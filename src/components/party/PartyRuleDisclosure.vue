<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ title: string; metadata?: string; preview?: string; pinned?: boolean }>()
const excerpt = computed(() => {
  const text = (props.preview ?? '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[*_`#]/g, '').replace(/\s+/g, ' ').trim()
  if (text.length <= 170) return text
  return `${text.slice(0, 170).replace(/\s+\S*$/, '')}…`
})
</script>

<template>
  <div class="sheet-disclosure-row" :class="{ 'is-pinned': pinned }">
    <details class="sheet-disclosure party-rule">
      <summary><span class="sheet-disclosure-heading"><span class="sheet-disclosure-name"><span v-if="pinned" aria-hidden="true">★ </span>{{title}}</span><small v-if="metadata" class="sheet-disclosure-meta">{{metadata}}</small><span v-if="excerpt" class="party-rule-preview">{{excerpt}}</span></span></summary>
      <div class="sheet-disclosure-body"><slot /></div>
    </details>
  </div>
</template>
