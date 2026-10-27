<script setup lang="ts">
import { computed } from 'vue'
import { characterBenefits } from '../../../shared/rule-benefits'
import { sheetSkill, sheetSave } from '../../lib/character-sheet'
import { useCharactersStore } from '../../stores/characters'
import { ABILITY_KEYS, SKILL_ABILITY } from '../../lib/calc'
import { pretty, signed, sheetProficiencies } from '../../lib/character-sheet'
const c = computed(() => useCharactersStore().current!)
const proficiencies = computed(() => sheetProficiencies(c.value))
</script>
<template>
  <div class="sheet-section-stack"><header class="sheet-section-title"><p class="sheet-eyebrow">TRAINING & KNOWLEDGE</p><h2>Proficiencies</h2><p>Permanent training can be changed in Edit character. Two filled circles indicate expertise.</p></header>
    <div class="sheet-two-columns"><section class="sheet-panel"><h3>Skills</h3><div v-for="(ability, key) in SKILL_ABILITY" :key="key" class="sheet-skill-row"><span class="sheet-skill-dots" :aria-label="characterBenefits(c).skills[key] === 'expert' ? 'Expertise' : characterBenefits(c).skills[key] === 'prof' ? 'Proficient' : 'Not proficient'"><i :class="{ filled: characterBenefits(c).skills[key] === 'prof' || characterBenefits(c).skills[key] === 'expert' }" /><i :class="{ filled: characterBenefits(c).skills[key] === 'expert' }" /></span><span>{{ pretty(key) }}<small>{{ ability.toUpperCase() }}</small></span><strong>{{ signed(sheetSkill(c,key)) }}</strong></div></section>
    <div class="sheet-section-stack"><section class="sheet-panel"><h3>Saving throws</h3><dl class="sheet-key-values sheet-numeric-values"><div v-for="key in ABILITY_KEYS" :key="key"><dt><span class="sheet-dot" :class="{ filled: characterBenefits(c).saves[key] }" /> {{ key.toUpperCase() }}</dt><dd>{{ signed(sheetSave(c,key)) }}</dd></div></dl></section><section v-for="(values, group) in proficiencies" :key="group" class="sheet-panel"><h3>{{ pretty(group) }}</h3><details :open="values.length<=8"><summary class="sheet-small">{{values.length}} recorded · {{values.length>8?'expand list':'view list'}}</summary><div class="sheet-chips" style="margin-top:12px;max-height:350px;overflow:auto"><span v-for="value in values" :key="value">{{ value }}</span><p v-if="!values.length" class="sheet-muted">None recorded.</p></div></details></section></div></div>
  </div>
</template>
