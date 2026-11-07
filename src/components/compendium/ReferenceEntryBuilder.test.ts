import {afterEach,expect,it} from 'vitest'
import {createRenderer,h,nextTick,reactive,ssrContextKey,type Component,type WritableComputedRef} from 'vue'
import {entryOptionDraft} from '../../../shared/entry-builders'
import ReferenceEntryBuilder from './ReferenceEntryBuilder.vue'

const renderer=createRenderer<object,object>({patchProp(){},insert(){},remove(){},createElement:()=>({}),createText:()=>({}),createComment:()=>({}),setText(){},setElementText(){},parentNode:()=>null,nextSibling:()=>null})
const stops:(()=>void)[]=[]
afterEach(()=>{stops.splice(0).forEach(stop=>stop())})

function mount(){
 let bindings!:Record<'optionsText'|'speakersText',WritableComputedRef<string>>
 const props=reactive({kind:'feats',step:'options',option:entryOptionDraft({name:'Resilient'}),benefits:[]}),original=ReferenceEntryBuilder as any
 const subject={...original,setup(p:unknown,c:unknown){bindings=original.setup(p,c);return bindings},render:()=>null} as Component
 const app=renderer.createApp({setup:()=>()=>h(subject,props)})
 app.provide(ssrContextKey,{modules:new Set()});app.mount({});stops.push(()=>app.unmount())
 return {props,bindings}
}

const fields=[['optionsText','options'],['speakersText','typicalSpeakers']] as const
it.each(fields)('%s preserves Enter and an unfinished next line while saving named entries',async(binding,field)=>{
 const {props,bindings}=mount(),text=bindings[binding]
 text.value='Strength';await nextTick()
 text.value+='\n';await nextTick()
 expect(text.value).toBe('Strength\n')
 expect(props.option[field]).toEqual(['Strength'])
 text.value+='Dexterity';await nextTick()
 expect(text.value).toBe('Strength\nDexterity')
 expect(props.option[field]).toEqual(['Strength','Dexterity'])
})

it.each(fields)('%s retains spacing and blank lines during editing without saving empty entries',async(binding,field)=>{
 const {props,bindings}=mount(),text=bindings[binding]
 text.value=' Strength \n\n Dexterity \n';await nextTick()
 expect(text.value).toBe(' Strength \n\n Dexterity \n')
 expect(props.option[field]).toEqual(['Strength','Dexterity'])
 props.step='review';await nextTick();props.step='options';await nextTick()
 expect(text.value).toBe(' Strength \n\n Dexterity \n')
 text.value='';await nextTick()
 expect(props.option[field]).toEqual([])
})

it.each(fields)('%s refreshes when the underlying list or option is replaced',async(binding,field)=>{
 const {props,bindings}=mount(),text=bindings[binding]
 props.option[field]=['Elves'];await nextTick()
 expect(text.value).toBe('Elves')
 props.option[field].push('Humans');await nextTick()
 expect(text.value).toBe('Elves\nHumans')
 props.option=entryOptionDraft({name:'Replacement'});await nextTick()
 expect(text.value).toBe('')
})
