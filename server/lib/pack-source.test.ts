import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CustomContent } from '../models/CustomContent'
import { PACK_SOURCE_CHARS, readPackDocuments } from './pack-source'
import { gzipSync } from 'node:zlib'

vi.mock('../models/CustomContent',()=>({CustomContent:{find:vi.fn(),aggregate:vi.fn()}}))
beforeEach(()=>vi.clearAllMocks())
const aggregateResult=(value:unknown)=>({option:vi.fn().mockResolvedValue(value)}) as never
const record={_id:'pack',userId:'owner',type:'orcbrew',updatedAt:new Date('2026-10-19T00:00:00Z'),sourceHash:'hash',data:{filename:'pack.orcbrew',includeDisabled:false}}
function metadata(){const query={select:vi.fn().mockReturnThis(),sort:vi.fn().mockReturnThis(),lean:vi.fn().mockResolvedValue([record])};vi.mocked(CustomContent.find).mockReturnValue(query as never)}

describe('bounded, consistent pack reads',()=>{
  it('reads only the requested owner pack and decodes compressed storage',async()=>{
    const source='{:name "é 🗡"}',encoded=gzipSync(Buffer.from(source)).toString('base64')
    const query={select:vi.fn().mockReturnThis(),sort:vi.fn().mockReturnThis(),lean:vi.fn().mockResolvedValue([{...record,data:{...record.data,sourceEncoding:'gzip-base64',sourceBytes:Buffer.byteLength(source)}}])}
    vi.mocked(CustomContent.find).mockReturnValue(query as never)
    vi.mocked(CustomContent.aggregate).mockReturnValue(aggregateResult([{_id:record._id,part:encoded,length:encoded.length,valid:true}]))
    const docs=await readPackDocuments('owner','pack')
    expect(CustomContent.find).toHaveBeenCalledWith({userId:'owner',type:'orcbrew',_id:'pack'})
    expect(docs[0]!.data.source).toBe(source)
    expect(docs[0]!.data).not.toHaveProperty('sourceEncoding')
  })
  it('reassembles source exactly, including Unicode at a boundary',async()=>{
    metadata()
    const source='a'.repeat(PACK_SOURCE_CHARS-1)+'🗡é\n'+('b'.repeat(PACK_SOURCE_CHARS+3))
    const points=[...source]
    vi.mocked(CustomContent.aggregate).mockImplementation((pipeline:any)=>{
      const guard={_id:'pack',userId:'owner',type:'orcbrew',updatedAt:record.updatedAt,sourceHash:'hash'}
      expect(pipeline[0].$match).toEqual(pipeline[0].$match.$or?{$or:[guard]}:guard)
      const offset=pipeline[1].$project.part.$substrCP[1]
      return aggregateResult([{_id:record._id,part:points.slice(offset,offset+PACK_SOURCE_CHARS).join(''),length:points.length,valid:true}])
    })
    const docs=await readPackDocuments('owner')
    expect(CustomContent.find).toHaveBeenCalledWith({userId:'owner',type:'orcbrew'})
    expect(docs[0]?.data.source).toBe(source)
    expect(CustomContent.aggregate).toHaveBeenCalledTimes(3)
  })
  it('rejects a changed document instead of joining different revisions',async()=>{
    metadata()
    vi.mocked(CustomContent.aggregate).mockReturnValueOnce(aggregateResult([{_id:record._id,part:'a'.repeat(PACK_SOURCE_CHARS),length:PACK_SOURCE_CHARS+1,valid:true}])).mockReturnValueOnce(aggregateResult([]))
    await expect(readPackDocuments('owner')).rejects.toThrow('changed while reading')
  })
  it('reads 126 small packs in bounded batches, retaining owner and revision guards',async()=>{
    const records=Array.from({length:126},(_,i)=>({...record,_id:'pack-'+i,data:{...record.data,filename:i+'.orcbrew'}}))
    vi.mocked(CustomContent.find).mockReturnValue({select:vi.fn().mockReturnThis(),sort:vi.fn().mockReturnThis(),lean:vi.fn().mockResolvedValue(records)} as never)
    vi.mocked(CustomContent.aggregate).mockImplementation((pipeline:any)=>{
      const guards=pipeline[0].$match.$or
      expect(guards.length).toBeLessThanOrEqual(12)
      for(const guard of guards)expect(guard).toMatchObject({userId:'owner',type:'orcbrew',updatedAt:record.updatedAt,sourceHash:'hash'})
      return aggregateResult(guards.map((guard:any)=>({_id:guard._id,part:'{}',length:2,valid:true})))
    })
    const docs=await readPackDocuments('owner')
    expect(docs.map(doc=>doc._id)).toEqual(records.map(doc=>doc._id))
    expect(CustomContent.aggregate).toHaveBeenCalledTimes(11)
  })
})
