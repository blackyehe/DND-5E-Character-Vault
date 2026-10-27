<script setup lang="ts">
import { computed } from 'vue'
import type { CharacterFeature } from '../../../shared/character'
import { featNames } from '../../lib/feat-references'
import type { HomebrewFeat } from '../../lib/srd'
import FeatureText from './FeatureText.vue'
import FeatReference from './FeatReference.vue'
import FeatRules from './FeatRules.vue'
import SheetDisclosure from './SheetDisclosure.vue'
const props = defineProps<{ feature: CharacterFeature; catalog: HomebrewFeat[]; features: CharacterFeature[]; loading?: boolean }>()
const names = computed(() => /^feats?$/i.test(props.feature.name.trim()) ? featNames(props.feature.description) : [])
</script>
<template>
  <div class="sheet-combat-description">
    <template v-if="names.length"><SheetDisclosure v-for="name in names" :key="name" :title="name"><FeatRules :name="name" :catalog="catalog" :features="features" :loading="loading" /><div class="sheet-feat-list"><FeatReference :name="name" :catalog="catalog" :features="features" :loading="loading" /></div></SheetDisclosure></template>
    <template v-else><FeatureText v-if="feature.description.trim() || feature.origin !== 'feat'" :text="feature.description" /><FeatRules v-else :name="feature.name" :catalog="catalog" :features="features" :loading="loading" /><div v-if="feature.origin==='feat'" class="sheet-feat-list"><FeatReference :name="feature.name" :catalog="catalog" :features="features" :loading="loading" /></div></template>
  </div>
</template>
