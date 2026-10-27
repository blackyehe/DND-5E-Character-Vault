import { env } from '../env'
import { Router } from 'express'
import { storedPackData,MAX_PACK_BYTES } from '../lib/pack-storage'
import { isValidObjectId } from 'mongoose'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth'
import { CustomContent } from '../models/CustomContent'
import { Character } from '../models/Character'
import { workshopDraftSchema, validatedDraft } from '../lib/workshop-schema'
import { workshopLibrary, synchronizeWorkshopCharacters } from '../lib/workshop-library'
import { compactDraft, compileWorkshopEntry, placeWorkshopEntry, workshopKey } from '../lib/workshop-pack'
import { inspectOrcbrew, sourceHash } from '../lib/orcbrew'
import { workshopFromEntry, workshopSection, type WorkshopDraft } from '../../shared/homebrew-workshop'
import { applyWorkshopRules } from '../../shared/workshop-character'

const router=Router();router.use(requireAuth)
const filename=z.string().min(1).max(255).regex(/^[^<>:"/\\|?*\x00-\x1f]+\.orcbrew$/i)
const saveSchema=z.object({draft:workshopDraftSchema,target:z.object({packId:z.string().optional(),filename:filename.optional(),expectedHash:z.string().optional()}),expectedRevision:z.number().int().min(0)})
const queues=new Map<string,Promise<unknown>>()
async function locked<T>(key:string,run:()=>Promise<T>){const previous=queues.get(key)??Promise.resolve();let release!:()=>void;const own=new Promise<void>(resolve=>{release=resolve});const chain=previous.catch(()=>{}).then(()=>own);queues.set(key,chain);await previous.catch(()=>{});try{return await run()}finally{release();if(queues.get(key)===chain)queues.delete(key)}}
router.get('/library',async(req,res)=>{
  const lib=await workshopLibrary(req.userId)
  res.json({packs:lib.packs.map(p=>({id:p.id,filename:p.filename,hash:sourceHash(String((lib.docs.find(d=>String(d._id)===p.id)!.data as {source:string}).source)),entries:[...p.parsed.entries.classes,...p.parsed.entries.subclasses,...p.parsed.entries.races].map(e=>e.index)})),rules:lib.rules.filter(r=>r.revision>0).map(r=>({id:r.id,revision:r.revision,index:r.index,previousIndexes:r.previousIndexes})),warnings:lib.warnings})
})
router.get('/backup',async(req,res)=>{
  const [content,characters,lib]=await Promise.all([CustomContent.find({userId:req.userId}).lean(),Character.find({userId:req.userId}).lean(),workshopLibrary(req.userId)])
  const strip=(value:unknown)=>{const {_id,userId,__v,...record}=value as Record<string,unknown>;return {id:String(_id),...record}}
  res.attachment('codex-of-heroes-backup.json').json({format:'codex-of-heroes-backup',version:1,createdAt:new Date().toISOString(),content:content.map(strip),characters:characters.map(c=>strip(applyWorkshopRules(c as never,lib.rules,lib.initial)))})
})
async function prepare(draft:WorkshopDraft,userId:string|undefined){
  const lib=await workshopLibrary(userId),kind=workshopSection(draft.kind)
  const latest=lib.rules.find(r=>r.id===draft.id)
  const origin=lib.catalog[kind].find(e=>e.index===draft.imported?.index)
  if(draft.imported&&!origin)throw Object.assign(new Error('The source definition has changed or was removed. Reopen its latest version from the library.'),{status:409})
  const originPack=origin?lib.packs.find(p=>p.parsed.entries[kind].some(e=>e.index===origin.index)):undefined
  const source=originPack?String((lib.docs.find(d=>String(d._id)===originPack.id)!.data as {source:string}).source):undefined
  const spellReferences=new Map<string,{key:string;level:number}>()
  for(const spell of lib.catalog.spells){const ref={key:spell.contentKey,level:Number(spell.level)};spellReferences.set(spell.index,ref);for(const alias of spell.aliases as string[])spellReferences.set(alias,ref)}
  // SRD IDs have no homebrew prefix; their levels are fetched from the local SRD service.
  const {readSrdRule}=await import('../lib/srd-client')
  for(const index of [...draft.magic.spellList,...(draft.race?.spells.map(s=>s.index)??[])]){if(spellReferences.has(index))continue
    const matching=lib.catalog.spells.filter(s=>s.contentKey===index)
    if(matching.length===1){spellReferences.set(index,{key:matching[0].contentKey,level:Number(matching[0].level)});continue}
    if(!/^[a-z0-9][a-z0-9-]*$/.test(index)||index.startsWith('homebrew-'))continue
    try{const spell=await readSrdRule(env.SRD_API_URL,`spells/${index}`) as {index:string;level:number}|null;if(spell)spellReferences.set(index,{key:spell.index,level:spell.level})}catch{/* Unresolved references are reported by the pack compiler. */}
  }
  // An unchanged legacy reference need not block an unrelated class edit.
  const originalCasting=(origin?.details as Record<string,unknown>|undefined)?.[':spellcasting'] as Record<string,unknown>|undefined
  for(const [level,values]of Object.entries(originalCasting?.[':spell-list'] as Record<string,unknown>??{}))if(Array.isArray(values)&&/^\d$/.test(level))for(const value of values){const key=String(value).replace(/^:/,'');if(!spellReferences.has(key))spellReferences.set(key,{key,level:Number(level)})}
  const parentRule=lib.rules.find(r=>r.draft.kind==='class'&&(r.index===draft.parentClass||r.previousIndexes.includes(draft.parentClass)))
  const parent=lib.catalog.classes.find(e=>e.index===(parentRule?.index??draft.parentClass))
  if(parent)draft.parentClass=parent.index
  const parentKey=parent?.contentKey??draft.parentClass
  if(draft.kind==='subclass'&&!/^[a-zA-Z0-9_./-]+$/.test(parentKey))throw Object.assign(new Error('Choose a valid parent class.'),{status:400})
  const savedBaseline=origin?validatedDraft((origin.details as Record<string,unknown>)[':codex/baseline']):null
  let baseline=savedBaseline??(origin?workshopFromEntry(origin,draft.kind):draft)
  baseline={...compactDraft(baseline),id:draft.id,features:savedBaseline?baseline.features:baseline.features.map(f=>({...f,id:draft.features.find(n=>f.originalIndex!==undefined&&n.originalIndex===f.originalIndex||f.originalSelection!==undefined&&n.originalSelection===f.originalSelection||f.name===n.name&&f.level===n.level)?.id??f.id}))}
  const previousIndexes=[...new Set([...(latest?.previousIndexes??[]),...(origin?[origin.index,...origin.aliases as string[]]:[])])]
  const previousNames=[...new Set([...(latest?.previousNames??[]),...(origin?[origin.name]:[])])]
  return {lib,latest,origin,source,spellReferences,parentKey,baseline,previousIndexes,previousNames,originPack}
}
router.post('/export',async(req,res)=>{
  const parsed=workshopDraftSchema.safeParse(req.body?.draft)
  if(!parsed.success)return res.status(400).json({error:parsed.error.issues[0]?.message??'Invalid draft'})
  try{const draft=parsed.data as WorkshopDraft,p=await prepare(draft,req.userId),compiled=compileWorkshopEntry(draft,p.source,p.origin,p.latest?.revision??1,p.previousIndexes,p.previousNames,p.spellReferences,p.parentKey,p.baseline)
    const source=placeWorkshopEntry(undefined,compiled,draft.kind,workshopKey(draft),false)
    inspectOrcbrew(source)
    res.json({filename:`${draft.name.replace(/[^a-z0-9]+/gi,'-').toLowerCase()}.orcbrew`,source,warnings:['DMV receives its supported class fields and readable rule descriptions. Advanced trackers, exact spell versions, and custom choices keep full automation on this site. Use the complete site backup to preserve everything.']})
  }catch(error){res.status((error as {status?:number}).status??400).json({error:(error as Error).message})}
})
router.post('/publish',async(req,res)=>{
  const parsed=saveSchema.safeParse(req.body)
  if(!parsed.success)return res.status(400).json({error:parsed.error.issues[0]?.message??'Invalid publication'})
  return locked(String(req.userId),async()=>{
    try{const draft=parsed.data.draft as WorkshopDraft,{target,expectedRevision}=parsed.data,p=await prepare(draft,req.userId)
      if((p.latest?.revision??0)!==expectedRevision)return res.status(409).json({error:'This class has a newer saved revision. Reopen it before saving your changes.'})
      const targetDoc=target.packId?p.lib.docs.find(d=>String(d._id)===target.packId):undefined
      if(target.packId&&(!isValidObjectId(target.packId)||!targetDoc))return res.status(404).json({error:'Target pack not found'})
      if(!targetDoc&&!target.filename)return res.status(400).json({error:'Name the new Orcbrew pack.'})
      const oldData=targetDoc?.data as {filename:string;source:string;includeDisabled?:boolean}|undefined
      if(oldData&&target.expectedHash!==sourceHash(oldData.source))return res.status(409).json({error:'This pack changed while you were editing. Reload the pack list and review the target before saving.'})
      const targetPack=p.lib.packs.find(pack=>pack.id===target.packId),targetOrigin=targetPack?.parsed.entries[workshopSection(draft.kind)].find(e=>e.index===p.origin?.index||((e.details as Record<string,unknown>)[':codex/workshop'] as WorkshopDraft|undefined)?.id===draft.id),hasOrigin=!!targetOrigin
      const compiled=compileWorkshopEntry(draft,hasOrigin?oldData!.source:p.source,targetOrigin??p.origin,(p.latest?.revision??0)+1,[...new Set([...p.previousIndexes,...(targetOrigin?[targetOrigin.index]:[])])],p.previousNames,p.spellReferences,p.parentKey,p.baseline)
      const source=placeWorkshopEntry(oldData?.source,compiled,draft.kind,workshopKey(draft),hasOrigin)
      if(Buffer.byteLength(source,'utf8')>MAX_PACK_BYTES)return res.status(400).json({error:'The revised pack exceeds 64 MB. Save into a new pack instead.'})
      const inspected=inspectOrcbrew(source),entry=inspected.entries[workshopSection(draft.kind)].find(e=>(e.details as Record<string,unknown>)[':codex/workshop']&&( (e.details as Record<string,unknown>)[':codex/workshop'] as WorkshopDraft).id===draft.id)
      if(!entry)throw new Error('The revised pack could not be read back.')
      const data=storedPackData({...oldData,filename:oldData?.filename??target.filename!,source,includeDisabled:oldData?.includeDisabled??false}),hash=sourceHash(source)
      if(entry.disabled&&!data.includeDisabled)return res.status(400).json({error:'This pack is disabled. Enable its disabled content in the Compendium or choose another pack.'})
      const duplicate=await CustomContent.findOne({userId:req.userId,type:'orcbrew',sourceHash:hash,...(targetDoc?{_id:{$ne:targetDoc._id}}:{})}).lean()
      if(duplicate)return res.status(409).json({error:'An identical pack is already in your library.'})
      const doc=targetDoc?await CustomContent.findOneAndUpdate({_id:targetDoc._id,userId:req.userId,updatedAt:targetDoc.updatedAt},{$set:{data,sourceHash:hash}},{new:true}).lean():await CustomContent.create({userId:req.userId,type:'orcbrew',data,sourceHash:hash})
      if(!doc)return res.status(409).json({error:'The pack changed during saving. Reload and try again.'})
      const library=await workshopLibrary(req.userId)
      let updates:{updated:number;review:number;deferred:number};try{updates=await synchronizeWorkshopCharacters(req.userId,library)}catch{updates={updated:0,review:0,deferred:1}}
      res.json({draft:{...((entry.details as Record<string,unknown>)[':codex/workshop'] as WorkshopDraft),imported:{index:entry.index,contentKey:entry.contentKey,sources:[data.filename],raw:entry.details},published:{revision:(p.latest?.revision??0)+1,index:entry.index,packId:String(doc._id),packHash:hash}},updates})
    }catch(error){return res.status((error as {status?:number}).status??400).json({error:(error as Error).message})}
  })
})
export default router
