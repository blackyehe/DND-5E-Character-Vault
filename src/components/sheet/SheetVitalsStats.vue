<script setup lang="ts">
import { computed } from 'vue'
import { vMotionCounter } from '../../directives/siteMotion'
import { useCharactersStore } from '../../stores/characters'
import { profBonus } from '../../lib/calc'
import { characterBenefits } from '../../../shared/rule-benefits'
import { sheetAC, signed, sheetInitiative, sheetPassive } from '../../lib/character-sheet'
defineProps<{includeMaxHp?:boolean}>()
const c=computed(()=>useCharactersStore().current!)
const benefits=computed(()=>characterBenefits(c.value))
const ac=computed(()=>sheetAC(c.value,benefits.value))
</script>
<template>
  <div class="sheet-vitals-statistics"><dl class="sheet-vitals-strip" :data-count="includeMaxHp?6:5" aria-label="Defenses and passive statistics">
    <div><dt>AC</dt><dd v-motion-counter="ac">{{ac}}</dd></div>
    <div v-if="includeMaxHp"><dt>Max HP</dt><dd>{{c.combat.hpMax}}</dd></div>
    <div><dt>Speed</dt><dd>{{benefits.speed}} <small>ft.</small></dd></div>
    <div><dt>Initiative</dt><dd>{{signed(sheetInitiative(c,benefits))}}</dd></div>
    <div><dt>Proficiency</dt><dd>{{signed(profBonus(c.meta.level))}}</dd></div>
    <div><dt>Passive perception</dt><dd>{{sheetPassive(c,benefits)}}</dd></div>
  </dl></div>
</template>
