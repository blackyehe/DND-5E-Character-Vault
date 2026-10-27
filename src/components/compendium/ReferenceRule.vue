<script setup lang="ts">
import { computed,ref } from 'vue'
import type { ReadingRule } from '../../lib/compendium-reading'
import { readingFields,readingText } from '../../lib/compendium-reading'
import { srd } from '../../lib/srd'
import FeatureText from '../sheet/FeatureText.vue'
import ReferenceValue from './ReferenceValue.vue'
const props=defineProps<{rule:ReadingRule}>()
const loaded=ref<Record<string,unknown>|null>(null),loading=ref(false),error=ref('')
const text=computed(()=>props.rule.text||readingText(loaded.value?.desc)||readingText(loaded.value?.description))
const additional=computed(()=>readingFields(Object.fromEntries(Object.entries(loaded.value??{}).filter(([key])=>!['name','desc','description','class','subclass','level','parent'].includes(key)))))
async function load(){if(!props.rule.reference||loaded.value||loading.value)return;loading.value=true;error.value='';try{const reference=props.rule.reference;loaded.value=await srd[reference.kind](reference.index) as unknown as Record<string,unknown>}catch{error.value='This rule could not be loaded.'}finally{loading.value=false}}
function toggle(event:Event){if((event.target as HTMLDetailsElement).open)void load()}
</script>
<template>
  <details class="reference-rule" :open="!rule.reference" @toggle="toggle">
    <summary>{{rule.name}}<small v-if="rule.level!==undefined">Level {{rule.level}}</small></summary>
    <div class="reference-rule-body"><p v-if="loading" role="status">Loading rules…</p><p v-else-if="error" role="alert">{{error}} <button type="button" class="btn-ghost" @click="load">Retry</button></p><template v-else><FeatureText v-if="text" :text="text" /><ReferenceValue v-if="rule.value" :value="rule.value" /><p v-if="!text&&!rule.value" class="reference-muted">This entry does not include a rules description.</p><section v-for="row in additional" :key="row.label"><h4>{{row.label}}</h4><ReferenceValue :value="row.value" :field-key="row.key" /></section></template></div>
  </details>
</template>
