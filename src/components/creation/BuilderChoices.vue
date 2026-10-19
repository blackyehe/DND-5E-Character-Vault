<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { contentLabel, type SrdRef } from '../../lib/srd'
import BuilderIcon from './BuilderIcon.vue'

const props = withDefaults(defineProps<{ entries: SrdRef[]; selected: string; kind: string; icon?: string; descriptions?: Record<string, string> }>(), { icon: 'leaf', descriptions: () => ({}) })
const emit = defineEmits<{ choose: [index: string] }>()
const query = ref('')
const source = ref<'all' | 'srd' | 'imported'>('all')
const limit = ref(12)
const matching = computed(() => props.entries.filter((entry) =>
  (source.value === 'all' || (source.value === 'imported' ? entry.index.startsWith('homebrew-') : !entry.index.startsWith('homebrew-')))
  && (!query.value || contentLabel(entry).toLowerCase().includes(query.value.toLowerCase())),
))
watch([query, source], () => { limit.value = 12 })
const shown = computed(() => matching.value.slice(0, limit.value))
function description(entry: SrdRef) {
  const data = entry as SrdRef & { description?: string; details?: Record<string, unknown> }
  return props.descriptions[entry.index] ?? data.description ?? String(data.details?.[':help'] ?? '')
}
</script>

<template>
  <div class="cb-choice-browser">
    <div class="cb-browser-toolbar">
      <label class="cb-search"><BuilderIcon name="search" :size="18" /><input v-model="query" :aria-label="`Search ${kind}`" :placeholder="`Find a ${kind}…`" /></label>
      <div class="cb-source-filter" :aria-label="`${kind} sources`">
        <button v-for="option in (['all', 'srd', 'imported'] as const)" :key="option" type="button" :aria-pressed="source === option" @click="source = option">{{ option === 'all' ? 'All' : option === 'srd' ? 'SRD' : 'Imported' }}</button>
      </div>
    </div>
    <div class="cb-results-caption"><span>{{ matching.length }} {{ kind }} options</span><span>Choose one to explore its details</span></div>
    <div class="cb-choice-grid">
      <button v-for="entry in shown" :key="entry.index" type="button" class="cb-choice" :class="{ 'is-selected': selected === entry.index }"
        :aria-pressed="selected === entry.index" :aria-label="`Choose ${contentLabel(entry)}`" :title="contentLabel(entry)" @click="emit('choose', entry.index)">
        <span class="cb-choice-heading"><span class="cb-choice-emblem"><BuilderIcon :name="icon" :size="22" /></span><span class="cb-choice-check"><BuilderIcon v-if="selected === entry.index" name="check" :size="16" /></span></span>
        <strong>{{ entry.name }}</strong>
        <span class="cb-choice-source">{{ entry.sourcePack || 'SRD · 2014' }}{{ entry.displayName?.match(/\(version \d+\)$/)?.[0] ? ` ${entry.displayName.match(/\(version \d+\)$/)?.[0]}` : '' }}</span>
        <span v-if="description(entry)" class="cb-choice-description">{{ description(entry) }}</span>
      </button>
    </div>
    <p v-if="!matching.length" class="cb-empty">No matching options. Try another name or source.</p>
    <button v-if="matching.length > limit" type="button" class="cb-button cb-button-subtle cb-load-more" @click="limit += 12">Show more options <span>({{ matching.length - limit }} remaining)</span></button>
  </div>
</template>
