<script setup lang="ts">
import { computed,watch } from 'vue'
import { armourCategories,itemFormTags,itemRarities,titleCase } from '../../../shared/item-classification'
import { emptyItemFilters,magicItemCategories,magicWeaponTypes,magicArmourTypes,magicDamageTypes,type ItemSearchFilters } from '../../lib/magic-item-filters'
const filters=defineModel<ItemSearchFilters>({required:true})
const props=defineProps<{magicOnly?:boolean;extraTags?:string[]}>()
const availableTags=computed(()=>[...new Set([...itemFormTags,...(props.extraTags??[])])].sort())
watch(()=>filters.value.category,category=>{
  if(category&&category!=='weapon'){filters.value.weapon='';filters.value.damage=''}
  if(category&&category!=='armor')filters.value.armour=''
})
</script>
<template>
  <div class="item-search-filters">
    <label>Category<select v-model="filters.category"><option value="">All categories</option><option v-for="[value,label] in magicItemCategories" :key="value" :value="value">{{label}}</option><template v-if="!magicOnly"><option value="gear">Adventuring gear</option><option value="consumable">Other consumables</option><option value="treasure">Treasure</option></template></select></label>
    <template v-if="!filters.category||filters.category==='weapon'"><label>Weapon type<select v-model="filters.weapon"><option value="">Any weapon type</option><optgroup label="Weapon groups"><option value="group:Simple">Simple weapons</option><option value="group:Martial">Martial weapons</option><option value="range:Melee">Melee weapons</option><option value="range:Ranged">Ranged weapons</option></optgroup><optgroup label="Specific weapon"><option v-for="form in magicWeaponTypes" :key="form.index" :value="form.index">{{form.name}}</option></optgroup></select></label><label>Damage type<select v-model="filters.damage"><option value="">Any damage type</option><option v-for="damage in magicDamageTypes" :key="damage" :value="damage">{{titleCase(damage)}}</option></select></label></template>
    <label v-if="!filters.category||filters.category==='armor'">Armour type<select v-model="filters.armour"><option value="">Any armour or shield</option><optgroup label="Armour groups"><option v-for="group in armourCategories" :key="group" :value="`group:${titleCase(group)}`">{{titleCase(group)}}{{group==='shield'?'s':' armour'}}</option></optgroup><optgroup label="Specific armour"><option v-for="form in magicArmourTypes" :key="form.index" :value="form.index">{{form.name}}</option></optgroup></select></label>
    <label>Item tag<select v-model="filters.tag"><option value="">Any tag</option><option v-for="tag in availableTags" :key="tag" :value="tag">{{titleCase(tag)}}</option></select></label>
    <label>Rarity<select v-model="filters.rarity"><option value="">Any rarity</option><option v-for="rarity in itemRarities" :key="rarity" :value="rarity">{{titleCase(rarity)}}</option></select></label>
    <label>Attunement<select v-model="filters.attunement"><option value="">Either</option><option value="required">Required</option><option value="none">Not required</option></select></label>
    <button v-if="Object.values(filters).some(Boolean)" type="button" class="sheet-button" @click="filters=emptyItemFilters()">Clear filters</button>
  </div>
</template>
<style>
.item-search-filters{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px 12px;align-items:end}.item-search-filters label{display:flex;flex-direction:column;gap:5px;font-size:13px}.item-search-filters select{width:100%;min-width:0;padding:8px;border:1px solid var(--cb-line);border-radius:5px;color:var(--cb-ink);background:var(--cb-field)}
</style>
