<script setup lang="ts">
import { computed } from 'vue'
import type { Character, CharacterResource } from '../../../shared/character'
import { progressionClasses, progressionLevel, scaledResource } from '../../../shared/character-progression'
import { automaticResources, resourcesFor } from '../../lib/character-sheet'
const props = defineProps<{ character: Pick<Character, 'meta' | 'abilities' | 'resources'> & Partial<Pick<Character, 'features' | 'homebrew'>>; creation?: boolean }>()
const emit = defineEmits<{ change: [value: CharacterResource[]] }>()
const resources = computed(() => resourcesFor(props.character))
const classes = computed(() => progressionClasses(props.character))
function change(index: number, patch: Partial<CharacterResource>) {
  emit('change', resources.value.map((r,i) => i === index ? scaledResource(props.character, { ...r, ...patch }) : r))
}
function mode(index: number, value: string) {
  const r = resources.value[index]!
  if (value === 'automatic') {
    const def = automaticResources(props.character).find(entry => entry.id === r.id)
    if (def) change(index, { ...def, used: Math.min(def.max, r.used), scaling: undefined })
  } else change(index, { automatic: false, unlimited: false, scaling: value === 'level' ? { perLevel: 1, base: 0 } : undefined })
}
function scale(index: number, patch: Partial<NonNullable<CharacterResource['scaling']>>) {
  change(index, { scaling: { ...resources.value[index]!.scaling!, ...patch } })
}
function add() { emit('change', [...resources.value, { id: crypto.randomUUID(), name: 'Custom points', max: 1, used: 0, recovery: 'long' }]) }
function remove(index: number) {
  if (resources.value[index]!.id.startsWith('auto:')) change(index, { max: 0, used: 0, automatic: false, unlimited: false, scaling: undefined })
  else emit('change', resources.value.filter((_,i) => i !== index))
}
</script>
<template>
  <div class="progression-editor"><div class="progression-heading"><h3>Class, feat & custom resources</h3><button type="button" class="progression-button" @click="add">+ Custom tracker</button></div><p class="progression-hint">Set the total pool<template v-if="!creation">, then record any points already spent</template>. For one point gained each level, choose <strong>Points per level</strong>, enter <strong>1</strong> per level and <strong>0</strong> extra base points.</p>
    <p v-if="!resources.length" class="progression-hint">Limited-use feats add trackers automatically. You can also add custom points for special features.</p>
    <article v-for="(r,index) in resources" :key="r.id" class="progression-resource"><p v-if="r.ruleId" class="progression-hint">From Workshop class rules · maximum and recovery follow the saved class. Edit the class in the Workshop to change these rules.</p><div class="progression-fields"><label>Tracker name<input :disabled="!!r.ruleId" :value="r.name" @input="change(index,{name:($event.target as HTMLInputElement).value})" /></label><label>Maximum rule<select :disabled="!!r.ruleId" :value="r.automatic?'automatic':r.scaling?'level':'fixed'" @change="mode(index,($event.target as HTMLSelectElement).value)"><option v-if="r.id.startsWith('auto:')" value="automatic">Automatic · follows feature rules</option><option value="fixed">Fixed total maximum</option><option value="level">Points per level · updates with level</option></select></label><label>Recovers on<select :disabled="!!r.ruleId" :value="r.recovery" @change="change(index,{recovery:($event.target as HTMLSelectElement).value as CharacterResource['recovery'],automatic:false,unlimited:false})"><option value="short">Short rest</option><option value="long">Long rest</option><option value="manual">Manual recovery</option></select></label></div>
      <div v-if="r.scaling&&!r.automatic" class="progression-fields"><label>Points gained per level<input :value="r.scaling.perLevel" type="number" min="0" max="999" @input="scale(index,{perLevel:Number(($event.target as HTMLInputElement).value)})" /></label><label>Extra base points<input :value="r.scaling.base" type="number" min="0" max="999" @input="scale(index,{base:Number(($event.target as HTMLInputElement).value)})" /></label><label>Levels to use<select :value="r.scaling.className??''" @change="scale(index,{className:($event.target as HTMLSelectElement).value||undefined})"><option value="">Total character level · {{character.meta.level}}</option><option v-for="entry in classes" :key="entry.name" :value="entry.name">{{entry.name}} level · {{entry.level}}</option><option v-if="r.scaling.className&&!classes.some(e=>e.name===r.scaling?.className)" :value="r.scaling.className">{{r.scaling.className}} · missing class</option></select></label></div>
      <div class="progression-fields"><label>Total maximum<input :value="r.max" type="number" min="0" max="999" :disabled="!!r.ruleId||!!r.automatic||!!r.scaling" @input="change(index,{max:Number(($event.target as HTMLInputElement).value),used:Math.min(r.used,Math.max(0,Number(($event.target as HTMLInputElement).value)))})" /></label><label v-if="!creation">Already spent<input :value="r.used" type="number" min="0" :max="r.ruleId?999:r.max" @input="change(index,{used:Number(($event.target as HTMLInputElement).value)})" /></label><div class="progression-remaining"><strong>{{r.unlimited?'∞':Math.max(0,r.max-r.used)}}</strong><small>remaining / {{r.unlimited?'unlimited':r.max}}</small></div></div>
      <label>Tracker notes<input :disabled="!!r.ruleId" :value="r.notes??''" placeholder="Special recovery or use rules…" @input="change(index,{notes:($event.target as HTMLInputElement).value})" /></label><p v-if="r.scaling" class="progression-hint" aria-live="polite">{{r.scaling.perLevel}} × level {{progressionLevel(character,r.scaling.className)}} + {{r.scaling.base}} base = <strong>{{r.max}} total points</strong>. This pool updates when the selected level changes.</p><p v-else-if="r.automatic" class="progression-hint">Calculated from the granting class or feat, your level and relevant ability scores. Change Maximum rule to override.</p><button type="button" class="progression-link" :disabled="!!r.ruleId" @click="remove(index)">{{r.id.startsWith('auto:')?'Disable':'Remove'}} tracker</button>
    </article>
  </div>
</template>
<style src="./progression-editor.css"></style>
