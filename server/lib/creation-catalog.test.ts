import {beforeEach,describe,expect,it,vi} from 'vitest'
const state=vi.hoisted(()=>({metadata:[{_id:'pack',data:{filename:'rules.orcbrew'}}],catalog:{} as Record<string,any[]>,reads:vi.fn(),legacy:vi.fn(),enabled:true}))
vi.mock('./compendium-components',()=>({componentMetadata:vi.fn(async()=>state.metadata),readComponentCatalogues:async(...args:any[])=>{state.reads(...args);return []}}))
vi.mock('./compendium-prepared',()=>({preparedReaderEnabled:()=>state.enabled}))
vi.mock('./workshop-library',()=>({workshopLibrary:async()=>{state.legacy();return {catalog:state.catalog}}}))
vi.mock('./orcbrew',async original=>({...await original<object>(),buildOrcbrewCatalog:()=>state.catalog}))
vi.mock('./workshop-schema',()=>({activeWorkshopEntries:(entries:any[])=>entries.filter(e=>!e.superseded)}))
beforeEach(()=>{vi.resetModules();state.metadata=[{_id:'pack',data:{filename:'rules.orcbrew'}}];state.reads.mockClear();state.legacy.mockClear();state.enabled=true;state.catalog=Object.fromEntries(['classes','races','backgrounds','subraces','subclasses','feats','languages','spells'].map(k=>[k,[]]))})
describe('character creation catalogue',()=>{
 it('coalesces one scoped load and retains creation rules and stable source identities',async()=>{
  state.catalog.classes=[{index:'homebrew-classes-test',name:'Test class',aliases:['old'],sourcePack:'Book',homebrew_traits:[{name:'Rule'}],details:{':profs':{skill:true},':spellcasting':{ability:'int'},':raw-editor-copy':'discard'}}]
  const {creationCatalog,CREATION_KINDS}=await import('./creation-catalog')
  const [a,b]=await Promise.all([creationCatalog('owner'),creationCatalog('owner')])
  expect(a).toEqual(b);expect(state.reads).toHaveBeenCalledOnce();expect(state.reads.mock.calls[0]?.[1]).toEqual(CREATION_KINDS)
  expect(a.classes[0]).toMatchObject({index:'homebrew-classes-test',aliases:['old'],homebrew_traits:[{name:'Rule'}],details:{':profs':{skill:true},':spellcasting':{ability:'int'}}})
  expect(a.classes[0]?.details).not.toHaveProperty(':raw-editor-copy');expect(state.legacy).not.toHaveBeenCalled()
  await creationCatalog('stranger');expect(state.reads).toHaveBeenCalledTimes(2)
 })
 it('invalidates exact source changes and removes superseded workshop choices',async()=>{
  state.catalog.races=[{index:'current',name:'Race',details:{}},{index:'old',superseded:true,details:{}}]
  const {creationCatalog}=await import('./creation-catalog')
  expect((await creationCatalog('owner')).races.map(e=>e.index)).toEqual(['current'])
  await creationCatalog('owner');expect(state.reads).toHaveBeenCalledOnce()
  state.metadata=[{_id:'changed',data:{filename:'rules.orcbrew'}}];state.catalog.races=[]
  expect((await creationCatalog('owner')).races).toEqual([]);expect(state.reads).toHaveBeenCalledTimes(2)
 })
})
