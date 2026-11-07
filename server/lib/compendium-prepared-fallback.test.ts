import {beforeEach,expect,it,vi} from 'vitest'
import {ORCBREW_KINDS} from './orcbrew'
const state=vi.hoisted(()=>({read:vi.fn()}))
vi.mock('../models/CustomContent',()=>({CustomContent:{find:()=>{const q={select:()=>q,maxTimeMS:()=>q,lean:async()=>[]};return q}}}))
vi.mock('../env',()=>({env:{COMPENDIUM_PREPARED_USERS:'owner',COMPENDIUM_READER:'prepared'}}))
vi.mock('./compendium-components',()=>({componentMetadata:async()=>[{_id:'pack',data:{filename:'pack.orcbrew'}}],componentContext:()=> 'current-context',readComponentCatalogues:state.read,readComponentSource:vi.fn()}))
vi.mock('./workshop-library',()=>({warmWorkshopCatalog:()=>undefined}))
vi.mock('./srd-snapshot',()=>({localSrdRule:()=>({results:[]})}))
vi.mock('./compendium-browse',()=>({compactBrowseEntry:vi.fn(),personalEntry:vi.fn(),browseEntrySource:vi.fn()}))
vi.mock('./compendium-entry-source',()=>({targetedCompendiumSource:vi.fn()}))
beforeEach(()=>{vi.resetModules();state.read.mockReset()})
it('uses a separate failed-probe identity for the read-only tier and does not request component repair',async()=>{
 const {readPreparedIndex}=await import('./compendium-prepared'),probes={failed:new Set<string>(),targetedFallbackEligible:false}
 state.read.mockImplementationOnce(async(_user,_kind,_packs,_repair,_deadline,options)=>{options.onLargeRepair();return null})
 expect(await readPreparedIndex('owner','revision','classes',probes)).toBeNull();expect(probes.targetedFallbackEligible).toBe(true)
 state.read.mockResolvedValueOnce([{id:'pack',filename:'pack.orcbrew',parsed:{entries:Object.fromEntries(ORCBREW_KINDS.map(k=>[k,[]])),report:{warnings:[]}}}])
 const result=await readPreparedIndex('owner','revision','classes',probes,true)
 expect(result?.records).toEqual([]);expect(state.read).toHaveBeenCalledTimes(2)
 expect(state.read.mock.calls[1]![3]).toBe(false);expect(state.read.mock.calls[1]![4]).toBe(Infinity);expect(state.read.mock.calls[1]![5]).toMatchObject({readOnlyFallback:true})
})
