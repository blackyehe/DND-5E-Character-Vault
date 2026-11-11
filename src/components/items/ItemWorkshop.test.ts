import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {createRenderer,ssrContextKey,type Component} from 'vue'
import ItemWorkshop from './ItemWorkshop.vue'
const get=vi.hoisted(()=>vi.fn())
vi.mock('../../lib/api',()=>({api:{get}}))
vi.mock('./ItemComposer.vue',()=>({default:{render:()=>null}}))
vi.mock('../workshop/WorkshopLibraryTools.vue',()=>({default:{render:()=>null}}))
vi.mock('../workshop/DeleteCreationButton.vue',()=>({default:{render:()=>null}}))
const renderer=createRenderer<object,object>({patchProp(){},insert(){},remove(){},createElement:()=>({}),createText:()=>({}),createComment:()=>({}),setText(){},setElementText(){},parentNode:()=>null,nextSibling:()=>null})
let bindings:any,stop:(()=>void)|undefined
const items=[{id:'item',item:{name:'Rope'}}],characters=[{_id:'hero',meta:{name:'Hero'}}]
function deferred<T>(){let resolve!:(value:T)=>void,reject!:(error:Error)=>void;const promise=new Promise<T>((r,j)=>{resolve=r;reject=j});return {promise,resolve,reject}}
function mount(){const original=ItemWorkshop as any;const app=renderer.createApp({...original,setup(props:unknown,context:unknown){bindings=original.setup(props,context);return bindings},render:()=>null} as Component);app.provide(ssrContextKey,{modules:new Set()});app.mount({});stop=()=>app.unmount()}
beforeEach(()=>{get.mockReset();bindings=undefined})
afterEach(()=>{stop?.();stop=undefined})
it('starts exactly two requests concurrently and keeps both result contracts',async()=>{
  const first=deferred<typeof items>(),second=deferred<typeof characters>()
  get.mockImplementation(path=>path==='/api/items'?first.promise:second.promise)
  mount()
  expect(get.mock.calls.map(c=>c[0])).toEqual(['/api/items','/api/characters'])
  expect(bindings.loading.value).toBe(true)
  second.resolve(characters);first.resolve(items)
  await vi.waitFor(()=>expect(bindings.loading.value).toBe(false))
  expect(bindings.items.value).toEqual(items);expect(bindings.characters.value).toEqual(characters)
})
it('ignores superseded success and errors and aborts both requests together',async()=>{
  const old=deferred<typeof items>()
  get.mockReturnValueOnce(old.promise).mockResolvedValueOnce(characters).mockResolvedValueOnce(items).mockResolvedValueOnce(characters)
  mount();const signal=get.mock.calls[0]![1].signal
  await bindings.load()
  expect(signal.aborted).toBe(true);expect(get.mock.calls[1]![1].signal).toBe(signal)
  old.reject(new Error('stale failure'));await Promise.resolve();await Promise.resolve()
  expect(bindings.error.value).toBe('');expect(bindings.items.value).toEqual(items)
})
it('keeps the existing failure/retry behavior without accepting late sibling results',async()=>{
  const sibling=deferred<typeof characters>()
  get.mockRejectedValueOnce(new Error('Access ended')).mockReturnValueOnce(sibling.promise)
  mount();await vi.waitFor(()=>expect(bindings.error.value).toBe('Access ended'))
  sibling.resolve(characters);await Promise.resolve();await Promise.resolve()
  expect(bindings.characters.value).toEqual([]);expect(bindings.loading.value).toBe(false)
  get.mockResolvedValueOnce(items).mockResolvedValueOnce(characters);await bindings.load()
  expect(bindings.error.value).toBe('');expect(bindings.characters.value).toEqual(characters)
})
it('aborts pending requests and ignores results after unmount',async()=>{
  const pending=deferred<typeof items>();get.mockReturnValue(pending.promise)
  mount();const signal=get.mock.calls[0]![1].signal;stop!();stop=undefined
  expect(signal.aborted).toBe(true);pending.resolve(items);await Promise.resolve();await Promise.resolve()
  expect(bindings.items.value).toEqual([])
})
it('opens character updates directly from a saved library item and guards active updates',async()=>{
 get.mockResolvedValue([]);mount();await vi.waitFor(()=>expect(bindings.loading.value).toBe(false))
 const open=vi.fn().mockResolvedValue(undefined);bindings.characterReview.value={open};const item={name:'Focus',templateId:'saved'}
 await bindings.review(item);expect(bindings.reviewItem.value).toEqual(item);expect(open).toHaveBeenCalledTimes(1)
 bindings.reviewBusy.value=true;await bindings.review({name:'Other'});expect(open).toHaveBeenCalledTimes(1);bindings.edit({name:'Other'});expect(bindings.open.value).toBe(false)
})
