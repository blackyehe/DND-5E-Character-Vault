<script setup lang="ts">
import { computed } from 'vue'
import { compendiumReading } from '../../lib/compendium-reading'
import type { SrdLevel } from '../../lib/srd'
import FeatureText from '../sheet/FeatureText.vue'
import ReferenceValue from './ReferenceValue.vue'
import ReferenceRule from './ReferenceRule.vue'
import './compendium-reader.css'
const props=defineProps<{entry:Record<string,unknown>;kind:string;levels:SrdLevel[];levelsLoading:boolean;levelsError:string}>()
defineEmits<{retryLevels:[]}>()
const document=computed(()=>compendiumReading(props.entry,props.kind,props.levels))
</script>
<template>
  <article class="reference-reader">
    <FeatureText v-if="document.text" :text="document.text" />
    <dl v-if="document.facts.length" class="reference-facts"><div v-for="row in document.facts" :key="row.label"><dt>{{row.label}}</dt><dd><ReferenceValue :value="row.value" :field-key="row.key" /></dd></div></dl>
    <section v-if="document.rules.length" class="reference-rules"><h3>{{kind==='selections'?'Available choices':kind==='races'||kind==='subraces'?'Traits':'Features & rules'}}</h3><ReferenceRule v-for="(rule,index) in document.rules" :key="`${rule.reference?.index??rule.name}:${rule.level}:${index}`" :rule="rule" /></section>
    <p v-if="levelsLoading" class="reference-muted" role="status">Loading features by level…</p>
    <p v-else-if="levelsError" role="alert">{{levelsError}} <button type="button" class="btn-ghost" @click="$emit('retryLevels')">Retry features</button></p>
    <section v-for="row in document.sections" :key="row.label" class="reference-section"><h3>{{row.label}}</h3><ReferenceValue :value="row.value" :field-key="row.key" /></section>
    <p v-if="!document.text&&!document.facts.length&&!document.rules.length&&!document.sections.length" class="reference-muted">This source contains the entry's name, but no description or additional rules. Import a more complete definition to read its rules here.</p>
  </article>
</template>
