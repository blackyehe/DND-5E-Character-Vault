<script setup lang="ts">
import { computed } from 'vue'
import { characterBenefits } from '../../../shared/rule-benefits'
import { sheetSkill, sheetSave } from '../../lib/character-sheet'
import { useCharactersStore } from '../../stores/characters'
import { ABILITY_KEYS, SKILL_ABILITY } from '../../lib/calc'
import { pretty, signed, sheetProficiencies } from '../../lib/character-sheet'
const c = computed(() => useCharactersStore().current!)
const benefits = computed(() => characterBenefits(c.value))
const skills = computed(() => Object.fromEntries(Object.keys(SKILL_ABILITY).map(key => [key, sheetSkill(c.value, key, benefits.value)])))
const saves = computed(() => Object.fromEntries(ABILITY_KEYS.map(key => [key, sheetSave(c.value, key, benefits.value)])))
const proficiencies = computed(() => sheetProficiencies(c.value, benefits.value))
</script>
<template>
  <div class="sheet-section-stack"><header class="sheet-section-title"><p class="sheet-eyebrow">TRAINING & KNOWLEDGE</p><h2>Proficiencies</h2><p>Permanent training can be changed in Edit character. Two filled circles indicate expertise.</p></header>
    <div class="sheet-two-columns"><section class="sheet-panel"><h3>Skills</h3><div v-for="(ability, key) in SKILL_ABILITY" :key="key" class="sheet-skill-row"><span class="sheet-skill-dots" :aria-label="benefits.skills[key] === 'expert' ? 'Expertise' : benefits.skills[key] === 'prof' ? 'Proficient' : 'Not proficient'"><i :class="{ filled: benefits.skills[key] === 'prof' || benefits.skills[key] === 'expert' }" /><i :class="{ filled: benefits.skills[key] === 'expert' }" /></span><span>{{ pretty(key) }}<small>{{ ability.toUpperCase() }}</small></span><strong>{{ signed(skills[key]!) }}</strong></div></section>
    <div class="sheet-section-stack"><section class="sheet-panel"><h3>Saving throws</h3><dl class="sheet-key-values sheet-numeric-values"><div v-for="key in ABILITY_KEYS" :key="key"><dt><span class="sheet-dot" :class="{ filled: benefits.saves[key] }" /> {{ key.toUpperCase() }}</dt><dd>{{ signed(saves[key]!) }}</dd></div></dl></section><section v-for="(values, group) in proficiencies" :key="group" class="sheet-panel"><h3>{{ pretty(group) }}</h3><details :open="values.length<=8"><summary class="sheet-small">{{values.length}} recorded · {{values.length>8?'expand list':'view list'}}</summary><div class="sheet-chips" style="margin-top:12px;max-height:350px;overflow:auto"><span v-for="value in values" :key="value">{{ value }}</span><p v-if="!values.length" class="sheet-muted">None recorded.</p></div></details></section></div></div>
  </div>
</template>
