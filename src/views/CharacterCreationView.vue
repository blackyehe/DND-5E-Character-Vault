<script setup lang="ts">
import WorkshopCharacterChoices from '../components/workshop/WorkshopCharacterChoices.vue'
import { applyWorkshopRules } from '../../shared/workshop-character'
import ShadowChampions from '../components/ShadowChampions.vue'
import ItemRules from '../components/sheet/ItemRules.vue'
import { isRevenantShadow, classSpellDefaults } from '../../shared/class-rules'
import { computed, nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useCharactersStore } from '../stores/characters'
import { useCharacterBuilder } from '../composables/useCharacterBuilder'
import { ABILITY_KEYS, SKILL_ABILITY, abilityMod, skillMod, type AbilityKey } from '../lib/calc'
import { abilityProblem, BUILDER_STEPS, POINT_COST, STANDARD_SCORES, signed, type BuilderStep } from '../lib/character-builder'
import { contentLabel, type SrdRef } from '../lib/srd'
import BuilderIcon from '../components/creation/BuilderIcon.vue'
import { useBuilderAppearance } from '../composables/useBuilderAppearance'
import BuilderChoices from '../components/creation/BuilderChoices.vue'
import BuilderAdvancements from '../components/creation/BuilderAdvancements.vue'
import SpellSlotEditor from '../components/sheet/SpellSlotEditor.vue'
import ResourceEditor from '../components/sheet/ResourceEditor.vue'
import { emptyCharacter, type Character } from '../../shared/character'
import { resourcesFor } from '../lib/character-sheet'
import { slotsFor } from '../../shared/character-progression'
import { selectedFeatIndexes } from '../lib/advancements'

const router = useRouter()
const store = useCharactersStore()
const builder = useCharacterBuilder()
const { draft, ready, race, klass, subrace, subclass, background, races, classes, backgrounds, equipment, languages, feats, context,
  scores, stats, issues, canCreate, warnings, detailError, loadingDetails, raceTraits, classTraits, subraceTraits, subclassTraits,
  subclassOptions, subraceOptions, skillChoice, fixedSkills, saved, restored, storageError, spellQuery, spellLevel, classSpellsOnly,
  spellResults, spellLoading, spellError, spellDetail, spellDetailLoading, canCast, inventoryBusy,
  spellPolicy, spellCounts, spellProblems } = builder
const { appearance } = useBuilderAppearance()
const progressionCharacter = computed(() => {
  const c = emptyCharacter()
  c.meta.level = draft.level; c.meta.klass = klass.value?.name ?? ''; c.abilities = scores.value
  c.meta.race = race.value?.name ?? ''; c.meta.subclass = subclass.value?.name ?? ''
  c.spellcasting.ability = draft.spellAbility || context.value.spellAbility
  c.spellcasting.slotRule = draft.slotRule ?? (classSpellDefaults(klass.value?.name??'') && !Object.keys(draft.slotOverrides).length ? {progression:classSpellDefaults(klass.value!.name)!.progression} : undefined)
  for (let rank=1;rank<=9;rank++) c.spellcasting.slots[`l${rank}`] = {max:draft.slotOverrides[`l${rank}`]??context.value.slots[`l${rank}`]??0,used:0,recovery:klass.value?.index==='warlock'?'short':'long'}
  c.spellcasting.slots = slotsFor(c)
  c.features = context.value.features.filter(f => (f.level ?? 1) <= draft.level).map(f => ({...f}))
  c.resources = resourcesFor({...c,resources:draft.resources})
  c.homebrew={bindings:[],choices:draft.ruleChoices,conflicts:[],acknowledged:[]}
  c.meta.classIndex=klass.value?.index;c.meta.subclassIndex=subclass.value?.index
  return applyWorkshopRules(c as Character,context.value.ruleDefinitions??[])
})
function changeCasting(value: Character['spellcasting']) {
  const wasAutomatic = !!draft.slotRule
  const maximumChanged = Object.entries(value.slots).some(([key,s])=>s.max!==(progressionCharacter.value.spellcasting.slots[key]?.max??0))
  draft.spellAbility = value.ability
  if (!value.slotRule && (wasAutomatic || maximumChanged)) draft.slotOverrides = Object.fromEntries(Object.entries(value.slots).map(([key,s])=>[key,s.max]))
  draft.slotRule = value.slotRule
}

const spellResultsElement = ref<HTMLElement | null>(null)
const creating = ref(false), createError = ref(''), showMobileSummary = ref(false)
const activeHeading = ref<HTMLElement | null>(null)
const languageSelection = ref(''), additionalSkill = ref(''), equipmentQuery = ref(''), customItemName = ref('')
const equipmentLimit = ref(12)
const prepareNewSpell = ref(true)
const spellAddProblem = computed(() => spellDetail.value ? builder.spellAddProblem(spellDetail.value, prepareNewSpell.value) : '')
const spellAlreadyAdded = computed(() => !!spellDetail.value && draft.spells.some((spell) => spell.index === spellDetail.value!.index))
const spellCounters = computed(() => [
  { title: 'Cantrips', selected: spellCounts.value.cantrips, limit: spellPolicy.value.cantrips },
  ...(spellPolicy.value.spells !== null || !spellPolicy.value.available ? [{ title: spellPolicy.value.spellLabel, selected: spellCounts.value.spells, limit: spellPolicy.value.spells }] : []),
  ...(spellPolicy.value.prepared !== null ? [{ title: 'Prepared spells', selected: spellCounts.value.prepared, limit: spellPolicy.value.prepared }] : []),
  ...spellPolicy.value.arcanum.map((level) => ({ title: `Level ${level} Arcanum`, selected: draft.spells.filter((spell) => spell.level === level).length, limit: 1 })),
])
const abilityNames: Record<AbilityKey, string> = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' }
const raceDescriptions = {
  dragonborn: 'Proud ancestry. A draconic legacy carried into a new adventure.', dwarf: 'Rooted in craft, tradition, and a determined spirit.',
  elf: 'A long-lived people with an affinity for magic and the natural world.', gnome: 'An inventive mind and an endlessly curious spirit.',
  'half-elf': 'A life between worlds, with a perspective all your own.', 'half-orc': 'A formidable presence, with your own story to tell.',
  halfling: 'A small footprint. A generous heart. A surprising appetite for adventure.', human: 'Adaptable, ambitious, and full of possibility.', tiefling: 'An infernal legacy. A future you choose for yourself.',
}
const classDescriptions = {
  barbarian: 'Instinct, endurance, and the fury of the front line.', bard: 'Weave magic through stories, music, and inspiration.', cleric: 'Devotion made powerful through divine magic.',
  druid: 'The voice of the wild, and a connection to its many forms.', fighter: 'Master your weapons and the art of martial combat.', monk: 'Discipline, precision, and the power of body and spirit.',
  paladin: 'An oath that gives purpose to your sword and your magic.', ranger: 'A watchful explorer at home beyond the beaten path.', rogue: 'Clever hands, sharp instincts, and impeccable timing.',
  sorcerer: 'Magic is part of you. Discover what it can become.', warlock: 'Power born from a pact with something extraordinary.', wizard: 'Turn curiosity and study into a mastery of the arcane.',
}
const currentIndex = computed(() => BUILDER_STEPS.findIndex((step) => step.id === draft.step))
const currentStep = computed(() => BUILDER_STEPS[currentIndex.value]!)
const pointsUsed = computed(() => ABILITY_KEYS.reduce((sum, key) => sum + (POINT_COST[draft.scores[key]] ?? 0), 0))
const eligibleFeatures = computed(() => context.value.features.filter((feature) => (feature.level ?? 1) <= draft.level))
const filteredEquipment = computed(() => equipment.value.filter((entry) => !equipmentQuery.value || entry.name.toLowerCase().includes(equipmentQuery.value.toLowerCase())))
const totalWeight = computed(() => draft.equipment.reduce((sum, entry) => sum + entry.qty * entry.weight, 0))
const selectedClassSkillCount = computed(() => draft.skills.filter((key) => skillChoice.value.options.includes(key) && !fixedSkills.value.includes(key)).length)
const completion = computed<Record<BuilderStep, boolean>>(() => ({
  race: !!race.value && !issues.value.some((issue) => issue.step === 'race'), class: !!klass.value && !issues.value.some((issue) => issue.step === 'class'),
  abilities: !issues.value.some((issue) => issue.step === 'abilities'), background: !!background.value || !!draft.customBackground.trim(),
  feats: !issues.value.some((issue)=>issue.step==='feats'),
  skills: !!klass.value && !issues.value.some((issue) => issue.step === 'skills'),
  spells: !issues.value.some((issue) => issue.step === 'spells') && (!!draft.spells.length || (!!klass.value && !canCast.value)), equipment: !!draft.equipment.length, identity: !!draft.name.trim(), review: canCreate.value,
}))
const completedCount = computed(() => BUILDER_STEPS.filter((step) => step.id !== 'review' && completion.value[step.id]).length)
const stepStatus = (step: BuilderStep) => ({
  race: race.value ? [race.value.name, subrace.value?.name].filter(Boolean).join(' · ') : 'Choose your heritage', class: klass.value ? `${klass.value.name} · Level ${draft.level}` : 'Choose your calling',
  abilities: abilityProblem(draft) ? 'Needs attention' : draft.method === 'pointBuy' ? `${pointsUsed.value}/27 points` : draft.method === 'standard' ? 'Standard array' : 'Manual scores',
  feats: `${selectedFeatIndexes(draft,context.value).length} feats selected`,
  background: background.value?.name ?? (draft.customBackground || 'Optional'), skills: `${new Set([...fixedSkills.value, ...draft.skills, ...draft.additionalSkills]).size} proficiencies`,
  spells: draft.spells.length ? `${draft.spells.length} selected` : 'Optional', equipment: draft.equipment.length ? `${draft.equipment.length} items` : 'Optional',
  identity: draft.name || 'Give them a name', review: canCreate.value ? 'Ready for adventure' : `${issues.value.length} choices to finish`,
})[step]
function setOverride(field: 'hpOverride' | 'acOverride', event: Event) {
  const input = event.target as HTMLInputElement
  draft[field] = input.value === '' ? null : input.valueAsNumber
}
const displayNumber = (value: number | null) => value !== null && Number.isFinite(value) ? value : '—'

watch(spellResults, async () => {
  await nextTick()
  spellResultsElement.value?.scrollTo({ top: 0 })
})

async function goTo(step: BuilderStep) {
  if (creating.value) return
  draft.step = step
  await nextTick()
  activeHeading.value?.focus({ preventScroll: true })
  activeHeading.value?.scrollIntoView({ block: 'start', behavior: 'smooth' })
}
function setMethod(method: typeof draft.method) {
  if (draft.method === method) return
  draft.method = method
  draft.scores = method === 'standard' ? { ...STANDARD_SCORES } : Object.fromEntries(ABILITY_KEYS.map((key) => [key, method === 'pointBuy' ? 8 : 10])) as typeof draft.scores
}
function assignScore(key: AbilityKey, event: Event) {
  const score = Number((event.target as HTMLSelectElement).value)
  const other = ABILITY_KEYS.find((ability) => ability !== key && draft.scores[ability] === score)
  if (other) draft.scores[other] = draft.scores[key]
  draft.scores[key] = score
}
function canIncrease(key: AbilityKey) {
  const score = draft.scores[key]
  return score < 15 && pointsUsed.value + POINT_COST[score + 1]! - POINT_COST[score]! <= 27
}
function rollScores() {
  draft.method = 'manual'
  for (const key of ABILITY_KEYS) {
    const rolls = Array.from({ length: 4 }, () => Math.floor(Math.random() * 6) + 1).sort((a, b) => a - b)
    draft.scores[key] = rolls.slice(1).reduce((sum, value) => sum + value, 0)
  }
}
function addLanguage() { if (languageSelection.value && !draft.extraLanguages.includes(languageSelection.value)) draft.extraLanguages.push(languageSelection.value); languageSelection.value = '' }
function addExtraSkill() { if (additionalSkill.value && !draft.additionalSkills.includes(additionalSkill.value)) draft.additionalSkills.push(additionalSkill.value); additionalSkill.value = '' }
function addCustomItem() {
  if (!customItemName.value.trim()) return
  draft.equipment.push({ index: `custom-${crypto.randomUUID()}`, name: customItemName.value.trim(), qty: 1, weight: 0, equipped: false, notes: '' })
  customItemName.value = ''
}
function equip(index: number) {
  const item = draft.equipment[index]!
  if (!item.equipped && item.armor_class) {
    for (const other of draft.equipment) if (other !== item && other.armor_class && (other.armor_category === 'Shield') === (item.armor_category === 'Shield')) other.equipped = false
  }
  item.equipped = !item.equipped
}
function directItems(value: Record<string, unknown>): { entry: SrdRef; quantity: number }[] | null {
  if (value.option_type === 'counted_reference' && value.of) return [{ entry: value.of as SrdRef, quantity: Number(value.count) || 1 }]
  if (value.option_type === 'multiple' && Array.isArray(value.items)) {
    const parts = value.items.map((item) => directItems(item as Record<string, unknown>))
    return parts.every(Boolean) ? parts.flatMap((part) => part ?? []) : null
  }
  return null
}
const startingChoices = computed(() => (klass.value?.starting_equipment_options ?? []).map((choice) => ({
  description: choice.desc ?? 'Starting equipment choice',
  options: (choice.from.options ?? []).flatMap((option) => { const items = directItems(option); return items ? [{ items, label: items.map((item) => `${item.quantity} × ${item.entry.name}`).join(', ') }] : [] }),
})))
async function addKit(items: { entry: SrdRef; quantity: number }[]) { for (const item of items) await builder.addEquipment(item.entry, item.quantity) }
const hasFixedEquipment = computed(() => (Array.isArray(klass.value?.starting_equipment) && klass.value.starting_equipment.length > 0) || !!background.value?.equipment.length)
async function createCharacter() {
  if (!canCreate.value || creating.value) return
  creating.value = true; createError.value = ''
  try {
    const character = await store.create(builder.create())
    builder.clearDraft()
    await router.push({ name: 'character', params: { id: character._id } })
  } catch (error) { createError.value = error instanceof Error ? error.message : 'Could not save the character. Your draft is safe.' }
  finally { creating.value = false }
}
</script>

<template>
  <div class="cb-page" :data-theme="appearance.theme" :data-accent="appearance.accent" :style="{ '--cb-text-scale': appearance.textSize === 'large' ? 1.14 : 1 }">
    <div class="cb-topbar"><div class="cb-topbar-inner"><RouterLink to="/" class="cb-back-link"><BuilderIcon name="back" :size="16" /> Your characters</RouterLink><div class="cb-topbar-actions"><span class="cb-rules-label"><span /> 5TH EDITION · 2014 RULES</span></div></div></div>
    <header class="cb-hero">
      <div class="cb-hero-inner"><div><p class="cb-eyebrow">THE CODEX · CHARACTER BUILDER</p><h1>Your next chapter<br class="cb-mobile-break" /> starts here.</h1><p>Build a character worth telling stories about. One choice at a time.</p></div>
        <div class="cb-hero-actions"><span class="cb-draft-status" role="status"><span :class="{ 'is-saved': saved }" />{{ storageError ? 'Draft not saved' : saved ? 'Draft saved on this device' : ready ? 'Saving draft…' : 'Loading your library…' }}</span>
          <button type="button" class="cb-button cb-button-outline" :disabled="creating" @click="goTo('review')">Review character <BuilderIcon name="arrow" :size="16" /></button></div>
      </div>
    </header>
    <div class="cb-workspace">
      <aside class="cb-navigation"><div class="cb-navigation-heading"><span>YOUR CHARACTER</span><span>{{ completedCount }}/{{ BUILDER_STEPS.length - 1 }}</span></div><div class="cb-progress-track"><span :style="{ width: `${completedCount / (BUILDER_STEPS.length - 1) * 100}%` }" /></div>
        <nav aria-label="Character creation sections"><button v-for="(step, index) in BUILDER_STEPS" :key="step.id" type="button" class="cb-nav-step" :class="{ 'is-active': draft.step === step.id, 'is-complete': completion[step.id] }" :aria-current="draft.step === step.id ? 'step' : undefined" :disabled="creating" @click="goTo(step.id)">
          <span class="cb-nav-number"><BuilderIcon v-if="completion[step.id] && draft.step !== step.id" name="check" :size="14" /><span v-else>{{ String(index + 1).padStart(2, '0') }}</span></span><span><strong>{{ step.title }}</strong><small>{{ stepStatus(step.id) }}</small></span><span v-if="draft.step === step.id" class="cb-active-dot" />
        </button></nav>
        <div class="cb-navigation-note"><BuilderIcon name="book" :size="18" /><p>Go at your own pace.<br />You can revisit any section.</p></div>
        <button type="button" class="cb-save-link" @click="builder.saveDraft"><BuilderIcon name="save" :size="15" /> Save draft</button>
      </aside>

      <main class="cb-main">
        <div v-if="restored" class="cb-notice"><BuilderIcon name="check" :size="17" /><span>Your saved draft is ready. Pick up where you left off.</span><button type="button" aria-label="Dismiss draft message" @click="restored = false"><BuilderIcon name="close" :size="14" /></button></div>
        <p v-for="warning in warnings" :key="warning" class="cb-alert" role="alert">{{ warning }}</p><p v-if="storageError" class="cb-alert" role="alert">{{ storageError }}</p>
        <div class="cb-mobile-snapshot"><button type="button" :aria-expanded="showMobileSummary" @click="showMobileSummary = !showMobileSummary"><BuilderIcon name="shield" :size="20" /><strong>{{ draft.name || 'Your adventurer' }}</strong><span>View character summary</span></button><div v-if="showMobileSummary" class="cb-mobile-stats">{{ race?.name || 'Race not selected' }} · {{ klass?.name || 'Class not selected' }} · Level {{ draft.level }}<br />HP {{ displayNumber(stats.hp) }} · AC {{ displayNumber(stats.ac) }} · Speed {{ displayNumber(stats.speed) }} ft.</div></div>
        <section class="cb-panel" aria-labelledby="builder-section-heading">
          <div class="cb-section-heading"><span class="cb-section-icon"><BuilderIcon :name="currentStep.icon" :size="24" /></span><div><p class="cb-eyebrow">CHAPTER {{ String(currentIndex + 1).padStart(2, '0') }} <span>OF {{ String(BUILDER_STEPS.length).padStart(2, '0') }}</span></p><h2 id="builder-section-heading" ref="activeHeading" tabindex="-1">{{ currentStep.title }}</h2></div><span class="cb-step-optional" v-if="['background', 'equipment'].includes(draft.step)">OPTIONAL</span></div>
          <p class="cb-section-description">{{ currentStep.description }}</p>
          <p v-if="detailError" class="cb-alert" role="alert">{{ detailError }}</p><p v-if="createError" class="cb-alert" role="alert">{{ createError }}</p>
          <div v-if="!ready" class="cb-loading" role="status"><span class="cb-spinner" /> Opening the character library…</div>
          <fieldset v-else class="cb-content-fieldset" :disabled="creating">
            <template v-if="draft.step === 'race'">
              <BuilderChoices :entries="races" :selected="draft.race" kind="race" icon="leaf" :descriptions="raceDescriptions" @choose="builder.chooseRace" />
              <div v-if="draft.race" class="cb-detail-panel"><p v-if="loadingDetails" class="cb-loading"><span class="cb-spinner" /> Reading your ancestry…</p><template v-if="race"><div class="cb-detail-heading"><div><p class="cb-eyebrow">YOUR ANCESTRY</p><h3>{{ race.name }}</h3></div><span class="cb-badge">{{ race.sourcePack ? 'IMPORTED' : 'SRD 2014' }}</span></div>
                <div class="cb-fact-row"><span><strong>{{ race.size }}</strong> size</span><span><strong>{{ race.speed }} ft.</strong> speed</span><span v-for="bonus in race.ability_bonuses" :key="bonus.ability_score.index"><strong>{{ signed(bonus.bonus) }} {{ bonus.ability_score.index.toUpperCase() }}</strong></span></div>
                <label v-if="subraceOptions.length" class="cb-field">Subrace / heritage<select v-model="draft.subrace"><option value="">No additional subrace</option><option v-for="entry in subraceOptions" :key="entry.index" :value="entry.index">{{ contentLabel(entry) }}</option></select></label>
                <p v-if="subrace" class="cb-field-hint">{{ subrace.name }} bonuses are included in your final ability scores.</p>
                <details v-for="(trait, index) in [...raceTraits, ...subraceTraits]" :key="index" class="cb-trait"><summary>{{ trait.name }}<span>+</span></summary><p>{{ trait.description }}</p></details>
                <details v-if="race.age || race.alignment" class="cb-trait"><summary>Culture & characteristics<span>+</span></summary><p>{{ race.age }}</p><p>{{ race.alignment }}</p><p>{{ race.language_desc }}</p></details>
              </template></div>
            </template>

            <template v-else-if="draft.step === 'class'"><WorkshopCharacterChoices v-model="draft.ruleChoices" :rules="(context.ruleDefinitions??[]).map(r=>r.draft)" :level="draft.level" />
              <div class="cb-level-control"><div><strong>Starting level</strong><p>A new adventure usually begins at level 1.</p></div><label class="cb-level-input"><span>LEVEL</span><input v-model.number="draft.level" type="number" min="1" max="20" aria-label="Starting level" /></label></div>
              <BuilderChoices :entries="classes" :selected="draft.klass" kind="class" icon="swords" :descriptions="classDescriptions" @choose="builder.chooseClass" />
              <div v-if="draft.klass" class="cb-detail-panel"><p v-if="loadingDetails" class="cb-loading"><span class="cb-spinner" /> Reading your class features…</p><template v-if="klass"><div class="cb-detail-heading"><div><p class="cb-eyebrow">YOUR CALLING</p><h3>{{ klass.name }}</h3></div><span class="cb-big-die">d{{ klass.hit_die }}</span></div>
                <div class="cb-fact-row"><span><strong>{{ displayNumber(stats.hp) }}</strong> starting HP</span><span><strong>{{ klass.saving_throws.map((entry) => entry.index.toUpperCase()).join(' & ') }}</strong> saves</span></div>
                <label v-if="subclassOptions.length" class="cb-field">Subclass <span class="cb-field-hint">Optional · choose when appropriate for your level</span><select v-model="draft.subclass"><option value="">Choose later</option><option v-for="entry in subclassOptions" :key="entry.index" :value="entry.index">{{ contentLabel(entry) }}</option></select></label>
                <details v-for="(feature, index) in [...classTraits, ...subclassTraits].filter((feature) => (feature.level ?? 1) <= draft.level)" :key="index" class="cb-trait"><summary>{{ feature.name }}<span>+</span></summary><p>{{ feature.description }}</p></details>
              </template></div>
            </template>

            <template v-else-if="draft.step === 'abilities'">
              <div class="cb-methods"><button v-for="method in (['standard', 'pointBuy', 'manual'] as const)" :key="method" type="button" :aria-pressed="draft.method === method" @click="setMethod(method)"><BuilderIcon :name="method === 'standard' ? 'star' : method === 'pointBuy' ? 'dice' : 'person'" :size="18" />{{ method === 'standard' ? 'Standard array' : method === 'pointBuy' ? 'Point buy' : 'Manual scores' }}</button></div>
              <div class="cb-score-explainer"><p>{{ draft.method === 'standard' ? 'Assign 15, 14, 13, 12, 10, and 8. Selecting a score swaps it with its current ability.' : draft.method === 'pointBuy' ? 'Spend up to 27 points. Your base scores start at 8, before racial bonuses.' : 'Enter your base scores, or roll 4d6 and drop the lowest die for each ability.' }}</p><span v-if="draft.method === 'pointBuy'" class="cb-points">{{ 27 - pointsUsed }}<small>POINTS LEFT</small></span><button v-if="draft.method === 'manual'" class="cb-button cb-button-subtle" type="button" @click="rollScores"><BuilderIcon name="dice" :size="18" /> Roll 4d6</button></div>
              <p v-if="abilityProblem(draft)" class="cb-alert" role="alert">{{ abilityProblem(draft) }}</p>
              <div class="cb-abilities-grid"><div v-for="key in ABILITY_KEYS" :key="key" class="cb-ability-card"><div class="cb-ability-label"><strong>{{ key.toUpperCase() }}</strong><span>{{ abilityNames[key] }}</span></div><span class="cb-ability-modifier">{{ signed(abilityMod(scores[key])) }}</span><div class="cb-ability-edit"><label :for="`score-${key}`">BASE SCORE</label><select v-if="draft.method === 'standard'" :id="`score-${key}`" :aria-label="`${abilityNames[key]} base score`" :value="draft.scores[key]" @change="assignScore(key, $event)"><option v-for="value in [15, 14, 13, 12, 10, 8]" :key="value" :value="value">{{ value }}</option></select><div v-else-if="draft.method === 'pointBuy'" class="cb-score-stepper"><button type="button" :aria-label="`Decrease ${abilityNames[key]}`" :disabled="draft.scores[key] <= 8" @click="draft.scores[key]--">−</button><strong>{{ draft.scores[key] }}</strong><button type="button" :aria-label="`Increase ${abilityNames[key]}`" :disabled="!canIncrease(key)" @click="draft.scores[key]++">+</button></div><input v-else :id="`score-${key}`" :aria-label="`${abilityNames[key]} base score`" v-model.number="draft.scores[key]" type="number" min="3" max="20" /></div><div class="cb-final-score"><strong>{{ scores[key] }}</strong><span>FINAL SCORE<small>{{ scores[key] - draft.scores[key] ? `${signed(scores[key] - draft.scores[key])} from bonuses` : 'No bonus applied' }}</small></span></div></div></div>
              <details class="cb-advanced"><summary>Additional ability adjustments <span>Feats, higher levels & homebrew</span></summary><p class="cb-field-hint">Enter table-specific changes here. Racial bonuses and choices from Feats & advancements are already applied; do not count them twice.</p><div class="cb-adjustments"><label v-for="key in ABILITY_KEYS" :key="key" class="cb-field">{{ key.toUpperCase() }}<input v-model.number="draft.adjustments[key]" type="number" min="-20" max="20" /></label></div></details>
            </template>

            <template v-else-if="draft.step === 'feats'"><BuilderAdvancements :draft="draft" :context="context" :feats="feats" /></template>
            <template v-else-if="draft.step === 'background'">
              <BuilderChoices :entries="backgrounds" :selected="draft.background" kind="background" icon="book" :descriptions="{ acolyte: 'A life of faith, service, and the communities that shaped you.' }" @choose="builder.chooseBackground" />
              <div v-if="background" class="cb-detail-panel"><div class="cb-detail-heading"><div><p class="cb-eyebrow">BEFORE THE ADVENTURE</p><h3>{{ background.name }}</h3></div><button type="button" class="cb-text-button" @click="draft.background = ''">Clear</button></div><p class="cb-reference-copy">{{ background.description }}</p><div class="cb-fact-row"><span v-if="background.skills.length"><strong>{{ background.skills.map((key) => prettySkill(key)).join(', ') }}</strong> skills</span><span v-if="background.languages"><strong>{{ background.languages }}</strong> extra languages</span></div><details v-for="trait in background.traits" :key="trait.name" class="cb-trait"><summary>{{ trait.name }}<span>+</span></summary><p>{{ trait.description }}</p></details></div>
              <div class="cb-subsection"><label class="cb-field">Or write your own background<input v-model="draft.customBackground" maxlength="255" placeholder="Sailor, wandering scholar, exiled heir…" :disabled="!!draft.background" /></label><p class="cb-field-hint">For a custom background, add its skills, languages, and starting gear in the next sections.</p></div>
            </template>

            <template v-else-if="draft.step === 'skills'">
              <div class="cb-selection-counter"><div><h3>Skill proficiencies</h3><p>{{ skillChoice.choose ? `Choose ${skillChoice.choose} class skills. Granted proficiencies are already included.` : 'Record the skills your character is trained in.' }}</p></div><strong v-if="skillChoice.choose">{{ selectedClassSkillCount }} <span>/ {{ skillChoice.choose }}</span></strong></div>
              <p v-if="klass?.workshop" class="cb-note">Expertise: {{draft.expertise.length}} / {{klass.workshop.expertiseCount}} choices.</p><div class="cb-skills-grid"><div v-for="(ability, key) in SKILL_ABILITY" :key="key" class="cb-skill-row" :class="{ 'is-selected': draft.skills.includes(key) || fixedSkills.includes(key), 'is-unavailable': skillChoice.choose && !skillChoice.options.includes(key) && !fixedSkills.includes(key) }"><button type="button" :aria-pressed="draft.skills.includes(key) || fixedSkills.includes(key)" :disabled="fixedSkills.includes(key) || (!!skillChoice.choose && !skillChoice.options.includes(key)) || (!draft.skills.includes(key) && !!skillChoice.choose && draft.skills.length >= skillChoice.choose)" @click="builder.toggleSkill(key)"><span class="cb-checkbox"><BuilderIcon v-if="draft.skills.includes(key) || fixedSkills.includes(key)" name="check" :size="13" /></span><span><strong>{{ prettySkill(key) }}</strong><small>{{ ability.toUpperCase() }}{{ fixedSkills.includes(key) ? ' · Granted' : '' }}</small></span><b>{{ signed(skillMod(draft.level, scores[ability], draft.expertise.includes(key) ? 'expert' : draft.skills.includes(key) || fixedSkills.includes(key) ? 'prof' : 'none')) }}</b></button><label v-if="draft.skills.includes(key) || fixedSkills.includes(key)" class="cb-expertise"><input type="checkbox" :checked="draft.expertise.includes(key)" @change="draft.expertise = draft.expertise.includes(key) ? draft.expertise.filter((value) => value !== key) : [...draft.expertise, key]" /> Expertise</label></div></div>
              <div class="cb-subsection"><h3>Languages</h3><p class="cb-field-hint">{{ context.proficiencies.languages.join(', ') || 'No languages granted yet.' }}{{ background?.languages ? ` · Choose ${background.languages} extra languages from your background.` : '' }}</p><div class="cb-inline-form"><label class="cb-field cb-grow">Additional language<select v-model="languageSelection"><option value="">Choose a language…</option><option v-for="entry in languages" :key="entry.index" :value="entry.name">{{ entry.name }}</option></select></label><button class="cb-button cb-button-secondary" type="button" :disabled="!languageSelection" @click="addLanguage">Add</button></div><div class="cb-chips"><button v-for="language in draft.extraLanguages" :key="language" type="button" @click="draft.extraLanguages = draft.extraLanguages.filter((value) => value !== language)">{{ language }} <BuilderIcon name="close" :size="12" /></button></div><label class="cb-field cb-tools-field">Additional tools & instruments<input v-model="draft.tools" placeholder="Disguise kit, lute, carpenter’s tools…" /><span class="cb-field-hint">Separate tools with commas.</span></label></div>
              <div class="cb-subsection"><h3>Additional skill training</h3><p class="cb-field-hint">Use this for custom backgrounds, racial choices, or other granted skills.</p><div class="cb-inline-form"><label class="cb-field cb-grow">Skill<select v-model="additionalSkill"><option value="">Choose an additional proficiency…</option><option v-for="(_, key) in SKILL_ABILITY" :key="key" :value="key" :disabled="fixedSkills.includes(key) || draft.skills.includes(key) || draft.additionalSkills.includes(key)">{{ prettySkill(key) }}</option></select></label><button type="button" class="cb-button cb-button-secondary" :disabled="!additionalSkill" @click="addExtraSkill">Add</button></div><div class="cb-chips"><button v-for="key in draft.additionalSkills" :key="key" type="button" @click="draft.additionalSkills = draft.additionalSkills.filter((value) => value !== key)">{{ prettySkill(key) }} <BuilderIcon name="close" :size="12" /></button></div></div>
              <details class="cb-advanced"><summary>Granted armor, weapon & tool proficiencies</summary><p v-for="(values, group) in context.proficiencies" :key="group" class="cb-reference-copy"><strong>{{ group }}:</strong> {{ values.join(', ') || 'None' }}</p></details>
            </template>

            <template v-else-if="draft.step === 'spells'">
              <div class="cb-spell-settings"><label class="cb-field">Spellcasting ability<select v-model="draft.spellAbility"><option value="">{{ abilityNames[context.spellAbility] }} (from class)</option><option v-for="key in ABILITY_KEYS" :key="key" :value="key">{{ abilityNames[key] }}</option></select></label><span><strong>{{ signed(abilityMod(scores[draft.spellAbility || context.spellAbility]) + stats.proficiency) }}</strong> SPELL ATTACK</span><span><strong>{{ 8 + abilityMod(scores[draft.spellAbility || context.spellAbility]) + stats.proficiency }}</strong> SAVE DC</span></div>
              <div class="cb-spell-allowances" aria-label="Spell selection allowances" aria-live="polite">
                <div class="cb-allowance-heading"><strong>{{ klass?.name || 'Choose your class' }} · Level {{ draft.level }}</strong><span v-if="spellPolicy.available">{{ spellPolicy.maxLevel ? `Up to spell level ${spellPolicy.maxLevel}` : 'Cantrips / special grants only' }}</span></div>
                <div class="cb-allowance-grid"><div v-for="counter in spellCounters" :key="counter.title" class="cb-allowance-card" :class="{ 'is-over': counter.limit !== null && counter.selected > counter.limit }"><span>{{ counter.title }}</span><strong>{{ counter.selected }} <small>/ {{ counter.limit ?? 'manual' }}</small></strong><small>{{ counter.limit === null ? 'Follow your class rules' : counter.selected > counter.limit ? `${counter.selected - counter.limit} over allowance` : `${counter.limit - counter.selected} remaining` }}</small></div></div>
                <p class="cb-field-hint">{{ spellPolicy.note }}</p><p class="cb-field-hint">Cantrips do not use spell slots or count against prepared spells. Spell slots track casts, not how many spells you may choose.</p>
              </div>
              <label class="cb-spell-override"><input v-model="draft.spellLimitOverride" type="checkbox" /><span><strong>Override spell selection limits</strong><small>Allow extra choices, special grants, copied spells, or homebrew rules.</small></span><span v-if="draft.spellLimitOverride" class="cb-badge">OVERRIDE ON</span></label>
              <div v-if="spellProblems.length && !draft.spellLimitOverride" class="cb-alert" role="alert"><p v-for="problem in spellProblems" :key="problem">{{ problem }}</p></div>
              <div class="cb-spell-toolbar"><label class="cb-search"><BuilderIcon name="search" :size="17" /><input v-model="spellQuery" placeholder="Search spells…" aria-label="Search starting spells" /></label><select v-model="spellLevel" aria-label="Spell level"><option value="all">All levels</option><option value="0">Cantrips</option><option v-for="value in 9" :key="value" :value="String(value)">Level {{ value }}</option></select></div><label v-if="canCast" class="cb-checkbox-label"><input v-model="classSpellsOnly" type="checkbox" /> Show only my class spell list</label>
              <p v-if="spellError" class="cb-alert" role="alert">{{ spellError }}</p>
              <div class="cb-spell-browser">
                <div class="cb-spell-list">
                  <div class="cb-spell-list-heading"><strong>Available spells <span>{{ spellResults.length }}</span></strong><small>Scroll to browse · select to read</small></div>
                  <div ref="spellResultsElement" class="cb-spell-results" tabindex="0" role="region" aria-label="Available spells" :aria-busy="spellLoading">
                    <p v-if="spellLoading" class="cb-loading"><span class="cb-spinner" /> Finding spells…</p>
                    <p v-else-if="!spellResults.length" class="cb-empty">No matching spells.</p>
                    <template v-else>
                      <button v-for="entry in spellResults" :key="entry.index" type="button" :aria-pressed="spellDetail?.index === entry.index" :class="{ 'is-selected': spellDetail?.index === entry.index }" @click="builder.inspectSpell(entry.index)">
                        <span>{{ entry.name }}<small>{{ entry.sourcePack || 'SRD 2014' }}</small></span><BuilderIcon v-if="draft.spells.some((spell) => spell.index === entry.index)" name="check" :size="15" /><span v-else>›</span>
                      </button>
                    </template>
                  </div>
                </div>
                <div class="cb-spell-detail-panel" :aria-busy="spellDetailLoading">
                  <p v-if="spellDetailLoading" class="cb-loading">Reading spell…</p>
                  <template v-else-if="spellDetail">
                    <div :key="spellDetail.index" class="cb-spell-description" tabindex="0" role="region" :aria-label="`${spellDetail.name} description`">
                      <span class="cb-badge">{{ spellDetail.level === 0 ? 'CANTRIP' : `LEVEL ${spellDetail.level}` }} · {{ spellDetail.school.name }}</span><h3>{{ spellDetail.name }}</h3>
                      <p class="cb-field-hint">{{ spellDetail.casting_time }} · {{ spellDetail.range }}<br />{{ spellDetail.duration }}</p>
                      <p v-for="(paragraph, index) in spellDetail.desc" :key="index" class="cb-reference-copy">{{ paragraph }}</p>
                      <template v-if="spellDetail.higher_level?.length"><h4>At higher levels</h4><p v-for="(paragraph, index) in spellDetail.higher_level" :key="index" class="cb-reference-copy">{{ paragraph }}</p></template>
                    </div>
                    <div class="cb-spell-actions">
                      <label v-if="spellDetail.level > 0 && spellPolicy.prepared !== null && !spellAlreadyAdded" class="cb-checkbox-label"><input v-model="prepareNewSpell" type="checkbox" /> Add as prepared</label>
                      <p v-if="spellAddProblem && !spellAlreadyAdded" class="cb-field-hint" role="status">{{ spellAddProblem }}{{ spellAddProblem.startsWith('Prepared spell limit') && spellDetail.level > 0 && prepareNewSpell ? ' You can untick Add as prepared to keep a spell unprepared.' : '' }}</p>
                      <button type="button" class="cb-button cb-button-primary" :disabled="!!spellAddProblem" @click="builder.addSpell(spellDetail, prepareNewSpell)"><BuilderIcon :name="spellAlreadyAdded ? 'check' : 'plus'" :size="16" />{{ spellAlreadyAdded ? 'Added to character' : 'Add to character' }}</button>
                    </div>
                  </template>
                  <div v-else class="cb-spell-placeholder"><BuilderIcon name="wand" :size="30" /><p>Select a spell to read its effects.</p></div>
                </div>
              </div>
              <div v-if="draft.spells.length" class="cb-subsection"><h3>Your starting spells <span class="cb-count-pill">{{ draft.spells.length }}</span></h3><div v-for="spell in draft.spells" :key="spell.index" class="cb-selected-row"><span><strong>{{ spell.name }}</strong><small>{{ spell.level === 0 ? 'Cantrip' : `Level ${spell.level}` }}</small></span><label v-if="spell.level > 0 && spellPolicy.prepared !== null" class="cb-checkbox-label"><input type="checkbox" :checked="spell.prepared" :disabled="!spell.prepared && !builder.canPrepareSpell(spell.index)" @change="spell.prepared = ($event.target as HTMLInputElement).checked && builder.canPrepareSpell(spell.index)" /> Prepared</label><span v-else class="cb-field-hint">{{ spell.level === 0 ? 'Always ready' : spellPolicy.available ? 'Known' : 'Selected' }}</span><button type="button" :aria-label="`Remove ${spell.name}`" @click="draft.spells = draft.spells.filter((entry) => entry.index !== spell.index)"><BuilderIcon name="close" :size="16" /></button></div></div>
              <details class="cb-advanced" open><summary>Spell slots & level progression <span>Total casts available at level {{draft.level}}</span></summary><SpellSlotEditor creation :character="progressionCharacter" @change="changeCasting" /></details><details class="cb-advanced"><summary>Class & custom points <span>Fixed pools or points gained each level</span></summary><ResourceEditor creation :character="progressionCharacter" @change="draft.resources=$event" /></details>
            </template>

            <template v-else-if="draft.step === 'equipment'">
              <div v-if="klass || background" class="cb-detail-panel cb-starter-equipment"><div class="cb-detail-heading"><div><p class="cb-eyebrow">STARTING GEAR</p><h3>Pack for your calling.</h3></div><BuilderIcon name="bag" :size="28" /></div><button v-if="hasFixedEquipment" type="button" class="cb-button cb-button-secondary" :disabled="inventoryBusy" @click="builder.addFixedEquipment">Add fixed class & background gear</button><div v-for="(choice, index) in startingChoices" :key="index" class="cb-gear-choice"><p>{{ choice.description }}</p><div class="cb-chips"><button v-for="option in choice.options" :key="option.label" type="button" :disabled="inventoryBusy" @click="addKit(option.items)"><BuilderIcon name="plus" :size="12" />{{ option.label }}</button></div><p v-if="!choice.options.length" class="cb-field-hint">Use the equipment search below to choose these items.</p></div><p v-if="!startingChoices.length && !hasFixedEquipment" class="cb-field-hint">Add your starting gear from the equipment list below.</p></div>
              <label class="cb-search cb-equipment-search"><BuilderIcon name="search" :size="18" /><input v-model="equipmentQuery" placeholder="Search weapons, armor & adventuring gear…" aria-label="Search equipment" /></label><div class="cb-equipment-catalog"><button v-for="entry in filteredEquipment.slice(0, equipmentLimit)" :key="entry.index" type="button" :disabled="inventoryBusy" @click="builder.addEquipment(entry)"><span>{{ entry.name }}</span><BuilderIcon name="plus" :size="15" /></button></div><button v-if="filteredEquipment.length > equipmentLimit" type="button" class="cb-text-button" @click="equipmentLimit += 12">Show more equipment</button>
              <div class="cb-inline-form cb-custom-equipment"><label class="cb-field cb-grow">Custom item<input v-model="customItemName" maxlength="100" placeholder="A keepsake, unusual weapon, or anything else…" @keydown.enter.prevent="addCustomItem" /></label><button type="button" class="cb-button cb-button-secondary" :disabled="!customItemName.trim()" @click="addCustomItem">Add item</button></div>
              <div class="cb-subsection"><div class="cb-detail-heading"><h3>Your inventory</h3><span class="cb-field-hint">{{ totalWeight.toFixed(1) }} lb. carried</span></div><p v-if="!draft.equipment.length" class="cb-empty">Your pack is empty. Add some essentials or come back later.</p><div v-for="(item, index) in draft.equipment" :key="item.index" class="cb-inventory-row"><div><details><summary>{{ item.name }}</summary><ItemRules :item="item" /></details><label class="cb-checkbox-label"><input type="checkbox" :checked="item.equipped" @change="equip(index)" /> Equipped</label></div><label>QTY<input v-model.number="item.qty" type="number" min="1" :aria-label="`${item.name} quantity`" /></label><label>LB. EACH<input v-model.number="item.weight" type="number" min="0" step="0.1" :aria-label="`${item.name} weight`" /></label><button type="button" :aria-label="`Remove ${item.name}`" @click="draft.equipment.splice(index, 1)"><BuilderIcon name="close" :size="16" /></button></div></div>
            </template>

            <template v-else-if="draft.step === 'identity'">
              <div class="cb-name-field"><label for="hero-name">Every hero has a name.</label><input id="hero-name" v-model="draft.name" maxlength="80" placeholder="What shall we call you?" autocomplete="off" /></div>
              <div class="cb-form-grid"><label class="cb-field">Pronouns<input v-model="draft.pronouns" maxlength="60" placeholder="e.g. she / her" /></label><label class="cb-field">Age<input v-model="draft.age" maxlength="40" placeholder="Years, seasons, or a mystery" /></label><label class="cb-field">Alignment<select v-model="draft.alignment"><option value="">Leave undefined</option><option v-for="alignment in ['Lawful Good', 'Neutral Good', 'Chaotic Good', 'Lawful Neutral', 'True Neutral', 'Chaotic Neutral', 'Lawful Evil', 'Neutral Evil', 'Chaotic Evil']" :key="alignment">{{ alignment }}</option></select></label><label class="cb-field">Portrait URL <span class="cb-field-hint">Optional</span><input v-model="draft.portrait" type="url" placeholder="https://…" /></label></div>
              <div class="cb-subsection"><h3>Give them a little depth.</h3><div class="cb-form-grid"><label v-for="field in (['traits', 'ideals', 'bonds', 'flaws'] as const)" :key="field" class="cb-field">{{ field === 'traits' ? 'Personality traits' : field.charAt(0).toUpperCase() + field.slice(1) }}<select v-if="background?.suggestions[field]?.length" :aria-label="`Suggested ${field}`" value="" @change="draft.personality[field] = ($event.target as HTMLSelectElement).value"><option value="">Ideas from your background…</option><option v-for="suggestion in background.suggestions[field]" :key="suggestion" :value="suggestion">{{ suggestion }}</option></select><textarea :aria-label="field === 'traits' ? 'Personality traits' : field.charAt(0).toUpperCase() + field.slice(1)" v-model="draft.personality[field]" rows="3" :placeholder="field === 'ideals' ? 'What do they believe in?' : field === 'bonds' ? 'Who or what matters most?' : field === 'flaws' ? 'What gets them into trouble?' : 'How do they see the world?'" /></label></div><label class="cb-field">Appearance<textarea v-model="draft.personality.appearance" rows="3" placeholder="A recognizable detail, a favorite coat, an old scar…" /></label><label class="cb-field">Backstory<textarea v-model="draft.personality.backstory" rows="5" placeholder="Where have they been, and why are they setting out now?" /></label></div>
            </template>

            <template v-else-if="draft.step === 'review'">
              <div class="cb-review-banner" :class="{ 'is-ready': canCreate }"><BuilderIcon :name="canCreate ? 'check' : 'book'" :size="26" /><div><h3>{{ canCreate ? 'Your adventure is ready to begin.' : 'A few final choices.' }}</h3><p>{{ canCreate ? 'Your choices are ready to become a character sheet.' : 'Finish these essentials, then your character is ready.' }}</p></div></div>
              <div v-if="issues.length" class="cb-review-issues"><button v-for="issue in issues" :key="issue.message" type="button" @click="goTo(issue.step)"><span>{{ issue.message }}</span><BuilderIcon name="arrow" :size="16" /></button></div>
              <div class="cb-review-grid"><button v-for="step in BUILDER_STEPS.filter((step) => step.id !== 'review')" :key="step.id" type="button" class="cb-review-card" @click="goTo(step.id)"><BuilderIcon :name="step.icon" :size="21" /><span><small>{{ step.title }}</small><strong>{{ stepStatus(step.id) }}</strong></span><span class="cb-edit-label">Edit</span></button></div>
              <details class="cb-advanced"><summary>Combat values & overrides</summary><p class="cb-field-hint">HP uses fixed class gains. AC uses equipped armor and Dexterity. Enter special defenses or table adjustments here.</p><div class="cb-form-grid"><label class="cb-field">Maximum HP override<input :value="draft.hpOverride" type="number" min="1" :placeholder="String(displayNumber(stats.hp))" @input="setOverride('hpOverride', $event)" /></label><label class="cb-field">Armor class override<input :value="draft.acOverride" type="number" min="1" :placeholder="String(displayNumber(stats.ac))" @input="setOverride('acOverride', $event)" /></label></div></details>
              <details class="cb-advanced"><summary>Features & traits <span>{{ eligibleFeatures.length }} included</span></summary><details v-for="(feature, index) in eligibleFeatures" :key="index" class="cb-trait"><summary>{{ feature.name }}<span>+</span></summary><p>{{ feature.description }}</p></details></details>
              <label class="cb-field cb-final-notes">A note for the first session<span class="cb-field-hint">Record feature choices such as fighting styles, invocations, or table-specific rules here.</span><textarea v-model="draft.personality.notes" rows="3" placeholder="A goal, a question for your DM, or something you don’t want to forget…" /></label>
            </template>
          </fieldset>
          <footer class="cb-panel-footer"><button type="button" class="cb-button cb-button-subtle" :disabled="creating" @click="currentIndex ? goTo(BUILDER_STEPS[currentIndex - 1]!.id) : router.push('/')"><BuilderIcon name="back" :size="16" />{{ currentIndex ? 'Back' : 'Save & exit' }}</button><span>{{ draft.step === 'review' ? 'You can edit your sheet later.' : 'Your progress is saved automatically.' }}</span><button v-if="draft.step !== 'review'" type="button" class="cb-button cb-button-primary" :disabled="!ready || creating" @click="goTo(BUILDER_STEPS[currentIndex + 1]!.id)">Next: {{ BUILDER_STEPS[currentIndex + 1]!.title }} <BuilderIcon name="arrow" :size="16" /></button><button v-else type="button" class="cb-button cb-button-primary" :disabled="!canCreate || creating" @click="createCharacter"><BuilderIcon :name="creating ? 'save' : 'check'" :size="18" />{{ creating ? 'Creating character…' : 'Create character' }}</button></footer>
        </section>
        <p class="cb-bottom-note"><BuilderIcon name="book" :size="15" /> Your story, your pace. Optional choices can be added on your character sheet.</p>
      </main>

      <aside class="cb-summary" aria-label="Live character summary"><div class="cb-summary-card"><p class="cb-eyebrow">YOUR ADVENTURER</p><div class="cb-summary-emblem"><img v-if="draft.portrait" :src="draft.portrait" alt="Character portrait" /><BuilderIcon v-else name="shield" :size="48" /><span>LVL {{ draft.level }}</span></div><h2>{{ draft.name || 'A story unwritten' }}</h2><p class="cb-summary-identity">{{ race?.name || 'Choose your ancestry' }}{{ subrace ? ` · ${subrace.name}` : '' }}<br />{{ klass?.name || 'Find your calling' }}{{ subclass ? ` · ${subclass.name}` : '' }}</p><span v-if="background || draft.customBackground" class="cb-summary-background">{{ background?.name || draft.customBackground }}</span><div class="cb-summary-divider" />
        <div class="cb-summary-stats"><div><BuilderIcon name="shield" :size="16" /><strong>{{ displayNumber(stats.ac) }}</strong><span>ARMOR CLASS</span></div><div><span class="cb-heart-symbol">♡</span><strong>{{ displayNumber(stats.hp) }}</strong><span>HIT POINTS</span></div><div><BuilderIcon name="leaf" :size="16" /><strong>{{ displayNumber(stats.speed) }}</strong><span>SPEED · FT.</span></div></div>
        <div class="cb-summary-abilities"><div v-for="key in ABILITY_KEYS" :key="key"><span>{{ key.toUpperCase() }}</span><strong>{{ scores[key] }}</strong><small>{{ signed(abilityMod(scores[key])) }}</small></div></div><div class="cb-summary-line"><span>Proficiency bonus</span><strong>{{ signed(stats.proficiency) }}</strong></div><div class="cb-summary-line"><span>Initiative</span><strong>{{ signed(stats.initiative) }}</strong></div><div class="cb-summary-line"><span>Features & traits</span><strong>{{ eligibleFeatures.length }}</strong></div><div class="cb-summary-line"><span>Spells selected</span><strong>{{ draft.spells.length }}</strong></div><div class="cb-summary-divider" /><button type="button" class="cb-summary-review" @click="goTo('review')">{{ canCreate ? 'Ready for adventure' : 'Review your character' }}<BuilderIcon name="arrow" :size="16" /></button><ShadowChampions v-if="isRevenantShadow(klass?.name??'')" :level="draft.level" /></div><p class="cb-summary-note">The details make the hero.<br />The choices are yours.</p></aside>
    </div>
  </div>
</template>

<script lang="ts">
function prettySkill(value: string) { return value.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase()) }
</script>
