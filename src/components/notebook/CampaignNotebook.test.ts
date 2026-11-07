import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
import {createRenderer,h,nextTick,reactive,ssrContextKey,type Component} from 'vue'
import type {NotebookIndex,NotebookSummary} from '../../../shared/notebook'
import CampaignNotebook from './CampaignNotebook.vue'
import {ApiError} from '../../lib/api'

const state=vi.hoisted(()=>({get:vi.fn(),post:vi.fn(),patch:vi.fn(),role:'player' as 'dm'|'player',scope:'scope-a',version:'v1',polls:[] as (()=>void)[]}))
vi.mock('../../lib/api',async original=>({...await original<typeof import('../../lib/api')>(),api:{
  get:(path:string,options?:{onResponse?:(response:Response)=>void})=>{
    options?.onResponse?.({headers:new Headers({'X-Notebook-Scope':state.scope,'X-Notebook-Navigation':state.version})} as Response)
    return Promise.resolve(state.get(path,options)).then(body=>{
      if(path.includes('/initial?')){const {entries,total,nextOffset,...navigation}=body;return {listing:{entries,total,nextOffset},navigation}}
      if((path.includes('/navigation?')||path.includes('/initial?'))){const {entries:_entries,total:_total,nextOffset:_offset,...navigation}=body;return navigation}
      if(new URL(path,'http://test').searchParams.get('navigation')==='false')return {entries:body.entries,total:body.total,nextOffset:body.nextOffset}
      return body
    })
  },post:state.post,patch:state.patch}}))
vi.mock('../../stores/auth',()=>({useAuthStore:()=>({user:{id:'viewer'}})}))
vi.mock('../../composables/useVisiblePolling',()=>({useVisiblePolling:(refresh:()=>void)=>state.polls.push(refresh)}))
vi.mock('./NotebookEditor.vue',()=>({default:{render:()=>null}}))
vi.mock('./NotebookFocusReader.vue',()=>({default:{render:()=>null}}))
const renderer=createRenderer<object,object>({patchProp(){},insert(){},remove(){},createElement:()=>({}),createText:()=>({}),createComment:()=>({}),setText(){},setElementText(){},parentNode:()=>null,nextSibling:()=>null})
const targets=[{id:'target',title:'Known title',section:'journal',codexType:'people',folder:''}]
const page=(changes:Partial<NotebookIndex>={}):NotebookIndex=>({entries:[],folders:[],total:0,nextOffset:null,characters:[],role:state.role,readOnly:false,counts:{people:1,places:0,objects:0,factions:0,quests:0,events:0,sessions:0},questCounts:{active:0,finished:0},sessionEntries:[],tags:[],entryCount:1,...changes})
const summary=(id:string,title=id):NotebookSummary=>({id,title,section:'journal',folderId:null,audience:'room',characterIds:[],relevantCharacterIds:[],revision:1,updatedAt:'2026-11-02',editedBy:'DM',deletedAt:null,codexType:'people',sessions:[],questStatus:null,tags:[]})
function deferred<T>(){let resolve!:(value:T)=>void,reject!:(error:Error)=>void;const promise=new Promise<T>((r,j)=>{resolve=r;reject=j});return {promise,resolve,reject}}
async function flush(){for(let n=0;n<8;n++)await Promise.resolve();await nextTick()}
let bindings:any,stop:(()=>void)|undefined
function mount(extra:Record<string,unknown>={}){
  const props=reactive({roomId:'room',role:state.role,...extra} as Record<string,unknown>&{roomId:string;role:'dm'|'player'}),original=CampaignNotebook as any
  const subject={...original,setup(props:unknown,context:unknown){bindings=original.setup(props,context);return bindings},render:()=>null} as Component
  const app=renderer.createApp({setup:()=>()=>h(subject,props)})
  app.provide(ssrContextKey,{modules:new Set()})
  app.mount({});stop=()=>app.unmount();return props
}
const listingCalls=()=>state.get.mock.calls.filter(c=>!c[0].includes('/link-targets')&&!c[0].includes('/navigation?'))
const navigationCalls=()=>state.get.mock.calls.filter(c=>c[0].includes('/navigation?')||c[0].includes('/initial?'))
const targetCalls=()=>state.get.mock.calls.filter(c=>c[0].includes('/link-targets'))
beforeEach(()=>{
  vi.useFakeTimers();state.get.mockReset();state.post.mockReset();state.patch.mockReset();state.role='player';state.scope='scope-a';state.version='v1';state.polls=[]
  state.get.mockImplementation((path:string)=>Promise.resolve(path.includes('/link-targets')?{entries:targets}:page()))
  vi.stubGlobal('window',new EventTarget());vi.stubGlobal('document',{visibilityState:'visible'})
  vi.stubGlobal('localStorage',{getItem:()=>null,setItem:vi.fn(),removeItem:vi.fn()})
})
afterEach(()=>{stop?.();stop=undefined;vi.useRealTimers();vi.unstubAllGlobals()})

describe('notebook startup and link-target reuse',()=>{
  it.each(['player','dm'] as const)('shares context for the %s initial listing/navigation and starts link targets alongside it',async role=>{
    state.role=role;const listing=deferred<NotebookIndex>(),links=deferred<{entries:typeof targets}>(),result=page()
    state.get.mockImplementation((path:string)=>path.includes('/link-targets')?links.promise:listing.promise)
    mount()
    expect(state.get).toHaveBeenCalledTimes(2)
    expect(navigationCalls()).toHaveLength(1)
    expect(new URL(listingCalls()[0]![0],'http://test').searchParams.get('type')).toBe(role==='player'?'all':'people')
    expect(new URL(listingCalls()[0]![0],'http://test').searchParams.get('navigation')).toBe('false')
    listing.resolve(result);links.resolve({entries:targets});await flush()
    expect(bindings.index.value).toEqual(result);expect(bindings.linkTargets.value).toEqual(targets)
    expect(state.get).toHaveBeenCalledTimes(2)
  })
  it('starts player previews at all while keeping preview scope on both requests',async()=>{
    state.role='dm';mount({previewCharacter:'hero'});await flush()
    for(const[path]of state.get.mock.calls)expect(new URL(path,'http://test').searchParams.get('previewCharacter')).toBe('hero')
    expect(new URL(listingCalls()[0]![0],'http://test').searchParams.get('type')).toBe('all')
    expect(state.get).toHaveBeenCalledTimes(2)
  })
  it('retains the DM fallback to all when People is empty',async()=>{
    state.role='dm';state.get.mockImplementation((path:string)=>Promise.resolve(path.includes('/link-targets')?{entries:targets}:page({counts:{...page().counts,people:0}})))
    mount();await flush()
    expect(listingCalls().map(c=>new URL(c[0],'http://test').searchParams.get('type'))).toEqual(['people','all'])
    expect(targetCalls()).toHaveLength(1)
  })
  it('reuses link targets across filters and unchanged polls, then reloads changed navigation',async()=>{
    mount();await flush();vi.advanceTimersByTime(60000)
    state.polls[0]!();await flush()
    bindings.category.value='places';await bindings.loadIndex()
    expect(listingCalls()).toHaveLength(3);expect(targetCalls()).toHaveLength(1)
    expect(navigationCalls()).toHaveLength(1)
    state.get.mockImplementation((path:string)=>Promise.resolve(path.includes('/link-targets')?{entries:targets}:page({entryCount:2})))
    state.version='v2';await bindings.loadIndex();await flush();expect(targetCalls()).toHaveLength(2)
  })
  it('reloads renamed visible targets, explicit refreshes and successful folder writes',async()=>{
    state.role='dm';mount();await flush()
    state.get.mockImplementation((path:string)=>Promise.resolve(path.includes('/link-targets')?{entries:targets}:page({entries:[summary('target','Renamed')]})))
    await bindings.loadIndex();await flush();expect(targetCalls()).toHaveLength(2)
    state.get.mockImplementation((path:string)=>Promise.resolve(path.includes('/link-targets')?{entries:targets}:page()))
    bindings.refresh();await flush();expect(targetCalls()).toHaveLength(3)
    state.post.mockResolvedValue({id:'folder'});await bindings.saveFolder();await flush()
    expect(targetCalls()).toHaveLength(4)
  })
  it('does not resurrect private data when parallel link-target loading loses access',async()=>{
    const listing=deferred<NotebookIndex>(),links=deferred<{entries:typeof targets}>()
    state.get.mockImplementation((path:string)=>path.includes('/link-targets')?links.promise:listing.promise)
    mount();links.reject(new ApiError(403,'Access ended'));await flush()
    expect(listingCalls()[0]![1].signal.aborted).toBe(true)
    listing.resolve(page());await flush()
    expect(bindings.index.value).toBeNull();expect(bindings.linkTargets.value).toEqual([]);expect(bindings.error.value).toBe('Access ended')
  })
  it.each([401,403,404])('clears cached titles when a listing loses access (%i)',async status=>{
    mount();await flush();state.get.mockRejectedValueOnce(new ApiError(status,'Access ended'))
    await bindings.loadIndex();expect(bindings.index.value).toBeNull();expect(bindings.linkTargets.value).toEqual([])
  })
  it('aborts the old scope and ignores late listing and title results',async()=>{
    const listing=deferred<NotebookIndex>(),links=deferred<{entries:typeof targets}>()
    state.get.mockImplementation((path:string)=>path.includes('/link-targets')?links.promise:listing.promise)
    const props=mount(),oldCalls=[...state.get.mock.calls]
    state.get.mockImplementation((path:string)=>Promise.resolve(path.includes('/link-targets')?{entries:[]}:page({total:2})))
    props.roomId='another-room';await flush()
    for(const[,options]of oldCalls)expect(options.signal.aborted).toBe(true)
    listing.resolve(page({total:99}));links.resolve({entries:targets});await flush()
    expect(bindings.index.value.total).toBe(2);expect(bindings.linkTargets.value).toEqual([])
  })
})

describe('split navigation permissions and invalidation',()=>{
  it('hides cached sessions/counts immediately after assignment revocation, then admits only matching fresh navigation',async()=>{
    const oldSession=summary('revoked','Private session')
    state.get.mockImplementation((path:string)=>Promise.resolve(path.includes('/link-targets')?{entries:targets}:page({characters:[{id:'hero',name:'Hero',assigned:true}],sessionEntries:[oldSession]})))
    mount();await flush();expect(bindings.index.value.sessionEntries).toHaveLength(1)
    const fresh=deferred<NotebookIndex>();state.scope='scope-b'
    state.get.mockImplementation((path:string)=>(path.includes('/navigation?')||path.includes('/initial?'))?fresh.promise:Promise.resolve(path.includes('/link-targets')?{entries:[]}:page()))
    const pending=bindings.loadIndex();await flush()
    expect(bindings.index.value).toBeNull();expect(bindings.linkTargets.value).toEqual([])
    fresh.resolve(page());await pending;await flush()
    expect(bindings.index.value.characters).toEqual([]);expect(bindings.index.value.sessionEntries).toEqual([])
    expect(navigationCalls()).toHaveLength(2)
  })
  it('does not let a late navigation response restore data after room access is revoked',async()=>{
    const old=deferred<NotebookIndex>()
    state.get.mockImplementation((path:string)=>path.includes('/link-targets')?Promise.resolve({entries:targets}):old.promise)
    mount();await flush();expect(bindings.index.value).toBeNull()
    state.get.mockRejectedValueOnce(new ApiError(404,'Room access ended'));await bindings.loadIndex()
    old.resolve(page({sessionEntries:[summary('secret')]}));await flush()
    expect(bindings.index.value).toBeNull();expect(bindings.linkTargets.value).toEqual([])
    expect(bindings.error.value).toBe('Room access ended')
  })
  it('drops a revoked character filter instead of retaining its cached navigation on a 400 response',async()=>{
    mount();await flush();bindings.relevant.value='revoked-character';state.scope='scope-b'
    state.get.mockImplementation((path:string)=>path.includes('/link-targets')?Promise.resolve({entries:[]}):new URL(path,'http://test').searchParams.get('character')==='revoked-character'?Promise.reject(new ApiError(400,'Character filter is unavailable')):Promise.resolve(page()))
    await bindings.loadIndex();await flush()
    expect(bindings.relevant.value).toBe('');expect(bindings.index.value.characters).toEqual([])
    expect(navigationCalls()).toHaveLength(2)
  })
  it('reacts to parent membership/assignment scope changes before showing replacement data',async()=>{
    const props=mount({accessScope:'members-a'});await flush();const fresh=deferred<NotebookIndex>()
    state.get.mockImplementation((path:string)=>(path.includes('/navigation?')||path.includes('/initial?'))?fresh.promise:Promise.resolve(path.includes('/link-targets')?{entries:[]}:page()))
    props.accessScope='members-b';await flush()
    expect(bindings.index.value).toBeNull()
    fresh.resolve(page());await flush();expect(bindings.index.value.sessionEntries).toEqual([])
  })
  it('refetches navigation on a visible mutation token and clears old metadata while it waits',async()=>{
    mount();await flush();const fresh=deferred<NotebookIndex>();state.version='v2'
    state.get.mockImplementation((path:string)=>(path.includes('/navigation?')||path.includes('/initial?'))?fresh.promise:Promise.resolve(path.includes('/link-targets')?{entries:[]}:page({total:2})))
    const pending=bindings.loadIndex();await flush()
    expect(bindings.index.value).toBeNull();expect(navigationCalls()).toHaveLength(2)
    fresh.resolve(page({entryCount:2}));await pending
    expect(bindings.index.value.entryCount).toBe(2);expect(bindings.index.value.total).toBe(2)
  })
  it('invalidates navigation after tag and entry mutations, not searches or page changes',async()=>{
    state.role='dm';mount();await flush()
    state.post.mockResolvedValue({name:'New tag'});expect(await bindings.createTag('New tag')).toBe(true)
    expect(navigationCalls()).toHaveLength(2)
    const entry={...summary('entry'),body:'Saved',relatedIds:[],questClues:[],coverImage:'',reading:{description:'Saved',encounters:'',relations:''},connections:[]}
    state.post.mockResolvedValue({id:'entry'})
    state.get.mockImplementation((path:string)=>Promise.resolve(path.includes('/entries/')?entry:path.includes('/link-targets')?{entries:targets}:page()))
    bindings.draft.value={title:'New',body:'Saved',section:'journal',folderId:null,audience:'room',characterIds:[],relevantCharacterIds:[],relatedIds:[]}
    await bindings.save();await flush();expect(navigationCalls()).toHaveLength(3)
    await bindings.loadIndex(true);bindings.search.value='Saved';vi.advanceTimersByTime(250);await flush()
    expect(navigationCalls()).toHaveLength(3)
  })
  it('loads the correct trash navigation without changing the old counts contract',async()=>{
    mount();await flush();bindings.toggleTrash();await flush()
    expect(navigationCalls()).toHaveLength(2)
    expect(new URL(navigationCalls().at(-1)![0],'http://test').searchParams.get('deleted')).toBe('true')
    expect(bindings.index.value.counts).toEqual(page().counts)
  })
})

describe('notebook search cancellation',()=>{
  it('keeps the 250ms debounce and cancels immediately, ignoring late responses during the delay',async()=>{
    mount();await flush();const old=deferred<NotebookIndex>()
    state.get.mockReturnValueOnce(old.promise);const pending=bindings.loadIndex(),signal=listingCalls().at(-1)![1].signal
    bindings.search.value='a';expect(signal.aborted).toBe(true)
    state.polls[0]!();expect(listingCalls()).toHaveLength(2)
    old.resolve(page({total:99}));await pending;expect(bindings.index.value.total).toBe(0)
    vi.advanceTimersByTime(200);bindings.search.value='ab'
    vi.advanceTimersByTime(249);expect(listingCalls()).toHaveLength(2)
    vi.advanceTimersByTime(1);await flush()
    expect(listingCalls()).toHaveLength(3)
    expect(new URL(listingCalls().at(-1)![0],'http://test').searchParams.get('search')).toBe('ab')
    expect(targetCalls()).toHaveLength(1)
  })
  it('ignores superseded search failures and keeps the latest result',async()=>{
    mount();await flush();const old=deferred<NotebookIndex>()
    state.get.mockReturnValueOnce(old.promise);const pending=bindings.loadIndex()
    state.get.mockResolvedValueOnce(page({total:7}));bindings.search.value='new';vi.advanceTimersByTime(250);await flush()
    old.reject(new ApiError(404,'stale denial'));await pending
    expect(bindings.index.value.total).toBe(7);expect(bindings.error.value).toBe('')
  })
  it('debounces connection search and cancels both section requests as one group',async()=>{
    mount();await flush();const old=deferred<NotebookIndex>()
    state.get.mockReturnValueOnce(old.promise).mockReturnValueOnce(old.promise)
    bindings.linkQuery.value='old';vi.advanceTimersByTime(249);expect(listingCalls()).toHaveLength(1)
    vi.advanceTimersByTime(1);expect(listingCalls()).toHaveLength(3)
    const calls=listingCalls().slice(-2),signal=calls[0]![1].signal
    for(const[path]of calls)expect(new URL(path,'http://test').searchParams.get('navigation')).toBe('false')
    expect(calls[1]![1].signal).toBe(signal)
    bindings.linkQuery.value='new';expect(signal.aborted).toBe(true)
    old.resolve(page({entries:[summary('stale')]}));await flush();expect(bindings.linkResults.value).toEqual([])
    state.get.mockResolvedValue(page({entries:[summary('latest')]}));vi.advanceTimersByTime(250);await flush()
    expect(bindings.linkResults.value.every((row:NotebookSummary)=>row.id==='latest')).toBe(true)
    expect(listingCalls()).toHaveLength(5)
  })
  it('aborts requests and cancels pending search timers when unmounted',async()=>{
    const pending=deferred<NotebookIndex>();state.get.mockReturnValue(pending.promise)
    mount();const calls=[...state.get.mock.calls];bindings.search.value='later';bindings.linkQuery.value='later'
    stop!();stop=undefined
    for(const[,options]of calls)expect(options.signal.aborted).toBe(true)
    vi.advanceTimersByTime(1000);expect(state.get).toHaveBeenCalledTimes(2)
    pending.resolve(page());await flush();expect(bindings.index.value).toBeNull()
  })
})
