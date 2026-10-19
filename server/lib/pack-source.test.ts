import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CustomContent } from '../models/CustomContent'
import { PACK_SOURCE_CHARS, readPackDocuments } from './pack-source'

vi.mock('../models/CustomContent',()=>({CustomContent:{find:vi.fn(),aggregate:vi.fn()}}))
beforeEach(()=>vi.clearAllMocks())
const record={_id:'pack',userId:'owner',type:'orcbrew',updatedAt:new Date('2026-10-19T00:00:00Z'),sourceHash:'hash',data:{filename:'pack.orcbrew',includeDisabled:false}}
function metadata(){const query={select:vi.fn().mockReturnThis(),sort:vi.fn().mockReturnThis(),lean:vi.fn().mockResolvedValue([record])};vi.mocked(CustomContent.find).mockReturnValue(query as never)}

describe('bounded, consistent pack reads',()=>{
  it('reassembles source exactly, including Unicode at a boundary',async()=>{
    metadata()
    const source='a'.repeat(PACK_SOURCE_CHARS-1)+'🗡é\n'+('b'.repeat(PACK_SOURCE_CHARS+3))
    const points=[...source]
    vi.mocked(CustomContent.aggregate).mockImplementation((pipeline:any)=>{
      expect(pipeline[0].$match).toEqual({_id:'pack',userId:'owner',type:'orcbrew',updatedAt:record.updatedAt,sourceHash:'hash'})
      const offset=pipeline[1].$project.part.$substrCP[1]
      return Promise.resolve([{part:points.slice(offset,offset+PACK_SOURCE_CHARS).join(''),length:points.length,valid:true}]) as never
    })
    const docs=await readPackDocuments('owner')
    expect(CustomContent.find).toHaveBeenCalledWith({userId:'owner',type:'orcbrew'})
    expect(docs[0]?.data.source).toBe(source)
    expect(CustomContent.aggregate).toHaveBeenCalledTimes(3)
  })
  it('rejects a changed document instead of joining different revisions',async()=>{
    metadata()
    vi.mocked(CustomContent.aggregate).mockResolvedValueOnce([{part:'a'.repeat(PACK_SOURCE_CHARS),length:PACK_SOURCE_CHARS+1,valid:true}] as never).mockResolvedValueOnce([] as never)
    await expect(readPackDocuments('owner')).rejects.toThrow('changed while reading')
  })
})
