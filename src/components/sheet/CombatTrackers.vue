<script setup lang="ts">
import { computed, ref } from 'vue'
import { useCharactersStore, type Character } from '../../stores/characters'
import { slotsFor } from '../../../shared/character-progression'
import { resourcesFor, signed, benefitSpellAttack, benefitSpellDC } from '../../lib/character-sheet'
import RuleReference from './RuleReference.vue'
import { vMotionCounter } from '../../directives/siteMotion'
import { useSheetLibrary } from '../../composables/useSheetLibrary'
import { featResourceKey } from '../../../shared/feat-resources'
import type { CharacterResource } from '../../../shared/character'
import {restUpdate} from '../../../shared/character-rest'
defineProps<{ variant?:'rail' }>()

const store = useCharactersStore(), c = computed(() => store.current!)
const library=useSheetLibrary()
function resourceRules(r:CharacterResource){
  const key=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]/g,'')
  const aliases:Record<string,string[]>={'auto:sorcery':['Font of Magic'],'auto:ki':['Ki'],'auto:rage':['Rage'],'auto:arcane-recovery':['Arcane Recovery']}
  const names=[r.name,r.name.split(' · ')[0]!,...(aliases[r.id]??[])]
  const definitions=library.features.value.filter(f=>names.some(name=>key(name)===key(f.name)))
  const texts=definitions.map(f=>f.description).filter(Boolean)
  if(!texts.length&&r.id.startsWith('auto:feat:'))texts.push(...library.featCatalog.value.filter(f=>featResourceKey(f.name)===r.id.split(':')[2]).slice(0,1).map(f=>f.description))
  return [...new Set([...texts,r.notes].filter((v):v is string=>!!v?.trim()))].join('\n\n')||`${r.max} uses. ${r.recovery==='manual'?'Recover manually.':`Recovers on a ${r.recovery} rest.`} Full rules can be recorded in Features or tracker notes.`
}
const amounts = ref<Record<string, number>>({})
const records = computed(() => resourcesFor(c.value))
const resources = computed(() => records.value.filter(r => r.max > 0))
const effectiveSlots = computed(() => slotsFor(c.value))
const slots = computed(() => Object.entries(effectiveSlots.value).filter(([,s]) => s.max > 0))
const spellAttack = computed(() => benefitSpellAttack(c.value))
const hasMagic = computed(() => slots.value.length || c.value.spellcasting.known.length || c.value.spellcasting.prepared.length)
const recovery = (value?: string) => value ?? (c.value.meta.klass.toLowerCase() === 'warlock' ? 'short' : 'long')
const sharedSlotRecovery = computed(() => {
  const kinds = new Set(slots.value.map(([,s]) => recovery(s.recovery)))
  return kinds.size === 1 ? [...kinds][0] : undefined
})
async function save(patch: Partial<Character>) {
  if (store.saving) return
  try { await store.update(c.value._id, patch) } catch { /* The sheet retains the saved values and displays the error. */ }
}
function slot(key: string, delta: number) {
  const current = effectiveSlots.value[key]!
  return save({ spellcasting: { ...c.value.spellcasting, slots: { ...effectiveSlots.value, [key]: { ...current, used: delta<0?Math.max(0,current.used+delta):Math.min(current.max,current.used+delta) } } } })
}
function resource(id: string, direction: number, single = false) {
  const amount = single ? 1 : amounts.value[id] ?? 1
  if (!Number.isInteger(amount) || amount < 1) return
  return save({ resources: records.value.map(r => r.id === id ? { ...r, used: direction<0?Math.max(0,r.used-amount):Math.min(r.max,r.used+amount) } : r) })
}
function rest(kind: 'short' | 'long') {
  return save(restUpdate(c.value,kind))
}
</script>

<template>
  <section class="sheet-panel sheet-trackers" :class="{'sheet-trackers-rail':variant==='rail'}">
    <header class="sheet-trackers-heading"><h3>Spell slots & resources</h3></header>
    <p v-if="hasMagic&&variant==='rail'" class="sheet-small sheet-rail-casting">Casting ability <strong>{{ c.spellcasting.ability.toUpperCase() }}</strong></p>
    <dl v-if="hasMagic" class="sheet-casting-stats sheet-casting-highlight" aria-label="Spellcasting statistics"><div><dt>Spell attack</dt><dd>{{ signed(spellAttack) }}</dd></div><div><dt>Save DC</dt><dd>{{ benefitSpellDC(c) }}</dd></div><div v-if="variant!=='rail'"><dt>Casting</dt><dd>{{ c.spellcasting.ability.toUpperCase() }}</dd></div></dl>
    <fieldset :disabled="store.saving"><div class="sheet-tracker-grid">
      <article v-if="variant==='rail'&&slots.length" class="sheet-tracker-card sheet-slot-group">
        <h4>Spell slots</h4>
        <div class="sheet-slot-rows"><div v-for="[key,s] in slots" :key="key" class="sheet-slot-row">
          <div class="sheet-slot-label"><strong>Level {{ key.slice(1) }}</strong><span><span v-motion-counter="s.max-s.used">{{ Math.max(0,s.max-s.used) }}</span> / {{ s.max }} available</span><small v-if="!sharedSlotRecovery">{{ recovery(s.recovery)==='short'?'Short':'Long' }} rest</small></div>
          <div class="sheet-tracker-actions"><button class="sheet-button sheet-small-button" :aria-label="`Use level ${key.slice(1)} slot`" :disabled="s.used>=s.max" @click="slot(key,1)">Use</button><button class="sheet-button sheet-small-button" :aria-label="`Restore level ${key.slice(1)} slot`" :disabled="s.used<=0" @click="slot(key,-1)">Restore</button></div>
        </div></div>
        <small v-if="sharedSlotRecovery" class="sheet-tracker-recovery">All slots recover on a {{ sharedSlotRecovery }} rest.</small>
      </article>
      <template v-else><article v-for="[key,s] in slots" :key="key" class="sheet-tracker-card">
        <header><h4>Level {{ key.slice(1) }} slots</h4><span class="sheet-tracker-total"><strong v-motion-counter="s.max-s.used">{{ Math.max(0, s.max-s.used) }}</strong> / {{ s.max }}</span></header>
        <div v-if="s.max<=12" class="sheet-track-pips"><button v-for="i in s.max" :key="i" :class="{spent:i>s.max-s.used}" :aria-label="`Level ${key.slice(1)} slot ${i}: ${i>s.max-s.used?'spent':'available'}`" :aria-pressed="i<=s.max-s.used" @click="slot(key,i>s.max-s.used?-1:1)" /></div><div v-else class="sheet-tracker-count">{{ s.max-s.used }} available</div>
        <div class="sheet-tracker-actions"><button class="sheet-button sheet-small-button" :aria-label="`Use level ${key.slice(1)} slot`" :disabled="s.used>=s.max" @click="slot(key,1)">Use</button><button class="sheet-button sheet-small-button" :aria-label="`Restore level ${key.slice(1)} slot`" :disabled="s.used<=0" @click="slot(key,-1)">Restore</button></div>
        <p class="sheet-small sheet-tracker-notes"></p>
        <small class="sheet-tracker-recovery">{{ recovery(s.recovery)==='short'?'Short rest':'Long rest' }}</small>
      </article></template>
      <article v-for="r in resources" :key="r.id" class="sheet-tracker-card sheet-tracker-points">
        <header><h4><RuleReference :name="r.name" :text="resourceRules(r)" /></h4><span class="sheet-tracker-total"><strong v-motion-counter="r.unlimited?'?':r.max-r.used">{{ r.unlimited?'?':Math.max(0,r.max-r.used) }}</strong><template v-if="!r.unlimited"> / {{ r.max }}</template></span></header>
        <div v-if="!r.unlimited&&r.max<=12" class="sheet-track-pips"><button v-for="i in r.max" :key="i" :class="{spent:i>r.max-r.used}" :aria-label="`${r.name} ${i}: ${i>r.max-r.used?'spent':'available'}`" :aria-pressed="i<=r.max-r.used" @click="resource(r.id,i>r.max-r.used?-1:1,true)" /></div><div v-else class="sheet-tracker-count">{{ r.unlimited?'Unlimited':`${r.max-r.used} available` }}</div>
        <div class="sheet-tracker-actions"><template v-if="!r.unlimited"><label class="sheet-sr-only" :for="`resource-${r.id}`">{{ r.name }} amount</label><input :id="`resource-${r.id}`" type="number" min="1" :max="r.max" :value="amounts[r.id]??1" @input="amounts[r.id]=Number(($event.target as HTMLInputElement).value)" /><button class="sheet-button sheet-small-button" :aria-label="`Spend ${r.name}`" :disabled="r.used>=r.max" @click="resource(r.id,1)">Spend</button><button class="sheet-button sheet-small-button" :aria-label="`Recover ${r.name}`" :disabled="r.used<=0" @click="resource(r.id,-1)">Recover</button></template></div>
        <p class="sheet-small sheet-tracker-notes">{{r.notes}}</p>
        <small class="sheet-tracker-recovery">{{ r.recovery==='manual'?'Manual recovery':`${r.recovery==='short'?'Short':'Long'} rest` }}</small>
      </article>
    </div><p v-if="!slots.length&&!resources.length" class="sheet-small">No slots or resources at this level. Add custom trackers in Edit character.</p><footer v-else class="sheet-trackers-footer"><div><button class="sheet-button sheet-small-button" @click="rest('short')">Short rest</button><button class="sheet-button sheet-small-button" @click="rest('long')">Long rest</button></div><p class="sheet-small">Recovers eligible slots and resources. HP and hit dice are managed separately.</p></footer></fieldset>
  </section>
</template>

<style scoped>
.sheet-trackers .sheet-casting-stats.sheet-casting-highlight{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;padding:12px;margin:0 0 16px;border:1px solid var(--cb-line);border-radius:6px;background:var(--cb-soft)}
.sheet-trackers .sheet-casting-stats.sheet-casting-highlight>div{display:grid;grid-template-rows:minmax(2.5em,auto) auto;justify-items:center;align-content:start}
.sheet-trackers .sheet-casting-highlight>div>dt{font-size:12px}.sheet-trackers .sheet-casting-highlight>div>dd{font-size:26px;line-height:1.2;font-weight:600}.sheet-trackers .sheet-casting-highlight>div:last-child>dd{font-size:18px}
.sheet-trackers:not(.sheet-trackers-rail) .sheet-tracker-grid{grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr));align-items:stretch}
.sheet-trackers:not(.sheet-trackers-rail) .sheet-tracker-card{display:grid;grid-template-rows:auto auto auto 1fr auto;gap:8px}
.sheet-trackers:not(.sheet-trackers-rail) .sheet-tracker-card>header{align-items:start;min-height:2.7em}.sheet-trackers .sheet-tracker-total{flex-shrink:0}
.sheet-trackers:not(.sheet-trackers-rail) .sheet-tracker-actions{margin-top:0;align-self:start;min-height:32px}.sheet-trackers .sheet-tracker-notes{margin:0;overflow-wrap:anywhere}.sheet-trackers .sheet-tracker-recovery{margin-top:0}
@supports(grid-template-rows:subgrid){.sheet-trackers:not(.sheet-trackers-rail) .sheet-tracker-card{grid-template-rows:subgrid;grid-row:span 5}}
</style>
