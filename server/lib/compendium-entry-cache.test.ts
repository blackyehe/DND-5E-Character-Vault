import {beforeEach,expect,it,vi} from 'vitest'
import {gzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
const state=vi.hoisted(()=>({responses:[] as any[],queries:[] as {filter:any;sort?:unknown}[],write:vi.fn(async()=>{})}))
vi.mock('../models/CompendiumEntryCache',()=>({CompendiumEntryCache:{findOne:(filter:unknown)=>{const record={filter} as any;state.queries.push(record);const q={select:()=>q,sort:(sort:unknown)=>{record.sort=sort;return q},lean:async()=>state.responses.shift()??null};return q},updateOne:state.write}}))
vi.mock('./model-initialization',()=>({recoverableModelInitialization:()=>async()=>{}}))
import {importedCompendiumSource} from './compendium-entry-source'
const index='homebrew-classes-probe',revision='current-revision',legacy='source-1:'+revision,current='source-components-3-families:'+revision
const value=(name='Complete entry')=>({index,name,homebrew:true,url:'',desc:['Complete original rules']})
function row(version=current,entry=value()){const payload=gzipSync(JSON.stringify(entry));return {revision:version,payload,digest:createHash('sha256').update(payload).digest('hex')}}
const locate=vi.fn(async()=>null),prepared=vi.fn(async()=>null)
const load=(resolver:typeof prepared|undefined=prepared)=>importedCompendiumSource('owner','classes',index,revision,locate,resolver)
beforeEach(()=>{state.responses=[];state.queries=[];state.write.mockClear();locate.mockReset();locate.mockResolvedValue(null);prepared.mockReset();prepared.mockResolvedValue(null)})
it('serves a current-only hit with one query and no source resolution or cache writes',async()=>{
 state.responses=[row()];expect(await load()).toEqual(value());expect(state.queries).toHaveLength(1);expect(prepared).not.toHaveBeenCalled();expect(locate).not.toHaveBeenCalled();expect(state.write).not.toHaveBeenCalled()
 expect(state.queries[0]!.filter).toEqual({userId:'owner',kind:'classes',index,revision:{$in:[legacy,current]},expiresAt:{$gt:expect.any(Date)}})
})
it('keeps a valid legacy winner as a single-payload read',async()=>{
 state.responses=[row(legacy,value('Legacy winner')),row(current,value('Other value'))];expect((await load())?.name).toBe('Legacy winner');expect(state.queries).toHaveLength(1);expect(state.responses).toHaveLength(1)
})
it.each(['digest','gzip','index','homebrew'])('retries only the current namespace after invalid legacy %s',async(mode)=>{
 const old=row(legacy);if(mode==='digest')old.digest='bad';if(mode==='gzip'){old.payload=Buffer.from('not gzip');old.digest=createHash('sha256').update(old.payload).digest('hex')}if(mode==='index')Object.assign(old,row(legacy,{...value(),index:'wrong'}));if(mode==='homebrew')Object.assign(old,row(legacy,{...value(),homebrew:false}))
 state.responses=[old,row()];expect(await load()).toEqual(value());expect(state.queries).toHaveLength(2);expect(state.queries[1]!.filter.revision).toBe(current);expect(prepared).not.toHaveBeenCalled()
})
it('uses the normal prepared fallback after a combined miss without repeating a current-cache miss',async()=>{
 state.responses=[null];expect(await load()).toBeNull();expect(state.queries).toHaveLength(1);expect(prepared).toHaveBeenCalledOnce();expect(locate).toHaveBeenCalledOnce()
})
it('falls back normally after an invalid current value without querying the absent legacy value again',async()=>{
 state.responses=[{...row(),digest:'invalid'}];expect(await load()).toBeNull();expect(state.queries).toHaveLength(1);expect(prepared).toHaveBeenCalledOnce();expect(locate).toHaveBeenCalledOnce()
})
it('preserves prepared-result persistence under the current namespace',async()=>{
 prepared.mockResolvedValueOnce(value() as never);expect(await load()).toEqual(value());expect(state.write).toHaveBeenCalledWith({userId:'owner',revision:current,kind:'classes',index},expect.objectContaining({$set:expect.objectContaining({payload:expect.any(Buffer),digest:expect.any(String),expiresAt:expect.any(Date)})}),{upsert:true});expect(locate).not.toHaveBeenCalled()
})
it('leaves the legacy-only reader on its single exact query',async()=>{
 state.responses=[row(legacy)];expect(await importedCompendiumSource('owner','classes',index,revision,locate)).toEqual(value());expect(state.queries).toHaveLength(1)
 expect(state.queries[0]!.filter.revision).toBe(legacy);expect(state.queries[0]!.sort).toBeUndefined()
})
it('coalesces simultaneous reads of the same owned entry',async()=>{
 let finish!:(row:unknown)=>void;state.responses=[new Promise(resolve=>{finish=resolve})]
 const a=load(),b=load();finish(row());expect(await a).toEqual(value());expect(await b).toEqual(value());expect(state.queries).toHaveLength(1)
})
