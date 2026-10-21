<script setup lang="ts">
import { computed } from 'vue'
import FeatureText from '../sheet/FeatureText.vue'
import { field,hasReadingValue,list,readingFields,readingLabel,readingName,readingText,record } from '../../lib/compendium-reading'
const props=withDefaults(defineProps<{value:unknown;depth?:number}>(),{depth:0})
const data=computed(()=>record(props.value))
const text=computed(()=>readingText(props.value))
const description=computed(()=>readingText(field(data.value,'desc')??field(data.value,'description')??field(data.value,'help')))
const namedReference=computed(()=>!!field(data.value,'name')&&!!field(data.value,'index')&&!description.value)
const choice=computed(()=>typeof field(data.value,'choose')==='number')
const options=computed(()=>field(field(data.value,'from'),'options')??field(data.value,'options'))
const optionSource=computed(()=>field(field(data.value,'from'),'equipment_category')??field(field(data.value,'from'),'resource_list_url'))
const equipment=computed(()=>field(data.value,'equipment')??field(data.value,'of')??field(data.value,'item'))
const ability=computed(()=>field(data.value,'ability_score'))
const fields=computed(()=>readingFields(data.value))
const textFields=computed(()=>fields.value.filter(row=>!['Name','Desc','Description','Help'].includes(row.label)))
const enabled=computed(()=>Object.keys(data.value).length>0&&Object.values(data.value).every(v=>typeof v==='boolean'))
const inlineNames=computed(()=>Array.isArray(props.value)&&props.value.every(v=>typeof v==='string'&&v.length<100&&!v.includes('\n')))
</script>
<template>
  <span v-if="!hasReadingValue(value)" class="reference-muted">None recorded.</span>
  <span v-else-if="typeof value==='boolean'">{{value?'Yes':'No'}}</span>
  <span v-else-if="typeof value==='number'">{{value}}</span>
  <template v-else-if="typeof value==='string'"><span v-if="value.startsWith(':')">{{readingLabel(value)}}</span><FeatureText v-else :text="text" /></template>
  <p v-else-if="inlineNames">{{list(value).map(readingName).join(', ')}}</p>
  <ul v-else-if="Array.isArray(value)" class="reference-value-list"><li v-for="(child,index) in value" :key="index"><ReferenceValue :value="child" :depth="depth+1" /></li></ul>
  <span v-else-if="namedReference">{{readingName(value)}}</span>
  <p v-else-if="enabled">{{Object.entries(data).filter(([,v])=>v).map(([key])=>readingLabel(key)).join(', ')||'None'}}</p>
  <div v-else-if="choice" class="reference-choice"><p><strong>Choose {{field(data,'choose')}}</strong><span v-if="description"> · {{description}}</span></p><ReferenceValue v-if="hasReadingValue(options)" :value="options" :depth="depth+1" /><p v-else-if="optionSource">From {{typeof optionSource==='string'?readingLabel(optionSource):readingName(optionSource)}}</p><p v-else-if="field(data,'type')">From {{readingLabel(String(field(data,'type')))}}</p></div>
  <p v-else-if="equipment"><template v-if="field(data,'quantity')!==undefined||field(data,'count')!==undefined">{{field(data,'quantity')??field(data,'count')}} × </template>{{readingName(equipment)}}</p>
  <p v-else-if="ability">{{readingName(ability)}} {{field(data,'minimum_score')!==undefined?`${field(data,'minimum_score')} or higher`:field(data,'bonus')!==undefined?`${Number(field(data,'bonus'))>0?'+':''}${field(data,'bonus')}`:''}}</p>
  <div v-else-if="description"><strong v-if="field(data,'name')">{{readingName(data)}}</strong><FeatureText :text="description" /><dl v-if="textFields.length&&depth<12" class="reference-nested-fields"><div v-for="row in textFields" :key="row.label"><dt>{{row.label}}</dt><dd><ReferenceValue :value="row.value" :depth="depth+1" /></dd></div></dl></div>
  <p v-else-if="field(data,'string')">{{field(data,'string')}}</p>
  <div v-else-if="(fields.length||field(data,'key'))&&depth<12"><strong v-if="typeof field(data,'key')==='string'">{{readingLabel(String(field(data,'key')))}}</strong><dl v-if="fields.length" class="reference-nested-fields"><div v-for="row in fields" :key="row.label"><dt>{{row.label}}</dt><dd><ReferenceValue :value="row.value" :depth="depth+1" /></dd></div></dl></div>
  <p v-else class="reference-muted">No additional readable rules were included in this entry.</p>
</template>
