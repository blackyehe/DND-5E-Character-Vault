import {expect, it, vi} from 'vitest'
import mongoose from 'mongoose'
import express from 'express'
import {extensionModelReadiness} from './model-readiness'
import {initializationDiagnostic} from './initialization-diagnostic'
import {createProductionTrialApp} from './production-trial-app'

function fixture(stage: 'collection' | 'indexes' | null, error = Object.assign(new Error('Synthetic storage failure'), {name:'MongoWaitQueueTimeoutError'})) {
  const base = new mongoose.Mongoose()
  let unavailable = !!stage
  const createCollection = vi.fn(async () => {if (unavailable && stage === 'collection') throw error})
  const ensureIndexes = vi.fn(async () => {if (unavailable && stage === 'indexes') throw error})
  const schema = new base.Schema({token:{type:String, unique:true}}, {autoCreate:true, autoIndex:true})
  schema.statics.createCollection = createCollection
  schema.statics.ensureIndexes = ensureIndexes
  const model = base.model('ExtensionReadinessFixture', schema)
  return {model, createCollection, ensureIndexes, recover:()=>{unavailable=false}}
}

it.each(['pairing', 'session'] as const)('recovers a cached transient %s initialization failure and coalesces concurrent starts', async failed => {
  const pairing = fixture(failed === 'pairing' ? 'collection' : null), session = fixture(failed === 'session' ? 'indexes' : null)
  await Promise.all([pairing.model.init().catch(()=>{}), session.model.init().catch(()=>{})])
  pairing.recover(); session.recover()
  const ready = extensionModelReadiness(pairing.model, session.model)
  await Promise.all([ready(), ready(), ready()])
  const damaged = failed === 'pairing' ? pairing : session, healthy = failed === 'pairing' ? session : pairing
  expect(damaged.createCollection).toHaveBeenCalledTimes(2)
  expect(damaged.ensureIndexes).toHaveBeenCalledTimes(failed === 'pairing' ? 1 : 2)
  expect(healthy.createCollection).toHaveBeenCalledTimes(1)
  expect(healthy.ensureIndexes).toHaveBeenCalledTimes(1)
  await ready()
  expect(damaged.createCollection).toHaveBeenCalledTimes(2)
})

it.each([13, 85, 86, 11000])('does not recover or bypass a permanent database/index error %i', async code => {
  const pairing=fixture('indexes',Object.assign(new Error('Private permanent failure'),{name:'MongoServerError',code})),session=fixture(null)
  await Promise.all([pairing.model.init().catch(()=>{}),session.model.init()]);pairing.recover()
  const ready=extensionModelReadiness(pairing.model,session.model)
  for(let attempt=0;attempt<2;attempt++)try{await ready();throw new Error('Expected readiness failure')}catch(error){expect(initializationDiagnostic(error,'boundary')).toMatchObject({stage:'pairing-indexes',kind:'MongoServerError',code})}
  expect(pairing.createCollection).toHaveBeenCalledTimes(1)
  expect(pairing.ensureIndexes).toHaveBeenCalledTimes(1)
})

it('requires both index barriers and retries a later request after temporary setup failure', async () => {
  const pairing=fixture(null),session=fixture('indexes')
  await Promise.all([pairing.model.init(),session.model.init().catch(()=>{})])
  const ready=extensionModelReadiness(pairing.model,session.model),loaded=vi.fn()
  await expect(ready().then(loaded)).rejects.toBeInstanceOf(Error)
  expect(loaded).not.toHaveBeenCalled()
  session.recover()
  await ready().then(loaded)
  expect(loaded).toHaveBeenCalledTimes(1)
  expect(pairing.ensureIndexes).toHaveBeenCalledTimes(1)
  expect(session.ensureIndexes).toHaveBeenCalledTimes(3)
})

it('keeps HTTP denied until storage recovers, then reaches the normal authentication boundary', async () => {
  const pairing=fixture('collection'),session=fixture(null)
  await Promise.all([pairing.model.init().catch(()=>{}),session.model.init()])
  const ready=extensionModelReadiness(pairing.model,session.model),records:unknown[]=[]
  const config={websiteOrigin:'https://website.test',extensionOrigin:'https://extension.test',roomId:'a'.repeat(24),epoch:'readiness-http-fixture',mode:'play-controls' as const,rememberedConnections:false}
  const app=createProductionTrialApp(express(),()=>config,async()=>{await ready();const boundary=express();boundary.use((_req,res)=>res.status(401).end());return boundary},record=>records.push(record))
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve))
  try{
    const url='http://127.0.0.1:'+(server.address() as {port:number}).port+'/api/extension/v1/session'
    expect((await fetch(url)).status).toBe(503)
    expect(records).toMatchObject([{stage:'pairing-indexes',kind:'MongoWaitQueueTimeoutError'}])
    pairing.recover()
    expect((await fetch(url)).status).toBe(401)
  }finally{await new Promise<void>(resolve=>server.close(()=>resolve()))}
})
