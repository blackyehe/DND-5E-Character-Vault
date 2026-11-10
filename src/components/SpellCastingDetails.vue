<script setup lang="ts">
import type {SrdSpell} from '../lib/srd'
defineProps<{spell:Partial<Pick<SrdSpell,'casting_time'|'range'|'duration'|'components'|'concentration'|'ritual'>>}>()
</script>
<template>
 <div class="spell-casting-details">
  <p><strong>Casting time:</strong> {{spell.casting_time?.trim()||'Not recorded'}}<span v-if="spell.ritual"> (ritual)</span></p>
  <p><strong>Range:</strong> {{spell.range?.trim()||'Not recorded'}}</p>
  <p><strong>Duration:</strong> {{spell.duration?.trim()||'Not recorded'}}<span v-if="spell.concentration&&!spell.duration?.toLowerCase().includes('concentration')"> (concentration)</span></p>
  <p><strong>Components:</strong> {{spell.components?.join(', ')||'Not recorded'}}</p>
 </div>
</template>
<style scoped>
.spell-casting-details{margin:10px 0;line-height:1.6}.spell-casting-details p{margin:0}.spell-casting-details strong{font-weight:700;color:inherit}
</style>
