import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
import {createRenderer,nextTick} from 'vue'
import {useCharacterBuilder} from './useCharacterBuilder'
import {srd,type CreationOptions} from '../lib/srd'
const client=vi.hoisted(()=>({load:vi.fn(),definition:vi.fn(),featDefinitions:vi.fn(),reset:vi.fn()}))
vi.mock('../lib/creation-selection-client',()=>({creationSelectionClient:()=>client}))
vi.mock('../stores/auth',()=>({useAuthStore:()=>({user:{id:'test-owner'}})}))
vi.mock('../lib/srd',()=>({contentLabel:(e:{name:string})=>e.name,homebrew:{creationOptions:vi.fn()},srd:{classes:vi.fn(),races:vi.fn(),backgrounds:vi.fn(),equipment:vi.fn(),languages:vi.fn(),race:vi.fn()}}))
const options=():CreationOptions=>({classes:[],races:[{index:'homebrew-races-test',name:'Imported race',url:'',sourcePack:'Book',speed:30,alignment:'',age:'',size:'Medium',language_desc:'',traits:[],subraces:[],languages:[],ability_bonuses:[],homebrew_traits:[],homebrew:true}],backgrounds:[],subraces:[],subclasses:[],feats:[],languages:[],spells:[]})
const renderer=createRenderer<any,any>({patchProp:()=>{},insert:()=>{},remove:()=>{},createElement:()=>({}),createText:()=>({}),createComment:()=>({}),setText:()=>{},setElementText:()=>{},parentNode:()=>null,nextSibling:()=>null})
let app:ReturnType<typeof renderer.createApp>|undefined
function mount(){let builder!:ReturnType<typeof useCharacterBuilder>;app=renderer.createApp({setup(){builder=useCharacterBuilder();return()=>null}});app.mount({});return builder}
beforeEach(()=>{
 vi.clearAllMocks();vi.stubGlobal('localStorage',{getItem:vi.fn().mockReturnValue(null),setItem:vi.fn(),removeItem:vi.fn()})
 for(const key of ['classes','races','backgrounds','equipment','languages'] as const)vi.mocked(srd[key]).mockResolvedValue([])
 vi.mocked(client.load).mockResolvedValue(options());client.featDefinitions.mockResolvedValue([])
})
afterEach(()=>{app?.unmount();vi.unstubAllGlobals()})
describe('imported builder loading and recovery',()=>{
 it('requests complete selected race rules instead of treating selection metadata as rules',async()=>{
  const full=options().races[0]!,data=options();data.races=[{index:full.index,name:full.name,url:'',selectionOnly:true,homebrew:true}] as never
  client.load.mockResolvedValue(data);client.definition.mockResolvedValue(full)
  const builder=mount();await vi.waitFor(()=>expect(builder.ready.value).toBe(true));expect(client.definition).not.toHaveBeenCalled()
  builder.chooseRace(full.index);await nextTick();await vi.waitFor(()=>expect(builder.race.value).toEqual(full));expect(client.definition).toHaveBeenCalledExactlyOnceWith('races',data.races[0]);expect(srd.race).not.toHaveBeenCalled()
 })
 it('restores selected feat text before allowing that selection into character rules',async()=>{
  const full={index:'feat-one',name:'Feat',description:'Complete feat rules',url:'',prerequisites:[],ability_increases:[],homebrew:true,sourcePack:'Book'}
  const data=options();data.feats=[{index:full.index,name:full.name,url:'',selectionOnly:true,homebrew:true}] as never;client.load.mockResolvedValue(data);client.featDefinitions.mockResolvedValue([full])
  vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify({version:1,name:'Restored',featLimitOverride:true,feats:['feat-one']}))
  const builder=mount();await vi.waitFor(()=>expect(builder.context.value.features.some(f=>f.description===full.description)).toBe(true));expect(client.featDefinitions).toHaveBeenCalledOnce();expect(builder.draft.name).toBe('Restored')
 })
 it('offers imported classes and their subclasses when the display name differs from the pack key',async()=>{
  const data=options();data.classes=[{index:'homebrew-class-oracle',name:'Dawn Oracle',contentKey:'oracle-key',aliases:[],url:'',hit_die:8,homebrew_traits:[],subclasses:[]}] as never
  data.subclasses=[{index:'homebrew-subclass-stars',name:'Star School',class:'oracle-key',url:'',traits:[]},{index:'homebrew-unrelated',name:'Other School',class:'other-key',url:'',traits:[]}] as never
  vi.mocked(client.load).mockResolvedValue(data)
  const builder=mount();await vi.waitFor(()=>expect(builder.ready.value).toBe(true));builder.chooseClass('homebrew-class-oracle');await nextTick();await vi.waitFor(()=>expect(builder.klass.value?.name).toBe('Dawn Oracle'))
  expect(builder.classes.value.map(e=>e.name)).toContain('Dawn Oracle');expect(builder.subclassOptions.value.map(e=>e.name)).toEqual(['Star School']);expect(builder.detailError.value).toBe('')
 })
 it('loads all imported choices in one request and selects an imported race without an SRD lookup',async()=>{
  const builder=mount();await vi.waitFor(()=>expect(builder.ready.value).toBe(true))
  expect(client.load).toHaveBeenCalledOnce();expect(builder.races.value.map(e=>e.index)).toEqual(['homebrew-races-test'])
  builder.chooseRace('homebrew-races-test');await nextTick();await vi.waitFor(()=>expect(builder.race.value?.name).toBe('Imported race'))
  expect(srd.race).not.toHaveBeenCalled();expect(builder.warnings.value).toEqual([])
 })
 it('makes a failed imported load visible and retries without losing the current draft',async()=>{
  vi.mocked(client.load).mockRejectedValueOnce(new Error('Temporary outage'))
  const builder=mount();await vi.waitFor(()=>expect(builder.ready.value).toBe(true))
  expect(builder.warnings.value.join()).toContain('Imported character options could not load')
  builder.draft.name='Keep this draft';builder.draft.scores.str=17
  await builder.reloadLibrary()
  expect(builder.draft.name).toBe('Keep this draft');expect(builder.draft.scores.str).toBe(17)
  expect(builder.races.value).toHaveLength(1);expect(builder.warnings.value).toEqual([])
  vi.mocked(client.load).mockRejectedValueOnce(new Error('Another outage'))
  await builder.reloadLibrary();expect(builder.races.value).toHaveLength(1)
 })
})
