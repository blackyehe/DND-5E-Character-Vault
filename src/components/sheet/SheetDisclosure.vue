<script setup lang="ts">
import {onMounted,onBeforeUnmount,ref,useSlots} from 'vue'
defineProps<{ title: string; metadata?: string; pinned?: boolean }>()
const summary=ref<HTMLElement|null>(null),headerHeight=ref<number>(),slots=useSlots()
let observer:ResizeObserver|undefined
onMounted(()=>{
  if(!summary.value||!slots.actions)return
  const measure=()=>{headerHeight.value=summary.value?.getBoundingClientRect().height}
  measure()
  if(typeof ResizeObserver!=='undefined'){observer=new ResizeObserver(measure);observer.observe(summary.value)}
})
onBeforeUnmount(()=>observer?.disconnect())
</script>

<template>
  <div class="sheet-disclosure-row" :class="{ 'is-pinned': pinned }" :style="headerHeight?{'--sheet-disclosure-header-height':`${headerHeight}px`}:undefined">
    <details class="sheet-disclosure">
      <summary ref="summary"><span class="sheet-disclosure-heading"><span class="sheet-disclosure-name"><span v-if="pinned" aria-hidden="true">★ </span>{{ title }}</span><small v-if="metadata" class="sheet-disclosure-meta">{{ metadata }}</small></span><span class="sheet-disclosure-toggle" aria-hidden="true">⌄</span></summary>
      <div class="sheet-disclosure-body"><slot /></div>
    </details>
    <div v-if="$slots.actions" class="sheet-disclosure-actions"><slot name="actions" /></div>
  </div>
</template>
