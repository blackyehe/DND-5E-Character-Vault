import {beforeEach,describe,expect,it,vi} from 'vitest'
const state=vi.hoisted(()=>({metadata:[{_id:'pack',data:{filename:'rules.orcbrew'}}],catalog:{} as Record<string,any[]>,reads:vi.fn(),legacy:vi.fn(),enabled:true}))
vi.mock('./compendium-components',()=>({COMPONENT_VERSION:'test-components-1',componentMetadata:vi.fn(async()=>state.metadata),readComponentCatalogues:async(...args:any[])=>{state.reads(...args);return []}}))
vi.mock('./compendium-prepared',()=>({preparedReaderEnabled:()=>state.enabled}))
vi.mock('./workshop-library',()=>({workshopLibrary:async()=>{state.legacy();return {catalog:state.catalog}}}))
vi.mock('./orcbrew',async original=>({...await original<object>(),buildOrcbrewCatalog:()=>state.catalog}))
vi.mock('./workshop-schema',()=>({activeWorkshopEntries:(entries:any[])=>entries.filter(e=>!e.superseded)}))
beforeEach(()=>{vi.resetModules();state.metadata=[{_id:'pack',data:{filename:'rules.orcbrew'}}];state.reads.mockClear();state.legacy.mockClear();state.enabled=true;state.catalog=Object.fromEntries(['classes','races','backgrounds','subraces','subclasses','feats','languages','spells'].map(k=>[k,[]]))})
describe('character creation catalogue',()=>{
 it('projects every identity into lists and returns complete definitions only at the matching revision',async()=>{
  state.catalog.classes=[{index:'class',name:'Class',aliases:['old'],sourcePack:'Book',homebrew_traits:[{name:'Full rule',description:'Full text'}],details:{':profs':{skill:true}}}]
  const module=await import('./creation-catalog'),initial=await module.creationSelectionsResponse('owner')
  expect(initial.value?.options.classes).toEqual([{index:'class',name:'Class',url:'',selectionOnly:true,homebrew:true,aliases:['old'],sourcePack:'Book'}])
  const selected=await module.creationDefinitions('owner',initial.value!.revision,'classes','class')
  expect(selected).toEqual((await module.creationCatalog('owner')).classes[0]);expect(selected).toHaveProperty('homebrew_traits')
  await expect(module.creationDefinitions('owner',initial.value!.revision,'classes','removed')).rejects.toMatchObject({status:404})
 })
 it('validates cold selection-list conditionals without reading definitions and separates the full-response namespace',async()=>{
  const module=await import('./creation-catalog'),first=await module.creationSelectionsResponse('owner'),full=await module.creationCatalogResponse('owner')
  expect(first.etag).not.toBe(full.etag);vi.resetModules();state.reads.mockClear()
  const cold=await import('./creation-catalog');expect(await cold.creationSelectionsResponse('owner','W/'+first.etag)).toEqual({etag:first.etag});expect(state.reads).not.toHaveBeenCalled()
  expect((await cold.creationSelectionsResponse('stranger',first.etag)).value).toBeDefined()
 })
 it('rejects definitions after a source change rather than mixing new rules with old selection lists',async()=>{
  state.catalog.feats=[{index:'feat',name:'Feat',description:'Complete feat'}]
  const module=await import('./creation-catalog'),first=await module.creationSelectionsResponse('owner')
  expect(await module.creationDefinitions('owner',first.value!.revision,'feats')).toEqual((await module.creationCatalog('owner')).feats)
  state.metadata=[{_id:'changed',data:{filename:'updated'}}]
  await expect(module.creationDefinitions('owner',first.value!.revision,'feats')).rejects.toMatchObject({status:409})
 })
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
 it('validates an account-scoped conditional hit in a cold module without reading definitions',async()=>{
  const first=await (await import('./creation-catalog')).creationCatalogResponse('owner')
  expect(first.catalog).toBeDefined();expect(first.etag).toMatch(/^"[a-f0-9]{64}"$/)
  vi.resetModules();state.reads.mockClear()
  const module=await import('./creation-catalog')
  expect(await module.creationCatalogResponse('owner',first.etag)).toEqual({etag:first.etag})
  expect(await module.creationCatalogResponse('owner','W/'+first.etag)).toEqual({etag:first.etag})
  expect(state.reads).not.toHaveBeenCalled();expect(state.legacy).not.toHaveBeenCalled()
  expect((await module.creationCatalogResponse('stranger',first.etag)).catalog).toBeDefined()
  expect(state.reads).toHaveBeenCalledOnce()
 })
 it('replaces a browser copy after a pack change and never returns a not-modified hit for it',async()=>{
  const module=await import('./creation-catalog'),first=await module.creationCatalogResponse('owner')
  state.metadata=[{_id:'pack',data:{filename:'rules.orcbrew',includeDisabled:true}}] as any
  state.catalog.spells=[{index:'new-spell',name:'New spell',details:{}}]
  const next=await module.creationCatalogResponse('owner','W/'+first.etag)
  expect(next.etag).not.toBe(first.etag);expect(next.catalog?.spells[0]?.index).toBe('new-spell')
 })
})
