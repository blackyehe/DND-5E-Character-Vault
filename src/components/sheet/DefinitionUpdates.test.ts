import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {createRenderer,reactive,ssrContextKey,type Component} from 'vue'
import {useAuthStore} from '../../stores/auth'
import DefinitionUpdates from './DefinitionUpdates.vue'
const get=vi.hoisted(()=>vi.fn())
vi.mock('../../lib/api',()=>({api:{get}}))
vi.mock('../../stores/auth',async()=>{const {reactive}=await import('vue');const auth=reactive({user:{id:'owner'}});return {useAuthStore:()=>auth}})
vi.mock('../compendium/DefinitionChangeReview.vue',()=>({default:{render:()=>null}}))
const renderer=createRenderer<object,object>({patchProp(){},insert(){},remove(){},createElement:()=>({}),createText:()=>({}),createComment:()=>({}),setText(){},setElementText(){},parentNode:()=>null,nextSibling:()=>null})
const props=reactive({characterId:'hero',roomId:undefined as string|undefined,canApply:true,disabled:false}),events:unknown[][]=[]
let bindings:any,stop:(()=>void)|undefined
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>resolve=r);return {promise,resolve}}
function mount(){const original=DefinitionUpdates as any,app=renderer.createApp({...original,setup(_:unknown,context:any){bindings=original.setup(props,{...context,emit:(...e:unknown[])=>events.push(e)});return bindings},render:()=>null} as Component,props);app.provide(ssrContextKey,{modules:new Set()});app.mount({});stop=()=>app.unmount()}
beforeEach(()=>{vi.stubGlobal('window',new EventTarget());vi.stubGlobal('document',{visibilityState:'visible'});Object.assign(props,{characterId:'hero',roomId:undefined,canApply:true,disabled:false});(useAuthStore().user as any).id='owner';get.mockReset().mockResolvedValue([]);events.length=0})
afterEach(()=>{stop?.();stop=undefined;vi.unstubAllGlobals()})
it('uses the room assignment boundary for a player and never sends a character write',async()=>{props.roomId='room';props.canApply=false;mount();await vi.waitFor(()=>expect(bindings.busy.value).toBe(false));expect(get).toHaveBeenCalledExactlyOnceWith('/api/rooms/room/characters/hero/rule-updates',expect.objectContaining({signal:expect.any(AbortSignal)}))})
it('discards late updates after a character or account switch',async()=>{const old=deferred<unknown[]>();get.mockReturnValueOnce(old.promise);mount();const signal=get.mock.calls[0]![1].signal;props.characterId='other';await vi.waitFor(()=>expect(get).toHaveBeenCalledTimes(2));expect(signal.aborted).toBe(true);old.resolve([{kind:'feats',index:'old',name:'Old account rule'}]);await Promise.resolve();expect(bindings.updates.value).toEqual([]);(useAuthStore().user as any).id='another';await vi.waitFor(()=>expect(get).toHaveBeenCalledTimes(3))})
it('defers checks while editing and does not reload sources after every play save',async()=>{props.disabled=true;mount();expect(get).not.toHaveBeenCalled();props.disabled=false;await vi.waitFor(()=>expect(get).toHaveBeenCalledTimes(1));props.disabled=true;await Promise.resolve();props.disabled=false;await Promise.resolve();expect(get).toHaveBeenCalledTimes(1);const pending=deferred<unknown[]>();get.mockReturnValueOnce(pending.promise);const request=bindings.load();stop!();stop=undefined;pending.resolve([{kind:'feats',index:'late',name:'Late'}]);await request;expect(bindings.updates.value).toEqual([])})
