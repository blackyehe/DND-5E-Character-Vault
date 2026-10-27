<script setup lang="ts">
import { computed } from 'vue'
import type { Character } from '../../../shared/character'
import { characterBenefits, characterBenefitRows, benefitSummary, benefitTitle, availableBenefitSpells } from '../../../shared/rule-benefits'
const props=defineProps<{character:Character;disabled?:boolean;editable?:boolean}>()
const emit=defineEmits<{activate:[index:string,active:boolean]}>()
const effects=computed(()=>characterBenefits(props.character)),rows=computed(()=>characterBenefitRows(props.character))
const spells=computed(()=>availableBenefitSpells(props.character))
const facts=computed(()=>[
 ['Damage resistance',effects.value.resistances.map(benefitTitle).join(', ')],['Damage immunity',effects.value.immunities.map(benefitTitle).join(', ')],['Damage vulnerability',effects.value.vulnerabilities.map(benefitTitle).join(', ')],['Condition immunity',effects.value.conditionImmunities.map(benefitTitle).join(', ')],['Saving throw advantage',effects.value.saveAdvantage.map(benefitTitle).join(', ')],
 ...(['fly','swim','climb','burrow','darkvision','blindsight','truesight'] as const).map(k=>[benefitTitle(k),effects.value[k]?`${effects.value[k]} ft.`:'']),['Attacks per Attack action',effects.value.attacks>1?String(effects.value.attacks):''],
].filter(([,v])=>!!v))
</script>
<template><section v-if="rows.length" class="sheet-panel" aria-label="Benefits and defenses"><h3>Benefits & defenses</h3><dl class="sheet-key-values"><div v-for="[label,value] in facts" :key="label"><dt>{{label}}</dt><dd>{{value}}</dd></div></dl><div v-if="spells.length"><h4>Active spell effects</h4><p class="sheet-small">Switch on while the effect lasts. Track concentration, duration and casting costs manually.</p><label v-for="spell in spells" :key="spell.index" class="sheet-checkbox"><input type="checkbox" :checked="character.spellcasting.activeEffects?.includes(spell.index)??false" :disabled="disabled||!editable" @change="emit('activate',spell.index,($event.target as HTMLInputElement).checked)" />{{spell.entry.name}}</label></div><details class="sheet-details"><summary>Benefit sources</summary><p v-for="(r,i) in rows" :key="i" class="sheet-small">{{benefitSummary(r.row)}} · {{r.source}} · {{r.active?'Active':'Inactive or locked'}}</p></details></section></template>
