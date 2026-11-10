vi.mock('./definition-editions',()=>({effectiveDefinitions:async(_owner:unknown,rows:{source:unknown}[])=>rows.map(row=>({entry:row.source,revision:0}))}))
import {beforeEach,expect,it,vi} from 'vitest'
import {inspectOrcbrew,buildOrcbrewCatalog,sourceHash} from './orcbrew'
import {characterRules} from './workshop-rules'
import {activeWorkshopEntries} from './workshop-schema'
import {workshopStartup} from './workshop-startup'
const mocks=vi.hoisted(()=>({enabled:vi.fn(),metadata:vi.fn(),read:vi.fn(),legacy:vi.fn()}))
vi.mock('./compendium-prepared',()=>({preparedReaderEnabled:mocks.enabled}))
vi.mock('./compendium-components',()=>({componentMetadata:mocks.metadata,componentContext:(p:any)=>p.sourceHash+':'+p.updatedAt.toISOString()+':'+p.data.filename+':'+p.data.includeDisabled,readComponentCatalogues:mocks.read}))
vi.mock('./workshop-library',()=>({workshopLibrary:mocks.legacy}))
const sources=['{:orcpub.dnd.e5/classes {:mage {:name "Mage" :description "Complete source fields"}} :orcpub.dnd.e5/races {:folk {:name "Folk" :description "Readable traits"}} :orcpub.dnd.e5/spells {:spark {:name "Spark" :description "Full text" :level 1}}}','{:orcpub.dnd.e5/subclasses {:secret {:name "Secret" :disabled? true}}}']
const metadata=sources.map((s,i)=>({_id:'pack-'+i,userId:'owner',sourceHash:sourceHash(s),updatedAt:new Date('2026-10-01'),data:{filename:'pack-'+i+'.orcbrew',includeDisabled:false}}))
const packs=sources.map((s,i)=>({id:metadata[i]!._id,filename:metadata[i]!.data.filename,includeDisabled:false,parsed:inspectOrcbrew(s)})),catalog=buildOrcbrewCatalog(packs),rules=characterRules(catalog)
const legacy={packs,catalog,...rules,warnings:[],docs:metadata.map((m,i)=>({...m,data:{...m.data,source:sources[i]}}))}
let revision=0
beforeEach(()=>{vi.clearAllMocks();for(const row of metadata)row.updatedAt=new Date(Date.parse('2026-10-01')+(++revision));mocks.enabled.mockReturnValue(true);mocks.metadata.mockResolvedValue(metadata);mocks.read.mockResolvedValue(packs);mocks.legacy.mockResolvedValue(legacy)})
it('returns the same complete authoring data and pack identities using only four prepared categories',async()=>{
 const value=await workshopStartup('owner')
 expect(value.classes).toEqual(activeWorkshopEntries(catalog.classes,'classes').map(e=>({...e,definitionRevision:0})));expect(value.races).toEqual(activeWorkshopEntries(catalog.races,'races').map(e=>({...e,definitionRevision:0})));expect(value.spells).toEqual(catalog.spells)
 expect(value.library.packs).toEqual(packs.map(p=>({id:p.id,filename:p.filename,hash:metadata.find(m=>m._id===p.id)!.sourceHash,entries:[...p.parsed.entries.classes,...p.parsed.entries.subclasses,...p.parsed.entries.races].map(e=>e.index)})))
 expect(value.library.packs[1]!.entries).toHaveLength(1);expect(value.subclasses).toHaveLength(0)
 expect(mocks.read).toHaveBeenCalledWith('owner',['classes','subclasses','races','spells'],metadata,false,expect.any(Number))
 expect(mocks.legacy).not.toHaveBeenCalled()
})
it.each(['off','missing','error','changed'])('falls back without a partial result when prepared data is %s',async condition=>{
 if(condition==='off')mocks.enabled.mockReturnValue(false)
 if(condition==='missing')mocks.read.mockResolvedValue(null)
 if(condition==='error')mocks.read.mockRejectedValue(new Error('temporary storage failure'))
 if(condition==='changed')mocks.metadata.mockResolvedValueOnce(metadata).mockResolvedValueOnce([{...metadata[0],sourceHash:'different'}])
 const fallback=await workshopStartup('owner')
 expect(fallback.classes).toEqual(activeWorkshopEntries(catalog.classes,'classes').map(e=>({...e,definitionRevision:0})));expect(mocks.legacy).toHaveBeenCalledWith('owner')
})
it('coalesces concurrent startup requests per owner and clears failed in-flight work',async()=>{
 let release!:(value:typeof packs)=>void;mocks.read.mockReturnValueOnce(new Promise(resolve=>{release=resolve}))
 const first=workshopStartup('owner'),second=workshopStartup('owner')
 for(let n=0;n<8;n++)await Promise.resolve()
 release(packs);expect(await second).toEqual(await first);expect(mocks.read).toHaveBeenCalledOnce()
 mocks.enabled.mockReturnValue(false);mocks.legacy.mockRejectedValueOnce(new Error('network'))
 await expect(workshopStartup('owner')).rejects.toThrow('network');expect((await workshopStartup('owner')).classes).toEqual(activeWorkshopEntries(catalog.classes,'classes').map(e=>({...e,definitionRevision:0})))
})
it('reuses a warm response only after current small owner metadata matches',async()=>{
 const reader=vi.fn(),first=await workshopStartup('owner',reader),count=mocks.metadata.mock.calls.length
 expect(reader).toHaveBeenLastCalledWith('prepared')
 expect(await workshopStartup('owner',reader)).toEqual(first);expect(reader).toHaveBeenLastCalledWith('resident');expect(mocks.read).toHaveBeenCalledOnce();expect(mocks.metadata).toHaveBeenCalledTimes(count+1)
 metadata[0]!.updatedAt=new Date(metadata[0]!.updatedAt.getTime()+1)
 mocks.read.mockResolvedValue(null)
 await workshopStartup('owner');expect(mocks.read).toHaveBeenCalledTimes(2);expect(mocks.legacy).toHaveBeenCalledOnce()
})
