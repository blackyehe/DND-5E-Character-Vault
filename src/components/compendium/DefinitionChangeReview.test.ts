import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {createRenderer,reactive,ssrContextKey,type Component} from 'vue'
import {ApiError} from '../../lib/api'
import {useAuthStore} from '../../stores/auth'
import DefinitionChangeReview from './DefinitionChangeReview.vue'
import type {DefinitionReview,DefinitionReviewRow} from '../../../shared/definition-review'
const mocks=vi.hoisted(()=>({get:vi.fn(),post:vi.fn()}))
vi.mock('../../lib/api',()=>({api:{get:mocks.get,post:mocks.post},ApiError:class extends Error{status:number;constructor(status:number,message:string){super(message);this.status=status}}}))
vi.mock('../../stores/auth',async()=>{const {reactive}=await import('vue');const state=reactive({user:{id:'owner'}});return {useAuthStore:()=>state}})
const renderer=createRenderer<object,object>({patchProp(){},insert(){},remove(){},createElement:()=>({}),createText:()=>({}),createComment:()=>({}),setText(){},setElementText(){},parentNode:()=>null,nextSibling:()=>null})
let bindings:any,stop:(()=>void)|undefined
const props=reactive({characterId:undefined as string|undefined,kind:'feats',index:'contractor',version:1,disabled:false}),events:unknown[][]=[]
const row:DefinitionReviewRow={id:'a'.repeat(24),name:'Volenta',updatedAt:'saved',reviewHash:'b'.repeat(64),sourceConfirmation:true,alreadyReviewed:false,warnings:[],changes:[],statistics:[{label:'Spell attack',before:'+11',after:'+12'},{label:'Spell save DC',before:'19',after:'20'}]}
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>resolve=r);return {promise,resolve}}
function mount(){const original=DefinitionChangeReview as any;const app=renderer.createApp({...original,setup(_:unknown,context:any){bindings=original.setup(props,{...context,emit:(...e:unknown[])=>events.push(e)});return bindings},render:()=>null} as Component,props);app.provide(ssrContextKey,{modules:new Set()});app.mount({});stop=()=>app.unmount()}
beforeEach(()=>{Object.assign(props,{characterId:undefined,kind:'feats',index:'contractor',version:1,disabled:false});(useAuthStore().user as any).id='owner';mocks.get.mockReset().mockResolvedValue({revision:3,characters:[row]});mocks.post.mockReset().mockResolvedValue({});events.length=0})
afterEach(()=>{stop?.();stop=undefined})
it('requires source confirmation and applies exactly the revision and character that were reviewed',async()=>{
 mount();await bindings.load();await bindings.apply(row);expect(mocks.post).not.toHaveBeenCalled();bindings.confirmed.value[row.id]=true
 await bindings.apply(row);expect(mocks.post).toHaveBeenCalledWith('/api/compendium/feats/contractor/review/'+row.id,{expectedRevision:3,expectedUpdatedAt:'saved',reviewHash:row.reviewHash,confirmedSource:true});expect(bindings.applied.value[row.id]).toBe(true);expect(events).toContainEqual(['applied','Volenta'])
 await bindings.apply(row);expect(mocks.post).toHaveBeenCalledTimes(1)
})
it('requires a fresh comparison after an entry or character conflicts',async()=>{
 mount();await bindings.load();bindings.confirmed.value[row.id]=true;mocks.post.mockRejectedValueOnce(new ApiError(409,'Character changed'))
 await bindings.apply(row);expect(bindings.stale.value).toBe(true);expect(bindings.canApply(row)).toBe(false);expect(bindings.applied.value[row.id]).toBeUndefined()
 await bindings.load();expect(bindings.stale.value).toBe(false);expect(bindings.confirmed.value).toEqual({});expect(bindings.error.value).toBe('')
})
it.each(['blocked','alreadyReviewed'])('cannot apply a %s review even through the handler',async field=>{
 mount();await bindings.load();bindings.confirmed.value[row.id]=true;await bindings.apply({...row,[field]:true});expect(mocks.post).not.toHaveBeenCalled()
})
it('aborts and discards a comparison when the saved definition, draft or account changes',async()=>{
 mount();for(const change of [()=>props.version++,()=>props.disabled=true,()=>{props.disabled=false;(useAuthStore().user as any).id='other'}]){
  const pending=deferred<DefinitionReview>();mocks.get.mockReturnValueOnce(pending.promise);const loading=bindings.load(),signal=mocks.get.mock.calls.at(-1)![1].signal
  change();expect(signal.aborted).toBe(true);pending.resolve({revision:3,characters:[row]});await loading;expect(bindings.review.value).toBeNull();expect(bindings.error.value).toBe('')
 }
})
it('does not report a completed apply against a new definition or after unmount',async()=>{
 mount();await bindings.load();bindings.confirmed.value[row.id]=true;const pending=deferred<unknown>();mocks.post.mockReturnValueOnce(pending.promise);const saving=bindings.apply(row);props.index='other';stop!();stop=undefined;pending.resolve({});await saving;expect(bindings.applied.value).toEqual({});expect(events).not.toContainEqual(['applied','Volenta'])
})

it('limits a sheet review to its current character',async()=>{props.characterId=row.id;const other={...row,id:'other'};mocks.get.mockResolvedValue({revision:3,characters:[other,row]});mount();await bindings.load();expect(bindings.review.value.characters).toEqual([row]);bindings.confirmed.value.other=true;expect(bindings.canApply(other)).toBe(false);await bindings.apply(other);expect(mocks.post).not.toHaveBeenCalled()})
