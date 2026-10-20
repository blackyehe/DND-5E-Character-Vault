<script setup lang="ts">
import { nextTick, watch } from 'vue'
import { RouterView } from 'vue-router'
import AppNav from './components/ui/AppNav.vue'
import BuilderAppearance from './components/creation/BuilderAppearance.vue'
import { useBuilderAppearance } from './composables/useBuilderAppearance'
const { appearance, appearanceStyle, appearanceOpen } = useBuilderAppearance()
async function closeAppearance() {
  appearanceOpen.value = false
  await nextTick()
  document.getElementById('site-appearance-toggle')?.focus({ preventScroll: true })
}
watch(appearanceStyle, (style) => {
  document.body.style.backgroundColor = String(style['--cb-canvas'])
  document.documentElement.style.colorScheme = String(style['color-scheme'])
}, { immediate: true })
</script>

<template>
  <div class="site-shell min-h-screen flex flex-col" :data-theme="appearance.theme" :data-accent="appearance.accent" :data-sheet-density="appearance.sheetDensity" :data-sheet-layout="appearance.sheetLayout" :data-sheet-typography="appearance.sheetTypography" :style="appearanceStyle">
    <AppNav />
    <div v-if="appearanceOpen" class="cb-page cb-appearance-wrap site-appearance-host"><BuilderAppearance :open="appearanceOpen" @close="closeAppearance" /></div>
    <main class="flex-1"><RouterView /></main>
  </div>
</template>
