import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { computed, createRenderer, h, nextTick } from 'vue'
import { emptyCharacter, type Character } from '../../shared/character'
import { resolveCharacterProgression } from '../../shared/character-progression'
import { useCharactersStore } from '../stores/characters'
import { useAuthStore } from '../stores/auth'
import { api } from '../lib/api'
import { sheetReferenceCache } from '../lib/sheet-reference-cache'
import { provideSheetLibrary } from './useSheetLibrary'
import { combatSuggested } from '../lib/character-sheet'

vi.mock('../lib/api',()=>({api:{get:vi.fn(),patch:vi.fn(),post:vi.fn(),delete:vi.fn()}}))
const renderer=createRenderer<object,object>({patchProp(){},insert(){},remove(){},
  createElement:()=>({}),createText:()=>({}),createComment:()=>({}),setText(){},setElementText(){},
  parentNode:()=>null,nextSibling:()=>null})
let stop:(()=>void)|undefined
let saved:Character
let pinia:ReturnType<typeof createPinia>
beforeEach(()=>{
  pinia=createPinia();setActivePinia(pinia);vi.clearAllMocks();sheetReferenceCache.clear()
  useAuthStore().user={id:'account',email:'',displayName:''}
  saved=resolveCharacterProgression({...emptyCharacter(),_id:'character',updatedAt:'v1'})
  useCharactersStore().libraryRevision='pack-1'
  vi.mocked(api.get).mockImplementation(async path=>path.endsWith('/references')
    ?{character:structuredClone(saved),spells:[],feats:[],races:[],subclasses:[],classes:[],backgrounds:[]}
    :{character:structuredClone(saved),spells:{},libraryRevision:useCharactersStore().libraryRevision})
})
afterEach(()=>{stop?.();stop=undefined})
function mount(){
  let library!:ReturnType<typeof provideSheetLibrary>
  const store=useCharactersStore()
  const app=renderer.createApp({setup(){library=provideSheetLibrary(computed(()=>store.current!));return()=>h('div')}})
  app.use(pinia);app.mount({});stop=()=>app.unmount()
  return library
}
const referenceCalls=()=>vi.mocked(api.get).mock.calls.filter(([path])=>path.endsWith('/references')).length
const complete=async(library:ReturnType<typeof mount>)=>vi.waitFor(()=>expect(library.loading.value).toBe(false))

describe('reference caching in the mounted sheet library',()=>{
  it('classifies imported Grim Harvest with trailing whitespace as a subclass combat feature',async()=>{
    const store=useCharactersStore()
    saved.meta.klass='Sorcerer';saved.meta.subclass='Blood Magic';saved.meta.level=3
    const description='Whenever you hit a creature with one of your blood spells, if the creature has blood, you heal half the damage. If an enemy creature dies in an area at most 60 ft. from you, you regain Sorcery points equal to your proficiency bonus.'
    saved.features=[{name:'Grim Harvest ',description,pinned:false}]
    vi.mocked(api.get).mockImplementation(async path=>path.endsWith('/references')
      ?{character:structuredClone(saved),spells:[],feats:[],races:[],classes:[],backgrounds:[],subclasses:[{name:'Blood Magic',traits:[{name:'Grim Harvest ',description,level:3}]}]}
      :{character:structuredClone(saved),spells:{},libraryRevision:store.libraryRevision})
    await store.fetchOne(saved._id,{quick:true})
    const library=mount();await complete(library)
    expect(library.features.value[0]).toMatchObject({name:'Grim Harvest ',origin:'subclass',level:3})
    expect(combatSuggested(library.features.value[0]!)).toBe(true)
    expect(store.current!.features[0]?.origin).toBeUndefined()
  })

  it('reuses an unchanged response only after another fresh quick read',async()=>{
    const store=useCharactersStore()
    await store.fetchOne(saved._id,{quick:true});let library=mount();await complete(library)
    expect(referenceCalls()).toBe(1)
    stop!();stop=undefined;store.current=null
    await store.fetchOne(saved._id,{quick:true});library=mount();await complete(library)
    expect(referenceCalls()).toBe(1)
    expect(vi.mocked(api.get).mock.calls.filter(([path])=>path.includes('view=quick'))).toHaveLength(2)
    expect(library.referenceSource.value).toBe('cache')
    expect(store.loadHistory[0]?.source).toBe('cache')
    expect(store.loadHistory[0]?.referenceMs).not.toBeNull()
  })
  it('keeps live counters and opening measurements without reloading definitions',async()=>{
    const store=useCharactersStore()
    await store.fetchOne(saved._id,{quick:true});const library=mount();await complete(library)
    const firstMs=store.lastOpenMs
    store.current!.combat.hpCurrent=3;store.current!.combat.hpTemp=2;store.current!.updatedAt='v2'
    await nextTick();await complete(library)
    expect(referenceCalls()).toBe(1)
    expect(store.current!.combat.hpCurrent).toBe(3)
    // Polls can refresh play state without rewriting the opening measurement.
    saved=JSON.parse(JSON.stringify(store.current!));await store.fetchOne(saved._id,{quick:true})
    expect(store.lastOpenMs).toBe(firstMs);expect(store.loadHistory).toHaveLength(1)
  })
  it('fetches changed library revisions and supports an explicit force refresh',async()=>{
    const store=useCharactersStore()
    await store.fetchOne(saved._id,{quick:true});const library=mount();await complete(library)
    store.libraryRevision='pack-2';await nextTick();await complete(library)
    expect(referenceCalls()).toBe(2)
    await library.reload();expect(referenceCalls()).toBe(3)
  })
  it('refreshes approved spell definitions on an open sheet without a pack revision change',async()=>{
    const store=useCharactersStore()
    await store.fetchOne(saved._id,{quick:true});const library=mount();await complete(library)
    saved.compendiumRules=[{kind:'spells',index:'acid-arrow',revision:1,sourceHash:'approved-source',before:{index:'acid-arrow',name:'Acid Arrow'},entry:{index:'acid-arrow',name:'Acid Arrow',desc:['Approved rules']}}]
    saved.updatedAt='approved-v2';store.current=structuredClone(saved)
    await nextTick();await complete(library)
    expect(referenceCalls()).toBe(2)
  })
  it('does not reuse references after a saved version changes',async()=>{
    const store=useCharactersStore()
    await store.fetchOne(saved._id,{quick:true});const library=mount();await complete(library)
    stop!();stop=undefined;store.current=null;saved.updatedAt='v2'
    await store.fetchOne(saved._id,{quick:true});const reopened=mount();await complete(reopened)
    expect(referenceCalls()).toBe(2);expect(reopened.referenceSource.value).toBe('network')
  })
  it('counts the initial server refresh when rule hydration restarts the library',async()=>{
    const store=useCharactersStore()
    await store.fetchOne(saved._id,{quick:true})
    saved.features=[{name:'Resolved feature',description:'Updated rules',origin:'class'}]
    const library=mount();await complete(library)
    expect(referenceCalls()).toBe(1)
    expect(store.current!.features[0]?.name).toBe('Resolved feature')
    expect(store.loadHistory[0]?.source).toBe('network')
    expect(store.loadHistory[0]?.referenceMs).toBeGreaterThan(0)
  })
})
