import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {createRenderer,ssrContextKey,type Component} from 'vue'
import {newOptionTracker} from '../../../shared/option-trackers'
import {newOptionDraft} from '../../../shared/option-workshop'
import {useAuthStore} from '../../stores/auth'
import OptionWorkshop from './OptionWorkshop.vue'
const mocks=vi.hoisted(()=>({get:vi.fn(),post:vi.fn(),setItem:vi.fn()}))
vi.mock('../../lib/api',()=>({api:{get:mocks.get,post:mocks.post}}))
vi.mock('../../stores/auth',async()=>{const {reactive}=await import('vue');const state=reactive({user:{id:'owner'}});return {useAuthStore:()=>state}})
vi.mock('vue-router',()=>({onBeforeRouteLeave:vi.fn()}))
vi.mock('../../lib/workshop-trash',()=>({announceWorkshopChange:vi.fn()}))
vi.mock('../compendium/EntryBuilder.vue',()=>({default:{render:()=>null}}))
vi.mock('../compendium/DefinitionChangeReview.vue',()=>({default:{render:()=>null}}))
const renderer=createRenderer<object,object>({patchProp(){},insert(){},remove(){},createElement:()=>({}),createText:()=>({}),createComment:()=>({}),setText(){},setElementText(){},parentNode:()=>null,nextSibling:()=>null})
let bindings:any,stop:(()=>void)|undefined
const pack={id:'a'.repeat(24),filename:'Blacky.orcbrew',hash:'b'.repeat(64)}
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>resolve=r);return {promise,resolve}}
function option(){const draft=newOptionDraft('feats');draft.body.name='Zhaerin Contractor';draft.benefits=[{type:'spell-attack-bonus',value:1},{type:'spell-dc-bonus',value:1}];return draft}
function mount(){const original=OptionWorkshop as any;const app=renderer.createApp({...original,setup(p:unknown,c:unknown){bindings=original.setup(p,c);return bindings},render:()=>null} as Component);app.provide(ssrContextKey,{modules:new Set()});app.mount({});stop=()=>app.unmount()}
async function start(){mount();await vi.waitFor(()=>expect(bindings.loading.value).toBe(false));bindings.open(option());bindings.target.value=pack.id}
beforeEach(()=>{vi.stubGlobal('localStorage',{getItem:()=>null,setItem:mocks.setItem});vi.stubGlobal('window',{addEventListener(){},removeEventListener(){}});mocks.get.mockReset().mockResolvedValue({packs:[pack],options:[],warnings:[]});mocks.post.mockReset();mocks.setItem.mockReset();(useAuthStore().user as any).id='owner'})
afterEach(()=>{stop?.();stop=undefined;vi.unstubAllGlobals()})
it('releases a successful save without fetching the library again and uses the returned hash for a second save',async()=>{
 await start();const saved={...option(),published:{revision:1,index:'homebrew-feats-new',packId:pack.id,packHash:'c'.repeat(64)}}
 mocks.post.mockResolvedValue({draft:saved,message:'Saved',pack:{...pack,hash:saved.published.packHash}})
 await bindings.publish();expect(bindings.busy.value).toBe(false);expect(mocks.get).toHaveBeenCalledTimes(1);expect(bindings.reviewSaved.value).toBe(true)
 bindings.draft.value.benefits[0].value=2;expect(bindings.reviewSaved.value).toBe(false);expect(bindings.options.value[0].benefits[0].value).toBe(1)
 await bindings.publish();expect(mocks.post.mock.calls[1]![1].target).toEqual({packId:pack.id,expectedHash:'c'.repeat(64)});expect(mocks.setItem).toHaveBeenCalled()
})
it('allows saving another new option to a newly created pack immediately',async()=>{
 await start();bindings.target.value='new';bindings.filename.value='  New.orcbrew  '
 const draft={...bindings.draft.value,published:{revision:1,index:'new',packId:'d'.repeat(24),packHash:'e'.repeat(64)}}
 mocks.post.mockResolvedValue({draft,message:'Saved',pack:{id:draft.published.packId,filename:'New.orcbrew',hash:draft.published.packHash}})
 await bindings.publish();expect(mocks.post.mock.calls[0]![1].target).toEqual({filename:'New.orcbrew'});expect(bindings.packs.value[0].filename).toBe('New.orcbrew');expect(bindings.saveProblem.value).toBe('')
})
it('explains missing fields, unavailable packs and invalid benefits without sending a save',async()=>{
 await start();bindings.draft.value.body.name=' ';expect(bindings.saveProblem.value).toMatch(/name/);await bindings.publish();expect(mocks.post).not.toHaveBeenCalled()
 bindings.draft.value.body.name='Feat';bindings.draft.value.source=' ';expect(bindings.saveProblem.value).toMatch(/source/)
 bindings.draft.value.source='Homebrew';bindings.target.value='new';bindings.filename.value='invalid';expect(bindings.saveProblem.value).toMatch(/\.orcbrew/)
 bindings.target.value='missing';expect(bindings.saveProblem.value).toMatch(/unavailable/)
 bindings.target.value=pack.id;bindings.draft.value.benefits=[{type:'spell-dc-bonus',value:100}];expect(bindings.saveProblem.value).toMatch(/Benefit 1/)
})
it('retains the edited draft and old revision on a failed or conflicting save',async()=>{
 await start();const before=JSON.stringify(bindings.draft.value);mocks.post.mockRejectedValue(new Error('The pack changed. Reload its version.'))
 await bindings.publish();expect(bindings.error.value).toMatch(/pack changed/);expect(JSON.stringify(bindings.draft.value)).toBe(before);expect(bindings.busy.value).toBe(false);expect(mocks.setItem).toHaveBeenCalled()
})
it('ignores a save completing after the account changes or the view unmounts',async()=>{
 await start();const pending=deferred<unknown>();mocks.post.mockReturnValue(pending.promise);const saving=bindings.publish();(useAuthStore().user as any).id='other';pending.resolve({draft:option(),message:'Old account'});await saving;expect(bindings.draft.value).toBeNull();expect(bindings.notice.value).toBe('')
 bindings.open(option());bindings.target.value=pack.id;const later=deferred<unknown>();mocks.post.mockReturnValue(later.promise);const oldNotice=bindings.notice.value,second=bindings.publish();stop!();stop=undefined;later.resolve({draft:option(),message:'After unmount'});await second;expect(bindings.notice.value).toBe(oldNotice)
})

it('explains invalid tracker fields and marks tracker changes as requiring a fresh review',async()=>{
 await start();bindings.draft.value.body.trackers=[{...newOptionTracker(),max:0}];expect(bindings.saveProblem.value).toMatch(/uses/);await bindings.publish();expect(mocks.post).not.toHaveBeenCalled()
 bindings.draft.value.body.trackers[0].max=3;expect(bindings.saveProblem.value).toBe('')
 const saved=JSON.parse(JSON.stringify(bindings.draft.value));saved.published={revision:1,index:'saved',packId:pack.id,packHash:'c'.repeat(64)};mocks.post.mockResolvedValue({draft:saved,message:'Saved',pack:{...pack,hash:saved.published.packHash}})
 await bindings.publish();expect(bindings.reviewSaved.value).toBe(true);bindings.draft.value.body.trackers[0].name='New name';expect(bindings.reviewSaved.value).toBe(false)
})
