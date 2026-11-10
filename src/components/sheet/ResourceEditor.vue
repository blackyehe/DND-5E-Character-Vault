<script setup lang="ts">
import { computed } from 'vue'
import type { Character, CharacterResource } from '../../../shared/character'
import { progressionClasses, progressionLevel, scaledResource } from '../../../shared/character-progression'
import { automaticResources, resourcesFor } from '../../lib/character-sheet'
const props = defineProps<{ character: Pick<Character, 'meta' | 'abilities' | 'resources'> & Partial<Pick<Character, 'features' | 'homebrew' | 'equipment' | 'compendiumRules' | 'proficiencies'>>; creation?: boolean }>()
const emit = defineEmits<{ change: [value: CharacterResource[]] }>()
const allResources = computed(() => resourcesFor(props.character))
const isRemoved = (r:CharacterResource) => r.id.startsWith('auto:')&&!r.automatic&&!r.scaling&&!r.max&&!r.ruleId&&!r.source
const resources = computed(() => allResources.value.filter(r=>!isRemoved(r)))
const removedResources = computed(() => allResources.value.filter(isRemoved))
const defaults = computed(() => new Map(automaticResources(props.character).map(r=>[r.id,r])))
const classes = computed(() => progressionClasses(props.character))
function change(index: number, patch: Partial<CharacterResource>) {
  const selected=resources.value[index]
  if(!selected)return
  const editsRules=Object.keys(patch).some(key=>key!=='used')
  if((selected.source||selected.ruleId)&&editsRules)return
  // Saved automatic rows are recalculated on read; editing their rules must opt out.
  const override=selected.automatic&&editsRules&&patch.automatic===undefined?{automatic:false,unlimited:false,scaling:undefined}:{}
  emit('change', allResources.value.map(r => r.id===selected.id ? scaledResource(props.character, { ...r, ...override, ...patch }) : r))
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
function add() { emit('change', [...allResources.value, { id: crypto.randomUUID(), name: 'Custom points', max: 1, used: 0, recovery: 'long' }]) }
function remove(index: number) {
  if(!resources.value[index]||resources.value[index]!.source||resources.value[index]!.ruleId)return
  if (resources.value[index]!.id.startsWith('auto:')) change(index, { max: 0, used: 0, automatic: false, unlimited: false, scaling: undefined })
  else emit('change', allResources.value.filter(r => r.id!==resources.value[index]!.id))
}
function restore(id:string) {
  const def=defaults.value.get(id)
  if(!def||!removedResources.value.some(r=>r.id===id))return
  emit('change',allResources.value.map(r=>r.id===id?{...def}:r))
}
</script>
<template>
  <div class="progression-editor"><div class="progression-heading"><h3>Class, feat & custom resources</h3><button type="button" class="progression-button" @click="add">+ Custom tracker</button></div><p class="progression-hint">Set the total pool<template v-if="!creation">, then record any points already spent</template>. For one point gained each level, choose <strong>Points per level</strong>, enter <strong>1</strong> per level and <strong>0</strong> extra base points.</p>
    <p v-if="!resources.length" class="progression-hint">Limited-use feats and items can add trackers automatically. You can also add custom points for special features.</p>
    <article v-for="(r,index) in resources" :key="r.id" class="progression-resource"><p v-if="r.source" class="progression-hint">From this {{r.source.kind==='item'?'item':'character option'}}: maximum, recovery and availability follow its reviewed definition. Edit the source in the Workshop or Compendium to change its trackers.</p><p v-if="r.ruleId" class="progression-hint">From Workshop class rules · maximum and recovery follow the saved class. Edit the class in the Workshop to change these rules.</p><div class="progression-fields"><label>Tracker name<input :disabled="!!(r.ruleId||r.source)" :value="r.name" @input="change(index,{name:($event.target as HTMLInputElement).value})" /></label><label>Maximum rule<select :disabled="!!(r.ruleId||r.source)" :value="r.automatic?'automatic':r.scaling?'level':'fixed'" @change="mode(index,($event.target as HTMLSelectElement).value)"><option v-if="r.id.startsWith('auto:')||r.source" value="automatic">Automatic · follows feature rules</option><option value="fixed">Fixed total maximum</option><option value="level">Points per level · updates with level</option></select></label><label>Recovers on<select :disabled="!!(r.ruleId||r.source)" :value="r.recovery" @change="change(index,{recovery:($event.target as HTMLSelectElement).value as CharacterResource['recovery'],automatic:false,unlimited:false})"><option value="short">Short rest</option><option value="long">Long rest</option><option value="manual">Manual recovery</option></select></label></div>
      <div v-if="r.scaling&&!r.automatic" class="progression-fields"><label>Points gained per level<input :value="r.scaling.perLevel" type="number" min="0" max="999" @input="scale(index,{perLevel:Number(($event.target as HTMLInputElement).value)})" /></label><label>Extra base points<input :value="r.scaling.base" type="number" min="0" max="999" @input="scale(index,{base:Number(($event.target as HTMLInputElement).value)})" /></label><label>Levels to use<select :value="r.scaling.className??''" @change="scale(index,{className:($event.target as HTMLSelectElement).value||undefined})"><option value="">Total character level · {{character.meta.level}}</option><option v-for="entry in classes" :key="entry.name" :value="entry.name">{{entry.name}} level · {{entry.level}}</option><option v-if="r.scaling.className&&!classes.some(e=>e.name===r.scaling?.className)" :value="r.scaling.className">{{r.scaling.className}} · missing class</option></select></label></div>
      <div class="progression-fields"><label>Total maximum<input :value="r.max" type="number" min="0" max="999" :disabled="!!(r.ruleId||r.source)||!!r.automatic||!!r.scaling" @input="change(index,{max:Number(($event.target as HTMLInputElement).value),used:Math.min(r.used,Math.max(0,Number(($event.target as HTMLInputElement).value)))})" /></label><label v-if="!creation">Already spent<input :value="r.used" type="number" min="0" :max="r.ruleId||r.source?999:r.max" @input="change(index,{used:Number(($event.target as HTMLInputElement).value)})" /></label><div class="progression-remaining"><strong>{{r.unlimited?'∞':Math.max(0,r.max-r.used)}}</strong><small>remaining / {{r.unlimited?'unlimited':r.max}}</small></div></div>
      <label>Tracker notes<input :disabled="!!(r.ruleId||r.source)" :value="r.notes??''" placeholder="Special recovery or use rules…" @input="change(index,{notes:($event.target as HTMLInputElement).value})" /></label><p v-if="r.scaling" class="progression-hint" aria-live="polite">{{r.scaling.perLevel}} × level {{progressionLevel(character,r.scaling.className)}} + {{r.scaling.base}} base = <strong>{{r.max}} total points</strong>. This pool updates when the selected level changes.</p><p v-else-if="r.automatic&&!r.source&&!r.ruleId" class="progression-hint">{{r.id.startsWith('auto:feat:')?'Inferred from the feat’s rules.':'Calculated from your class, race or feature rules.'}} Edit tracker to set your own maximum and recovery. Removing it keeps the granting feature and prevents the tracker from returning automatically.</p><p v-else-if="r.id.startsWith('auto:')&&!r.source&&!r.ruleId" class="progression-hint">Uses your custom values. Choose Automatic under Maximum rule to follow the granting feature again.</p><div v-if="!r.source&&!r.ruleId" class="progression-heading"><button v-if="r.automatic" type="button" class="progression-button" @click="mode(index,'fixed')">Edit tracker</button><button type="button" class="progression-link" @click="remove(index)">Remove tracker</button></div>
    </article>
    <details v-if="removedResources.length"><summary>Removed automatic trackers · {{removedResources.length}}</summary><p class="progression-hint">These trackers stay off the character sheet after saving. Their granting features remain. Restore one to use its current automatic rules with a fresh pool.</p><div v-for="r in removedResources" :key="r.id" class="progression-resource"><div class="progression-heading"><strong>{{r.name}}</strong><button type="button" class="progression-button" :disabled="!defaults.has(r.id)" :aria-label="`Restore ${r.name} tracker`" @click="restore(r.id)">Restore tracker</button></div><p v-if="!defaults.has(r.id)" class="progression-hint">The original granting feature is no longer active.</p></div></details>
  </div>
</template>
<style src="./progression-editor.css"></style>
