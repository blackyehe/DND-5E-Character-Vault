import { beforeEach,describe,it,expect,vi } from 'vitest'
const state=vi.hoisted(()=>({revision:'one',catalog:{} as Record<string,unknown[]>,edits:[] as unknown[],chunks:[] as any[],onBuild:undefined as (()=>void)|undefined,build:vi.fn(),writes:vi.fn(),reads:vi.fn()}))
vi.mock('../env',()=>({env:{SRD_API_URL:'https://fixture.invalid',COMPENDIUM_READER:'legacy',COMPENDIUM_PREPARED_USERS:''}}))
vi.mock('./compendium-prepared',()=>({preparedReaderEnabled:()=>false,readPreparedIndex:vi.fn(),readPreparedSource:vi.fn()}))
vi.mock('./compendium-entry-source',()=>({importedCompendiumSource:vi.fn()}))
vi.mock('./workshop-library',()=>({workshopLibrary:async(user:string)=>{state.build(user);state.onBuild?.();return {catalog:state.catalog}}}))
vi.mock('./monster-enrichment',()=>({enrichedMonsterEntries:async(_u:string,e:unknown)=>e,enrichedStandardMonster:(e:unknown)=>e}))
vi.mock('../models/CustomContent',()=>({CustomContent:{find:(filter:any)=>{
  let projection='';const chain={select:(s:string)=>{projection=s;return chain},sort:()=>chain,lean:async()=>projection.startsWith('_id')?[{_id:filter.userId,updatedAt:state.revision}]:filter.type==='compendium-edit'?state.edits:[]};return chain
},findOne:()=>({select:()=>({lean:async()=>null}),lean:async()=>null})}}))
vi.mock('../models/CompendiumBrowseIndex',()=>({CompendiumBrowseIndex:{
  init:async()=>{},createCollection:async()=>{},ensureIndexes:async()=>{},
  find:(filter:any)=>{const q={sort:()=>q,setOptions:()=>q,lean:async()=>{state.reads(filter);return state.chunks.filter(c=>c.userId===filter.userId&&c.revision===filter.revision&&c.kind===filter.kind)}};return q},
  bulkWrite:async(ops:any[])=>{state.writes(ops);for(const op of ops)state.chunks.push({...op.updateOne.filter,...op.updateOne.update.$set})},
}}))
beforeEach(()=>{vi.resetModules();state.revision='one';state.catalog={other:[]};state.edits=[];state.chunks=[];state.onBuild=undefined;state.build.mockClear();state.writes.mockClear();state.reads.mockClear()})
describe('revisioned per-account browse index',()=>{
  it('uses persisted metadata after a cold module reload without assembling packs',async()=>{
    state.catalog.other=[{index:'homebrew-other-one',name:'Only source',url:'',sourcePack:'Book',details:{':description':'Full description'}}]
    const first=await (await import('./compendium-browse')).compendiumBrowseIndex('owner','other')
    expect(first.index.records[0]?.entry).not.toHaveProperty('details')
    expect(state.writes).toHaveBeenCalledOnce()
    vi.resetModules();state.build.mockClear()
    const second=await (await import('./compendium-browse')).compendiumBrowseIndex('owner','other')
    expect(second).toEqual(first);expect(state.build).not.toHaveBeenCalled()
    await (await import('./compendium-browse')).compendiumBrowseIndex('stranger','other')
    expect(state.build).toHaveBeenCalledWith('stranger')
  })
  it('invalidates on source removal instead of showing deleted entries',async()=>{
    state.catalog.other=[{index:'old',name:'Removed source',url:''}]
    const module=await import('./compendium-browse'),first=await module.compendiumBrowseIndex('owner','other')
    state.catalog.other=[];state.revision='deleted'
    const second=await module.compendiumBrowseIndex('owner','other')
    expect(second.revision).not.toBe(first.revision);expect(second.index.records).toEqual([])
  })
  it('discards an index built across a concurrent import and retries the new revision',async()=>{
    state.onBuild=()=>{state.revision='two';state.onBuild=undefined}
    await (await import('./compendium-browse')).compendiumBrowseIndex('owner','other')
    expect(state.build).toHaveBeenCalledTimes(2);expect(state.writes).toHaveBeenCalledOnce()
  })
  it('shares a concurrent rebuild while deriving edited spell facets from the full source',async()=>{
    state.catalog.spells=[]
    state.edits=[{data:{index:'acid-arrow',changes:{name:'My Acid Arrow',level:9}}}]
    const module=await import('./compendium-browse')
    const [one,two]=await Promise.all([module.compendiumBrowseIndex('owner','spells'),module.compendiumBrowseIndex('owner','spells')])
    expect(one).toEqual(two);expect(state.build).toHaveBeenCalledOnce()
    const edited=one.index.records.find(r=>r.entry.index==='acid-arrow')!
    expect(edited.search).toContain('my acid arrow');expect(edited.facts.level).toEqual(['9'])
    expect(edited.entry).not.toHaveProperty('desc')
  })
})
