<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { CharacterFeature } from '../../../shared/character'
import type { HomebrewFeat } from '../../lib/srd'
import { featVersions } from '../../lib/feat-references'
import FeatureText from './FeatureText.vue'

const props = defineProps<{ name: string; catalog: HomebrewFeat[]; features: CharacterFeature[]; loading?: boolean }>()
const versions = computed(() => featVersions(props.name, props.catalog, props.features))
const selected = ref('')
watch(versions, entries => {
  if (!entries.some(entry => entry.id === selected.value)) selected.value = entries.length === 1 ? entries[0]!.id : ''
}, { immediate: true })
const detail = computed(() => versions.value.find(entry => entry.id === selected.value))
</script>

<template>
  <div class="sheet-feat-rules">
    <label v-if="versions.length > 1" class="sheet-feat-version">Source version
      <select v-model="selected" class="input-base"><option value="">Choose a matching source…</option><option v-for="version in versions" :key="version.id" :value="version.id">{{version.name}} · {{version.sources.join(', ') || 'Imported source'}}</option></select>
    </label>
    <template v-if="detail">
      <p v-if="detail.sources.length" class="sheet-small">{{detail.sources.join(' · ')}}</p>
      <dl v-if="detail.abilities.length || detail.prerequisites.length" class="sheet-feat-facts"><div v-if="detail.prerequisites.length"><dt>Prerequisites</dt><dd>{{detail.prerequisites.join(', ')}}</dd></div><div v-if="detail.abilities.length"><dt>Ability increase options</dt><dd>{{detail.abilities.join(', ')}}</dd></div></dl>
      <FeatureText :text="detail.description || 'This source did not supply a description.'" />
    </template>
    <p v-else class="sheet-feature-text" :role="loading ? 'status' : undefined">{{versions.length ? 'Choose a source above to read this feat’s rules.' : loading ? 'Loading feat rules…' : 'No matching feat definition is available. Its rules can be recorded in Edit character.'}}</p>
  </div>
</template>
