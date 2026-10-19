<script setup lang="ts">
import { computed } from 'vue'
import type { Character, SlotProgression } from '../../../shared/character'
import { progressionClasses, progressionLevel, SLOT_PROGRESSIONS, slotsFor, suggestedProgression } from '../../../shared/character-progression'
import { ABILITY_KEYS, abilityMod, profBonus } from '../../lib/calc'
import { signed } from '../../lib/character-sheet'

const props = defineProps<{ character: Pick<Character, 'meta' | 'abilities' | 'spellcasting'>; creation?: boolean }>()
const emit = defineEmits<{ change: [value: Character['spellcasting']] }>()
const rule = computed(() => props.character.spellcasting.slotRule)
const slots = computed(() => slotsFor(props.character))
const level = computed(() => progressionLevel(props.character, rule.value?.className))
const options = computed(() => progressionClasses(props.character))
const suggested = computed(() => suggestedProgression(props.character))
const bonus = computed(() => abilityMod(props.character.abilities[props.character.spellcasting.ability]) + profBonus(props.character.meta.level))
function update(value: Partial<Character['spellcasting']>) { emit('change', { ...props.character.spellcasting, ...value }) }
function progression(value: string) {
  const next = { ...props.character, spellcasting: { ...props.character.spellcasting, slots: slots.value, slotRule: value ? { progression: value as SlotProgression, className: rule.value?.className } : undefined } }
  update({ slotRule: next.spellcasting.slotRule, slots: slotsFor(next) })
}
function source(value: string) {
  if (!rule.value) return
  const next = { ...props.character, spellcasting: { ...props.character.spellcasting, slotRule: { ...rule.value, className: value || undefined } } }
  update({ slotRule: next.spellcasting.slotRule, slots: slotsFor(next) })
}
function manualSlot(rank: number, field: 'max' | 'used' | 'recovery', value: number | string) {
  const key = `l${rank}`, current = slots.value[key] ?? { max: 0, used: 0 }
  const next = { ...current, [field]: value }
  if (field === 'max') next.used = Math.min(Math.max(0, next.max), next.used)
  update({ slots: { ...slots.value, [key]: next } })
}
</script>

<template>
  <div class="progression-editor">
    <div class="progression-fields"><label>Spellcasting ability<select :disabled="!!rule?.workshopId" :value="character.spellcasting.ability" @change="update({ability:($event.target as HTMLSelectElement).value as Character['spellcasting']['ability']})"><option v-for="key in ABILITY_KEYS" :key="key" :value="key">{{key.toUpperCase()}}{{key==='con'?' · Constitution':''}}</option></select></label><label>Spell slot progression<select :disabled="!!rule?.workshopId" :value="rule?.progression??''" @change="progression(($event.target as HTMLSelectElement).value)"><option value="">Manual totals · keep my own rules</option><option v-for="(label,key) in SLOT_PROGRESSIONS" :key="key" :value="key">{{label}}</option></select></label><label v-if="rule">Levels to use<select :disabled="!!rule?.workshopId" :value="rule.className??''" @change="source(($event.target as HTMLSelectElement).value)"><option value="">Total character level · {{character.meta.level}}</option><option v-for="entry in options" :key="entry.name" :value="entry.name">{{entry.name}} level · {{entry.level}}</option><option v-if="rule.className&&!options.some(e=>e.name===rule?.className)" :value="rule.className">{{rule.className}} · missing class</option></select></label></div>
    <div class="progression-summary" aria-live="polite"><strong>{{rule?`${SLOT_PROGRESSIONS[rule.progression].split(' · ')[0]} at level ${level}`:'Manual spell slot totals'}}</strong><span v-if="rule">{{Object.entries(slots).filter(([,s])=>s.max>0).map(([key,s])=>`${s.max} × level ${key.slice(1)}`).join(' · ')||'No spell slots at this level'}}</span><span>Casting {{character.spellcasting.ability.toUpperCase()}} · attack {{signed(bonus)}} · save DC {{8+bonus}}</span></div>
    <p v-if="rule?.workshopId" class="progression-hint">From Workshop class rules · casting ability and slot progression follow the saved class. Update the class in the Workshop to change them.</p><p class="progression-hint">Enter the <strong>total maximum</strong> at each spell level, not extra slots to add. Spent means already used; remaining = maximum − spent. Slots count casts, not spells known or cantrips.</p>
    <p v-if="rule" class="progression-hint">Totals follow the selected level automatically, including after leveling up. {{rule.progression==='pact'?'Pact slots recover on a short rest. Mystic Arcanum is separate.':'Slots recover on a long rest.'}} Select Manual totals for special rules or mixed spellcasting / pact pools.</p>
    <p v-else-if="suggested" class="progression-hint">Your class usually uses {{SLOT_PROGRESSIONS[suggested].split(' · ')[0].toLowerCase()}} progression. <button type="button" class="progression-link" @click="progression(suggested!)">Use this progression</button></p>
    <p v-else class="progression-hint">For a homebrew full caster, choose Full caster and the level it scales with. Multiclass combinations can use Manual totals.</p>
    <div class="progression-slot-grid"><article v-for="rank in 9" :key="rank" class="progression-slot"><strong>Spell level {{rank}}</strong><label>Total maximum<input :value="slots[`l${rank}`]?.max??0" type="number" min="0" max="99" :disabled="!!rule" @input="manualSlot(rank,'max',Number(($event.target as HTMLInputElement).value))" /></label><label v-if="!creation">Already spent<input :value="slots[`l${rank}`]?.used??0" type="number" min="0" :max="rule?.workshopId?999:slots[`l${rank}`]?.max??0" @input="manualSlot(rank,'used',Number(($event.target as HTMLInputElement).value))" /></label><small>{{Math.max(0,(slots[`l${rank}`]?.max??0)-(slots[`l${rank}`]?.used??0))}} remaining</small><label v-if="!rule">Recovers on<select :value="slots[`l${rank}`]?.recovery??(character.meta.klass.toLowerCase()==='warlock'?'short':'long')" @change="manualSlot(rank,'recovery',($event.target as HTMLSelectElement).value)"><option value="long">Long rest</option><option value="short">Short rest</option></select></label></article></div>
  </div>
</template>

<style src="./progression-editor.css"></style>
