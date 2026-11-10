import {effectiveDefinition,effectiveDefinitions,saveNativeDefinition} from '../lib/definition-editions'
import {optionEdition,nativeDesired,savedPackEntry} from '../lib/native-definition-editing'
import {changedEntryFields} from '../../shared/compendium-editing'
import {Router} from 'express'
import {z} from 'zod'
import {isValidObjectId,Types} from 'mongoose'
import {CustomContent} from '../models/CustomContent'
import {optionAuthoringLibrary as library} from '../lib/option-authoring-library'
import {readPackDocuments} from '../lib/pack-source'
import {inspectOrcbrew,sourceHash} from '../lib/orcbrew'
import {storedPackData,MAX_PACK_BYTES} from '../lib/pack-storage'
import {placeOptionEntry} from '../lib/workshop-pack'
import {optionDraftSchema,optionRecord,optionKey,validatedOption} from '../lib/option-workshop'
import {manualOptionChoices} from '../lib/option-choices'
import {localSrdRule} from '../lib/srd-snapshot'
import {selectedOption} from '../../shared/option-reference'
import {activeWorkshopEntries} from '../lib/workshop-schema'
import {characterRuleLibrary} from '../lib/character-rule-library'
const router=Router(),queues=new Map<string,Promise<unknown>>()
const input=z.object({draft:optionDraftSchema,target:z.object({packId:z.string().regex(/^[a-f0-9]{24}$/i).optional(),filename:z.string().min(1).max(255).regex(/^[^<>:"/\\|?*\x00-\x1f]+\.orcbrew$/i).optional(),expectedHash:z.string().length(64).optional()}).strict(),expectedRevision:z.number().int().min(0)}).strict()
// Selection needs scoped character rules, never the authoring library's monster/item sources.
router.get('/parents',async(req,res)=>{const {catalog}=await characterRuleLibrary(req.userId,[]),standard=(localSrdRule('/compendium/races') as {results:{index:string;name:string}[]}).results;res.json([...standard,...activeWorkshopEntries(catalog.races,'races')].map(e=>({index:e.index,name:e.name,displayName:'displayName' in e?e.displayName:e.name})))})
router.get('/choices',async(req,res)=>{const {catalog}=await characterRuleLibrary(req.userId,['invocations','boons','selections','other']);res.set('Cache-Control','no-store').json(manualOptionChoices(catalog))})
router.get('/',async(req,res)=>{const {lib,rows}=await library(req.userId);const editions=await effectiveDefinitions(req.userId,rows.map(row=>({kind:row.draft.kind,source:row.entry})));const options=rows.map(({entry,draft,pack},position)=>{const effective=editions[position]!;return {...optionEdition(draft,effective.entry),published:{revision:Number(entry.optionRevision),index:entry.index,packId:pack.id,packHash:lib.hashes.get(pack.id)!,definitionRevision:effective.revision}}});res.json({packs:lib.packs.map(p=>({id:p.id,filename:p.filename,hash:lib.hashes.get(p.id)!})),options,warnings:lib.warnings})})
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
  const targetDoc=target.packId?(lib.docs??await readPackDocuments(req.userId,target.packId)).find(d=>String(d._id)===target.packId):undefined
  if(target.packId&&(!isValidObjectId(target.packId)||!targetDoc))return res.status(404).json({error:'Pack not found.'})
  if(!targetDoc&&!target.filename)return res.status(400).json({error:'Name the new pack.'})
  const old=targetDoc?.data as {filename:string;source:string;includeDisabled?:boolean}|undefined
  if(old&&sourceHash(old.source)!==target.expectedHash)return res.status(409).json({error:'The pack changed. Refresh its version before saving; your draft is kept.'})
  const effective=latest?await effectiveDefinition(req.userId,draft.kind,latest.entry):undefined
  if((effective?.revision??0)!==(draft.published?.definitionRevision??0))return res.status(409).json({error:'This definition changed in another editor. Reopen the saved version; your draft is kept.'})
  const aliases=latest?[latest.entry.index,...((latest.entry.details as Record<string,unknown>)[':codex/previous-indexes'] as string[]??[])]:[]
  const source=placeOptionEntry(old?.source,draft.kind,optionKey(draft.id),optionRecord(draft,expectedRevision+1,aliases,effective?.entry as import('../lib/orcbrew').OrcbrewEntry|undefined),draft.id)
  if(Buffer.byteLength(source)>MAX_PACK_BYTES)return res.status(400).json({error:'This pack would exceed 64 MB. Choose another pack for the new option.'})
  const inspected=inspectOrcbrew(source),entry=inspected.entries[draft.kind].find(e=>e.optionId===draft.id);if(!entry||entry.disabled&&!old?.includeDisabled)return res.status(400).json({error:'The option could not be read as active content. Choose an enabled pack.'})
  const hash=sourceHash(source),data=storedPackData({...old,filename:old?.filename??target.filename!,source},{report:inspected.report})
  const id=String(targetDoc?._id??new Types.ObjectId()),after=savedPackEntry(draft.kind,inspected,{id,filename:old?.filename??target.filename!,includeDisabled:old?.includeDisabled},entry.index)
  const desired=nativeDesired(draft.kind,after,latest&&effective?changedEntryFields(latest.entry,effective.entry):undefined,draft)
  const result=await saveNativeDefinition(req.userId,draft.kind,latest?.entry,after,draft.published?.definitionRevision??0,desired,async session=>targetDoc?await CustomContent.findOneAndUpdate({_id:targetDoc._id,userId:req.userId,type:'orcbrew',updatedAt:targetDoc.updatedAt,...(targetDoc.sourceHash?{sourceHash:targetDoc.sourceHash}:{})},{$set:{data,sourceHash:hash}},{new:true,session}).lean():(await CustomContent.create([{_id:id,userId:req.userId,type:'orcbrew',data,sourceHash:hash}],{session}))[0])
  const doc=result.saved

  res.json({draft:{...draft,published:{revision:expectedRevision+1,index:entry.index,packId:String(doc._id),packHash:hash,definitionRevision:result.revision}},pack:{id:String(doc._id),filename:old?.filename??target.filename!,hash},message:'Option saved to your pack. Review affected characters below to apply these changes.'})
 }catch(e){const duplicate=(e as {code?:number}).code===11000;res.status(duplicate?409:(e as {status?:number}).status??400).json({error:duplicate?'This pack already exists in your library.':(e as Error).message})}
 finally{release();if(queues.get(owner)===chain)queues.delete(owner)}
})
export default router
