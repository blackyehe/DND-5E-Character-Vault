<script setup lang="ts">
import { computed, ref } from 'vue'
import { protectedEntryField, cloneEntry, type EntryData } from '../../../shared/compendium-editing'
import { readingLabel } from '../../lib/compendium-reading'
const props=withDefaults(defineProps<{modelValue:unknown;label:string;depth?:number;root?:boolean;kind?:string}>(),{depth:0,root:false})
const emit=defineEmits<{'update:modelValue':[unknown]}>()
const object=computed(()=>props.modelValue&&typeof props.modelValue==='object'&&!Array.isArray(props.modelValue)?props.modelValue as EntryData:null)
const fields=computed(()=>Object.entries(object.value??{}).filter(([key])=>!protectedEntryField(key,props.root)&&!['benefits',':level-modifiers','level-modifiers'].includes(key)&&(props.label!=='Description and source notes'||!['stats','filterItem','upstream','sourceName'].includes(key))&&(!props.root||!object.value?.workshop||key==='workshop')&&(!props.root||props.kind!=='monsters'||!Object.keys((object.value?.details??{}) as EntryData).some(k=>k.startsWith(':'))||['name','details'].includes(key))).sort(([a],[b])=>a==='name'?-1:b==='name'?1:0))
const newField=ref(''),newType=ref('text'),fieldError=ref('')
const expanded=ref(props.depth===1&&props.label!=='Details')
function initialValue(type:string){return type==='number'?0:type==='boolean'?false:type==='rule'?{name:'',description:'',level:1}:type==='list'?[]:''}
function addField(){const key=newField.value.trim();if(!key||protectedEntryField(key,props.root)||Object.hasOwn(object.value??{},key)){fieldError.value='Choose a new field name that is not reserved.';return}set(key,initialValue(newType.value));newField.value='';fieldError.value=''}
function fieldLabel(key:string){return props.root&&props.kind==='monsters'&&key==='details'?'Statistics and rules':props.root&&key==='itemView'?'Description and source notes':props.root&&key==='workshopItem'?'Item statistics':readingLabel(key)}
function set(key:string,value:unknown){emit('update:modelValue',{...object.value,[key]:value})}
function item(index:number,value:unknown){const next=[...props.modelValue as unknown[]];next[index]=value;emit('update:modelValue',next)}
function remove(index:number){emit('update:modelValue',(props.modelValue as unknown[]).filter((_,i)=>i!==index))}
function blank(value:unknown,key=''):unknown{
  if(['id','_id','localId'].includes(key))return crypto.randomUUID()
  if(typeof value==='string')return ''
  if(typeof value==='number')return ['level','choose','startsAt'].includes(key)?1:0
  if(typeof value==='boolean')return false
  if(Array.isArray(value))return []
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,blank(v,k)]))
  return ''
}
function add(){const rows=props.modelValue as unknown[];emit('update:modelValue',[...rows,rows.length?blank(cloneEntry(rows[0])):initialValue(newType.value)])}
</script>
<template>
  <div v-if="root" class="entry-fields"><EntryFieldEditor v-for="[key,value] in fields" :key="key" :model-value="value" :label="fieldLabel(key)" :depth="depth+1" @update:model-value="set(key,$event)" /></div>
  <details v-else-if="object||Array.isArray(modelValue)" class="entry-field-group" :open="expanded" @toggle="expanded=($event.target as HTMLDetailsElement).open">
    <summary>{{label}} <small v-if="Array.isArray(modelValue)">{{modelValue.length}} {{modelValue.length===1?'entry':'entries'}}</small></summary>
    <div v-if="expanded&&object" class="entry-fields"><EntryFieldEditor v-for="[key,value] in fields" :key="key" :model-value="value" :label="readingLabel(key)" :depth="depth+1" @update:model-value="set(key,$event)" /><details><summary>Add a field</summary><div class="entry-add-field"><label class="entry-field">Field name<input v-model="newField" class="input-base" type="text" /></label><label class="entry-field">Value type<select v-model="newType" class="input-base"><option value="text">Text</option><option value="number">Number</option><option value="boolean">Yes / no</option><option value="rule">Rule</option><option value="list">List</option></select></label><button type="button" class="btn-ghost" @click="addField">Add field</button><p v-if="fieldError" role="alert">{{fieldError}}</p></div></details></div>
    <div v-else-if="expanded" class="entry-list"><div v-for="(value,i) in (modelValue as unknown[])" :key="i" class="entry-list-row"><EntryFieldEditor :model-value="value" :label="`${label} ${i+1}`" :depth="depth+1" @update:model-value="item(i,$event)"/><button type="button" class="btn-ghost" :aria-label="`Remove ${label} ${i+1}`" @click="remove(i)">Remove</button></div><label v-if="!(modelValue as unknown[]).length" class="entry-field">New entry type<select v-model="newType" class="input-base"><option value="text">Text</option><option value="number">Number</option><option value="boolean">Yes / no</option><option value="rule">Rule with name, description and level</option></select></label><button type="button" class="btn-ghost" @click="add">Add entry to {{label.toLowerCase()}}</button></div>
  </details>
  <label v-else-if="typeof modelValue==='boolean'" class="entry-check"><input type="checkbox" :checked="modelValue" @change="emit('update:modelValue',($event.target as HTMLInputElement).checked)" />{{label}}</label>
  <label v-else-if="typeof modelValue==='number'" class="entry-field">{{label}}<input class="input-base" type="number" step="any" :value="modelValue" required @input="emit('update:modelValue',($event.target as HTMLInputElement).valueAsNumber)" /></label>
  <label v-else class="entry-field">{{label}}<textarea v-if="typeof modelValue==='string'&&(modelValue.length>100||/description|text|help|notes|benefit/i.test(label))" class="input-base" :value="modelValue" rows="5" @input="emit('update:modelValue',($event.target as HTMLTextAreaElement).value)"/><input v-else class="input-base" type="text" :value="modelValue??''" @input="emit('update:modelValue',($event.target as HTMLInputElement).value)" /><small v-if="modelValue===null">The source has no value. Enter text to supply one.</small></label>
</template>
