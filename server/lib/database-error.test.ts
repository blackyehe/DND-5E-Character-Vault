import {describe, it, expect} from 'vitest'
import {databaseErrorDetails, withDatabaseStage} from './database-error'
import {env} from '../env'

describe('database failure diagnostics', () => {
  it('captures the pool timeout and its initialization stage with redacted messages and frames', async () => {
    const cause = new Error(`socket closed ${env.JWT_SECRET}`)
    const error = Object.assign(new Error(`pool timeout ${env.MONGO_URI}`, {cause}), {name: 'MongoWaitQueueTimeoutError'})
    error.stack = `${error.name}: ${error.message}\n    at initialize (${env.JWT_SECRET}:10:2)\n    at transaction (notebook.ts:20:1)`
    await expect(withDatabaseStage('notebook-initialization', async () => { throw error })).rejects.toBe(error)
    const details = databaseErrorDetails(error), serialized = JSON.stringify(details)
    expect(details).toMatchObject({stage: 'notebook-initialization', operationMs: expect.any(Number)})
    expect(details.connectionErrors).toHaveLength(2)
    expect(serialized).toContain('notebook.ts:20:1')
    expect(serialized).not.toContain(env.MONGO_URI)
    expect(serialized).not.toContain(env.JWT_SECRET)
  })

  it('reports transaction failures separately and propagates the identical error', async () => {
    const error = Object.assign(new Error('connection cleared'), {name: 'MongoPoolClearedError'})
    await expect(withDatabaseStage('notebook-transaction', async () => { throw error })).rejects.toBe(error)
    expect(databaseErrorDetails(error)).toMatchObject({stage: 'notebook-transaction'})
  })

  it('bounds cause depth and message/frame lengths even for cyclic causes', () => {
    const error = Object.assign(new Error('x'.repeat(2000)), {name: 'MongoNetworkError'})
    error.cause = error
    const errors = databaseErrorDetails(error).connectionErrors as {message: string; frames: string}[]
    expect(errors).toHaveLength(4)
    expect(errors.every(value => value.message.length <= 800 && value.frames.length <= 800)).toBe(true)
  })

  it('does not disclose arbitrary document or validation errors', async () => {
    const error = new Error('private campaign document')
    await expect(withDatabaseStage('notebook-transaction', async () => { throw error })).rejects.toBe(error)
    expect(databaseErrorDetails(error)).toEqual({})
  })
})
