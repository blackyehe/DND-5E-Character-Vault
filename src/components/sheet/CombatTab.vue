<script setup lang="ts">
import { computed, ref } from 'vue'
import { useCharactersStore, type Character } from '../../stores/characters'
import { abilityMod } from '../../lib/calc'
import { sheetAC, signed } from '../../lib/character-sheet'
import { combatAttacks } from '../../lib/equipment'
import ItemRules from './ItemRules.vue'
import SpellbookPanel from './SpellbookPanel.vue'
import CombatTrackers from './CombatTrackers.vue'
import CombatFeatures from './CombatFeatures.vue'
const emit=defineEmits<{repairSpell:[index:string]}>()
const store = useCharactersStore(), c = computed(() => store.current!)
const attacks=computed(()=>combatAttacks(c.value))
const amount = ref(1)
async function save(patch: Partial<Character>) { if (store.saving) return; try { await store.update(c.value._id, patch) } catch { /* Sheet displays the error. */ } }
function combat(patch: Partial<Character['combat']>) { return save({ combat: { ...c.value.combat, ...patch } }) }
function hp(value: string, kind: 'hpCurrent' | 'hpTemp') { const n = Number(value); if (Number.isInteger(n)) combat({ [kind]: Math.max(0, Math.min(kind === 'hpCurrent' ? c.value.combat.hpMax : 9999, n)) }) }
function changeHP(heal: boolean) {
  if (!Number.isInteger(amount.value) || amount.value < 1) return
  const v = c.value.combat
  if (heal) combat({ hpCurrent: Math.min(v.hpMax, v.hpCurrent + amount.value) })
  else { const absorbed = Math.min(v.hpTemp, amount.value); combat({ hpTemp: v.hpTemp - absorbed, hpCurrent: Math.max(0, v.hpCurrent - amount.value + absorbed) }) }
}
</script>
<template>
  <div class="sheet-section-stack"><header class="sheet-section-title"><p class="sheet-eyebrow">READY FOR THE NEXT TURN</p><h2>Combat</h2><p>Your defenses, attacks, spells, and remaining resources in one place.</p></header>
    <fieldset :disabled="store.saving"><div class="sheet-two-columns">
      <section class="sheet-panel"><h3>Vitals</h3><div class="sheet-three-columns" style="text-align:center"><div><span class="sheet-small">Armor class</span><div class="sheet-controls"><strong>{{ sheetAC(c) }}</strong></div></div><div><span class="sheet-small">Initiative</span><div class="sheet-controls"><strong>{{ signed(abilityMod(c.abilities.dex)) }}</strong></div></div><div><span class="sheet-small">Speed</span><div class="sheet-controls"><strong>{{ c.combat.speed }}<small style="font-size:12px"> ft.</small></strong></div></div></div><hr />
      <div class="sheet-three-columns"><label>Current HP<input :value="c.combat.hpCurrent" type="number" min="0" :max="c.combat.hpMax" @change="hp(($event.target as HTMLInputElement).value, 'hpCurrent')" /></label><label>Maximum HP<output style="font-size:24px;text-align:center;padding:5px">{{ c.combat.hpMax }}</output></label><label>Temporary HP<input :value="c.combat.hpTemp" type="number" min="0" @change="hp(($event.target as HTMLInputElement).value, 'hpTemp')" /></label></div>
      <div class="sheet-inline" style="margin-top:16px"><label style="flex:1">Damage / healing<input v-model.number="amount" type="number" min="1" /></label><button class="sheet-button" :disabled="!Number.isInteger(amount) || amount < 1" @click="changeHP(false)">Damage</button><button class="sheet-button" :disabled="!Number.isInteger(amount) || amount < 1" @click="changeHP(true)">Heal</button></div><p class="sheet-small" style="margin-top:9px">Damage uses temporary HP first.</p></section>
      <section class="sheet-panel"><h3>Death saves & inspiration</h3><div v-for="(label, key) in { deathSavesSuccess: 'Successes', deathSavesFailure: 'Failures' }" :key="key" style="text-align:center;margin:18px 0"><p class="sheet-small">{{ label }}</p><div class="sheet-track-pips"><button v-for="i in 3" :key="i" :class="{ filled: i <= c.combat[key] }" :aria-label="`${key === 'deathSavesSuccess' ? 'Success' : 'Failure'} ${i}`" :aria-pressed="i <= c.combat[key]" @click="combat({ [key]: i === c.combat[key] ? i - 1 : i })" /></div></div><div class="sheet-between"><button class="sheet-button sheet-small-button" @click="combat({ deathSavesSuccess: 0, deathSavesFailure: 0 })">Reset saves</button><label class="sheet-checkbox"><input type="checkbox" :checked="c.combat.inspiration" @change="combat({ inspiration: !c.combat.inspiration })" /> Inspiration</label></div><hr /><label>Hit dice used · {{ c.combat.hitDiceTotal }} total<input :value="c.combat.hitDiceUsed" type="number" min="0" :max="c.combat.hitDiceTotal" @change="combat({ hitDiceUsed: Math.min(c.combat.hitDiceTotal, Math.max(0, Math.floor(Number(($event.target as HTMLInputElement).value) || 0))) })" /></label></section>
    </div></fieldset>
    <section class="sheet-panel"><h3>Attacks</h3><p v-if="!attacks.length" class="sheet-empty">No attacks recorded. Add weapons or custom attacks in Edit character.</p><div v-else class="sheet-table-wrap"><table class="sheet-table"><thead><tr><th>Weapon / attack</th><th>To hit</th><th>Damage</th><th>Damage type</th><th>Range</th><th>Enchantment</th></tr></thead><tbody><tr v-for="(a,index) in attacks" :key="a._id ?? index"><td class="sheet-attack-name"><details v-if="a.item" class="sheet-weapon-details"><summary :aria-label="`View ${a.name} rules`">{{a.name}} <span aria-hidden="true">ⓘ</span></summary><ItemRules :item="a.item" /></details><span v-else>{{a.name}}</span><small>{{ a.proficient ? 'Proficient' : 'Not proficient' }} · {{ a.ability.toUpperCase() }}</small><details v-if="a.notes"><summary class="sheet-small">Notes</summary><p class="sheet-prose">{{ a.notes }}</p></details></td><td><strong>{{ signed(a.toHit) }}</strong></td><td>{{ a.text }}</td><td>{{ a.damageType || '—' }}</td><td>{{ a.range || '—' }}</td><td :title="'A weapon enchantment adds to both attack and damage rolls.'">{{ a.magicBonus ? `${signed(a.magicBonus)} magic` : '—' }}</td></tr></tbody></table></div><p class="sheet-small" style="margin-top:12px">Damage includes the selected ability modifier, extra damage bonus, and weapon enchantment. Edit custom exceptions in Edit character.</p></section>
    <CombatTrackers />
    <SpellbookPanel @repair="emit('repairSpell',$event)" />
    <CombatFeatures />
  </div>
</template>
