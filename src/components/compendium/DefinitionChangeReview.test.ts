import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {createRenderer,createSSRApp,reactive,ssrContextKey,type Component} from 'vue'
import {renderToString} from 'vue/server-renderer'
import {ApiError} from '../../lib/api'
import {useAuthStore} from '../../stores/auth'
import DefinitionChangeReview from './DefinitionChangeReview.vue'
import type {DefinitionReview,DefinitionReviewRow} from '../../../shared/definition-review'
const mocks=vi.hoisted(()=>({get:vi.fn(),post:vi.fn()}))
vi.mock('../../lib/api',()=>({api:{get:mocks.get,post:mocks.post},ApiError:class extends Error{status:number;constructor(status:number,message:string){super(message);this.status=status}}}))
vi.mock('../../stores/auth',async()=>{const {reactive}=await import('vue');const state=reactive({user:{id:'owner'}});return {useAuthStore:()=>state}})
const renderer=createRenderer<object,object>({patchProp(){},insert(){},remove(){},createElement:()=>({}),createText:()=>({}),createComment:()=>({}),setText(){},setElementText(){},parentNode:()=>null,nextSibling:()=>null})
let bindings:any,stop:(()=>void)|undefined
const props=reactive({characterId:undefined as string|undefined,kind:'feats',index:'contractor',version:1,disabled:false,autoOpen:false}),events:unknown[][]=[]
const row:DefinitionReviewRow={id:'a'.repeat(24),name:'Volenta',updatedAt:'saved',reviewHash:'b'.repeat(64),sourceConfirmation:true,alreadyReviewed:false,warnings:[],changes:[],statistics:[{label:'Spell attack',before:'+11',after:'+12'},{label:'Spell save DC',before:'19',after:'20'}]}
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>resolve=r);return {promise,resolve}}
function mount(){const original=DefinitionChangeReview as any;const app=renderer.createApp({...original,setup(_:unknown,context:any){bindings=original.setup(props,{...context,emit:(...e:unknown[])=>events.push(e)});return bindings},render:()=>null} as Component,props);app.provide(ssrContextKey,{modules:new Set()});app.mount({});stop=()=>app.unmount()}
beforeEach(()=>{Object.assign(props,{characterId:undefined,kind:'feats',index:'contractor',version:1,disabled:false,autoOpen:false});(useAuthStore().user as any).id='owner';mocks.get.mockReset().mockResolvedValue({revision:3,characters:[row]});mocks.post.mockReset().mockResolvedValue({});events.length=0})
afterEach(()=>{stop?.();stop=undefined})
it('opens and loads in one action, then explicitly confirms the exact saved review once',async()=>{
 mount();await bindings.open();expect(bindings.opened.value).toBe(true);expect(mocks.get).toHaveBeenCalledTimes(1);expect(mocks.post).not.toHaveBeenCalled();expect(bindings.applyLabel.value).toBe('Update Volenta')
 await bindings.applySelected();expect(mocks.post).toHaveBeenCalledExactlyOnceWith('/api/compendium/feats/contractor/review/'+row.id,{expectedRevision:3,expectedUpdatedAt:'saved',reviewHash:row.reviewHash,confirmedSource:true});expect(bindings.applied.value[row.id]).toBe(true);expect(events).toContainEqual(['applied','Volenta']);await bindings.applySelected();expect(mocks.post).toHaveBeenCalledTimes(1)
})
it('updates only selected eligible rows and stops truthfully after a partial failure',async()=>{
 const second={...row,id:'second',name:'Second'},third={...row,id:'third',name:'Third'};mocks.get.mockResolvedValue({revision:3,characters:[row,second,third,{...row,id:'blocked',blocked:true},{...row,id:'current',alreadyReviewed:true}]});mount();await bindings.open();expect(bindings.selected.value).toEqual([row.id,'second','third'])
 bindings.selected.value=bindings.selected.value.filter((id:string)=>id!=='third');mocks.post.mockResolvedValueOnce({}).mockRejectedValueOnce(new ApiError(409,'Character changed'))
 await bindings.applySelected();expect(mocks.post).toHaveBeenCalledTimes(2);expect(bindings.notice.value).toBe('Updated Volenta.');expect(bindings.applied.value).toEqual({[row.id]:true});expect(bindings.stale.value).toBe(true);expect(bindings.canApply.value).toBe(false)
 await bindings.applySelected();expect(mocks.post).toHaveBeenCalledTimes(2)
 mocks.get.mockResolvedValue({revision:3,characters:[{...row,alreadyReviewed:true},second]});await bindings.load();expect(bindings.selected.value).toEqual(['second']);expect(bindings.stale.value).toBe(false)
})
it('requires a fresh comparison after any failed/ambiguous write',async()=>{
 mount();await bindings.open();mocks.post.mockRejectedValueOnce(new Error('Connection lost'));await bindings.applySelected();expect(bindings.stale.value).toBe(true);expect(bindings.applied.value[row.id]).toBeUndefined();await bindings.applySelected();expect(mocks.post).toHaveBeenCalledTimes(1)
})
it.each(['blocked','alreadyReviewed'])('does not send a %s row even if its ID is selected',async field=>{
 mocks.get.mockResolvedValue({revision:3,characters:[{...row,[field]:true}]});mount();await bindings.open();bindings.selected.value=[row.id];await bindings.applySelected();expect(mocks.post).not.toHaveBeenCalled()
})
it('aborts stale reads without unlocking a newer request',async()=>{
 mount();const old=deferred<DefinitionReview>();mocks.get.mockReturnValueOnce(old.promise);const loading=bindings.open();await vi.waitFor(()=>expect(mocks.get).toHaveBeenCalledTimes(1));const signal=mocks.get.mock.calls[0]![1].signal
 props.version++;expect(signal.aborted).toBe(true);const next=deferred<DefinitionReview>();mocks.get.mockReturnValueOnce(next.promise);const newer=bindings.open();await vi.waitFor(()=>expect(mocks.get).toHaveBeenCalledTimes(2));old.resolve({revision:1,characters:[row]});await loading;expect(bindings.busy.value).toBe(true);next.resolve({revision:4,characters:[]});await newer;expect(bindings.review.value.revision).toBe(4);expect(bindings.busy.value).toBe(false)
})
it('invalidates an in-flight confirmation on draft/account/source changes and unmount',async()=>{
 for(const change of [()=>props.disabled=true,()=>{(useAuthStore().user as any).id='other'},()=>props.index='other',()=>{stop!();stop=undefined}]){
  mount();await bindings.open();const pending=deferred<unknown>();mocks.post.mockReturnValueOnce(pending.promise);const saving=bindings.applySelected();change();pending.resolve({});await saving;expect(bindings.applied.value).toEqual({});stop?.();stop=undefined;props.disabled=false;(useAuthStore().user as any).id='owner';props.index='contractor'
 }
})
it('limits sheet updates to the current character and opens them automatically',async()=>{
 props.characterId=row.id;props.autoOpen=true;mocks.get.mockResolvedValue({revision:3,characters:[{...row,id:'other'},row]});mount();await vi.waitFor(()=>expect(bindings.review.value?.characters).toEqual([row]));bindings.selected.value=['other'];await bindings.applySelected();expect(mocks.post).not.toHaveBeenCalled()
})
it('renders the concise preview without a separate source checkbox or discovery step',async()=>{
 const original=DefinitionChangeReview as any;const html=await renderToString(createSSRApp({...original,setup(p:unknown,c:unknown){const b=original.setup(p,c);b.opened.value=true;b.review.value={revision:3,characters:[row]};b.selected.value=[row.id];return b}} as Component,{kind:'feats',index:'contractor',sourceName:'Contractor',hideTrigger:true}))
 expect(html).toContain('Update Volenta');expect(html).toContain('Character statistics');expect(html).not.toContain('Find affected characters');expect(html).not.toContain('type="checkbox"');expect(html).toContain('saved Contractor rules')
})
