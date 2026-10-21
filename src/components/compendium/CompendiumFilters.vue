<script setup lang="ts">
import type { AvailableFacet } from '../../../shared/compendium-facets'
defineProps<{ fields: AvailableFacet[] }>()
const selected = defineModel<Record<string,string>>({ required:true })
</script>
<template>
  <div v-if="fields.length" class="compendium-filters">
    <label v-for="field in fields" :key="field.key">{{field.label}}
      <select :aria-label="field.label" :value="selected[field.key] || ''" @change="selected={...selected,[field.key]:($event.target as HTMLSelectElement).value}">
        <option value="">{{field.any}}</option>
        <option v-for="option in field.options" :key="option.value" :value="option.value">{{option.label}}</option>
      </select>
    </label>
  </div>
</template>
