<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, watch } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import AppNav from './components/ui/AppNav.vue'
import NavigationRecovery from './components/ui/NavigationRecovery.vue'
import BuilderAppearance from './components/creation/BuilderAppearance.vue'
import { useBuilderAppearance } from './composables/useBuilderAppearance'
import { cancelSiteMotion, vMotionPanel } from './directives/siteMotion'
import {useAuthStore} from './stores/auth'
import {compendiumPauseReason,configureCompendiumPreparation,refreshCompendiumPreparation} from './lib/compendium-preparation'
const route = useRoute()
const auth=useAuthStore()
function updatePreparation(){const reason=compendiumPauseReason(route.path,document.hidden,navigator.onLine);configureCompendiumPreparation(auth.user?.id,!!reason,reason)}
watch([()=>auth.user?.id,()=>route.path],updatePreparation,{immediate:true,flush:'sync'})
function libraryStorage(event:StorageEvent){if(event.key==='codex:workshop-revision')refreshCompendiumPreparation()}
onMounted(()=>{
 document.addEventListener('visibilitychange',updatePreparation)
 window.addEventListener('online',updatePreparation);window.addEventListener('offline',updatePreparation)
 window.addEventListener('codex:workshop-published',refreshCompendiumPreparation)
 window.addEventListener('codex:library-changed',refreshCompendiumPreparation)
 window.addEventListener('storage',libraryStorage)
})
onUnmounted(()=>{
 configureCompendiumPreparation(undefined,true)
 document.removeEventListener('visibilitychange',updatePreparation)
 window.removeEventListener('online',updatePreparation);window.removeEventListener('offline',updatePreparation)
 window.removeEventListener('codex:workshop-published',refreshCompendiumPreparation)
 window.removeEventListener('codex:library-changed',refreshCompendiumPreparation)
 window.removeEventListener('storage',libraryStorage)
})
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
