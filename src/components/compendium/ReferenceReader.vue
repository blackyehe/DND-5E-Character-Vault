<script setup lang="ts">
import { computed,onBeforeUnmount,provide,ref,shallowRef } from 'vue'
import { compendiumReading } from '../../lib/compendium-reading'
import type { SrdLevel } from '../../lib/srd'
import FeatureText from '../sheet/FeatureText.vue'
import ReferenceValue from './ReferenceValue.vue'
import ReferenceRule from './ReferenceRule.vue'
import {loadReadingSpellNames,spellReferences,SPELL_REFERENCE_CONTEXT,type ReadingSpell} from '../../lib/compendium-references'
import './compendium-reader.css'
const props=defineProps<{entry:Record<string,unknown>;kind:string;levels:SrdLevel[];levelsLoading:boolean;levelsError:string;owner?:string}>()
defineEmits<{retryLevels:[]}>()
const document=computed(()=>compendiumReading(props.entry,props.kind,props.levels))
const names=shallowRef(new Map<string,ReadingSpell>()),namesLoading=ref(false),namesError=ref('')
const controller=new AbortController();let pending:Promise<void>|undefined,loaded=false
async function loadNames(retry=false){
 if(!props.owner||loaded||pending||namesError.value&&!retry)return pending
 const owner=props.owner;namesLoading.value=true;namesError.value=''
 pending=(async()=>{try{const result=await loadReadingSpellNames(owner,controller.signal);if(!controller.signal.aborted&&props.owner===owner){names.value=result;loaded=true}}catch{if(!controller.signal.aborted)namesError.value='Spell names could not load. Original references are preserved.'}finally{namesLoading.value=false;pending=undefined}})()
 return pending
}
provide(SPELL_REFERENCE_CONTEXT,{names,ensure:async()=>{await loadNames()}})
onBeforeUnmount(()=>controller.abort())
</script>
<template>
  <article class="reference-reader">
    <FeatureText v-if="document.text" :text="document.text" />
    <dl v-if="document.facts.length" class="reference-facts"><div v-for="row in document.facts" :key="row.label"><dt>{{row.label}}</dt><dd><ReferenceValue :value="row.value" :field-key="row.key" /></dd></div></dl>
    <section v-if="document.rules.length" class="reference-rules"><h3>{{kind==='selections'?'Available choices':kind==='races'||kind==='subraces'?'Traits':'Features & rules'}}</h3><div class="reference-section-body"><ReferenceRule v-for="(rule,index) in document.rules" :key="`${rule.reference?.index??rule.name}:${rule.level}:${index}`" :rule="rule" /></div></section>
    <p v-if="levelsLoading" class="reference-muted" role="status">Loading features by level…</p>
    <p v-else-if="levelsError" role="alert">{{levelsError}} <button type="button" class="btn-ghost" @click="$emit('retryLevels')">Retry features</button></p>
    <template v-for="row in document.sections" :key="row.label"><ReferenceValue v-if="spellReferences(row.value,row.key??'')" :value="row.value" :field-key="row.key" /><section v-else class="reference-section"><h3>{{row.label}}</h3><div class="reference-section-body"><ReferenceValue :value="row.value" :field-key="row.key" /></div></section></template>
    <p v-if="namesLoading" class="reference-muted" role="status">Loading spell names…</p>
    <p v-if="namesError" class="reference-notice" role="alert">{{namesError}} <button type="button" class="btn-ghost" @click="loadNames(true)">Retry spell names</button></p>
    <p v-if="!document.text&&!document.facts.length&&!document.rules.length&&!document.sections.length" class="reference-muted">This source contains the entry's name, but no description or additional rules. Import a more complete definition to read its rules here.</p>
  </article>
</template>
