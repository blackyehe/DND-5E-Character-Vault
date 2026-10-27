<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, useId, watch } from 'vue'
import { DAMAGE_TYPES, benefitTitle } from '../../../shared/rule-benefits'
import type { RoomDetail } from '../../../shared/rooms'
import { partyHitPointUpdate, type PartyMemberSnapshot } from '../../../shared/party-dashboard'
import { usePartyDashboard } from '../../composables/usePartyDashboard'
import PartyCombatKit from './PartyCombatKit.vue'
import './party-dashboard.css'

const props = defineProps<{ room: RoomDetail; preferenceKey: string; active: boolean; disabled?: boolean }>()
const emit = defineEmits<{ open: [id: string, section: string]; busy: [value: boolean]; 'access-lost': [] }>()
const host = ref<HTMLElement | null>(null), chooser = ref(false), query = ref(''), memberQuery = ref(''), selected = ref(''), hpOpen = ref('')
const damageTypes=ref<Record<string,string>>({})
const amounts = ref<Record<string, number>>({}), temporary = ref<Record<string, number>>({})
const explicitIds = ref<string[] | null>(null), domId = useId()
const selectorCollapsed = ref(false)
try { selectorCollapsed.value = localStorage.getItem(`${props.preferenceKey}:selector-collapsed`) === 'true' } catch { /* Storage is optional. */ }
function toggleSelector() {
  selectorCollapsed.value = !selectorCollapsed.value
  try { localStorage.setItem(`${props.preferenceKey}:selector-collapsed`, String(selectorCollapsed.value)) } catch { /* Storage is optional. */ }
}
try { const saved = JSON.parse(localStorage.getItem(props.preferenceKey) ?? 'null'); if (Array.isArray(saved)) explicitIds.value = saved.filter((id): id is string => typeof id === 'string') } catch { /* Storage is optional. */ }
const ids = computed(() => props.room.characters.filter(c => explicitIds.value ? explicitIds.value.includes(c._id) : c.assignedTo && c.companionKind !== 'shadow-champion').map(c => c._id))
const party = computed(() => props.room.characters.filter(c => ids.value.includes(c._id)))
const visible = computed(() => party.value.filter(c => `${c.meta.name} ${c.meta.klass} ${owner(c.assignedTo)}`.toLowerCase().includes(query.value.trim().toLowerCase())))
const choices = computed(() => props.room.characters.filter(c => `${c.meta.name} ${c.meta.klass}`.toLowerCase().includes(memberQuery.value.trim().toLowerCase())))
const { members, loading, saving, stale, error, notice, updated, refresh, save } = usePartyDashboard(computed(() => props.room.id), ids, () => props.active, () => emit('access-lost'))
const locked = computed(() => !!saving.value || stale.value || props.disabled)
watch(saving, value => emit('busy', !!value))
onUnmounted(() => emit('busy', false))
watch(visible, value => { if (!value.some(c => c._id === selected.value)) selected.value = value[0]?._id ?? '' }, { immediate: true })
const focused = computed(() => visible.value.filter(c => c._id === selected.value))
watch(ids, value => { if (!value.includes(hpOpen.value)) hpOpen.value = '' })
function persist() { try { if (explicitIds.value === null) localStorage.removeItem(props.preferenceKey); else localStorage.setItem(props.preferenceKey, JSON.stringify(explicitIds.value)) } catch { /* Storage is optional. */ } }
function include(id: string, checked: boolean) { if (saving.value) return; explicitIds.value = checked ? [...new Set([...ids.value, id])] : ids.value.filter(value => value !== id); persist() }
function useAssigned() { explicitIds.value = null; persist() }
function owner(id: string | null) { return id ? props.room.members.find(member => member.id === id)?.displayName ?? 'Assigned player' : 'Unassigned' }
function resources(member: PartyMemberSnapshot) {
  const slots = member.slots.reduce((sum, slot) => sum + Math.max(0, slot.max - slot.used), 0)
  return [member.slots.length ? `${slots} slots available` : '', ...member.resources.slice(0, 2).map(r => `${r.name}: ${r.unlimited ? '∞' : Math.max(0, r.max - r.used)}`), member.resources.length > 2 ? `+${member.resources.length - 2} resources` : ''].filter(Boolean).join(' · ') || 'No slots or limited resources'
}
function adjust(id: string, heal: boolean) { const member = members.value[id]; if (!member) return; const update = partyHitPointUpdate(member, amounts.value[id] ?? 1, heal,damageTypes.value[id]??''); if (update) void save(id, update) }
function inspiration(member: PartyMemberSnapshot) { void save(member.id, { expectedUpdatedAt: member.updatedAt, combat: { inspiration: !member.inspiration } }) }
function tempHP(member: PartyMemberSnapshot) { const amount = temporary.value[member.id] ?? member.hp.temp; if (Number.isInteger(amount) && amount >= 0 && amount <= 9999) void save(member.id, { expectedUpdatedAt: member.updatedAt, combat: { hpTemp: amount } }) }
function tracker(member: PartyMemberSnapshot, key: string, used: number, slot: boolean) { void save(member.id, { expectedUpdatedAt: member.updatedAt, ...(slot ? { slots: [{ key, used }] } : { resources: [{ id: key, used }] }) }) }
let returnTarget: HTMLElement | null = null, returnScroll = 0
function openSheet(id: string, section: string) { if (saving.value || props.disabled) return; returnTarget = document.activeElement as HTMLElement; returnScroll = window.scrollY; emit('open', id, section) }
async function restore() { await nextTick(); window.scrollTo({ top: returnScroll, behavior: 'instant' }); (returnTarget?.isConnected ? returnTarget : host.value?.querySelector<HTMLElement>('h2'))?.focus({ preventScroll: true }) }
defineExpose({ refresh, restore })
</script>
<template>
  <section ref="host" class="party-dashboard" aria-label="Party dashboard">
    <header class="party-heading"><div><h2 tabindex="-1">Party <span class="party-count">{{party.length}}</span></h2><p class="sheet-small">{{explicitIds===null?'Assigned characters':'Your selected party'}} · selection saved on this device</p></div><div class="party-heading-actions"><button type="button" class="sheet-button" :aria-expanded="chooser" :aria-controls="`${domId}-chooser`" :disabled="!!saving" @click="chooser=!chooser">Choose party</button><button type="button" class="sheet-button" :disabled="loading||!!saving" @click="refresh">{{loading?'Refreshing…':'Refresh party'}}</button></div></header>
    <section v-show="chooser" :id="`${domId}-chooser`" class="party-chooser sheet-panel" aria-label="Choose party members"><div class="party-chooser-heading"><label>Find a character<input v-model="memberQuery" type="search" placeholder="Name or class…" /></label><button type="button" class="sheet-button" :disabled="!!saving" @click="useAssigned">Use assigned characters</button><button type="button" class="sheet-button" @click="chooser=false">Done</button></div><p class="sheet-small">Include unassigned heroes or companions explicitly. This does not change player assignments.</p><div class="party-choices"><label v-for="c in choices" :key="c._id"><input type="checkbox" :checked="ids.includes(c._id)" :disabled="!!saving" @change="include(c._id,($event.target as HTMLInputElement).checked)" /><span><strong>{{c.meta.name||'Unnamed'}}</strong><small>{{owner(c.assignedTo)}}{{c.companionKind?' · Shadow Champion':''}}</small></span></label></div><p v-if="!choices.length" class="sheet-small">No matching characters.</p></section>
    <p v-if="error" class="sheet-alert" role="alert">{{error}}</p><p v-if="notice" class="party-notice" role="status">{{notice}}</p><p v-if="stale&&party.length&&!loading" class="sheet-notice">Refresh party before making changes.</p>
    <div v-if="party.length" class="party-toolbar"><div class="party-selector-controls"><button type="button" class="sheet-button" :aria-expanded="!selectorCollapsed" :aria-controls="`${domId}-selector ${domId}-search`" :aria-label="selectorCollapsed?'Expand character selector':'Collapse character selector'" @click="toggleSelector"><span aria-hidden="true">{{selectorCollapsed?'›':'‹'}}</span> {{selectorCollapsed?'Show characters':'Hide characters'}}</button><label v-show="!selectorCollapsed" :id="`${domId}-search`">Find in party<input v-model="query" type="search" placeholder="Name, class or player…" /></label></div><p class="sheet-small">{{saving?'Saving…':updated?`Updated ${updated} · refreshes every 15 seconds while visible`:'Loading saved vitals…'}}</p></div>
    <section v-if="!party.length" class="party-empty sheet-panel"><h3>Bring your party to the table</h3><p class="sheet-prose">Choose characters for this dashboard, or assign heroes to players in Players & assignments.</p><button type="button" class="sheet-button sheet-button-primary" @click="chooser=true">Choose party</button></section>
    <p v-else-if="!visible.length" class="sheet-notice">No matching party members. <button type="button" class="sheet-button" @click="query=''">Clear search</button></p>
    <div v-if="visible.length" class="party-workspace" :class="{'is-selector-collapsed':selectorCollapsed}">
      <div v-show="!selectorCollapsed" :id="`${domId}-selector`" class="party-character-selector">
      <nav class="party-roster" aria-label="Party characters"><button v-for="c in visible" :key="c._id" type="button" class="party-roster-choice" :aria-current="selected===c._id?'true':undefined" @click="selected=c._id"><strong>{{c.meta.name||'Unnamed'}}</strong><span>Level {{c.meta.level}} {{c.meta.klass}}</span><small v-if="members[c._id]">{{members[c._id]!.hp.current}} / {{members[c._id]!.hp.max}} HP<template v-if="members[c._id]!.hp.temp"> +{{members[c._id]!.hp.temp}} temp</template> &middot; AC {{members[c._id]!.ac}}</small><small v-else>{{loading?'Loading vitals…':'Vitals unavailable'}}</small></button></nav>
      <label class="party-mobile-picker">Character<select v-model="selected" aria-label="Character"><option v-for="c in visible" :key="c._id" :value="c._id">{{c.meta.name||'Unnamed'}} &mdash; {{members[c._id]?`${members[c._id]!.hp.current}/${members[c._id]!.hp.max} HP · AC ${members[c._id]!.ac}`:'Loading vitals'}}</option></select></label>
      </div>
      <div class="party-members">
      <article v-for="c in focused" :key="c._id" class="party-member" :aria-label="c.meta.name||'Unnamed character'" :aria-busy="saving===c._id">
        <div class="party-member-overview">
          <header class="party-identity"><span class="party-portrait" aria-hidden="true"><img v-if="c.meta.portrait" :src="c.meta.portrait" alt="" loading="lazy" /><span v-else>{{c.meta.name?.[0]||'?'}}</span></span><div><h3>{{c.meta.name||'Unnamed'}}</h3><p>Level {{c.meta.level}} {{c.meta.klass}}</p><small>{{owner(c.assignedTo)}}{{c.companionKind?' · Shadow Champion':''}}</small></div></header>
          <template v-if="members[c._id]"><dl class="party-vitals"><div class="party-hp"><dt>Hit points</dt><dd>{{members[c._id]!.hp.current}} <small>/ {{members[c._id]!.hp.max}}</small></dd><span class="party-temp">{{members[c._id]!.hp.temp?`+${members[c._id]!.hp.temp} temp`:'No temp HP'}}</span></div><div><dt><abbr title="Armor Class">AC</abbr></dt><dd>{{members[c._id]!.ac}}</dd></div><div><dt>Passive<br />perception</dt><dd>{{members[c._id]!.perception}}</dd></div><div><dt><template v-if="members[c._id]!.saveDC!==undefined">Spell<br />save DC</template><template v-else>Speed</template></dt><dd>{{members[c._id]!.saveDC??members[c._id]!.speed}}<small v-if="members[c._id]!.saveDC===undefined"> ft.</small></dd></div></dl>
          <div class="party-member-status"><button type="button" class="party-inspiration" :aria-label="`${c.meta.name}: inspiration`" :aria-pressed="members[c._id]!.inspiration" :disabled="locked" @click="inspiration(members[c._id]!)"><span aria-hidden="true">{{members[c._id]!.inspiration?'◆':'◇'}}</span> Inspiration</button><button type="button" class="sheet-button" :aria-expanded="hpOpen===c._id" :aria-controls="`${domId}-${c._id}-hp`" @click="hpOpen=hpOpen===c._id?'':c._id">Adjust HP</button></div></template>
          <p v-else class="party-unavailable sheet-small" role="status">{{loading?'Loading vitals…':'Vitals unavailable. Refresh the party or choose another character.'}}</p>
          <div class="party-member-actions"><button type="button" class="sheet-button" :disabled="!!saving||disabled" :aria-label="`Open ${c.meta.name}'s sheet`" @click="openSheet(c._id,'summary')">Open sheet</button></div>
        </div>
        <p class="party-resource-summary">{{members[c._id]?resources(members[c._id]!):'Saved character statistics'}}<span v-if="saving===c._id" role="status"> · Saving…</span></p>
        <form v-if="members[c._id]" v-show="hpOpen===c._id" :id="`${domId}-${c._id}-hp`" class="party-hp-form" :aria-label="`Adjust ${c.meta.name}'s hit points`" @submit.prevent="adjust(c._id,false)"><fieldset :disabled="locked"><label>Damage / healing<input v-model.number="amounts[c._id]" type="number" min="1" max="9999" placeholder="1" /></label><label>Damage type<select aria-label="Damage type" v-model="damageTypes[c._id]"><option :value="undefined">Already adjusted / untyped</option><option v-for="type in DAMAGE_TYPES" :key="type" :value="type">{{benefitTitle(type)}}</option></select></label><button type="submit" class="sheet-button" :disabled="!Number.isInteger(amounts[c._id]??1)||(amounts[c._id]??1)<1||(amounts[c._id]??1)>9999">Damage</button><button type="button" class="sheet-button" :disabled="!Number.isInteger(amounts[c._id]??1)||(amounts[c._id]??1)<1||(amounts[c._id]??1)>9999" @click="adjust(c._id,true)">Heal</button><label>Temporary HP<input v-model.number="temporary[c._id]" @keydown.enter.prevent="tempHP(members[c._id]!)" type="number" min="0" max="9999" :placeholder="String(members[c._id]!.hp.temp)" /></label><button type="button" class="sheet-button" :disabled="!Number.isInteger(temporary[c._id]??members[c._id]!.hp.temp)||(temporary[c._id]??0)<0||(temporary[c._id]??0)>9999" @click="tempHP(members[c._id]!)">Set temp HP</button></fieldset><p class="sheet-small">Typed damage applies defenses before temporary HP. Temporary HP replaces the current amount.</p></form>
        <section class="party-kit" :aria-label="`${c.meta.name}'s character details`">
          <PartyCombatKit :key="c._id" :room-id="room.id" :character-id="c._id" :version="members[c._id]?.updatedAt??c.updatedAt" :speed="members[c._id]?.saveDC!==undefined?members[c._id]?.speed:undefined" :disabled="!!saving||disabled" @open="openSheet(c._id,$event)"><template #trackers>
          <details v-if="members[c._id]&&(members[c._id]!.slots.length||members[c._id]!.resources.length)" class="party-trackers"><summary>Slots & resources <span class="sheet-small">{{members[c._id]!.slots.length+members[c._id]!.resources.length}} trackers</span></summary><fieldset :disabled="locked"><div class="party-tracker-grid"><article v-for="slot in members[c._id]!.slots" :key="slot.key"><div><strong>Level {{slot.key.slice(1)}} slots</strong><small>{{slot.recovery==='short'?'Short':'Long'}} rest</small></div><span>{{Math.max(0,slot.max-slot.used)}} / {{slot.max}}</span><button type="button" class="sheet-button" :aria-label="`Use level ${slot.key.slice(1)} slot for ${c.meta.name}`" :disabled="slot.used>=slot.max" @click="tracker(members[c._id]!,slot.key,slot.used+1,true)">Use</button><button type="button" class="sheet-button" :aria-label="`Restore level ${slot.key.slice(1)} slot for ${c.meta.name}`" :disabled="slot.used<=0" @click="tracker(members[c._id]!,slot.key,slot.used-1,true)">Restore</button></article><article v-for="r in members[c._id]!.resources" :key="r.id"><div><strong>{{r.name}}</strong><small>{{r.recovery==='manual'?'Manual recovery':`${r.recovery==='short'?'Short':'Long'} rest`}}</small></div><span>{{r.unlimited?'∞':`${Math.max(0,r.max-r.used)} / ${r.max}`}}</span><template v-if="!r.unlimited"><button type="button" class="sheet-button" :aria-label="`Spend ${r.name} for ${c.meta.name}`" :disabled="r.used>=r.max" @click="tracker(members[c._id]!,r.id,r.used+1,false)">Spend</button><button type="button" class="sheet-button" :aria-label="`Recover ${r.name} for ${c.meta.name}`" :disabled="r.used<=0" @click="tracker(members[c._id]!,r.id,r.used-1,false)">Recover</button></template><p v-if="r.notes" class="sheet-small">{{r.notes}}</p></article></div></fieldset></details>
          </template></PartyCombatKit>
        </section>
      </article>
      </div>
    </div>
  </section>
</template>
