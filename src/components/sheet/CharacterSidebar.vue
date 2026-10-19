<script setup lang="ts">
import { computed, ref } from 'vue'
import { useCharactersStore } from '../../stores/characters'
import { ABILITY_KEYS, abilityMod, passivePerception, profBonus } from '../../lib/calc'
import { XP_THRESHOLDS, pretty, sheetAC, signed } from '../../lib/character-sheet'
defineEmits<{ edit: [] }>()
const store = useCharactersStore(), c = computed(() => store.current!)
const xp = ref<number | ''>(''), xpMessage = ref('')
const next = computed(() => XP_THRESHOLDS[c.value.meta.level])
const progress = computed(() => {
  const base = XP_THRESHOLDS[c.value.meta.level - 1] ?? 0, target = next.value
  return target ? Math.min(100, Math.max(0, (c.value.meta.xp - base) / (target - base) * 100)) : 100
})
const trained = computed(() => Object.entries(c.value.skills).filter(([, v]) => v === 'prof' || v === 'expert'))
async function addXP() {
  if (!Number.isSafeInteger(xp.value) || Number(xp.value) <= 0 || store.saving) return
  const amount = Number(xp.value)
  try { await store.update(c.value._id, { meta: { ...c.value.meta, xp: c.value.meta.xp + amount } }); xp.value = ''; xpMessage.value = `${amount.toLocaleString()} XP added.` } catch { /* Error is displayed by the sheet. */ }
}
</script>
<template>
  <aside class="sheet-sidebar" aria-label="Character summary"><section class="sheet-panel sheet-identity">
    <div class="sheet-portrait" v-if="c.meta.portrait"><img :src="c.meta.portrait" alt="Character portrait" /></div>
    <p class="sheet-eyebrow">YOUR ADVENTURER</p><h1>{{ c.meta.name }}</h1><p class="sheet-subtitle">{{ c.meta.race }}{{ c.meta.subrace ? ` · ${c.meta.subrace}` : '' }}</p><p class="sheet-subtitle">Level {{ c.meta.level }} · {{ c.meta.klass }}</p><p v-if="c.meta.subclass" class="sheet-small">{{ c.meta.subclass }}</p>
    <div class="sheet-summary-vitals"><div><small>ARMOR CLASS</small><strong>{{ sheetAC(c) }}</strong></div><div><small>MAX HP</small><strong>{{ c.combat.hpMax }}</strong></div><div><small>SPEED · FT.</small><strong>{{ c.combat.speed }}</strong></div></div>
    <div class="sheet-xp"><div class="sheet-between"><span>{{ c.meta.xp.toLocaleString() }} XP</span><span>{{ next === undefined ? 'Maximum level' : `${Math.max(0, next - c.meta.xp).toLocaleString()} to level ${c.meta.level + 1}` }}</span></div><progress :value="progress" max="100" aria-label="Experience toward next level" /><p v-if="next !== undefined && c.meta.xp >= next" class="sheet-accent">Level advancement available · review in Edit</p><form v-if="store.canEditPermanent" class="sheet-inline" @submit.prevent="addXP"><label class="sheet-sr-only" for="xp-award">Experience to add</label><input id="xp-award" v-model.number="xp" type="number" min="1" step="1" placeholder="XP earned" :disabled="store.saving" /><button class="sheet-button" :disabled="store.saving || !Number.isSafeInteger(xp) || Number(xp) <= 0">Add XP</button></form><span class="sheet-sr-only" role="status">{{ xpMessage }}</span></div>
    <div class="sheet-ability-stack"><div v-for="key in ABILITY_KEYS" :key="key" class="sheet-ability-row"><span>{{ key.toUpperCase() }}</span><strong>{{ c.abilities[key] }}</strong><b>{{ signed(abilityMod(c.abilities[key])) }}</b></div></div>
    <dl class="sheet-key-values"><div><dt>Proficiency bonus</dt><dd>{{ signed(profBonus(c.meta.level)) }}</dd></div><div><dt>Passive perception</dt><dd>{{ passivePerception(c.meta.level, c.abilities.wis, c.skills.perception ?? 'none') }}</dd></div></dl>
    <details class="sheet-details" open><summary>Skill proficiencies <span>{{ trained.length }}</span></summary><ul class="sheet-compact-list"><li v-for="[name, value] in trained" :key="name">{{ pretty(name) }}<small v-if="value === 'expert'">Expertise</small></li><li v-if="!trained.length" class="sheet-muted">None recorded</li></ul></details>
    <details v-for="(values, group) in c.proficiencies" :key="group" class="sheet-details"><summary>{{ pretty(group) }} <span>{{ values.length }}</span></summary><ul class="sheet-compact-list"><li v-for="value in values" :key="value">{{ value }}</li><li v-if="!values.length" class="sheet-muted">None recorded</li></ul></details>
    <button v-if="store.canEditPermanent" class="sheet-button sheet-full" @click="$emit('edit')">Edit character</button>
  </section></aside>
</template>
