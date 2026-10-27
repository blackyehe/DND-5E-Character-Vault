import { describe,it,expect } from 'vitest'
import { encodeBrowseIndex,decodeBrowseIndex } from './compendium-browse-storage'
import { browseIndex,browseRecord } from '../../shared/compendium-browse'
import { randomBytes } from 'node:crypto'
import mongoose from 'mongoose'

describe('persistent browse metadata',()=>{
  it('roundtrips a multichunk category and rejects missing, duplicate or altered chunks',()=>{
    const index=browseIndex(Array.from({length:1500},(_,i)=>browseRecord({index:String(i),name:randomBytes(600).toString('hex'),url:''},'spells')),'spells')
    const chunks=encodeBrowseIndex(index)
    expect(chunks.length).toBeGreaterThan(1)
    expect(Math.max(...chunks.map(c=>c.payload.length))).toBeLessThanOrEqual(512*1024)
    expect(decodeBrowseIndex([...chunks].reverse())).toEqual(index)
    const databaseShape=chunks.map(c=>mongoose.mongo.BSON.deserialize(mongoose.mongo.BSON.serialize(c)))
    expect(decodeBrowseIndex(databaseShape as any)).toEqual(index)
    expect(decodeBrowseIndex(chunks.slice(1))).toBeNull()
    expect(decodeBrowseIndex([chunks[0]!,...chunks.slice(0,-1)])).toBeNull()
    const corrupt=chunks.map(c=>({...c,payload:Buffer.from(c.payload)}));corrupt[0]!.payload[0]^=1
    expect(decodeBrowseIndex(corrupt)).toBeNull()
  })
})
