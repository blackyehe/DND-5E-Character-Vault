import {beforeEach,expect,it,vi} from 'vitest'
import {Types} from 'mongoose'
import {encodePrepared} from './compendium-prepared-codec'
import {sourceHash,ORCBREW_KINDS} from './orcbrew'
const state=vi.hoisted(()=>({manifests:[] as any[],objects:[] as any[],size:{stored:2*1024*1024,decoded:2*1024*1024},read:vi.fn(),parse:vi.fn(),cached:vi.fn(),aggregate:vi.fn(),closed:vi.fn()}))
vi.mock('../models/CustomContent',()=>({CustomContent:{aggregate:(pipeline:unknown)=>{state.aggregate(pipeline);return {option:async()=>[state.size]}}}}))
vi.mock('./pack-source',()=>({readPackDocuments:state.read}))
vi.mock('./orcbrew-library',()=>({parsedPack:state.parse,cachedParsedPack:state.cached}))
vi.mock('./compendium-browse',()=>({compactBrowseEntry:(entry:unknown)=>({entry})}))
vi.mock('../models/CompendiumComponent',()=>({
 CompendiumComponent:{find:()=>({select(){return this},setOptions(){return this},lean:async()=>state.manifests})},
 CompendiumComponentObject:{collection:{name:'components'},find:()=>({select(){return this},sort(){return this},setOptions(){return this},lean(){return this},cursor:()=>({async *[Symbol.asyncIterator](){yield*state.objects},close:state.closed})})},
}))
import {componentContext,readComponentCatalogues,type PackMetadata} from './compendium-components'
const owner=new Types.ObjectId(),good:PackMetadata={_id:new Types.ObjectId(),userId:owner,sourceHash:sourceHash('good'),updatedAt:new Date('2026-10-31'),data:{filename:'good.orcbrew'}},changed:PackMetadata={...good,_id:new Types.ObjectId(),sourceHash:sourceHash('source'),data:{filename:'changed.orcbrew'}},entry={index:'homebrew-classes-current',name:'Current',contentKey:'current',source:'changed',disabled:false,legacyKey:'current',details:{':description':'Current source rules'}}
beforeEach(()=>{
 state.read.mockReset().mockResolvedValue([{...changed,data:{...changed.data,source:'source'}}]);state.parse.mockReset().mockReturnValue({entries:Object.fromEntries(ORCBREW_KINDS.map(k=>[k,k==='classes'?[entry]:[]]))})
 state.cached.mockReset()
 state.aggregate.mockClear();state.closed.mockClear();state.size={stored:2*1024*1024,decoded:2*1024*1024}
 state.manifests=[{context:componentContext(good),generation:'verified-good',counts:{classes:0},bytes:{classes:2}}]
 state.objects=encodePrepared([],2).map(c=>({...c,generation:'verified-good',kind:'classes'}))
})
const read=()=>readComponentCatalogues(String(owner),'classes',[good,changed],false,Infinity,{readOnlyFallback:true})
it('combines verified unchanged entries with one current bounded source without preparing a generation',async()=>{
 const result=await read();expect(result).toHaveLength(2);expect(result?.[0]?.parsed.entries.classes).toEqual([]);expect(result?.[1]?.parsed.entries.classes).toEqual([entry])
 expect(state.read).toHaveBeenCalledWith(String(owner),String(changed._id),{maxDecodedBytes:16*1024*1024,maxStoredBytes:32*1024*1024});expect(state.parse).toHaveBeenCalledOnce();expect(state.closed).toHaveBeenCalledOnce()
 expect(state.aggregate.mock.calls[0]![0][0].$match).toMatchObject({_id:changed._id,userId:owner,sourceHash:changed.sourceHash,updatedAt:changed.updatedAt})
})
it('keeps the normal small-repair limit and marks only the eligible large-source case',async()=>{
 const onLargeRepair=vi.fn(),warn=vi.spyOn(console,'warn').mockImplementation(()=>{})
 try{expect(await readComponentCatalogues(String(owner),'classes',[good,changed],true,performance.now()+2500,{onLargeRepair})).toBeNull();expect(onLargeRepair).toHaveBeenCalledOnce();expect(state.read).not.toHaveBeenCalled();expect(state.parse).not.toHaveBeenCalled()}finally{warn.mockRestore()}
})
it('reuses a resident exact parse after validating the current owner and bounded source metadata',async()=>{
 state.cached.mockReturnValue({entries:Object.fromEntries(ORCBREW_KINDS.map(k=>[k,k==='classes'?[entry]:[]]))})
 expect((await read())?.[1]?.parsed.entries.classes).toEqual([entry]);expect(state.cached).toHaveBeenCalledWith(changed.sourceHash);expect(state.read).not.toHaveBeenCalled();expect(state.parse).not.toHaveBeenCalled();expect(state.aggregate).toHaveBeenCalledOnce()
})
it('declines multiple invalid components and never silently omits a damaged unchanged pack',async()=>{
 state.objects=[];expect(await read()).toBeNull();expect(state.read).not.toHaveBeenCalled()
})
it.each([{stored:2,decoded:16*1024*1024+1},{stored:32*1024*1024+1,decoded:2},{stored:2,decoded:NaN}])('declines source sizes outside the fallback budget: %o',async size=>{
 state.size=size;expect(await read()).toBeNull();expect(state.read).not.toHaveBeenCalled()
})
it('rejects revision races, mismatched source hashes and foreign-owner metadata',async()=>{
 state.read.mockResolvedValueOnce([{...changed,updatedAt:new Date('2026-11-01'),data:{...changed.data,source:'source'}}]);expect(await read()).toBeNull();expect(state.parse).not.toHaveBeenCalled()
 state.read.mockResolvedValueOnce([{...changed,data:{...changed.data,source:'different'}}]);expect(await read()).toBeNull();expect(state.parse).not.toHaveBeenCalled()
 const foreign={...changed,userId:new Types.ObjectId()};state.read.mockClear();expect(await readComponentCatalogues(String(owner),'classes',[good,foreign],false,Infinity,{readOnlyFallback:true})).toBeNull();expect(state.read).not.toHaveBeenCalled()
})
it('does not enable this fallback for mutable repair or multi-category readers',async()=>{
 expect(await readComponentCatalogues(String(owner),'classes',[good,changed],true,Infinity,{readOnlyFallback:true})).toBeNull()
 expect(await readComponentCatalogues(String(owner),['classes','spells'],[good,changed],false,Infinity,{readOnlyFallback:true})).toBeNull();expect(state.read).not.toHaveBeenCalled()
})
