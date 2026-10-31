import {Router} from 'express'
import {z} from 'zod'
import {isValidObjectId} from 'mongoose'
import {CustomContent} from '../models/CustomContent'
import {workshopLibrary} from '../lib/workshop-library'
import {inspectOrcbrew,sourceHash} from '../lib/orcbrew'
import {storedPackData,MAX_PACK_BYTES} from '../lib/pack-storage'
import {placeOptionEntry} from '../lib/workshop-pack'
import {nativeOption,optionDraftSchema,optionRecord,optionKey,validatedOption} from '../lib/option-workshop'
import {OPTION_KINDS} from '../../shared/option-kinds'
import {manualOptionChoices} from '../lib/option-choices'
import {localSrdRule} from '../lib/srd-snapshot'
import {selectedOption} from '../../shared/option-reference'
import {activeWorkshopEntries} from '../lib/workshop-schema'
import {characterRuleLibrary} from '../lib/character-rule-library'
const router=Router(),queues=new Map<string,Promise<unknown>>()
const input=z.object({draft:optionDraftSchema,target:z.object({packId:z.string().regex(/^[a-f0-9]{24}$/i).optional(),filename:z.string().min(1).max(255).regex(/^[^<>:"/\\|?*\x00-\x1f]+\.orcbrew$/i).optional(),expectedHash:z.string().length(64).optional()}).strict(),expectedRevision:z.number().int().min(0)}).strict()
async function library(owner:string|undefined){const lib=await workshopLibrary(owner);return {lib,rows:lib.packs.flatMap(pack=>OPTION_KINDS.flatMap(kind=>pack.parsed.entries[kind].flatMap(entry=>{const draft=nativeOption(entry);return draft?[{pack,entry,draft}]:[]})))}}
// Selection needs scoped character rules, never the authoring library's monster/item sources.
router.get('/parents',async(req,res)=>{const {catalog}=await characterRuleLibrary(req.userId,[]),standard=(localSrdRule('/compendium/races') as {results:{index:string;name:string}[]}).results;res.json([...standard,...activeWorkshopEntries(catalog.races,'races')].map(e=>({index:e.index,name:e.name,displayName:'displayName' in e?e.displayName:e.name})))})
router.get('/choices',async(req,res)=>{const {catalog}=await characterRuleLibrary(req.userId,['invocations','boons','selections','other']);res.set('Cache-Control','no-store').json(manualOptionChoices(catalog))})
router.get('/',async(req,res)=>{const {lib,rows}=await library(req.userId);res.json({packs:lib.packs.map(p=>({id:p.id,filename:p.filename,hash:sourceHash(String((lib.docs.find(d=>String(d._id)===p.id)!.data as {source:string}).source))})),options:rows.map(({entry,draft,pack})=>({...draft,published:{revision:Number(entry.optionRevision),index:entry.index,packId:pack.id,packHash:sourceHash(String((lib.docs.find(d=>String(d._id)===pack.id)!.data as {source:string}).source))}})),warnings:lib.warnings})})
router.post('/publish',async(req,res)=>{
 const parsed=input.safeParse(req.body);if(!parsed.success)return res.status(400).json({error:parsed.error.issues[0]?.message??'Check the option.'})
 const owner=String(req.userId),previous=queues.get(owner)??Promise.resolve();let release!:()=>void;const own=new Promise<void>(r=>release=r),chain=previous.catch(()=>{}).then(()=>own);queues.set(owner,chain);await previous.catch(()=>{})
 try{
  const draft=validatedOption(parsed.data.draft),{target,expectedRevision}=parsed.data,{lib,rows}=await library(req.userId),existing=rows.filter(r=>r.draft.id===draft.id)
  if(existing.length>1)return res.status(409).json({error:'This option exists in multiple packs. Resolve the duplicate before editing.'})
  if(draft.kind==='subraces'){const {catalog}=await characterRuleLibrary(req.userId,[]),id=draft.body.subrace!.parentIndex,standard=(localSrdRule('/compendium/races') as {results:{index:string;name:string}[]}).results,parent=selectedOption(catalog.races,id,'')??standard.find(e=>e.index===id);if(!parent)return res.status(400).json({error:'The parent race is unavailable. Restore it or select an available parent.'});draft.body.subrace!.parentName=parent.name}
  const latest=existing[0]
  if((latest?Number(latest.entry.optionRevision):0)!==expectedRevision||latest&&latest.draft.kind!==draft.kind)return res.status(409).json({error:'This option changed or was deleted. Reopen its saved version.'})
  if(latest&&target.packId!==latest.pack.id)return res.status(409).json({error:'Save changes into the original pack. Start a new draft to create another option.'})
  if(draft.published&&!latest)return res.status(409).json({error:'This option source was removed. Restore its pack before saving.'})
  const targetDoc=target.packId?lib.docs.find(d=>String(d._id)===target.packId):undefined
  if(target.packId&&(!isValidObjectId(target.packId)||!targetDoc))return res.status(404).json({error:'Pack not found.'})
  if(!targetDoc&&!target.filename)return res.status(400).json({error:'Name the new pack.'})
  const old=targetDoc?.data as {filename:string;source:string;includeDisabled?:boolean}|undefined
  if(old&&sourceHash(old.source)!==target.expectedHash)return res.status(409).json({error:'The pack changed. Refresh its version before saving; your draft is kept.'})
  const aliases=latest?[latest.entry.index,...((latest.entry.details as Record<string,unknown>)[':codex/previous-indexes'] as string[]??[])]:[]
  const source=placeOptionEntry(old?.source,draft.kind,optionKey(draft.id),optionRecord(draft,expectedRevision+1,aliases,latest?.entry),draft.id)
  if(Buffer.byteLength(source)>MAX_PACK_BYTES)return res.status(400).json({error:'This pack would exceed 64 MB. Choose another pack for the new option.'})
  const entry=inspectOrcbrew(source).entries[draft.kind].find(e=>e.optionId===draft.id);if(!entry||entry.disabled&&!old?.includeDisabled)return res.status(400).json({error:'The option could not be read as active content. Choose an enabled pack.'})
  const hash=sourceHash(source),data=storedPackData({...old,filename:old?.filename??target.filename!,source})
  const doc=targetDoc?await CustomContent.findOneAndUpdate({_id:targetDoc._id,userId:req.userId,type:'orcbrew',updatedAt:targetDoc.updatedAt},{$set:{data,sourceHash:hash}},{new:true}).lean():await CustomContent.create({userId:req.userId,type:'orcbrew',data,sourceHash:hash})
  if(!doc)return res.status(409).json({error:'The pack changed while saving. Your draft is kept.'})
  res.json({draft:{...draft,published:{revision:expectedRevision+1,index:entry.index,packId:String(doc._id),packHash:hash}},message:'Option saved to your pack. Existing characters keep their reviewed rules.'})
 }catch(e){const duplicate=(e as {code?:number}).code===11000;res.status(duplicate?409:400).json({error:duplicate?'This pack already exists in your library.':(e as Error).message})}
 finally{release();if(queues.get(owner)===chain)queues.delete(owner)}
})
export default router
