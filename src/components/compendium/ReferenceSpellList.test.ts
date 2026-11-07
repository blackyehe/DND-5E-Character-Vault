import {afterEach,expect,it,vi} from 'vitest'
import {createRenderer,h,nextTick,reactive,shallowRef,ssrContextKey,type Component} from 'vue'
import ReferenceSpellList from './ReferenceSpellList.vue'
import {SPELL_REFERENCE_CONTEXT,type ReadingSpell} from '../../lib/compendium-references'

const renderer=createRenderer<object,object>({patchProp(){},insert(){},remove(){},createElement:()=>({}),createText:()=>({}),createComment:()=>({}),setText(){},setElementText(){},parentNode:()=>null,nextSibling:()=>null})
const stops:(()=>void)[]=[]
afterEach(()=>{stops.splice(0).forEach(stop=>stop())})
const spell=(index:string,level:number):[string,ReadingSpell]=>[index,{index,name:index,source:'Fixture',level}]
function mount(indexes:string[],initial:Map<string,ReadingSpell>=new Map()){
 let bindings:any
 const props=reactive({indexes}),names=shallowRef(initial),ensure=vi.fn(async()=>{}),original=ReferenceSpellList as any
 const subject={...original,setup(p:unknown,c:unknown){bindings=original.setup(p,c);return bindings},render:()=>null} as Component
 const app=renderer.createApp({setup:()=>()=>h(subject,props)});app.provide(ssrContextKey,{modules:new Set()});app.provide(SPELL_REFERENCE_CONTEXT,{names,ensure});app.mount({});stops.push(()=>app.unmount())
 return {bindings,props,names,ensure}
}
it('initially selects cantrips, then the lowest populated level when there are no cantrips',async()=>{
 const {bindings,props,ensure}=mount(['late','cantrip','early'],new Map([spell('late',9),spell('cantrip',0),spell('early',2)]))
 expect(bindings.activeGroup.value.level).toBe(0)
 expect(bindings.groups.value.map((g:any)=>g.level)).toEqual([0,2,9])
 expect(ensure).toHaveBeenCalledTimes(1)
 props.indexes=['late','early'];await nextTick();expect(bindings.activeGroup.value.level).toBe(2)
})
it('defaults correctly after asynchronous metadata and preserves an explicit selection while its level exists',async()=>{
 const {bindings,names}=mount(['cantrip','early','late','unknown'])
 expect(bindings.activeGroup.value.level).toBe(-1)
 names.value=new Map([spell('cantrip',0),spell('early',1),spell('late',3)]);await nextTick()
 expect(bindings.activeGroup.value.level).toBe(0)
 bindings.selectedLevel.value=3;await nextTick();expect(bindings.activeGroup.value.spells.map((s:any)=>s.index)).toEqual(['late'])
 names.value=new Map([spell('cantrip',0),spell('early',1),spell('late',3),spell('unknown',2)]);await nextTick()
 expect(bindings.activeGroup.value.level).toBe(3)
})
it('resets for a replacement collection and retains unresolved references in their own group',async()=>{
 const {bindings,props,names}=mount(['cantrip','late','unknown'],new Map([spell('cantrip',0),spell('late',3)]))
 bindings.selectedLevel.value=-1;await nextTick();expect(bindings.activeGroup.value.spells[0].index).toBe('unknown')
 names.value=new Map([spell('cantrip',0),spell('late',3),spell('unknown',1)]);await nextTick();expect(bindings.activeGroup.value.level).toBe(0)
 bindings.selectedLevel.value=3;props.indexes=['unknown','cantrip'];await nextTick();expect(bindings.activeGroup.value.level).toBe(0)
})
