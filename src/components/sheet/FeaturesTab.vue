<script setup lang="ts">
import { computed, ref } from 'vue'
import { useCharactersStore, type CharacterFeature, type FeatureOrigin } from '../../stores/characters'
import { useSheetLibrary } from '../../composables/useSheetLibrary'
import { ORIGINS } from '../../lib/character-sheet'
import { useIndependentColumns } from '../../composables/useIndependentColumns'
import FeatureText from './FeatureText.vue'
import SheetDisclosure from './SheetDisclosure.vue'
import { useBuilderAppearance } from '../../composables/useBuilderAppearance'
const store=useCharactersStore(), library=useSheetLibrary(), query=ref('')
const {appearance}=useBuilderAppearance()
const order=computed<FeatureOrigin[]>(()=>appearance.sheetLayout==='folio'?['class','feat','subclass','racial','background','other']:['class','subclass','racial','feat','background','other'])
const groups=computed(()=>order.value.map(origin=>({origin,title:ORIGINS[origin],features:library.features.value.map((feature,index)=>({...feature,index})).filter(f=>(/^feats?$/i.test(f.name.trim())?'feat':f.origin??'other')===origin&&`${f.name} ${f.description}`.toLowerCase().includes(query.value.toLowerCase())).sort((a,b)=>(a.level??99)-(b.level??99)||(a.order??a.index)-(b.order??b.index))})).filter(g=>g.features.length))
const columns=useIndependentColumns(groups,'row',computed(()=>appearance.sheetLayout==='folio'?900:1051))
async function pin(index:number,f:CharacterFeature){try{await store.update(store.current!._id,{features:library.features.value.map((v,i)=>i===index?{...v,pinned:!f.pinned}:v)})}catch{/* The sheet shows save errors. */}}
</script>
<template>
  <div class="sheet-section-stack"><header class="sheet-section-title"><p class="sheet-eyebrow">WHAT MAKES YOUR HERO</p><h2>Features & traits</h2><p>Sorted by gained level. Pin features to put them first in Combat.</p></header><label class="sheet-search">Search features<input v-model="query" type="search" placeholder="Names and descriptions…" /></label><p v-if="!groups.length" class="sheet-empty">No matching features recorded.</p>
    <div class="sheet-feature-groups" :data-columns="columns.length">
      <div v-for="(column,index) in columns" :key="index" class="sheet-independent-column">
        <section v-for="group in column" :key="group.origin" class="sheet-panel">
          <h3>{{group.title}} <span class="sheet-count">{{group.features.length}}</span></h3>
          <SheetDisclosure v-for="feature in group.features" :key="feature.index" :title="feature.name" :metadata="feature.level?`Level ${feature.level}`:'Level unrecorded'">
            <p v-if="feature.selectedOptions?.length" class="sheet-small">Selected: {{feature.selectedOptions.join(', ')}}</p>
            <FeatureText :text="feature.description" />
            <template #actions><button class="sheet-button sheet-small-button" :aria-pressed="!!feature.pinned" :disabled="store.saving" :aria-label="`${feature.pinned?'Unpin':'Pin'} ${feature.name}`" @click="pin(feature.index,feature)">{{feature.pinned?'★ Pinned':'☆ Pin'}}</button></template>
          </SheetDisclosure>
        </section>
      </div>
    </div>
    <p class="sheet-small">Unconfirmed origins or levels remain under Other / unclassified and can be set in Edit character.</p>
  </div>
</template>
