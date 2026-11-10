import {effectiveDefinition,effectiveDefinitions,saveNativeDefinition} from '../lib/definition-editions'
import {spellEdition,nativeDesired,savedPackEntry} from '../lib/native-definition-editing'
import {changedEntryFields} from '../../shared/compendium-editing'
import {Router} from 'express'
import {z} from 'zod'
import {isValidObjectId,Types} from 'mongoose'
import {CustomContent} from '../models/CustomContent'
import {authoringPacks} from '../lib/option-authoring-library'
import {readPackDocuments} from '../lib/pack-source'
import {inspectOrcbrew,sourceHash} from '../lib/orcbrew'
import {storedPackData,MAX_PACK_BYTES} from '../lib/pack-storage'
import {placeNativeEntry} from '../lib/workshop-pack'
import {spellDraftSchema,spellRecord,spellKey,validatedSpell,nativeSpell} from '../lib/spell-workshop'
const router=Router(),queues=new Map<string,Promise<unknown>>()
const input=z.object({draft:spellDraftSchema,target:z.object({packId:z.string().regex(/^[a-f0-9]{24}$/i).optional(),filename:z.string().min(1).max(255).regex(/^[^<>:"/\\|?*\x00-\x1f]+\.orcbrew$/i).optional(),expectedHash:z.string().length(64).optional()}).strict(),expectedRevision:z.number().int().min(0)}).strict()
async function library(owner:string|undefined){const lib=await authoringPacks(owner,['spells']);return {lib,rows:lib.packs.flatMap(pack=>pack.parsed.entries.spells.flatMap(entry=>{const draft=nativeSpell(entry);return draft?[{pack,entry,draft}]:[]}))}}
router.get('/',async(req,res)=>{const {lib,rows}=await library(req.userId);const editions=await effectiveDefinitions(req.userId,rows.map(row=>({kind:row.draft.kind,source:row.entry})));const spells=rows.map(({entry,draft,pack},position)=>{const effective=editions[position]!;return {...spellEdition(draft,effective.entry),published:{revision:Number(entry.spellRevision),index:entry.index,packId:pack.id,packHash:lib.hashes.get(pack.id)!,definitionRevision:effective.revision}}});res.json({packs:lib.packs.map(p=>({id:p.id,filename:p.filename,hash:lib.hashes.get(p.id)!})),spells,warnings:lib.warnings})})
router.post('/publish',async(req,res)=>{
 const parsed=input.safeParse(req.body);if(!parsed.success)return res.status(400).json({error:parsed.error.issues[0]?.message??'Check the spell.'})
 const owner=String(req.userId),previous=queues.get(owner)??Promise.resolve();let release!:()=>void;const own=new Promise<void>(r=>release=r),chain=previous.catch(()=>{}).then(()=>own);queues.set(owner,chain);await previous.catch(()=>{})
 try{
  const draft=validatedSpell(parsed.data.draft),{target,expectedRevision}=parsed.data,{lib,rows}=await library(req.userId),existing=rows.filter(r=>r.draft.id===draft.id)
  if(existing.length>1)return res.status(409).json({error:'This spell exists in multiple packs. Resolve the duplicate before editing.'})
  const latest=existing[0]
  if((latest?Number(latest.entry.spellRevision):0)!==expectedRevision||latest&&latest.draft.kind!==draft.kind)return res.status(409).json({error:'This spell changed or was deleted. Reopen its saved version.'})
  if(latest&&target.packId!==latest.pack.id)return res.status(409).json({error:'Save changes into the original pack. Start a new draft to create another spell.'})
  if(draft.published&&!latest)return res.status(409).json({error:'This spell source was removed. Restore its pack before saving.'})
  const targetDoc=target.packId?(lib.docs??await readPackDocuments(req.userId,target.packId)).find(d=>String(d._id)===target.packId):undefined
  if(target.packId&&(!isValidObjectId(target.packId)||!targetDoc))return res.status(404).json({error:'Pack not found.'})
  if(!targetDoc&&!target.filename)return res.status(400).json({error:'Name the new pack.'})
  const old=targetDoc?.data as {filename:string;source:string;includeDisabled?:boolean}|undefined
  if(old&&sourceHash(old.source)!==target.expectedHash)return res.status(409).json({error:'The pack changed. Refresh its version before saving; your draft is kept.'})
  const effective=latest?await effectiveDefinition(req.userId,draft.kind,latest.entry):undefined
  if((effective?.revision??0)!==(draft.published?.definitionRevision??0))return res.status(409).json({error:'This definition changed in another editor. Reopen the saved version; your draft is kept.'})
  const aliases=latest?[latest.entry.index,...((latest.entry.details as Record<string,unknown>)[':codex/previous-indexes'] as string[]??[])]:[]
  const source=placeNativeEntry(old?.source,'spells',spellKey(draft.id),spellRecord(draft,expectedRevision+1,aliases,effective?.entry as import('../lib/orcbrew').OrcbrewEntry|undefined),draft.id,':codex/spell')
  if(Buffer.byteLength(source)>MAX_PACK_BYTES)return res.status(400).json({error:'This pack would exceed 64 MB. Choose another pack for the new spell.'})
  const inspected=inspectOrcbrew(source),entry=inspected.entries[draft.kind].find(e=>e.spellId===draft.id);if(!entry||entry.disabled&&!old?.includeDisabled)return res.status(400).json({error:'The spell could not be read as active content. Choose an enabled pack.'})
  const hash=sourceHash(source),data=storedPackData({...old,filename:old?.filename??target.filename!,source},{report:inspected.report})
  const id=String(targetDoc?._id??new Types.ObjectId()),after=savedPackEntry(draft.kind,inspected,{id,filename:old?.filename??target.filename!,includeDisabled:old?.includeDisabled},entry.index)
  const desired=nativeDesired(draft.kind,after,latest&&effective?changedEntryFields(latest.entry,effective.entry):undefined,draft)
  const result=await saveNativeDefinition(req.userId,draft.kind,latest?.entry,after,draft.published?.definitionRevision??0,desired,async session=>targetDoc?await CustomContent.findOneAndUpdate({_id:targetDoc._id,userId:req.userId,type:'orcbrew',updatedAt:targetDoc.updatedAt,...(targetDoc.sourceHash?{sourceHash:targetDoc.sourceHash}:{})},{$set:{data,sourceHash:hash}},{new:true,session}).lean():(await CustomContent.create([{_id:id,userId:req.userId,type:'orcbrew',data,sourceHash:hash}],{session}))[0])
  const doc=result.saved

  res.json({draft:{...draft,published:{revision:expectedRevision+1,index:entry.index,packId:String(doc._id),packHash:hash,definitionRevision:result.revision}},pack:{id:String(doc._id),filename:old?.filename??target.filename!,hash},message:'Spell saved to your pack. Review affected characters below to apply these changes.'})
 }catch(e){const duplicate=(e as {code?:number}).code===11000;res.status(duplicate?409:(e as {status?:number}).status??400).json({error:duplicate?'This pack already exists in your library.':(e as Error).message})}
 finally{release();if(queues.get(owner)===chain)queues.delete(owner)}
})
export default router
