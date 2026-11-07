import {expect,it} from 'vitest'
import {inspectOrcbrew,sourceHash} from './orcbrew'
import {storedPackData,packSource} from './pack-storage'
import {cachedPackReport,storedPackSummary,PACK_SUMMARY_MAX_BYTES} from './pack-summary'
const source='\uFEFF{:orcpub.dnd.e5/feats {:test {:name "Unicode é 🗡" :description "Kept" :disabled? true}}}\r\n'
const report=inspectOrcbrew(source).report
it('stores an exact source/version report without changing UTF-8 bytes, and overrides supplied cache data',()=>{
 const data=storedPackData({filename:'a.orcbrew',source,packReport:{report:{entryCount:9000}}},{report})
 expect(packSource(data)).toBe(source)
 const cached=cachedPackReport({_id:'a',sourceHash:sourceHash(source),data})
 expect(cached).toEqual(report)
 cached!.warnings.push('caller change')
 expect(cachedPackReport({_id:'a',sourceHash:sourceHash(source),data})).toEqual(report)
 expect(storedPackData({filename:'a.orcbrew',source,packReport:data.packReport})).not.toHaveProperty('packReport')
})
it('requires current source identity and rejects malformed or obsolete reports',()=>{
 const summary=storedPackSummary(source,report)!
 const doc={_id:'a',sourceHash:sourceHash(source),data:{packReport:summary}}
 for(const patch of [{version:'obsolete'},{sourceHash:'0'.repeat(64)},{report:{...report,entryCount:999}},{report:{...report,nonFiniteCount:NaN}},{report:{...report,warnings:[5]}}])expect(cachedPackReport({...doc,data:{packReport:{...summary,...patch}}})).toBeUndefined()
 expect(cachedPackReport({...doc,sourceHash:'0'.repeat(64)})).toBeUndefined()
})
it('binds hashless legacy reports to the exact source-document timestamp',()=>{
 const updatedAt=new Date('2026-10-01T00:00:00Z'),data={packReport:storedPackSummary(source,report,updatedAt)}
 expect(cachedPackReport({_id:'a',updatedAt,data})).toEqual(report)
 expect(cachedPackReport({_id:'a',updatedAt:new Date(updatedAt.getTime()+1),data})).toBeUndefined()
 expect(cachedPackReport({_id:'a',data})).toBeUndefined()
  expect(cachedPackReport({_id:'a',updatedAt:new Date(NaN),data})).toBeUndefined()
})
it('keeps oversize warning reports on the exact legacy path instead of truncating them',()=>{
 const oversized={...report,warnings:['warning'.repeat(PACK_SUMMARY_MAX_BYTES)]}
 expect(storedPackSummary(source,oversized)).toBeUndefined()
})
