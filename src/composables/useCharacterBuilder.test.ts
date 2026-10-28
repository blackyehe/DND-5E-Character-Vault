import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
import {createRenderer,nextTick} from 'vue'
import {useCharacterBuilder} from './useCharacterBuilder'
import {srd,type CreationOptions} from '../lib/srd'
import {loadCreationOptions} from '../lib/creation-options-cache'
vi.mock('../lib/creation-options-cache',()=>({loadCreationOptions:vi.fn()}))
vi.mock('../stores/auth',()=>({useAuthStore:()=>({user:{id:'test-owner'}})}))
vi.mock('../lib/srd',()=>({contentLabel:(e:{name:string})=>e.name,homebrew:{creationOptions:vi.fn()},srd:{classes:vi.fn(),races:vi.fn(),backgrounds:vi.fn(),equipment:vi.fn(),languages:vi.fn(),race:vi.fn()}}))
const options=():CreationOptions=>({classes:[],races:[{index:'homebrew-races-test',name:'Imported race',url:'',sourcePack:'Book',speed:30,alignment:'',age:'',size:'Medium',language_desc:'',traits:[],subraces:[],languages:[],ability_bonuses:[],homebrew_traits:[],homebrew:true}],backgrounds:[],subraces:[],subclasses:[],feats:[],languages:[],spells:[]})
const renderer=createRenderer<any,any>({patchProp:()=>{},insert:()=>{},remove:()=>{},createElement:()=>({}),createText:()=>({}),createComment:()=>({}),setText:()=>{},setElementText:()=>{},parentNode:()=>null,nextSibling:()=>null})
let app:ReturnType<typeof renderer.createApp>|undefined
function mount(){let builder!:ReturnType<typeof useCharacterBuilder>;app=renderer.createApp({setup(){builder=useCharacterBuilder();return()=>null}});app.mount({});return builder}
beforeEach(()=>{
 vi.clearAllMocks();vi.stubGlobal('localStorage',{getItem:vi.fn().mockReturnValue(null),setItem:vi.fn(),removeItem:vi.fn()})
 for(const key of ['classes','races','backgrounds','equipment','languages'] as const)vi.mocked(srd[key]).mockResolvedValue([])
 vi.mocked(loadCreationOptions).mockResolvedValue(options())
})
afterEach(()=>{app?.unmount();vi.unstubAllGlobals()})
describe('imported builder loading and recovery',()=>{
 it('loads all imported choices in one request and selects an imported race without an SRD lookup',async()=>{
  const builder=mount();await vi.waitFor(()=>expect(builder.ready.value).toBe(true))
  expect(loadCreationOptions).toHaveBeenCalledOnce();expect(builder.races.value.map(e=>e.index)).toEqual(['homebrew-races-test'])
  builder.chooseRace('homebrew-races-test');await nextTick();await vi.waitFor(()=>expect(builder.race.value?.name).toBe('Imported race'))
  expect(srd.race).not.toHaveBeenCalled();expect(builder.warnings.value).toEqual([])
 })
 it('makes a failed imported load visible and retries without losing the current draft',async()=>{
  vi.mocked(loadCreationOptions).mockRejectedValueOnce(new Error('Temporary outage'))
  const builder=mount();await vi.waitFor(()=>expect(builder.ready.value).toBe(true))
  expect(builder.warnings.value.join()).toContain('Imported character options could not load')
  builder.draft.name='Keep this draft';builder.draft.scores.str=17
  await builder.reloadLibrary()
  expect(builder.draft.name).toBe('Keep this draft');expect(builder.draft.scores.str).toBe(17)
  expect(builder.races.value).toHaveLength(1);expect(builder.warnings.value).toEqual([])
  vi.mocked(loadCreationOptions).mockRejectedValueOnce(new Error('Another outage'))
  await builder.reloadLibrary();expect(builder.races.value).toHaveLength(1)
 })
})
