import { describe,it,expect } from 'vitest'
import { gzipSync } from 'node:zlib'
import { randomBytes } from 'node:crypto'
import { mongo } from 'mongoose'
import { packSource,storedPackData,decodedPackData,PLAIN_PACK_BYTES,MAX_STORED_PACK_BYTES } from './pack-storage'

describe('large Orcbrew storage',()=>{
  it('round-trips portable collections above the former compressed cap with BSON headroom',()=>{
    const original={filename:'All homebrew.orcbrew',source:randomBytes(8*1024*1024).toString('base64')}
    const stored=storedPackData(original)
    expect(String(stored.source).length).toBeGreaterThan(9*1024*1024)
    expect(String(stored.source).length).toBeLessThan(MAX_STORED_PACK_BYTES)
    expect(decodedPackData(stored)).toEqual(original)
    expect(mongo.BSON.calculateObjectSize({data:stored})).toBeLessThan(16*1024*1024)
    expect(()=>packSource({source:'a'.repeat(MAX_STORED_PACK_BYTES+1),sourceEncoding:'gzip-base64',sourceBytes:1})).toThrow('encoding')
  })
  it('round-trips decoded collections above64MiB while bounding decompression',()=>{
    const source=';'+('x'.repeat(65*1024*1024))
    const stored=storedPackData({filename:'large.orcbrew',source})
    expect(packSource(stored)).toBe(source)
    expect(()=>packSource({source:'a'.repeat(MAX_STORED_PACK_BYTES+1),sourceEncoding:'gzip-base64',sourceBytes:1})).toThrow('encoding')
  })
  it('keeps small sources exact and compresses larger Unicode sources without losing metadata',()=>{
    const small={filename:'shadows.orcbrew',source:'{:text "🗡 é"}',includeDisabled:true}
    expect(storedPackData(small)).toEqual(small)
    const large={...small,source:small.source+'\n;'+('🗡é'.repeat(Math.ceil(PLAIN_PACK_BYTES/6)))}
    const stored=storedPackData(large)
    expect(stored.sourceEncoding).toBe('gzip-base64')
    expect(decodedPackData(stored)).toEqual(large)
    expect(packSource(stored)).toBe(large.source)
    expect(storedPackData(stored)).toEqual(stored)
  })
  it('rejects corrupt encoding, mismatched lengths, and decompression beyond the limit',()=>{
    const source=gzipSync(Buffer.from('hello')).toString('base64')
    expect(()=>packSource({source,sourceEncoding:'gzip-base64',sourceBytes:6})).toThrow('size')
    expect(()=>packSource({source:'!',sourceEncoding:'gzip-base64',sourceBytes:5})).toThrow('encoding')
    expect(()=>packSource({source,sourceEncoding:'other',sourceBytes:5})).toThrow('encoding')
  })
})
