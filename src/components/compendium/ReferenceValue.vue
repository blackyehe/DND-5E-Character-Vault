<script setup lang="ts">
import { computed } from 'vue'
import FeatureText from '../sheet/FeatureText.vue'
import { field,hasReadingValue,list,readingFields,readingLabel,readingName,readingText,record } from '../../lib/compendium-reading'
import { readingBenefits,readingBenefitGroups,readingProgression,readingResources } from '../../lib/compendium-structured'
import {spellReferences,declaredSpellLevels} from '../../lib/compendium-references'
import ReferenceSpellList from './ReferenceSpellList.vue'
const props=withDefaults(defineProps<{value:unknown;depth?:number;fieldKey?:string}>(),{depth:0,fieldKey:''})
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
const benefits=computed(()=>props.depth<12?readingBenefits(props.value,props.fieldKey):null)
const benefitGroups=computed(()=>benefits.value?readingBenefitGroups(benefits.value):[])
const progression=computed(()=>props.depth<12?readingProgression(props.value,props.fieldKey):null)
const horizontalProgression=computed(()=>progression.value?.rows.every(row=>typeof row.value==='number'&&Number.isFinite(row.value)))
const resources=computed(()=>props.depth<12?readingResources(props.value,props.fieldKey):null)
const objectList=computed(()=>Array.isArray(props.value)&&props.value.every(v=>Object.keys(record(v)).length>0))
const name=computed(()=>typeof field(data.value,'name')==='string'?String(field(data.value,'name')):'')
const namedFields=computed(()=>fields.value.filter(row=>row.label!=='Name'))
const spells=computed(()=>spellReferences(props.value,props.fieldKey))
const spellLevels=computed(()=>declaredSpellLevels(props.value,props.fieldKey))
</script>
<template>
  <span v-if="!hasReadingValue(value)" class="reference-muted">None recorded.</span>
  <span v-else-if="typeof value==='boolean'">{{value?'Yes':'No'}}</span>
  <span v-else-if="typeof value==='number'">{{value}}</span>
  <div v-else-if="benefits" class="reference-benefits">
    <div v-for="(group,groupIndex) in benefitGroups" :key="groupIndex" class="reference-level-group">
      <div class="reference-level-label"><template v-if="hasReadingValue(group.level)">Level <ReferenceValue :value="group.level" :depth="depth+1" /></template><span v-else title="This source does not specify an acquisition level">Not specified</span></div>
      <ul class="reference-group-benefits"><li v-for="(benefit,index) in group.benefits" :key="index">
        <div class="reference-benefit-heading"><strong v-if="!benefit.spell">{{benefit.title}}</strong><template v-if="hasReadingValue(benefit.value)">: <ReferenceValue :value="benefit.value" :depth="depth+1" /></template><ReferenceSpellList v-if="benefit.spell" :indexes="[benefit.spell]" inline :source-only="benefit.details.some(row=>row.label==='Spell level')" /></div>
        <dl v-if="benefit.details.length" class="reference-nested-fields reference-inline-facts"><div v-for="(row,i) in benefit.details" :key="i" :class="{'reference-field-block':row.value!==null&&typeof row.value==='object'||!!spellReferences(row.value,row.key??'')}"><dt v-if="!spellReferences(row.value,row.key??'')">{{row.label}}</dt><dd><ReferenceValue :value="row.value" :field-key="row.key" :depth="depth+1" /></dd></div></dl>
      </li></ul>
    </div>
  </div>
  <ReferenceSpellList v-else-if="spells" :indexes="spells" :levels="spellLevels" :label="fieldKey?readingLabel(fieldKey):'Spell list'" />
  <div v-else-if="progression&&horizontalProgression" class="reference-progression-scroll" tabindex="0" role="region" :aria-label="`${fieldKey?readingLabel(fieldKey):progression.valueHeading} by ${progression.heading.toLowerCase()}`">
    <table class="reference-table reference-progression-horizontal"><tbody>
      <tr><th scope="row">{{progression.heading}}</th><th v-for="(row,index) in progression.rows" :key="index" scope="col">{{row.level}}</th></tr>
      <tr><th scope="row">{{progression.valueHeading}}</th><td v-for="(row,index) in progression.rows" :key="index">{{row.value}}</td></tr>
    </tbody></table>
  </div>
  <table v-else-if="progression" class="reference-table reference-progression">
    <thead><tr><th scope="col">{{progression.heading}}</th><th scope="col">{{progression.valueHeading}}</th></tr></thead>
    <tbody><tr v-for="(row,index) in progression.rows" :key="index"><th scope="row">{{row.level}}</th><td><ReferenceValue :value="row.value" :field-key="progression.heading==='Spell level'?'spell-list':''" :depth="depth+1" /></td></tr></tbody>
  </table>
  <ul v-else-if="resources" class="reference-resource-list"><li v-for="(resource,index) in resources" :key="index" class="reference-resource">
    <strong class="reference-resource-name">{{resource.name}}</strong>
    <div class="reference-resource-body"><dl class="reference-nested-fields reference-inline-facts"><div v-for="(row,i) in resource.fields" :key="i" :class="{'reference-field-block':row.value!==null&&typeof row.value==='object'}"><dt>{{row.label}}</dt><dd><ReferenceValue :value="row.value" :field-key="row.key" :depth="depth+1" /></dd></div></dl><FeatureText v-if="resource.notes" class="reference-resource-notes" :text="resource.notes" /></div>
  </li></ul>
  <template v-else-if="typeof value==='string'"><span v-if="value.startsWith(':')">{{readingLabel(value)}}</span><FeatureText v-else :text="text" /></template>
  <p v-else-if="inlineNames">{{list(value).map(readingName).join(', ')}}</p>
  <ul v-else-if="Array.isArray(value)" class="reference-value-list" :class="{'reference-object-list':objectList}"><li v-for="(child,index) in value" :key="index"><ReferenceValue :value="child" :depth="depth+1" /></li></ul>
  <span v-else-if="namedReference">{{readingName(value)}}</span>
  <p v-else-if="enabled">{{Object.entries(data).filter(([,v])=>v).map(([key])=>readingLabel(key)).join(', ')||'None'}}</p>
  <div v-else-if="choice" class="reference-choice"><p><strong>Choose {{field(data,'choose')}}</strong><span v-if="description"> · {{description}}</span></p><ReferenceValue v-if="hasReadingValue(options)" :value="options" :depth="depth+1" /><p v-else-if="optionSource">From {{typeof optionSource==='string'?readingLabel(optionSource):readingName(optionSource)}}</p><p v-else-if="field(data,'type')">From {{readingLabel(String(field(data,'type')))}}</p></div>
  <p v-else-if="equipment"><template v-if="field(data,'quantity')!==undefined||field(data,'count')!==undefined">{{field(data,'quantity')??field(data,'count')}} × </template>{{readingName(equipment)}}</p>
  <p v-else-if="ability">{{readingName(ability)}} {{field(data,'minimum_score')!==undefined?`${field(data,'minimum_score')} or higher`:field(data,'bonus')!==undefined?`${Number(field(data,'bonus'))>0?'+':''}${field(data,'bonus')}`:''}}</p>
  <div v-else-if="description"><strong v-if="field(data,'name')">{{readingName(data)}}</strong><FeatureText :text="description" /><dl v-if="textFields.length&&depth<12" class="reference-nested-fields"><div v-for="row in textFields" :key="row.label" :class="{'reference-field-block':row.value!==null&&typeof row.value==='object'||!!spellReferences(row.value,row.key??'')}"><dt v-if="!spellReferences(row.value,row.key??'')">{{row.label}}</dt><dd><ReferenceValue :value="row.value" :field-key="row.key" :depth="depth+1" /></dd></div></dl></div>
  <p v-else-if="field(data,'string')">{{field(data,'string')}}</p>
  <div v-else-if="(fields.length||field(data,'key'))&&depth<12"><strong v-if="name" class="reference-object-name">{{name}}</strong><strong v-else-if="typeof field(data,'key')==='string'">{{readingLabel(String(field(data,'key')))}}</strong><dl v-if="fields.length" class="reference-nested-fields"><div v-for="row in name?namedFields:fields" :key="row.label" :class="{'reference-field-block':row.value!==null&&typeof row.value==='object'||!!spellReferences(row.value,row.key??'')}"><dt v-if="!spellReferences(row.value,row.key??'')">{{row.label}}</dt><dd><ReferenceValue :value="row.value" :field-key="row.key" :depth="depth+1" /></dd></div></dl></div>
  <p v-else class="reference-muted">No additional readable rules were included in this entry.</p>
</template>
