import {beforeEach,expect,it,vi} from 'vitest'
import {createSSRApp,type Component} from 'vue'
import {renderToString} from 'vue/server-renderer'
import type {EquipmentItem} from '../../../shared/character'
import ItemComposer from './ItemComposer.vue'
import type {ItemComposerProps} from './item-composer-props'
import {newLinkedTracker} from '../../../shared/linked-trackers'
const mocks=vi.hoisted(()=>({post:vi.fn(),put:vi.fn(),giveItem:vi.fn()}))
vi.mock('../../lib/api',()=>({api:{post:mocks.post,put:mocks.put,get:vi.fn()}}))
vi.mock('../../stores/characters',()=>({useCharactersStore:()=>({giveItem:mocks.giveItem})}))
const benefits=[{type:'spell-attack-bonus',value:3,level:1},{type:'spell-dc-bonus',value:3,level:1}]
const item:EquipmentItem={name:'Custom focus',magical:true,kind:'accessory',qty:1,weight:1,notes:'Keep',equipped:false,benefits,requiresAttunement:true}
beforeEach(()=>{vi.clearAllMocks();mocks.post.mockResolvedValue({id:'saved'});mocks.put.mockResolvedValue({message:'Updated'});mocks.giveItem.mockResolvedValue({message:'Given'})})
async function render(mode:ItemComposerProps['mode'],capture:(bindings:any)=>void,initial:EquipmentItem=item){const original=ItemComposer as any,events:unknown[][]=[];const app=createSSRApp({...original,setup(p:unknown,c:any){const b=original.setup(p,{...c,emit:(...args:unknown[])=>events.push(args)});b.page.value='create';capture(b);return b}} as Component,{mode,initial,characterId:'hero'});app.directive('stable-loading',{});const context:{teleports?:Record<string,string>}={};const html=await renderToString(app,context);return {html:html+(context.teleports?.['.site-shell']??''),events}}
it('shows the same Benefits editor and saves configured grants in a new item',async()=>{
 let b:any;const {html}=await render('library',v=>b=v);expect(html).toContain('Rule benefits');expect(html).toContain('Spell attack bonus');expect(html).toContain('Spell save DC bonus');expect(html).toContain('attuned');await b.submit();expect(mocks.post.mock.calls[0]![1].item.benefits).toEqual(benefits)
})
it('passes benefits through giving and character drafts',async()=>{
 let b:any;await render('give',v=>b=v);await b.submit();expect(mocks.giveItem).toHaveBeenCalledWith('hero',expect.objectContaining({benefits}),expect.any(String),true)
 const {events}=await render('draft',v=>b=v);b.remember.value=false;await b.submit();expect(events).toContainEqual(['add',expect.objectContaining({benefits})])
})
it('updates and removes benefits on a saved item without mutating its initial definition',async()=>{
 let b:any;const initial={...item,templateId:'saved'};await render('library',v=>b=v,initial);b.itemBenefits.value=[];await b.submit();expect(mocks.put).toHaveBeenCalledWith('/api/items/saved',expect.objectContaining({item:expect.objectContaining({benefits:[]})}));expect(initial.benefits).toEqual(benefits)
})
it('explains invalid Benefits and blocks submission until they are fixed',async()=>{
 let b:any;await render('library',v=>b=v);b.itemBenefits.value=[{type:'spell-dc-bonus',value:100}];expect(b.benefitIssue.value).toMatch(/Benefit 1/);expect(b.canSubmit.value).toBe(false);await b.submit();expect(mocks.post).not.toHaveBeenCalled();b.itemBenefits.value=benefits;expect(b.canSubmit.value).toBeTruthy()
})
it('keeps Compendium entry mode on its own Benefits step',async()=>{const {html}=await render('entry',()=>{});expect(html).not.toContain('aria-label="Rule benefits"')})
it('offers the same linked tracker controls in library and Compendium item editing and preserves IDs when saving',async()=>{
 const tracker={...newLinkedTracker(),name:'Spell charges'},initial={...item,templateId:'saved',trackers:[tracker]};let b:any
 const {html}=await render('library',value=>b=value,initial);expect(html).toContain('Linked trackers');b.itemTrackers.value=[{...tracker,name:'Renamed charges'}];await b.submit();expect(mocks.put.mock.calls[0]![1].item.trackers).toEqual([{...tracker,name:'Renamed charges'}]);expect((await render('entry',()=>{},initial)).html).toContain('Linked trackers')
})
it('blocks invalid tracker definitions without discarding the draft',async()=>{let b:any;await render('library',v=>b=v);b.itemTrackers.value=[{...newLinkedTracker(),max:0}];expect(b.canSubmit.value).toBe(false);expect(b.trackerIssue.value).toContain('1');await b.submit();expect(mocks.post).not.toHaveBeenCalled();expect(b.itemTrackers.value[0].max).toBe(0)})
