<script setup lang="ts">
import { computed } from 'vue'
import type { CharacterFeature } from '../../../shared/character'
import { featNames } from '../../lib/feat-references'
import FeatureText from './FeatureText.vue'
import FeatReference from './FeatReference.vue'
const props = defineProps<{ feature: CharacterFeature }>()
const names = computed(() => /^feats?$/i.test(props.feature.name.trim()) ? featNames(props.feature.description) : [])
</script>
<template><div class="sheet-combat-description"><template v-if="names.length"><p class="sheet-small">Preview a feat by hovering or focusing its name. Click or tap for the complete rules.</p><div class="sheet-feat-list"><FeatReference v-for="name in names" :key="name" :name="name" /></div></template><template v-else><FeatureText :text="feature.description" /><div v-if="feature.origin==='feat'" class="sheet-feat-list"><FeatReference :name="feature.name" /></div></template></div></template>
