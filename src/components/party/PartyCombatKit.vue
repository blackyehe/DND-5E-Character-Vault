<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import type { Character } from '../../../shared/character'
import { api } from '../../lib/api'
import { combatAttacks } from '../../lib/equipment'
import { combatSuggested, pretty, signed, sheetProficiencies } from '../../lib/character-sheet'
import { type AbilityKey, SKILL_ABILITY, abilityMod, profBonus } from '../../lib/calc'
import RuleBenefits from '../sheet/RuleBenefits.vue'
import { sheetSkill,sheetSave,sheetInitiative } from '../../lib/character-sheet'
import { characterBenefits } from '../../../shared/rule-benefits'
import { itemBonuses } from '../../../shared/item-rules'
import type { HomebrewFeat, SrdSpell } from '../../lib/srd'
import { featFeatureRows, featVersions, isFeatList } from '../../lib/feat-references'
import CombatFeatureDescription from '../sheet/CombatFeatureDescription.vue'
import FeatureText from '../sheet/FeatureText.vue'
import SheetDisclosure from '../sheet/SheetDisclosure.vue'
import PartyRuleDisclosure from './PartyRuleDisclosure.vue'

const props = defineProps<{ roomId: string; characterId: string; version: string; speed?: number; disabled?: boolean }>()
const emit = defineEmits<{ open: [section: string] }>()
const saveOrder: AbilityKey[] = ['str','dex','con','int','wis','cha']
const character = ref<Character | null>(null), spells = ref<Record<string, SrdSpell>>({}), error = ref(''), loading = ref(false)
const query = ref(''), allFeatures = ref(false), allSkills = ref(false)
const combatExpanded = ref(false), featCatalog = ref<HomebrewFeat[]>([]), referenceLoading = ref(false), referenceError = ref(''), libraryRevision = ref('')
let referenceController: AbortController | undefined, loadedReferenceKey = ''
const referenceKey = computed(() => character.value ? JSON.stringify([props.roomId, props.characterId, libraryRevision.value, character.value.features]) : '')
async function loadFeatReferences() {
  const key = referenceKey.value
  if (!combatExpanded.value || !character.value?.features.some(f => f.origin === 'feat' || isFeatList(f)) || key === loadedReferenceKey) return
  referenceController?.abort(); referenceController = new AbortController()
  const signal = referenceController.signal
  referenceLoading.value = true; referenceError.value = ''; featCatalog.value = []
  try {
    const data = await api.get<{ feats: HomebrewFeat[] }>(`/api/rooms/${props.roomId}/characters/${props.characterId}/references`, { signal, timeoutMs: 20000 })
    if (signal.aborted || key !== referenceKey.value) return
    featCatalog.value = data.feats ?? []; loadedReferenceKey = key
  } catch (e) { if (!signal.aborted && key === referenceKey.value) referenceError.value = e instanceof Error ? e.message : 'Feat rules could not load.' }
  finally { if (referenceController?.signal === signal) referenceLoading.value = false }
}
watch([combatExpanded, referenceKey], () => { void loadFeatReferences() })
const abilityNames = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' }
let generation = 0, controller: AbortController | undefined
async function load() {
  controller?.abort(); controller = new AbortController()
  const run = ++generation, signal = controller.signal
  loading.value = true; error.value = ''
  try {
    const data = await api.get<{ character: Character; spells: Record<string, SrdSpell>; libraryRevision: string }>(`/api/rooms/${props.roomId}/characters/${props.characterId}?view=quick`, { signal })
    if (run !== generation) return
    character.value = data.character; spells.value = data.spells ?? {}; libraryRevision.value = data.libraryRevision ?? ''
  } catch (e) { if (run === generation && !signal.aborted) error.value = e instanceof Error ? e.message : 'Character details could not load.' }
  finally { if (run === generation) loading.value = false }
}
watch(() => [props.roomId, props.characterId, props.version], () => { void load() }, { immediate: true })
onUnmounted(() => { generation++; controller?.abort(); referenceController?.abort() })
const matches = (text: string) => text.toLowerCase().includes(query.value.trim().toLowerCase())
const allSkillRows = computed(() => character.value ? Object.entries(SKILL_ABILITY).map(([key, ability]) => {
  const c = character.value!, rank = characterBenefits(c).skills[key] ?? 'none'
  return { key, ability, rank, name: pretty(key), modifier: sheetSkill(c,key) }
}).sort((a, b) => a.name.localeCompare(b.name)) : [])
const trainedSkills = computed(() => allSkillRows.value.filter(skill => skill.rank !== 'none'))
const skills = computed(() => allSkills.value ? allSkillRows.value : trainedSkills.value)
const proficiencies = computed(() => character.value ? sheetProficiencies(character.value) : null)
const hasTraining = computed(() => proficiencies.value && Object.values(proficiencies.value).some(values => values.length))
const saveBonus = computed(() => character.value ? itemBonuses(character.value).saves : 0)
const features = computed(() => featFeatureRows(character.value?.features ?? []).map(f => {
  const versions = f.origin === 'feat' ? featVersions(f.name, featCatalog.value, character.value?.features) : []
  return { ...f, preview: f.description || (versions.length === 1 ? versions[0]!.description : ''), searchText: versions.map(v => v.description).join(' ') }
})
  .filter(f => (allFeatures.value || combatSuggested(f)) && matches(`${f.name} ${f.description} ${f.searchText}`))
  .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || (a.order ?? a.index) - (b.order ?? b.index)))
const attacks = computed(() => character.value ? combatAttacks(character.value).filter(a => matches(`${a.name} ${a.notes}`)) : [])
const spellList = computed(() => [...new Set([...(character.value?.spellcasting.prepared ?? []), ...(character.value?.spellcasting.known ?? [])])]
  .map(index => ({ index, detail: spells.value[index], name: spells.value[index]?.name ?? pretty(index.replace(/^homebrew-/, '')), prepared: character.value?.spellcasting.prepared.includes(index) }))
  .filter(s => matches(`${s.name} ${s.detail?.desc.join(' ') ?? ''}`)).sort((a, b) => Number(!!b.prepared) - Number(!!a.prepared) || a.name.localeCompare(b.name)))
</script>
<template>
  <div class="party-character-details">
    <p v-if="error" class="sheet-alert" role="alert">{{error}} <button type="button" class="sheet-button" :disabled="loading" @click="load">Try again</button></p>
    <p v-if="loading&&!character" class="sheet-small" role="status">Loading character details…</p>
    <template v-if="character">
      <dl class="party-detail-essentials" aria-label="Additional character statistics">
        <div><dt>Initiative</dt><dd>{{signed(sheetInitiative(character))}}</dd></div>
        <div><dt>Proficiency bonus</dt><dd>{{signed(profBonus(character.meta.level))}}</dd></div>
        
        <div v-if="speed!==undefined"><dt>Speed</dt><dd>{{speed}} <small>ft.</small></dd></div>
        <div><dt>Hit dice remaining</dt><dd>{{Math.max(0,character.combat.hitDiceTotal-character.combat.hitDiceUsed)}} <small>/ {{character.combat.hitDiceTotal}}</small></dd></div>
      </dl>
          <section class="party-reference-section party-reference-saves" aria-label="Abilities and saving throws">
            <h5>Saving throws</h5>
            <dl class="party-ability-grid"><div v-for="key in saveOrder" :key="key"><dt>{{abilityNames[key]}}</dt><dd class="party-ability-save" :class="{'party-trained-save':characterBenefits(character).saves[key]}"><span v-if="characterBenefits(character).saves[key]" class="party-training-dot" role="img" aria-label="Proficient" />{{signed(sheetSave(character,key))}} <small>{{characterBenefits(character).saves[key]?'proficient':'save'}}</small></dd><dd class="party-ability-score"><small>{{character.abilities[key]}} score &middot; {{signed(abilityMod(character.abilities[key]))}} mod</small></dd></div></dl>
            <p class="sheet-small">Proficiency bonus {{signed(profBonus(character.meta.level))}} is included in proficient saves.<template v-if="saveBonus"> Includes {{signed(saveBonus)}} from active items.</template></p>
          </section>
      <RuleBenefits :character="character" /><div class="party-training-columns">
        <section class="party-reference-section party-reference-side" aria-label="Skills">
            <div class="party-reference-heading"><h5>Skills</h5><label class="party-checkbox"><input v-model="allSkills" type="checkbox" /> Show all skills</label></div>
            <dl class="party-skill-list"><div v-for="skill in skills" :key="skill.key"><dt>{{skill.name}} <small>{{skill.ability.toUpperCase()}} · {{skill.rank==='expert'?'Expertise':skill.rank==='prof'?'Proficient':'Untrained'}}</small></dt><dd>{{signed(skill.modifier)}}</dd></div></dl>

            <p v-if="!skills.length" class="sheet-small">No skill proficiencies recorded. Show all skills to see untrained modifiers.</p>
          </section>
        <section v-if="proficiencies" class="party-reference-section party-reference-side" aria-label="Proficiencies and languages"><h5>Proficiencies & languages</h5><dl v-if="hasTraining" class="party-training-list"><template v-for="(values,group) in proficiencies" :key="group"><div v-if="values.length"><dt>{{pretty(group)}}</dt><dd>{{values.join(', ')}}</dd></div></template></dl><p v-else class="sheet-small">No training or languages recorded.</p></section>
      </div>
      <details class="party-combat-reference" @toggle="combatExpanded=($event.target as HTMLDetailsElement).open"><summary>Combat reference <span class="sheet-small">Attacks, features, spells & resources</span></summary>
      <div class="party-reference-search"><label>Find attacks, features or spells<input v-model="query" type="search" placeholder="Name or rule&#8230;" /></label></div>
      <div class="party-reference-columns party-reference-final">
        <section class="party-reference-section" aria-label="Attacks"><div class="party-reference-heading"><h5>Attacks <span class="party-section-count">{{attacks.length}}</span></h5><button type="button" class="party-sheet-link" :disabled="disabled" @click="emit('open','combat')">Combat on sheet</button></div>
            <SheetDisclosure v-for="(attack,i) in attacks" :key="attack._id??i" :title="attack.name" :metadata="`${signed(attack.toHit)} to hit · ${attack.text} ${attack.damageType} · ${attack.range||'Range not recorded'}`"><FeatureText :text="attack.notes||attack.item?.description||'No additional attack notes recorded.'" /></SheetDisclosure><p v-if="!attacks.length" class="sheet-small">{{query?'No matching attacks.':'No equipped weapons or custom attacks saved.'}}</p>
          </section>
        <section class="party-reference-section" aria-label="Combat features"><div class="party-reference-heading"><h5>Combat features <span class="party-section-count">{{features.length}}</span></h5><label class="party-checkbox"><input v-model="allFeatures" type="checkbox" /> All features</label></div>
            <p v-if="referenceLoading" class="sheet-small" role="status">Loading feat rules…</p><p v-if="referenceError" class="sheet-alert" role="alert">{{referenceError}} <button type="button" class="sheet-button" :disabled="referenceLoading" @click="loadFeatReferences">Retry feat rules</button></p>
            <PartyRuleDisclosure v-for="f in features" :preview="f.preview" :key="f.key" :title="f.name" :pinned="f.pinned" :metadata="[f.origin?pretty(f.origin):'',f.level?`Level ${f.level}`:''].filter(Boolean).join(' · ')"><CombatFeatureDescription :feature="f" :catalog="featCatalog" :features="character.features" :loading="referenceLoading" /><button v-if="!f.description && f.origin!=='feat'" type="button" class="sheet-button" :disabled="disabled" @click="emit('open','features')">Open full feature reference</button></PartyRuleDisclosure><p v-if="!features.length" class="sheet-small">{{query?'No matching features.':'No combat features saved. Select All features to see other saved traits.'}}</p>
          </section>
        <div class="party-reference-trackers"><slot name="trackers" /></div>
        <section v-if="character.spellcasting.known.length||character.spellcasting.prepared.length" class="party-reference-section party-reference-spells" aria-label="Spells"><div class="party-reference-heading"><h5>Spells <span class="party-section-count">{{spellList.length}}</span></h5><button type="button" class="party-sheet-link" :disabled="disabled" @click="emit('open','spells')">Full spellbook</button></div>
            <p class="sheet-small">Prepared spells first. Innate spells and complete references are on the sheet.</p><SheetDisclosure v-for="spell in spellList" :key="spell.index" :title="spell.name" :metadata="[spell.prepared?'Prepared':'Known',spell.detail?spell.detail.level?`Level ${spell.detail.level}`:'Cantrip':'',spell.detail?.casting_time??'',spell.detail?.range??''].filter(Boolean).join(' · ')"><template v-if="spell.detail"><p class="sheet-small">{{spell.detail.casting_time}} · {{spell.detail.range}} · {{spell.detail.duration}}</p><FeatureText :text="spell.detail.desc.join('\n\n')" /></template><p v-else class="sheet-small">Open the full spellbook for this spell’s reference.</p></SheetDisclosure><p v-if="!spellList.length" class="sheet-small">No matching spells.</p>
          </section>
      </div>
      </details>
    </template>
    <nav class="party-sheet-links" aria-label="Open character sheet section"><span>Continue on sheet:</span><button v-for="section in ['summary','combat','spells','equipment','features','proficiencies']" :key="section" type="button" class="sheet-button" :disabled="disabled" @click="emit('open',section)">{{pretty(section)}}</button></nav>
  </div>
</template>
