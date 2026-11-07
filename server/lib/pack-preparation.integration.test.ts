import {afterAll,afterEach,beforeAll,beforeEach,describe,expect,it,vi} from 'vitest'
import mongoose from 'mongoose'
import {randomUUID} from 'node:crypto'
import {env} from '../env'
import {CustomContent} from '../models/CustomContent'
import {CompendiumComponent,CompendiumComponentObject} from '../models/CompendiumComponent'
import {PackPreparationGeneration as Generation,PackPreparationJob as Job,PackPreparationLease as Lease} from '../models/PackPreparation'
import {COMPONENT_VERSION,componentContext,type PackMetadata} from './compendium-components'
import {PACK_PREPARATION_LIMITS as limits,PACK_PREPARATION_VERSION as version,packPreparationStatus,runPackPreparation} from './pack-preparation'
import {ORCBREW_KINDS,sourceHash} from './orcbrew'
import {storedPackData} from './pack-storage'
import {parsedPack} from './orcbrew-library'
import * as packSource from './pack-source'

const models=[CustomContent,CompendiumComponent,CompendiumComponentObject,Job,Lease,Generation]
const owner=new mongoose.Types.ObjectId(),other=new mongoose.Types.ObjectId()
const run=()=>runPackPreparation(String(owner),{force:true})
async function pack(){
 const source=';'+randomUUID()+'\n{:orcpub.dnd.e5/classes {:oracle {:name "Prepared Oracle" :description "Complete original rules" :hit-die 8}}}'
 return CustomContent.create({userId:owner,type:'orcbrew',sourceHash:sourceHash(source),data:storedPackData({filename:'isolated.orcbrew',source,includeDisabled:false})})
}
const context=(p:unknown)=>componentContext(p as PackMetadata)!
describe.skipIf(process.env.PACK_PREPARATION_TESTS!=='1')('isolated automatic pack preparation',()=>{
 beforeAll(async()=>{
  expect(env.MONGO_URI).toMatch(/^mongodb:\/\/127\.0\.0\.1:27017\/pack_preparation_tests_[a-f0-9]+(?:\?|$)/)
  expect(process.env.VERCEL).toBeUndefined();expect(env.COMPENDIUM_PACK_PREPARATION).toBe('on')
  expect(models.every(model=>model.base===mongoose)).toBe(true)
  await mongoose.connect(env.MONGO_URI,{autoCreate:false,autoIndex:false})
  expect(mongoose.connection.host).toBe('127.0.0.1');expect(mongoose.connection.name).toMatch(/^pack_preparation_tests_[a-f0-9]+$/)
  for(const model of models){await model.createCollection();await model.createIndexes()}
 })
 beforeEach(async()=>{for(const model of models)await model.collection.deleteMany({})})
 afterEach(()=>vi.restoreAllMocks())
 afterAll(async()=>{
  if(mongoose.connection.readyState===1&&mongoose.connection.host==='127.0.0.1'&&/^pack_preparation_tests_[a-f0-9]+$/.test(mongoose.connection.name))await mongoose.connection.dropDatabase()
  await mongoose.disconnect()
 })
 it('prepares current owned data once and accounts for the actual stored bytes',async()=>{
  const p=await pack(),before=p.updatedAt.toISOString();expect(await packPreparationStatus(String(other),String(p._id))).toBeNull();expect(await packPreparationStatus(String(owner),String(p._id))).toMatchObject({state:'pending',fullDetails:false});await run();await run()
  const ready=await CompendiumComponent.findOne({userId:owner,context:context(p)}).lean()
  expect(ready).toMatchObject({version:COMPONENT_VERSION,sources:true});expect(await Generation.countDocuments()).toBe(1)
  expect(await packPreparationStatus(String(owner),String(p._id))).toEqual({enabled:true,state:'ready',fullDetails:true})
  const ledger=await Generation.findOne().lean(),objects=await CompendiumComponentObject.find({generation:ready!.generation}).lean()
  expect(ledger!.bytes).toBe(objects.reduce((n,o)=>n+mongoose.mongo.BSON.calculateObjectSize(o),0));expect(ledger!.objects).toBe(objects.length)
  expect((await CustomContent.findById(p._id).lean())!.updatedAt.toISOString()).toBe(before)
  await runPackPreparation(String(other),{force:true});expect(await Job.countDocuments({userId:other})).toBe(0)
 })
 it('coalesces concurrent workers across the shared lease',async()=>{
  await pack();await Promise.all([run(),run(),run()])
  expect(await Generation.countDocuments()).toBe(1);expect((await Job.findOne().lean())!.attempts).toBe(1)
 })
 it('reuses a resident exact parse after the owned size and revision check',async()=>{
  const p=await pack();parsedPack(p.data);const read=vi.spyOn(packSource,'readPackDocuments');await run();expect(read).not.toHaveBeenCalled();expect((await Job.findOne().lean())!.state).toBe('ready')
 })
 it('recovers an expired worker and removes its obsolete partial generation',async()=>{
  const p=await pack(),generation=randomUUID(),old=new Date(Date.now()-limits.graceMs-1000)
  await Job.create({_id:p._id,userId:owner,version,context:context(p),state:'running',attempts:1,runAt:old,updatedAt:old,leaseUntil:old,token:'expired',generation})
  await Lease.create({_id:'worker',until:old,token:'expired'})
  await Generation.create({_id:generation,userId:owner,packId:p._id,version,context:context(p),state:'staging',bytes:100,objects:1,createdAt:old,obsoleteAt:old})
  await CompendiumComponentObject.collection.insertOne({userId:owner,generation,createdAt:old,payload:Buffer.from('partial')})
  await run();expect(await Generation.findById(generation)).toBeNull();expect(await CompendiumComponentObject.countDocuments({generation})).toBe(0);expect((await Job.findOne().lean())!.state).toBe('ready')
 })
 it.each(['replace','delete'] as const)('never publishes a pack after it is changed by %s during preparation',async action=>{
  const p=await pack(),original=CompendiumComponentObject.collection.insertMany.bind(CompendiumComponentObject.collection)
  vi.spyOn(CompendiumComponentObject.collection,'insertMany').mockImplementationOnce(async(docs,options)=>{
   const result=await original(docs,options)
   if(action==='delete')await CustomContent.deleteOne({_id:p._id,userId:owner})
   else{const data={...p.data,source:String(p.data.source)+'\n;latest'};await CustomContent.updateOne({_id:p._id,userId:owner},{$set:{data,sourceHash:sourceHash(data.source)}})}
   await run();return result
  })
  await run();expect(await CompendiumComponent.countDocuments()).toBe(0);expect(await CompendiumComponentObject.countDocuments()).toBe(0)
  if(action==='replace'){const current=await CustomContent.findById(p._id).lean();await run();expect((await CompendiumComponent.findOne().lean())!.context).toBe(context(current));expect((await Job.findOne().lean())!.state).toBe('ready')}
  else expect((await Job.findOne().lean())!.state).toBe('cancelled')
 })
 it('defers storage pressure and succeeds after space becomes available',async()=>{
  const p=await pack(),reserved=randomUUID()
  await Generation.create({_id:reserved,userId:owner,packId:p._id,version,context:context(p),state:'staging',bytes:limits.owner,objects:0,createdAt:new Date()})
  await run();let job=await Job.findOne().lean();expect(job).toMatchObject({state:'queued',reason:'storage-budget',attempts:0});expect(await CompendiumComponentObject.countDocuments()).toBe(0)
  await Generation.deleteOne({_id:reserved});await Job.updateOne({_id:p._id},{$set:{runAt:new Date(0)}});await run();job=await Job.findOne().lean();expect(job!.state).toBe('ready')
 })
 it('refuses oversized sources before storing a partial component',async()=>{
  const source=';'+'x'.repeat(limits.source)+'\n{}',p=await CustomContent.create({userId:owner,type:'orcbrew',sourceHash:sourceHash(source),data:storedPackData({filename:'large.orcbrew',source})})
  await run();expect(await Job.findOne().lean()).toMatchObject({state:'blocked',reason:'size-limit'});expect(await CompendiumComponentObject.countDocuments()).toBe(0);expect((await CustomContent.findById(p._id).lean())!.sourceHash).toBe(sourceHash(source))
 })
 it('enforces the global storage budget without changing another owner\'s reservation',async()=>{
  const p=await pack(),reserved=randomUUID()
  await Generation.create({_id:reserved,userId:other,packId:p._id,version,context:context(p),state:'staging',bytes:limits.global,objects:0,createdAt:new Date()})
  await run();expect(await Job.findOne({userId:owner}).lean()).toMatchObject({state:'queued',reason:'storage-budget'});expect((await Generation.findById(reserved).lean())!.bytes).toBe(limits.global);expect(await CompendiumComponentObject.countDocuments()).toBe(0)
 })
 it('keeps current generations and cleans old versions only after the grace period',async()=>{
  const p=await pack();await run();const previous=await Generation.findOne().lean();await Generation.updateOne({_id:previous!._id},{$set:{createdAt:new Date(Date.now()-limits.graceMs-1000)}})
  await run();expect(await Generation.countDocuments()).toBe(1)
  const data={...p.data,source:String(p.data.source)+'\n;changed'};await CustomContent.updateOne({_id:p._id,userId:owner},{$set:{data,sourceHash:sourceHash(data.source)}});await run()
  expect(await Generation.findById(previous!._id)).not.toBeNull()
  await Generation.updateOne({_id:previous!._id},{$set:{obsoleteAt:new Date(Date.now()-limits.graceMs-1000)}});await run()
  expect(await Generation.findById(previous!._id)).toBeNull();expect(await CompendiumComponentObject.countDocuments({generation:previous!._id})).toBe(0);expect(await Generation.countDocuments()).toBe(1)
 })
 it('keeps work queued after a spent invocation budget and permits a later request',async()=>{
  await pack();await expect(runPackPreparation(String(owner),{force:true,deadline:performance.now()+1})).rejects.toThrow('deadline');expect((await Job.findOne().lean())!.state).toBe('queued');await run();expect((await Job.findOne().lean())!.state).toBe('ready')
 })
 it('eventually visits obsolete generations beyond a full batch of retained current copies',async()=>{
  const old=new Date(Date.now()-2*limits.graceMs),counts=Object.fromEntries(ORCBREW_KINDS.map(k=>[k,0])),bytes=Object.fromEntries(ORCBREW_KINDS.map(k=>[k,2]))
  for(let i=0;i<65;i++){
   const source='{}\n;'+i,p=await CustomContent.create({userId:owner,type:'orcbrew',sourceHash:sourceHash(source),data:{filename:'empty.orcbrew',source}}),generation=randomUUID()
   await Generation.create({_id:generation,userId:owner,packId:p._id,version,context:context(p),state:'published',bytes:0,objects:0,createdAt:old})
   await CompendiumComponent.create({userId:owner,version:COMPONENT_VERSION,context:context(p),generation,counts,bytes,sources:false,createdAt:old})
  }
  const obsolete=randomUUID();await Generation.create({_id:obsolete,userId:owner,packId:new mongoose.Types.ObjectId(),version,context:'obsolete',state:'staging',bytes:0,objects:0,createdAt:new Date(old.getTime()+1),obsoleteAt:old})
  await run();expect(await Generation.findById(obsolete)).not.toBeNull();await run();expect(await Generation.findById(obsolete)).toBeNull();expect(await Generation.countDocuments()).toBe(65)
 })
})
