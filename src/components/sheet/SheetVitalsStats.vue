<script setup lang="ts">
import { computed } from 'vue'
import { useCharactersStore } from '../../stores/characters'
import { initiative, passivePerception, profBonus } from '../../lib/calc'
import { sheetAC, signed } from '../../lib/character-sheet'
defineProps<{includeMaxHp?:boolean}>()
const c=computed(()=>useCharactersStore().current!)
</script>
<template>
  <dl class="sheet-vitals-strip" aria-label="Defenses and passive statistics">
    <div><dt>AC</dt><dd>{{sheetAC(c)}}</dd></div>
    <div v-if="includeMaxHp"><dt>Max HP</dt><dd>{{c.combat.hpMax}}</dd></div>
    <div><dt>Speed</dt><dd>{{c.combat.speed}} <small>ft.</small></dd></div>
    <div><dt>Initiative</dt><dd>{{signed(initiative(c.abilities.dex))}}</dd></div>
    <div><dt>Proficiency</dt><dd>{{signed(profBonus(c.meta.level))}}</dd></div>
    <div><dt>Passive perception</dt><dd>{{passivePerception(c.meta.level,c.abilities.wis,c.skills.perception??'none')}}</dd></div>
  </dl>
</template>
