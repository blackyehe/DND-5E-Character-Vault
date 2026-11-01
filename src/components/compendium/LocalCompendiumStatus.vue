<script setup lang="ts">
import {computed} from 'vue'
import {useAuthStore} from '../../stores/auth'
import {BROWSE_KINDS} from '../../../shared/compendium-kinds'
import {localCompendiumState} from '../../lib/local-compendium-client'
import {preparationPauseMessages,preparationStatus,refreshCompendiumPreparation} from '../../lib/compendium-preparation'
import {compendiumTabLabel} from '../../lib/compendium-navigation'
const auth=useAuthStore()
const categories=computed(()=>BROWSE_KINDS.map(kind=>({kind,label:compendiumTabLabel(kind),state:auth.user?localCompendiumState(auth.user.id,kind):'not-saved' as const})))
const labels={
 'not-saved':'Queued for automatic preparation',checking:'Checking the saved copy',saved:'Available on this device',
 outdated:'Updating the saved copy',missing:'Restoring the saved copy',downloading:'Downloading the search index',
 unavailable:'This category could not fit in device storage',
}
</script>

<template>
 <details class="device-library">
  <summary>Library on device: {{preparationStatus.completed}}/{{preparationStatus.total}} · {{preparationStatus.phase}}</summary>
  <div class="device-library-menu" aria-label="Device library status">
   <p>{{preparationStatus.completed}}/{{preparationStatus.total}} categories verified on this device.</p>
   <p v-if="preparationStatus.phase==='paused'">{{preparationPauseMessages[preparationStatus.pauseReason||'foreground']}}</p>
   <p v-else>Search indexes prepare automatically while the website is idle. Full entry details load when opened.</p>
   <ul><li v-for="category in categories" :key="category.kind"><span>{{category.label}}</span><span>{{labels[category.state]}}</span></li></ul>
   <p v-if="preparationStatus.message">{{preparationStatus.message}}</p>
   <button v-if="preparationStatus.message" type="button" class="btn-ghost text-sm" @click="refreshCompendiumPreparation">Retry preparation</button>
  </div>
 </details>
</template>

<style scoped>
.device-library { position:relative; font-size:12px; color:var(--cb-summary-muted); }
.device-library[open] { z-index:70; }
/* This menu floats outside the disclosure; normal inline-detail animation clips it. */
:global(.site-shell[data-motion] .device-library[open]::details-content) { block-size:auto; overflow:visible; opacity:1; translate:none; transition:none; }
summary { cursor:pointer; }
.device-library-menu { position:absolute; left:0; top:calc(100% + 12px); z-index:60; width:min(420px,calc(100vw - 48px)); max-height:70vh; overflow:auto; padding:16px; border:1px solid var(--cb-line); border-radius:8px; background:var(--cb-paper); color:var(--cb-ink); box-shadow:0 8px 24px #0003; }
p + p, ul, button { margin-top:10px; }
ul { list-style:none; padding:0; }
li { display:flex; justify-content:space-between; gap:16px; padding:5px 0; border-bottom:1px solid var(--cb-line); }
li span:last-child { text-align:right; color:var(--cb-muted); }
</style>
