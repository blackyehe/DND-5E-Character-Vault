import {randomUUID} from 'node:crypto'
import {Types} from 'mongoose'
import {env} from '../env'
import {CustomContent} from '../models/CustomContent'
import {CompendiumComponent,CompendiumComponentObject} from '../models/CompendiumComponent'
import {PackPreparationGeneration as Generation,PackPreparationJob as Job,PackPreparationLease as Lease} from '../models/PackPreparation'
import {COMPONENT_VERSION,componentContext,componentMetadata,prepareComponent,type PackMetadata} from './compendium-components'
import {preparedReaderEnabled} from './compendium-prepared'
import {ORCBREW_KINDS} from './orcbrew'

export const PACK_PREPARATION_VERSION='automatic-pack-preparation-1'
export const PACK_PREPARATION_LIMITS={source:16*1024*1024,storedSource:32*1024*1024,generation:12*1024*1024,owner:32*1024*1024,global:64*1024*1024,objects:10000,packs:512,jobs:4096,leaseMs:30000,graceMs:600000,runMs:90000,jobsPerRun:128} as const
const queryOptions={maxTimeMS:2000,timeoutMS:4000},week=7*86400000
export const packPreparationEnabled=(owner:string)=>env.COMPENDIUM_PACK_PREPARATION==='on'&&Types.ObjectId.isValid(owner)&&preparedReaderEnabled(owner)
class WorkStopped extends Error {}
class StorageLimit extends Error {}
let initialized:Promise<void>|undefined
async function initialize(){
 initialized??=(async()=>{for(const model of [Job,Lease,Generation,CompendiumComponent,CompendiumComponentObject]){await model.createCollection(queryOptions);await model.createIndexes(queryOptions)}})().catch(error=>{initialized=undefined;throw error})
 await initialized
}
async function acquire(id:string,token:string,ms:number){
 try{return !!await Lease.findOneAndUpdate({_id:id,until:{$lte:new Date()}},{$set:{token,until:new Date(Date.now()+ms)}},{...queryOptions,upsert:true,returnDocument:'after'}).lean()}
 catch(error){if((error as {code?:number}).code===11000)return false;throw error}
}
function validManifest(value:{version?:string;generation?:string;counts?:Record<string,number>;bytes?:Record<string,number>}|undefined){
 return value?.version===COMPONENT_VERSION&&typeof value.generation==='string'&&ORCBREW_KINDS.every(k=>Number.isSafeInteger(value.counts?.[k])&&value.counts![k]!>=0&&value.counts![k]!<=100000&&Number.isSafeInteger(value.bytes?.[k])&&value.bytes![k]!>=2&&value.bytes![k]!<=64*1024*1024&&(value.counts![k]!==0||value.bytes![k]===2))
}
export async function packPreparationStatus(owner:string,id:string){
 const pack=await currentPack(new Types.ObjectId(owner),new Types.ObjectId(id));if(!pack)return null
 const context=componentContext(pack),enabled=packPreparationEnabled(owner)
 const [manifest,job]=await Promise.all([
  CompendiumComponent.findOne({userId:owner,context}).select('version generation counts bytes sources').setOptions(queryOptions).lean(),
  Job.findOne({_id:id,userId:owner,version:PACK_PREPARATION_VERSION,context}).select('state reason').setOptions(queryOptions).lean(),
 ])
 const ready=validManifest(manifest??undefined)
 return {enabled,state:ready?'ready':!enabled?'off':job&&['queued','running','blocked','cancelled'].includes(job.state)?job.state:'pending',fullDetails:ready&&manifest?.sources===true,...!ready&&job?.reason?{reason:job.reason}:{}}
}
/** Canonical source metadata is the durable dirty marker even if a wake was lost. */
async function reconcile(owner:string){
 const packs=await componentMetadata(owner)
 if(packs.length>PACK_PREPARATION_LIMITS.packs)return
 const contexts=packs.map(componentContext).filter((c):c is string=>!!c)
 // Retirement starts when the source context stops being current, not when a
 // possibly weeks-old generation was first created.
 await Generation.updateMany({userId:owner,context:{$nin:contexts},obsoleteAt:{$exists:false}},{$set:{obsoleteAt:new Date()}},queryOptions)
 const manifests=await CompendiumComponent.find({userId:owner,context:{$in:contexts}}).select('version context generation counts bytes').setOptions(queryOptions).lean()
 const ready=new Set(manifests.filter(validManifest).map(m=>m.context))
 const jobs=await Job.find({userId:owner}).setOptions(queryOptions).lean(),byId=new Map(jobs.map(j=>[String(j._id),j]))
 const total=await Job.countDocuments().setOptions(queryOptions)
 let added=0
 const updates=[]
 for(const pack of packs){
  const context=componentContext(pack),previous=byId.get(String(pack._id));if(!context||ready.has(context))continue
  if(previous?.version===PACK_PREPARATION_VERSION&&previous.context===context&&previous.state!=='ready'&&previous.state!=='cancelled'&&!(previous.state==='blocked'&&previous.reason==='disabled'))continue
  if(!previous&&(jobs.length+added>=PACK_PREPARATION_LIMITS.packs||total+added>=PACK_PREPARATION_LIMITS.jobs))break
  if(!previous)added++
  updates.push({updateOne:{filter:{_id:pack._id,userId:pack.userId,...previous?{context:previous.context,version:previous.version}:{}},update:{$set:{version:PACK_PREPARATION_VERSION,context,state:'queued',attempts:0,runAt:new Date(),updatedAt:new Date()},$unset:{token:1,leaseUntil:1,generation:1,reason:1,expiresAt:1}},upsert:!previous}})
 }
 if(updates.length)try{await Job.bulkWrite(updates,{ordered:false,timeoutMS:4000})}catch(error){if((error as {code?:number}).code!==11000)throw error}
 await Job.updateMany({userId:owner,_id:{$nin:packs.map(p=>p._id)},state:{$ne:'cancelled'}},{$set:{state:'cancelled',updatedAt:new Date(),expiresAt:new Date(Date.now()+week)}},queryOptions)
}
async function currentPack(owner:Types.ObjectId,id:Types.ObjectId){return CustomContent.findOne({_id:id,userId:owner,type:'orcbrew'}).select('_id userId sourceHash updatedAt data.filename data.includeDisabled data.sourceEncoding data.sourceBytes').setOptions(queryOptions).lean() as unknown as Promise<PackMetadata|null>}

/** Delete only automatic derived generations, with a reader/in-flight grace period. */
async function cleanObsolete(check:()=>Promise<void>){
 const records=await Generation.find({version:PACK_PREPARATION_VERSION,createdAt:{$lt:new Date(Date.now()-PACK_PREPARATION_LIMITS.graceMs)}}).sort({checkedAt:1,createdAt:1}).limit(64).setOptions(queryOptions).lean()
 if(!records.length)return
 const [sources,manifests,active]=await Promise.all([
  CustomContent.find({type:'orcbrew',$or:records.map(r=>({_id:r.packId,userId:r.userId}))}).select('_id userId sourceHash updatedAt data.filename data.includeDisabled').setOptions(queryOptions).lean(),
  CompendiumComponent.find({$or:records.map(r=>({userId:r.userId,generation:r._id}))}).select('context generation userId').setOptions(queryOptions).lean(),
  Job.find({version:PACK_PREPARATION_VERSION,generation:{$in:records.map(r=>r._id)},state:'running',leaseUntil:{$gt:new Date()}}).select('generation userId').setOptions(queryOptions).lean(),
 ])
 const retained=[]
 for(const record of records){
  await check()
  const pack=sources.find(p=>String(p._id)===String(record.packId)&&String(p.userId)===String(record.userId)) as PackMetadata|undefined
  const manifest=manifests.find(m=>m.generation===record._id&&String(m.userId)===String(record.userId))
  const running=active.some(j=>j.generation===record._id&&String(j.userId)===String(record.userId))
  if(running||manifest&&pack&&componentContext(pack)===manifest.context){retained.push({updateOne:{filter:{_id:record._id,userId:record.userId},update:{$set:{checkedAt:new Date(),...manifest?{state:'published'}:{}},$unset:{obsoleteAt:1}}}});continue}
  if(!record.obsoleteAt||record.obsoleteAt.getTime()>Date.now()-PACK_PREPARATION_LIMITS.graceMs){retained.push({updateOne:{filter:{_id:record._id,userId:record.userId},update:{$set:{checkedAt:new Date(),...!record.obsoleteAt?{obsoleteAt:new Date()}: {}}}}});continue}
  await check()
  if(manifest)await CompendiumComponent.deleteOne({userId:record.userId,generation:record._id,context:manifest.context}).setOptions(queryOptions)
  await CompendiumComponentObject.deleteMany({userId:record.userId,generation:record._id}).setOptions(queryOptions)
  await Generation.deleteOne({_id:record._id,userId:record.userId}).setOptions(queryOptions)
 }
 if(retained.length)await Generation.bulkWrite(retained,{ordered:false,timeoutMS:4000})
}

/** One global lease bounds cross-instance concurrency; jobs survive invocations. */
export async function runPackPreparation(owner:string,options:{force?:boolean;deadline?:number}={}){
 if(!packPreparationEnabled(owner))return
 const limits=PACK_PREPARATION_LIMITS,deadline=Math.min(options.deadline??Infinity,performance.now()+limits.runMs)
 await initialize()
 const token=randomUUID()
 if(!options.force&&!await acquire('idle:'+owner,token,60000))return
 await reconcile(owner)
 if(!await acquire('worker',token,limits.leaseMs))return
 let lastHeartbeat=0
 const check=async()=>{
  if(performance.now()+1000>=deadline)throw new WorkStopped('Preparation deadline reached')
  if(Date.now()-lastHeartbeat<2000)return
  const result=await Lease.updateOne({_id:'worker',token,until:{$gt:new Date()}},{$set:{until:new Date(Date.now()+limits.leaseMs)}},queryOptions)
  if(result.matchedCount!==1)throw new WorkStopped('Preparation lease ended')
  lastHeartbeat=Date.now()
 }
 try{
  await check();await cleanObsolete(check)
  const totals=await Generation.aggregate<{_id:Types.ObjectId;bytes:number}>([{$match:{version:PACK_PREPARATION_VERSION}},{$group:{_id:'$userId',bytes:{$sum:'$bytes'}}}]).option(queryOptions)
  const owners=new Map(totals.map(t=>[String(t._id),t.bytes]));let globalBytes=totals.reduce((n,t)=>n+t.bytes,0)
  for(let completed=0;completed<limits.jobsPerRun&&performance.now()+5000<deadline;completed++){
   await check()
   const now=new Date(),job=await Job.findOneAndUpdate({version:PACK_PREPARATION_VERSION,$or:[{state:'queued',runAt:{$lte:now}},{state:'running',leaseUntil:{$lte:now}}]},{$set:{state:'running',token,leaseUntil:new Date(Date.now()+limits.leaseMs),updatedAt:new Date()},$inc:{attempts:1}},{...queryOptions,sort:{runAt:1,_id:1},returnDocument:'after'}).lean()
   if(!job)break
   const filter={_id:job._id,userId:job.userId,token,context:job.context,state:'running' as const}
   if(!packPreparationEnabled(String(job.userId))){await Job.updateOne(filter,{$set:{state:'blocked',reason:'disabled',expiresAt:new Date(Date.now()+week)}},queryOptions);continue}
   const pack=await currentPack(job.userId,job._id),context=pack?componentContext(pack):null
   if(!pack||!context){await Job.updateOne(filter,{$set:{state:'cancelled',expiresAt:new Date(Date.now()+week)}},queryOptions);continue}
   if(context!==job.context){await Job.updateOne(filter,{$set:{context,state:'queued',attempts:0,runAt:new Date(),updatedAt:new Date()}},queryOptions);continue}
   const existing=await CompendiumComponent.findOne({userId:job.userId,context}).setOptions(queryOptions).lean()
   if(validManifest(existing??undefined)&&existing?.sources){await Job.updateOne(filter,{$set:{state:'ready',expiresAt:new Date(Date.now()+week)}},queryOptions);continue}
   const generation=randomUUID(),ownerKey=String(job.userId);let reserved=0
   await Generation.create({_id:generation,version:PACK_PREPARATION_VERSION,userId:job.userId,packId:job._id,context,state:'staging',bytes:0,objects:0,createdAt:new Date()})
   await Job.updateOne(filter,{$set:{generation}},queryOptions)
   const checkpoint=async(progress?:{bytes:number;objects:number})=>{
    await check()
    const alive=await Job.updateOne(filter,{$set:{leaseUntil:new Date(Date.now()+limits.leaseMs),updatedAt:new Date()}},queryOptions)
    if(alive.matchedCount!==1)throw new WorkStopped('Pack was superseded')
    if(progress){
     const delta=progress.bytes-reserved
     if(delta<0||globalBytes+delta>limits.global||(owners.get(ownerKey)??0)+delta>limits.owner)throw new StorageLimit('Automatic storage budget reached')
     const update=await Generation.updateOne({_id:generation,userId:job.userId,state:'staging'},{$set:{bytes:progress.bytes,objects:progress.objects}},queryOptions)
     if(update.matchedCount!==1)throw new WorkStopped('Generation reservation ended')
     globalBytes+=delta;owners.set(ownerKey,(owners.get(ownerKey)??0)+delta);reserved=progress.bytes
    }
   }
   try{
    await checkpoint()
    await prepareComponent(pack,{sources:true,background:{generation,deadline,maxSourceBytes:limits.source,maxStoredBytes:limits.storedSource,maxBytes:limits.generation,maxObjects:limits.objects,checkpoint}})
    await checkpoint()
    const published=await CompendiumComponent.findOne({userId:job.userId,context}).setOptions(queryOptions).lean()
    if(!validManifest(published??undefined))throw new Error('Prepared manifest was not published')
    if(published!.generation===generation)await Generation.updateOne({_id:generation,userId:job.userId},{$set:{state:'published'}},queryOptions)
    else{await CompendiumComponentObject.deleteMany({userId:job.userId,generation}).setOptions(queryOptions);await Generation.deleteOne({_id:generation,userId:job.userId}).setOptions(queryOptions);globalBytes-=reserved;owners.set(ownerKey,(owners.get(ownerKey)??0)-reserved)}
    await Job.updateOne(filter,{$set:{state:'ready',bytes:reserved,expiresAt:new Date(Date.now()+week),updatedAt:new Date()},$unset:{token:1,leaseUntil:1}},queryOptions)
   }catch(error){
    // Never remove a generation that successfully published before interruption.
    const published=await CompendiumComponent.exists({userId:job.userId,generation}).setOptions(queryOptions)
    if(!published){await CompendiumComponentObject.deleteMany({userId:job.userId,generation}).setOptions(queryOptions);await Generation.deleteOne({_id:generation,userId:job.userId}).setOptions(queryOptions);globalBytes-=reserved;owners.set(ownerKey,(owners.get(ownerKey)??0)-reserved)}
    const storage=error instanceof StorageLimit,limit=!storage&&/exceeds its limit/.test((error as Error).message),blocked=!storage&&(limit||job.attempts>=5)
    await Job.updateOne(filter,{$set:{state:blocked?'blocked':'queued',reason:storage?'storage-budget':limit?'size-limit':error instanceof WorkStopped?'interrupted':'preparation-unavailable',runAt:new Date(Date.now()+(storage?300000:Math.min(600000,30000*2**Math.min(job.attempts,5)))),updatedAt:new Date(),...(storage?{attempts:Math.max(0,job.attempts-1)}:{}),...(blocked?{expiresAt:new Date(Date.now()+week)}:{})},$unset:{token:1,leaseUntil:1}},queryOptions)
    if(error instanceof WorkStopped)break
   }
  }
 }finally{await Lease.updateOne({_id:'worker',token},{$set:{until:new Date(0)}},queryOptions)}
}
