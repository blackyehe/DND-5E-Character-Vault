<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, watch } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import AppNav from './components/ui/AppNav.vue'
import NavigationRecovery from './components/ui/NavigationRecovery.vue'
import BuilderAppearance from './components/creation/BuilderAppearance.vue'
import { useBuilderAppearance } from './composables/useBuilderAppearance'
import { cancelSiteMotion, vMotionPanel } from './directives/siteMotion'
const route = useRoute()
const { appearance, appearanceStyle, appearanceOpen } = useBuilderAppearance()
watch(() => appearance.motion, cancelSiteMotion, { flush: 'sync' })
let motionPreference: MediaQueryList | undefined
onMounted(() => {
  motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
  motionPreference.addEventListener('change', cancelSiteMotion)
})
onUnmounted(() => {
  motionPreference?.removeEventListener('change', cancelSiteMotion)
  cancelSiteMotion()
})
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
  <div class="site-shell min-h-screen flex flex-col" :data-theme="appearance.theme" :data-accent="appearance.accent" :data-sheet-density="appearance.sheetDensity" :data-sheet-layout="appearance.sheetLayout" :data-sheet-typography="appearance.sheetTypography" :data-motion="appearance.motion" :style="appearanceStyle">
    <AppNav />
    <NavigationRecovery />
    <div v-if="appearanceOpen" class="cb-page cb-appearance-wrap site-appearance-host"><BuilderAppearance :open="appearanceOpen" @close="closeAppearance" /></div>
    <main v-motion-panel="route.path" class="flex-1"><RouterView /></main>
  </div>
</template>
