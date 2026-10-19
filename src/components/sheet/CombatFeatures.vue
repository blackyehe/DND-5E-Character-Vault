<script setup lang="ts">
import { computed } from 'vue'
import { useCharactersStore, type CharacterFeature } from '../../stores/characters'
import { useSheetLibrary } from '../../composables/useSheetLibrary'
import { useIndependentColumns } from '../../composables/useIndependentColumns'
import { featNameKey, featNames } from '../../lib/feat-references'
import { combatSuggested } from '../../lib/character-sheet'
import CombatFeatureDescription from './CombatFeatureDescription.vue'
const store = useCharactersStore(), library = useSheetLibrary()
type CombatFeature = CharacterFeature & { index:number }
const groupOf = (feature:CharacterFeature) => feature.origin==='feat'||/^feats?$/i.test(feature.name.trim()) ? 'feats' : feature.origin==='class'||feature.origin==='subclass' ? 'class' : 'other'
const features = computed(() => {
  const individual = new Set(library.features.value.filter(f=>f.origin==='feat'&&!/^feats?$/i.test(f.name.trim())).map(f=>featNameKey(f.name)))
  return library.features.value.map((feature,index) => {
    if (/^feats?$/i.test(feature.name.trim())) return {...feature,index,description:featNames(feature.description).filter(name=>!individual.has(featNameKey(name))).join(', ')}
    return {...feature,index}
  }).filter(f=>combatSuggested(f)&&(!/^feats?$/i.test(f.name.trim())||f.description.trim())).sort((a,b)=>Number(!!b.pinned)-Number(!!a.pinned)||(a.order??a.index)-(b.order??b.index))
})
const classFeatures = computed(()=>features.value.filter(f=>groupOf(f)==='class'))
const featFeatures = computed(()=>features.value.filter(f=>groupOf(f)==='feats'))
const otherFeatures = computed(()=>features.value.filter(f=>groupOf(f)==='other'))
const classColumns = useIndependentColumns(classFeatures), featColumns = useIndependentColumns(featFeatures), otherColumns = useIndependentColumns(otherFeatures)
const groups = computed(()=>[
  {key:'class',title:'Class combat features',count:classFeatures.value.length,columns:classColumns.value},
  {key:'feats',title:'Feats',count:featFeatures.value.length,columns:featColumns.value},
  {key:'other',title:'Other combat features',count:otherFeatures.value.length,columns:otherColumns.value},
].filter(group=>group.count))
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
  <section class="sheet-panel"><h3>Combat features</h3><p class="sheet-small">Class features and feats have their own sections. Pinned features come first within each section; columns expand independently.</p><p v-if="!features.length" class="sheet-empty">Pin features from the Features tab to keep them here.</p><section v-for="group in groups" :key="group.key" class="sheet-combat-group"><h4>{{group.title}} <span class="sheet-count">{{group.count}}</span></h4><div class="sheet-combat-feature-grid" :data-columns="group.columns.length"><div v-for="(column,index) in group.columns" :key="index" class="sheet-independent-column"><article v-for="feature in column" :key="feature._id??feature.index" class="sheet-combat-feature" :class="{'is-pinned':feature.pinned}"><details><summary><span>{{feature.pinned?'★ ':''}}{{feature.name}}</span><small>{{feature.pinned?'Pinned':'Suggested'}}{{feature.level?` · Level ${feature.level}`:''}}</small></summary><CombatFeatureDescription :feature="feature" /></details><div class="sheet-combat-feature-actions"><button class="sheet-button sheet-small-button" :disabled="store.saving" :aria-label="`${feature.pinned?'Unpin':'Pin'} ${feature.name}`" @click="pin(feature.index,!feature.pinned)">{{feature.pinned?'Unpin':'Pin'}}</button><template v-if="feature.pinned"><button class="sheet-button sheet-small-button" :disabled="store.saving||pinnedFor(feature)[0]?.index===feature.index" :aria-label="`Move ${feature.name} up`" @click="move(feature.index,-1)">↑</button><button class="sheet-button sheet-small-button" :disabled="store.saving||pinnedFor(feature).at(-1)?.index===feature.index" :aria-label="`Move ${feature.name} down`" @click="move(feature.index,1)">↓</button></template></div></article></div></div></section></section>
</template>
