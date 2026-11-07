import {beforeEach,expect,it,vi} from 'vitest'
const state=vi.hoisted(()=>({docs:[] as any[],cached:vi.fn(),parse:vi.fn(),read:vi.fn(),build:vi.fn(),find:vi.fn()}))
vi.mock('../models/CustomContent',()=>({CustomContent:{find:(filter:unknown)=>{state.find(filter);const q={select:()=>q,sort:()=>q,lean:async()=>state.docs};return q}}}))
vi.mock('./pack-source',()=>({readPackDocuments:state.read}))
vi.mock('./orcbrew-library',()=>({parsedPack:state.parse,cachedParsedPack:state.cached}))
vi.mock('./orcbrew',()=>({buildOrcbrewCatalog:state.build}))
vi.mock('./workshop-schema',()=>({activeWorkshopEntries:(entries:unknown)=>entries}))
import {targetedCompendiumSource} from './compendium-entry-source'
const id='a'.repeat(24),index='homebrew-classes-current',locator={index,name:'Current',url:'',sourcePacks:['Current file.orcbrew'],aliases:[],source:'merged'},entry={index,name:'Current',url:'',homebrew:true,details:{':description':'Current rules'}},resident={entries:'exact resident parse'}
beforeEach(()=>{state.docs=[{_id:id,sourceHash:'current-hash',data:{filename:'Current file.orcbrew',includeDisabled:true}}];for(const f of [state.cached,state.parse,state.read,state.build,state.find])f.mockReset();state.cached.mockReturnValue(resident);state.build.mockReturnValue({classes:[entry]});state.parse.mockReturnValue({entries:'fresh parse'});state.read.mockResolvedValue([{_id:id,sourceHash:'new-hash',data:{filename:'Replaced file.orcbrew',includeDisabled:false,source:'fresh source'}}])})
it('reuses a resident parse only after looking up the owner’s current source fingerprint',async()=>{
 const value=await targetedCompendiumSource('owner','classes',index,locator)
 expect(state.find).toHaveBeenCalledWith({userId:'owner',type:'orcbrew','data.filename':{$in:['Current file.orcbrew']}})
 expect(state.cached).toHaveBeenCalledWith('current-hash');expect(state.read).not.toHaveBeenCalled();expect(state.parse).not.toHaveBeenCalled()
 expect(state.build).toHaveBeenCalledWith([{id,filename:'Current file.orcbrew',includeDisabled:true,parsed:resident}]);expect(value).toMatchObject({source:'merged',details:{':description':'Current rules'}})
})
it('does not use a resident parse when the authorized pack is missing',async()=>{
 state.docs=[];expect(await targetedCompendiumSource('stranger','classes',index,locator)).toBeNull();expect(state.cached).not.toHaveBeenCalled();expect(state.read).not.toHaveBeenCalled()
})
it('reads and parses the current source on a miss, using its current filename and disabled flag',async()=>{
 state.cached.mockReturnValue(undefined);expect(await targetedCompendiumSource('owner','classes',index,locator)).not.toBeNull()
 expect(state.read).toHaveBeenCalledWith('owner',id);expect(state.parse).toHaveBeenCalledWith({filename:'Replaced file.orcbrew',includeDisabled:false,source:'fresh source'})
 expect(state.build).toHaveBeenCalledWith([{id,filename:'Replaced file.orcbrew',includeDisabled:false,parsed:{entries:'fresh parse'}}])
})
