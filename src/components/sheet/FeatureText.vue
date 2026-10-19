<script setup lang="ts">
import { computed } from 'vue'
const props = defineProps<{ text: string }>()
const blocks = computed(() => props.text.replace(/\r\n?/g, '\n').split(/\n\s*\n/).filter(t => t.trim()).map(text => {
  const lines = text.trim().split('\n')
  return { text: text.trim(), bullets: lines.every(line => /^\s*[-*•]\s+/.test(line)) ? lines.map(line => line.replace(/^\s*[-*•]\s+/, '')) : null }
}))
</script>
<template><div class="sheet-feature-text"><template v-for="(block,index) in blocks" :key="index"><ul v-if="block.bullets"><li v-for="(line,i) in block.bullets" :key="i">{{line}}</li></ul><p v-else>{{block.text}}</p></template><p v-if="!blocks.length">No description recorded.</p></div></template>
