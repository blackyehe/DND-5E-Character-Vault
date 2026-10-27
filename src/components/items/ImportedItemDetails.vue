<script setup lang="ts">
import { computed,ref,watch } from 'vue'
import type { fiveToolsItemView } from '../../../shared/five-tools-item'
import { vMotionPanel } from '../../directives/siteMotion'
const props=defineProps<{view:ReturnType<typeof fiveToolsItemView>}>()
const panel=ref('rules')
const images=computed(()=>props.view.images)
watch(()=>props.view,()=>{panel.value='rules'})
</script>
<template>
  <div class="imported-item-reader">
    <div class="imported-item-tabs flex flex-wrap gap-2 mb-4" aria-label="Item content">
      <button type="button" class="btn-ghost text-sm" :aria-pressed="panel==='rules'" @click="panel='rules'">Rules</button>
      <button v-if="view.info" type="button" class="btn-ghost text-sm" :aria-pressed="panel==='info'" @click="panel='info'">Info</button>
      <button v-if="images.length" type="button" class="btn-ghost text-sm" :aria-pressed="panel==='art'" @click="panel='art'">Artwork ({{images.length}})</button>
      <a :href="view.upstream" target="_blank" rel="noopener noreferrer" class="btn-ghost text-sm">5etools source</a>
    </div>
    <p class="text-sm mb-4">{{view.sourceName}}{{view.page?` · page ${view.page}`:''}}</p>
    <div v-motion-panel="panel">
    <template v-if="panel==='rules'">
      <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 mb-5"><div v-for="[label,value] in view.stats" :key="label"><dt class="text-sm opacity-80">{{label}}</dt><dd>{{value}}</dd></div></dl>
      <p class="whitespace-pre-wrap leading-relaxed">{{view.description||'This source does not include additional rules text.'}}</p>
    </template>
    <p v-else-if="panel==='info'" class="whitespace-pre-wrap leading-relaxed">{{view.info}}</p>
    <div v-else class="space-y-4"><figure v-for="image in images" :key="image.url"><a :href="image.url" target="_blank" rel="noopener noreferrer"><img :src="image.url" :alt="image.title" loading="lazy" referrerpolicy="no-referrer" class="imported-item-art rounded" /></a><figcaption class="text-sm mt-1">{{image.title}}</figcaption></figure><p class="text-sm">Select an image to open the original, or right-click to save it.</p></div>
    </div>
  </div>
</template>
<style>
.imported-item-art{display:block;width:auto;height:auto;max-width:100%;max-height:min(52vh,560px);object-fit:contain;margin-inline:auto}
.imported-item-tabs [aria-pressed=true]{background:var(--cb-accent-soft);border-color:var(--cb-accent-text);color:var(--cb-accent-text)}
</style>
