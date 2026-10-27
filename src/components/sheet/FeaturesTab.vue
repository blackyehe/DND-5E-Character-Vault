<script setup lang="ts">
import { computed, ref } from 'vue'
import { useCharactersStore, type CharacterFeature, type FeatureOrigin } from '../../stores/characters'
import { useSheetLibrary } from '../../composables/useSheetLibrary'
import { ORIGINS } from '../../lib/character-sheet'
import { sheetFeatFeatures } from '../../lib/feat-references'
import CombatFeatureDescription from './CombatFeatureDescription.vue'
import SheetDisclosure from './SheetDisclosure.vue'
import SheetListGroup from './SheetListGroup.vue'
import SheetChunkedList from './SheetChunkedList.vue'
const store=useCharactersStore(), library=useSheetLibrary(), query=ref('')
const order:FeatureOrigin[]=['class','subclass','feat','racial','background','other']
const groups=computed(()=>order.map(origin=>({origin,title:ORIGINS[origin],features:sheetFeatFeatures(library.features.value).filter(f=>(/^feats?$/i.test(f.name.trim())?'feat':f.origin??'other')===origin&&`${f.name} ${f.description}`.toLowerCase().includes(query.value.toLowerCase())).sort((a,b)=>(a.level??99)-(b.level??99)||(a.order??a.index)-(b.order??b.index))})).filter(g=>g.features.length))
async function pin(index:number,f:CharacterFeature){try{await store.update(store.current!._id,{features:library.features.value.map((v,i)=>i===index?{...v,pinned:!f.pinned}:v)})}catch{/* The sheet shows save errors. */}}
</script>
<template>
  <div class="sheet-section-stack"><header class="sheet-section-title"><p class="sheet-eyebrow">WHAT MAKES YOUR HERO</p><h2>Features & traits</h2><p>Sorted by gained level. Pin features to put them first in Combat.</p></header><label class="sheet-search">Search features<input v-model="query" type="search" placeholder="Names and descriptions…" /></label><p v-if="!groups.length" class="sheet-empty">No matching features recorded.</p>
    <div class="sheet-feature-sections">
      <SheetListGroup v-for="group in groups" :key="group.origin" :title="group.title" :count="group.features.length" :group-key="`${store.current!._id}:features:${group.origin}`" :force-open="!!query.trim()">
        <SheetChunkedList :items="group.features"><template #default="{item:feature}"><SheetDisclosure :key="feature.index" :title="feature.name" :metadata="feature.level?`Level ${feature.level}`:'Level unrecorded'">
            <p v-if="feature.selectedOptions?.length" class="sheet-small">Selected: {{feature.selectedOptions.join(', ')}}</p>
            <CombatFeatureDescription :feature="feature" :catalog="library.featCatalog.value" :features="library.features.value" :loading="library.loading.value" />
            <template #actions><button class="sheet-button sheet-small-button" :aria-pressed="!!feature.pinned" :disabled="store.saving" :aria-label="`${feature.pinned?'Unpin':'Pin'} ${feature.name}`" @click="pin(feature.index,feature)">{{feature.pinned?'★ Pinned':'☆ Pin'}}</button></template>
        </SheetDisclosure></template></SheetChunkedList>
      </SheetListGroup>
    </div>
    <p class="sheet-small">Unconfirmed origins or levels remain under Other / unclassified and can be set in Edit character.</p>
  </div>
</template>
