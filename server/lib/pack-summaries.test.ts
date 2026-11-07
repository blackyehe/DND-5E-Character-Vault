import {beforeEach,expect,it,vi} from 'vitest'
import {inspectOrcbrew,sourceHash} from './orcbrew'
import {storedPackSummary} from './pack-summary'
import {readPackSummaries,PACK_SUMMARY_PROJECTION} from './pack-summaries'
import {CustomContent} from '../models/CustomContent'
import {parsedPack} from './orcbrew-library'
import {readPackDocuments} from './pack-source'
vi.mock('../models/CustomContent',()=>({CustomContent:{find:vi.fn()}}))
vi.mock('./pack-source',()=>({readPackDocuments:vi.fn()}))
vi.mock('./orcbrew-library',async()=>{
 const {inspectOrcbrew}=await import('./orcbrew'),{packSource}=await import('./pack-storage')
 return{parsedPack:vi.fn((data:unknown)=>inspectOrcbrew(packSource(data)))}
})
const source='{:orcpub.dnd.e5/feats {:test {:name "Test"}}}',report=inspectOrcbrew(source).report
const doc=(id:string,cached=true)=>({_id:id,userId:'owner',type:'orcbrew',sourceHash:sourceHash(source),updatedAt:new Date('2026-10-01'),data:{filename:id+'.orcbrew',includeDisabled:false,...cached?{packReport:storedPackSummary(source,report)}:{}}})
let query:any
function metadata(docs:unknown[]){query={select:vi.fn().mockReturnThis(),sort:vi.fn().mockReturnThis(),setOptions:vi.fn().mockReturnThis(),lean:vi.fn().mockResolvedValue(docs)};vi.mocked(CustomContent.find).mockReturnValue(query)}
beforeEach(()=>{vi.clearAllMocks();metadata([])})
it('lists 126 current summaries on a cold process without reading or parsing any source',async()=>{
 metadata(Array.from({length:126},(_,i)=>doc('pack-'+i)))
 const summaries=await readPackSummaries('owner')
 expect(summaries).toHaveLength(126)
 expect(CustomContent.find).toHaveBeenCalledWith({userId:'owner',type:'orcbrew'})
 expect(query.select).toHaveBeenCalledWith(PACK_SUMMARY_PROJECTION)
 expect(PACK_SUMMARY_PROJECTION.split(' ')).not.toContain('data.source')
 expect(readPackDocuments).not.toHaveBeenCalled();expect(parsedPack).not.toHaveBeenCalled()
 for(const row of summaries)expect(row).toMatchObject({report,includeDisabled:false})
})
it('batches only missing or stale IDs, preserving exact legacy reports and per-file errors',async()=>{
 const hit=doc('hit'),legacy=doc('legacy',false),bad=doc('bad',false),stale={...doc('stale'),sourceHash:'0'.repeat(64)}
 metadata([hit,legacy,bad,stale])
 vi.mocked(readPackDocuments).mockResolvedValue([{...legacy,data:{...legacy.data,source}},{...bad,data:{...bad.data,source:'{broken'}},{...doc('stale',false),data:{...doc('stale',false).data,source}}] as never)
 const rows=await readPackSummaries('owner')
 expect(readPackDocuments).toHaveBeenCalledWith('owner',undefined,{packIds:['legacy','bad','stale']})
 expect(parsedPack).toHaveBeenCalledTimes(3)
 expect(rows.find(r=>r.id==='hit')!.report).toEqual(report)
 expect(rows.find(r=>r.id==='legacy')!.report).toEqual(report)
 expect(rows.find(r=>r.id==='bad')!.error).toBeTruthy()
})
it('returns current include-disabled state and omits a concurrently deleted fallback row',async()=>{
 metadata([{...doc('enabled'),data:{...doc('enabled').data,includeDisabled:true}},doc('removed',false)])
 vi.mocked(readPackDocuments).mockResolvedValue([])
 expect(await readPackSummaries('owner')).toEqual([{id:'enabled',filename:'enabled.orcbrew',includeDisabled:true,report}])
})
