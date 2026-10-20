<script setup lang="ts">
defineProps<{ title: string; metadata?: string; pinned?: boolean }>()
</script>

<template>
  <div class="sheet-disclosure-row" :class="{ 'is-pinned': pinned }">
    <details class="sheet-disclosure">
      <summary><span class="sheet-disclosure-heading"><span class="sheet-disclosure-name"><span v-if="pinned" aria-hidden="true">★ </span>{{ title }}</span><small v-if="metadata" class="sheet-disclosure-meta">{{ metadata }}</small></span></summary>
      <div class="sheet-disclosure-body"><slot /></div>
    </details>
    <div v-if="$slots.actions" class="sheet-disclosure-actions"><slot name="actions" /></div>
  </div>
</template>
