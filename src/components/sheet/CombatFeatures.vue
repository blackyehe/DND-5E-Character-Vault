<script setup lang="ts">
import { computed } from 'vue'
import { useCharactersStore, type CharacterFeature } from '../../stores/characters'
import { useSheetLibrary } from '../../composables/useSheetLibrary'
import { sheetFeatFeatures } from '../../lib/feat-references'
import { combatSuggested } from '../../lib/character-sheet'
import CombatFeatureDescription from './CombatFeatureDescription.vue'
import SheetDisclosure from './SheetDisclosure.vue'
import SheetListGroup from './SheetListGroup.vue'
import SheetChunkedList from './SheetChunkedList.vue'
const store = useCharactersStore(), library = useSheetLibrary()
type CombatFeature = CharacterFeature & { index:number }
const groupOf = (feature:CharacterFeature) => feature.origin==='feat'||/^feats?$/i.test(feature.name.trim()) ? 'feats' : feature.origin==='class'||feature.origin==='subclass' ? 'class' : 'other'
const features = computed(() => sheetFeatFeatures(library.features.value).filter(combatSuggested).sort((a,b)=>Number(!!b.pinned)-Number(!!a.pinned)||(a.order??a.index)-(b.order??b.index)))
const classFeatures = computed(()=>features.value.filter(f=>groupOf(f)==='class'))
const featFeatures = computed(()=>features.value.filter(f=>groupOf(f)==='feats'))
const otherFeatures = computed(()=>features.value.filter(f=>groupOf(f)==='other'))
const groups = computed(()=>[
  {key:'class',title:'Class combat features',features:classFeatures.value},
  {key:'feats',title:'Feats',features:featFeatures.value},
  {key:'other',title:'Other combat features',features:otherFeatures.value},
].filter(group=>group.features.length))
const pinnedFor = (feature:CombatFeature) => features.value.filter(f=>f.pinned&&groupOf(f)===groupOf(feature))
async function save(features:CharacterFeature[]) { if(store.saving)return;try{await store.update(store.current!._id,{features})}catch{/* The sheet displays save errors. */} }
function pin(index:number, value:boolean) { return save(library.features.value.map((feature,i) => i === index ? { ...feature,pinned:value } : feature)) }
function move(index:number, direction:number) {
  const feature=features.value.find(f=>f.index===index)
  if(!feature)return
  const next = [...pinnedFor(feature)], at = next.findIndex(f => f.index === index), target = at+direction
  if(!next[target])return
  ;[next[at],next[target]]=[next[target]!,next[at]!]
  return save(library.features.value.map((feature,i) => { const order=next.findIndex(f=>f.index===i);return order<0?feature:{...feature,order} }))
}
</script>
<template>
  <div class="sheet-feature-sections"><p v-if="!features.length" class="sheet-empty">Pin features from the Features tab to keep them here.</p>
    <SheetListGroup v-for="group in groups" :key="group.key" :title="group.title" :count="group.features.length" :group-key="`${store.current!._id}:combat:${group.key}`">
      <SheetChunkedList :items="group.features"><template #default="{item:feature}">
          <SheetDisclosure :key="feature._id??feature.index" :title="feature.name" :pinned="feature.pinned" :metadata="[feature.pinned?'Pinned':'Suggested',feature.level?`Level ${feature.level}`:''].filter(Boolean).join(' · ')">
            <CombatFeatureDescription :feature="feature" :catalog="library.featCatalog.value" :features="library.features.value" :loading="library.loading.value" />
            <template #actions>
              <button class="sheet-button sheet-small-button" :disabled="store.saving" :aria-label="`${feature.pinned?'Unpin':'Pin'} ${feature.name}`" @click="pin(feature.index,!feature.pinned)">{{feature.pinned?'Unpin':'Pin'}}</button>
              <template v-if="feature.pinned"><button class="sheet-button sheet-small-button" :disabled="store.saving||pinnedFor(feature)[0]?.index===feature.index" :aria-label="`Move ${feature.name} up`" @click="move(feature.index,-1)">↑</button><button class="sheet-button sheet-small-button" :disabled="store.saving||pinnedFor(feature).at(-1)?.index===feature.index" :aria-label="`Move ${feature.name} down`" @click="move(feature.index,1)">↓</button></template>
            </template>
          </SheetDisclosure>
      </template></SheetChunkedList>
    </SheetListGroup>
  </div>
</template>
