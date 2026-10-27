import {describe, it, expect, vi} from 'vitest'
import mongoose from 'mongoose'
import {recoverableModelInitialization} from './model-initialization'

const transient = () => Object.assign(new Error('simulated checkout timeout'), {name: 'MongoWaitQueueTimeoutError'})

/** Real Mongoose init caching; only the storage operations are simulated. */
function fixture(failAt: 'collection' | 'indexes' | null, initialError = transient()) {
  const base = new mongoose.Mongoose()
  let unavailable = !!failAt
  const createCollection = vi.fn(async () => { if (unavailable && failAt === 'collection') throw initialError })
  const ensureIndexes = vi.fn(async () => { if (unavailable && failAt === 'indexes') throw initialError })
  const schema = new base.Schema({value: String}, {autoCreate: true, autoIndex: true})
  schema.statics.createCollection = createCollection
  schema.statics.ensureIndexes = ensureIndexes
  const model = base.model('InitializationRecovery', schema)
  return {model, createCollection, ensureIndexes, initialError, recover: () => { unavailable = false }}
}

describe('recoverable model initialization', () => {
  it.each(['collection', 'indexes'] as const)('recovers a cached %s failure using real Mongoose', async stage => {
    const f = fixture(stage)
    await expect(f.model.init()).rejects.toBe(f.initialError)
    f.recover()
    // The upstream promise stays rejected even after storage recovers.
    await expect(f.model.init()).rejects.toBe(f.initialError)
    const ready = recoverableModelInitialization(() => [f.model])
    await Promise.all([ready(), ready(), ready()])
    const calls = f.createCollection.mock.calls.length
    await ready()
    expect(f.createCollection).toHaveBeenCalledTimes(calls)
    expect(calls).toBe(2)
    expect(f.ensureIndexes).toHaveBeenCalledTimes(stage === 'indexes' ? 2 : 1)
  })

  it('allows a later request to recover after fallback also fails', async () => {
    const f = fixture('collection')
    await expect(f.model.init()).rejects.toBe(f.initialError)
    const ready = recoverableModelInitialization(() => [f.model])
    await expect(ready()).rejects.toBe(f.initialError)
    f.recover()
    await ready()
    expect(f.createCollection).toHaveBeenCalledTimes(3)
    expect(f.ensureIndexes).toHaveBeenCalledTimes(1)
  })

  it('preserves a permanent unique-index failure and does not bypass readiness', async () => {
    const duplicate = Object.assign(new Error('duplicate key'), {name: 'MongoServerError', code: 11000})
    const f = fixture('indexes', duplicate)
    await expect(f.model.init()).rejects.toBe(duplicate)
    f.recover()
    await expect(recoverableModelInitialization(() => [f.model])()).rejects.toBe(duplicate)
    expect(f.createCollection).toHaveBeenCalledTimes(1)
  })

  it('requires both models and their indexes before allowing a transaction', async () => {
    const first = fixture(null), second = fixture('indexes')
    await Promise.all([first.model.init(), second.model.init().catch(() => {})])
    const ready = recoverableModelInitialization(() => [first.model, second.model])
    const transaction = vi.fn()
    await expect(ready().then(transaction)).rejects.toBe(second.initialError)
    expect(transaction).not.toHaveBeenCalled()
    second.recover()
    await ready().then(transaction)
    expect(transaction).toHaveBeenCalledTimes(1)
    expect(first.createCollection).toHaveBeenCalledTimes(1)
  })
})
