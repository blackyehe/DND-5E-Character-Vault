import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { isValidObjectId } from 'mongoose'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth'
import { CustomContent } from '../models/CustomContent'
import { workshopLibrary } from '../lib/workshop-library'
import { sourceHash, inspectOrcbrew } from '../lib/orcbrew'
import { placeMonsterEntry } from '../lib/workshop-pack'
import { completeMonster, monsterActionSchema, validMonsterDraft } from '../lib/monster-workshop-schema'
import { diceValue } from '../../shared/monster-workshop'
import { rawMonster } from '../lib/monster-pack'
import { monsterEnrichmentPlan,monsterSnapshotId } from '../lib/monster-enrichment'
import standardIndex from '../data/srd-2014-compendium-index.json'
import { decodedPackData,storedPackData,MAX_PACK_BYTES } from '../lib/pack-storage'
import { readPackDocuments } from '../lib/pack-source'
const router=Router();router.use(requireAuth)
router.get('/enrichment',async(req,res)=>{
  const lib=await workshopLibrary(req.userId),plan=monsterEnrichmentPlan(lib.catalog.monsters),standard=monsterEnrichmentPlan(standardIndex.monsters)
  res.json({snapshot:plan.snapshot,revision:plan.revision,summary:plan.summary,standard:standard.summary,report:plan.report})
})
router.post('/enrichment',async(req,res)=>{
  const body=z.object({snapshot:z.literal(monsterSnapshotId),revision:z.string().length(64)}).strict().safeParse(req.body)
  if(!body.success)return res.status(400).json({error:'Review the current source snapshot before updating monsters.'})
  const lib=await workshopLibrary(req.userId),plan=monsterEnrichmentPlan(lib.catalog.monsters)
  if(plan.revision!==body.data.revision)return res.status(409).json({error:'The monster library changed. Review the current matches again.'})
  const data={snapshot:plan.snapshot,revision:plan.revision,appliedAt:new Date().toISOString(),entries:plan.supplements,report:plan.report}
  if(Buffer.byteLength(JSON.stringify(data))>12*1024*1024)return res.status(400).json({error:'This enrichment is too large to store safely.'})
  const saved=await CustomContent.findOneAndUpdate({userId:req.userId,type:'monster-enrichment',sourceHash:'active'},{$set:{data}},{upsert:true,new:true,runValidators:true}).select('_id').lean()
  res.json({id:String(saved!._id),snapshot:plan.snapshot,summary:plan.summary,message:'Source rules, lore and artwork added; original imports and IDs retained.'})
})
const filename=z.string().min(1).max(255).regex(/^[^<>:"/\\|?*\x00-\x1f]+\.orcbrew$/i)
const targetSchema=z.object({packId:z.string().regex(/^[a-f0-9]{24}$/).optional(),filename:filename.optional(),hash:z.string().max(128).optional()}).strict()
router.get('/library',async(req,res)=>{const [lib,actions]=await Promise.all([workshopLibrary(req.userId),CustomContent.find({userId:req.userId,type:'monster-action'}).select('_id data __v').sort({'data.name':1}).lean()]);const monsters=lib.packs.flatMap(pack=>pack.parsed.entries.monsters.flatMap(entry=>{const raw=entry.details as Record<string,unknown>,draft=validMonsterDraft(raw[':codex/monster']);return draft?[{...draft,published:{packId:pack.id,hash:sourceHash(String((lib.docs.find(d=>String(d._id)===pack.id)!.data as {source:string}).source)),revision:Number(raw[':codex/monster-revision'])||1,key:entry.contentKey,index:entry.index}}]:[]}));res.json({packs:lib.docs.map(doc=>({id:String(doc._id),filename:(doc.data as {filename:string}).filename,hash:sourceHash((doc.data as {source:string}).source),includeDisabled:(doc.data as {includeDisabled?:boolean}).includeDisabled===true})),monsters,actions:actions.flatMap(record=>{const parsed=monsterActionSchema.safeParse(record.data);return parsed.success?[{id:String(record._id),revision:record.__v??0,action:parsed.data}]:[]}),warnings:lib.warnings})})
router.post('/actions',async(req,res)=>{const parsed=monsterActionSchema.safeParse(req.body?.action);if(!parsed.success)return res.status(400).json({error:parsed.error.issues[0]?.message??'Invalid action.'});const action=parsed.data;if(!action.name.trim()||action.mode==='text'&&!action.description.trim()||(action.mode==='attack'||action.mode==='save'&&action.damage.trim())&&!diceValue(action.damage)||action.mode==='save'&&!action.description.trim())return res.status(400).json({error:'An action needs a name and readable rule.'});if(await CustomContent.countDocuments({userId:req.userId,type:'monster-action'})>=500)return res.status(400).json({error:'Your action library has reached 500 entries.'});const {librarySource:_,...data}=action;const record=await CustomContent.create({userId:req.userId,type:'monster-action',data});res.status(201).json({id:String(record._id),revision:0,action:data})})
router.put('/actions/:id',async(req,res)=>{const parsed=monsterActionSchema.safeParse(req.body?.action),revision=z.number().int().min(0).safeParse(req.body?.revision);if(!isValidObjectId(req.params.id)||!parsed.success||!revision.success)return res.status(400).json({error:'Check the action and revision.'});if(!parsed.data.name.trim()||parsed.data.mode==='text'&&!parsed.data.description.trim()||(parsed.data.mode==='attack'||parsed.data.mode==='save'&&parsed.data.damage.trim())&&!diceValue(parsed.data.damage)||parsed.data.mode==='save'&&!parsed.data.description.trim())return res.status(400).json({error:'An action needs a name and readable rule.'});const {librarySource:_,...data}=parsed.data;const record=await CustomContent.findOneAndUpdate({_id:req.params.id,userId:req.userId,type:'monster-action',__v:revision.data},{$set:{data},$inc:{__v:1}},{new:true,runValidators:true}).lean();if(!record)return res.status(409).json({error:'This action changed or is no longer available. Reload the library before editing.'});res.json({id:String(record._id),revision:record.__v,action:data})})
router.post('/export',async(req,res)=>{try{const draft=completeMonster(req.body?.draft),key=`codex-monster-${draft.id}`,source=placeMonsterEntry(undefined,key,rawMonster(draft,1),draft.id);inspectOrcbrew(source);res.json({source,filename:(draft.name.toLowerCase().replace(/[^a-z0-9]+/g,'-')||'monster')+'.orcbrew'})}catch(error){res.status(400).json({error:(error as Error).message})}})
router.post('/publish',async(req,res)=>{try{
  let draft=completeMonster(req.body?.draft);const parsed=targetSchema.safeParse(req.body?.target);if(!parsed.success)return res.status(400).json({error:'Choose a target pack or name a new Orcbrew pack.'});const target=parsed.data
  const doc=target.packId?(await readPackDocuments(req.userId,target.packId))[0]:null
  if(target.packId&&!doc)return res.status(404).json({error:'Target pack not found.'});if(!doc&&!target.filename)return res.status(400).json({error:'Name the new pack.'})
  const old=doc?decodedPackData(doc.data) as {source:string;filename:string;includeDisabled?:boolean}:undefined
  if(old&&sourceHash(old.source)!==target.hash)return res.status(409).json({error:'This pack changed. Reload the library and review the target before saving.'})
  if(draft.published&&draft.published.packId!==target.packId)draft={...draft,id:randomUUID(),published:undefined}
  const key=`codex-monster-${draft.id}`,previous=old?inspectOrcbrew(old.source).entries.monsters.find(e=>(e.details as Record<string,unknown>)[':codex/monster']&&((e.details as Record<string,unknown>)[':codex/monster'] as {id:string}).id===draft.id):undefined
  const revision=Number((previous?.details as Record<string,unknown>|undefined)?.[':codex/monster-revision'])||0
  if((draft.published?.revision??0)!==revision)return res.status(409).json({error:'This creature has a newer saved revision. Reopen it from the library.'})
  const source=placeMonsterEntry(old?.source,key,rawMonster(draft,revision+1),draft.id);if(Buffer.byteLength(source)>MAX_PACK_BYTES)return res.status(400).json({error:'The pack would exceed 64 MB. Choose a new pack.'});inspectOrcbrew(source)
  const hash=sourceHash(source),data=storedPackData({...old,filename:old?.filename??target.filename!,source,includeDisabled:old?.includeDisabled??false})
  let saved=doc?await CustomContent.findOneAndUpdate({_id:doc._id,userId:req.userId,updatedAt:doc.updatedAt},{$set:{data,sourceHash:hash}},{new:true}).lean():await CustomContent.findOne({userId:req.userId,type:'orcbrew',sourceHash:hash}).lean()
  if(!doc&&!saved)saved=(await CustomContent.create({userId:req.userId,type:'orcbrew',data,sourceHash:hash})).toObject()
  if(!saved)return res.status(409).json({error:'The pack changed while saving. Reload the library and retry.'})
  res.json({draft:{...draft,published:{packId:String(saved._id),hash,revision:revision+1,key}},message:'Monster saved to '+data.filename+'.'+(data.includeDisabled?' Disabled entries in this pack are enabled.':'')})
}catch(error){if((error as {code?:number}).code===11000)return res.status(409).json({error:'This pack was already saved or changed. Reload the library before trying again.'});res.status((error as {status?:number}).status??400).json({error:(error as Error).message})}})
export default router
