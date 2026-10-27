<script setup lang="ts">
import { revealNavigationTarget } from '../../lib/navigation-scroll'
import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useCharactersStore } from '../../stores/characters'
import { ApiError } from '../../lib/api'
import { srd, type SrdRef, type SrdSpell } from '../../lib/srd'
import { ABILITY_KEYS, SKILL_ABILITY, abilityMod } from '../../lib/calc'
import { pretty, signed } from '../../lib/character-sheet'
import {
  advancementCatalog,
  loadAdvancementRules,
  preparedLimit,
  type AdvancementCatalog,
} from '../../lib/level-up-rules'
import {
  levelUpPlan,
  newAdvancement,
  standardClasses,
  levelUpXP,
  type AdvancementRules,
  type AdvancementOption,
  type AdvancementFeature,
  advancementOptionProblem,
} from '../../../shared/level-up'
import { progressionClasses } from '../../../shared/character-progression'
import { ruleName } from '../../../shared/workshop-character'
import type { Character } from '../../../shared/character'
import './level-up.css'
import { featEffects, findFeats, sortSpellsByLevel, type FeatEffect } from '../../lib/advancement-discovery'
const emit = defineEmits<{ dirty: [value: boolean]; saved: []; cancel: [] }>(),
  store = useCharactersStore()
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v))
const base = ref<Character>(clone(store.current!)),
  decisions = reactive(newAdvancement(base.value)),
  rules = ref<AdvancementRules | null>(null)
const catalog = ref<AdvancementCatalog>({
    classes: [],
    subclasses: [],
    rules: [],
    feats: [],
    spells: [],
  }),
  initialised = ref(false),
  catalogBusy = ref(true),
  rulesBusy = ref(false),
  error = ref(''),
  conflict = ref(false),
  saveDone = ref(false),
  step = ref(0),
  attempted = ref(false),
  heading = ref<HTMLElement | null>(null)
const steps = [
  { key: 'class', name: 'Class & level', hint: 'Choose the path' },
  { key: 'health', name: 'Hit points', hint: 'Roll or take the average' },
  {
    key: 'training',
    name: 'Abilities & feats',
    hint: 'Use earned improvements',
  },
  {
    key: 'features',
    name: 'Features & choices',
    hint: 'Add this level’s grants',
  },
  { key: 'magic', name: 'Spells & resources', hint: 'Review casting changes' },
  { key: 'review', name: 'Review & apply', hint: 'Check every change' },
] as const
const plan = computed(() =>
    rules.value ? levelUpPlan(base.value, rules.value, decisions) : null,
  ),
  currentStep = computed(() => steps[step.value]!),
  currentIssues = computed(
    () => plan.value?.issues[currentStep.value.key] ?? [],
  )
const classOptions = computed(() =>
  [
    ...Object.entries(standardClasses).map(([index]) => ({
      index,
      name: pretty(index),
    })),
    ...catalog.value.classes.map((c) => ({ index: c.index, name: c.name })),
    ...catalog.value.rules
      .filter((r) => r.workshop.kind === 'class')
      .map((r) => ({ index: r.index, name: r.name })),
    ...progressionClasses(base.value)
      .filter(
        (e) =>
          !standardClasses[ruleName(e.name)] &&
          !catalog.value.classes.some((c) => c.name === e.name) &&
          !catalog.value.rules.some((r) => r.name === e.name),
      )
      .map((e) => ({ index: e.index ?? e.name, name: e.name })),
  ].filter((v, i, a) => a.findIndex((o) => o.index === v.index) === i),
)
const classIsNew = computed(
  () =>
    !progressionClasses(base.value).some(
      (e) => ruleName(e.name) === ruleName(decisions.className),
    ),
)
const needsSubclass = computed(
  () =>
    rules.value &&
    rules.value.classLevel >= rules.value.subclassLevel &&
    !progressionClasses(base.value).find(
      (e) => ruleName(e.name) === ruleName(decisions.className),
    )?.subclass &&
    !(
      progressionClasses(base.value).length === 1 &&
      ruleName(progressionClasses(base.value)[0]!.name) ===
        ruleName(decisions.className) &&
      base.value.meta.subclass
    ),
)
const featIndex = ref(''),
  featQuery = ref(''),
  featEffect = ref<FeatEffect | ''>(''),
  featSource = ref(''),
  spellQuery = ref(''),
  spellDetail = ref<SrdSpell | null>(null),
  spellBusy = ref(false),
  spells = ref<(SrdRef & { level: number })[]>([]),
  spellList = ref<string[]>([]),
  spellCatalogBusy = ref(false),
  spellError = ref('')
const availableFeats = computed(() => findFeats(catalog.value.feats, featQuery.value, featEffect.value, featSource.value))
const featSources = computed(() => [...new Set(catalog.value.feats.flatMap(f => f.sourcePack ? [f.sourcePack] : []))].sort())
const selectedFeat = computed(() => catalog.value.feats.find(f => f.index === featIndex.value))
const featSearchInput = ref<HTMLInputElement | null>(null)
function resetFeatFilters() {
  featQuery.value = ''
  featEffect.value = ''
  featSource.value = ''
  featSearchInput.value?.focus()
}
const availableSpells = computed(() =>
  sortSpellsByLevel(spells.value
    .filter(
      (s) =>
        !base.value.spellcasting.known.includes(s.index) &&
        !decisions.spells.includes(s.index) &&
        !decisions.cantrips.includes(s.index) &&
        (s.level === 0
          ? (rules.value?.casting?.cantrips ?? 0) > 0
          : s.level <= (rules.value?.casting?.maxSpellLevel ?? 0)) &&
        (!spellList.value.length || spellList.value.includes(s.index)) &&
        `${s.name} ${s.sourcePack ?? ''}`
          .toLowerCase()
          .includes(spellQuery.value.toLowerCase()),
    ))
    .slice(0, 40),
)
const grantQuery = ref(''),
  grantOptions = ref<(SrdRef & { level: number })[]>([]),
  grantDetail = ref<SrdSpell | null>(null),
  grantBusy = ref(false),
  grantError = ref('')
const matchingGrants = computed(() =>
  sortSpellsByLevel(grantOptions.value
    .filter(
      (s) =>
        !base.value.spellcasting.known.includes(s.index) &&
        !decisions.extraSpells.includes(s.index) &&
        !decisions.spells.includes(s.index) &&
        !decisions.cantrips.includes(s.index) &&
        s.name.toLowerCase().includes(grantQuery.value.toLowerCase()),
    ))
    .slice(0, 30),
)
async function loadGrants(event: Event) {
  if (!(event.target as HTMLDetailsElement).open || grantOptions.value.length)
    return
  grantBusy.value = true
  try {
    grantOptions.value = [
      ...((await srd.spells()) as (SrdRef & { level: number })[]),
      ...catalog.value.spells,
    ]
  } catch {
    grantError.value =
      'Spell definitions could not load. Close and reopen this section to retry.'
  } finally {
    grantBusy.value = false
  }
}
async function inspectGrant(s: SrdRef) {
  grantBusy.value = true
  grantError.value = ''
  try {
    grantDetail.value = s.index.startsWith('homebrew-')
      ? await import('../../lib/api').then(({ api }) =>
          api.get<SrdSpell>(
            `/api/characters/${base.value._id}/spell-definition/${encodeURIComponent(s.index)}`,
          ),
        )
      : await srd.spell(s.index)
  } catch {
    grantError.value =
      'This spell has no available rule definition. Choose another definition.'
  } finally {
    grantBusy.value = false
  }
}
function addGrant() {
  if (!grantDetail.value || !rules.value) return
  decisions.extraSpells.push(grantDetail.value.index)
  ;(rules.value.extraSpellOptions ??= []).push(grantDetail.value.index)
  grantDetail.value = null
}
const featureQueries = reactive<Record<string, string>>({})
const featureOptions = (f: AdvancementFeature) =>
  f.options
    ?.filter(
      (o) =>
        (decisions.choices[f.id] ?? []).includes(o.id) ||
        `${o.name} ${o.description}`
          .toLowerCase()
          .includes((featureQueries[f.id] ?? '').toLowerCase()),
    )
    .slice(0, 30)
const newSpellIds = computed(
  () =>
    plan.value?.next.spellcasting.known.filter(
      (id) => !base.value.spellcasting.known.includes(id),
    ) ?? [],
)
const prepareMax = computed(() =>
  plan.value && rules.value
    ? preparedLimit(plan.value.next, rules.value)
    : null,
)
const resources = computed(() => plan.value?.next.resources ?? [])
const changedSlots = computed(() =>
  Object.entries(plan.value?.next.spellcasting.slots ?? {}).filter(
    ([key, s]) => s.max || base.value.spellcasting.slots[key]?.max,
  ),
)
const statChanges = computed(() =>
  plan.value
    ? [
        {
          name: 'Character level',
          before: base.value.meta.level,
          after: plan.value.newLevel,
        },
        {
          name: 'Maximum HP',
          before: base.value.combat.hpMax,
          after: plan.value.next.combat.hpMax,
        },
        {
          name: 'Current HP',
          before: base.value.combat.hpCurrent,
          after: plan.value.next.combat.hpCurrent,
        },
        {
          name: 'Speed',
          before: base.value.combat.speed,
          after: plan.value.next.combat.speed,
        },
        {
          name: 'Hit dice',
          before: base.value.combat.hitDiceTotal,
          after: plan.value.next.combat.hitDiceTotal,
        },
        {
          name: 'Proficiency bonus',
          before: signed(plan.value.proficiency.before),
          after: signed(plan.value.proficiency.after),
        },
        ...ABILITY_KEYS.filter(
          (k) => plan.value!.next.abilities[k] !== base.value.abilities[k],
        ).map((k) => ({
          name: k.toUpperCase(),
          before: base.value.abilities[k],
          after: plan.value!.next.abilities[k],
        })),
      ]
    : [],
)
let generation = 0,
  alive = true
onUnmounted(() => {
  alive = false
  generation++
})
onMounted(async () => {
  emit('dirty', true)
  await initialise()
})
async function initialise() {
  catalogBusy.value = true
  error.value = ''
  store.saveError = ''
  try {
    const options = await advancementCatalog(base.value._id)
    if (!alive) return
    if (!options.character)
      throw new Error(
        'The saved sheet snapshot is unavailable. Reload the latest character.',
      )
    base.value = clone(options.character)
    Object.assign(decisions, newAdvancement(base.value))
    catalog.value = options
    initialised.value = true
    const all = classOptions.value,
      match =
        all.find((c) => c.index === decisions.classIndex) ??
        all.find((c) => ruleName(c.name) === ruleName(decisions.className))
    if (match) decisions.classIndex = match.index
    await loadRules()
  } catch (e) {
    error.value =
      e instanceof Error ? e.message : 'Could not load advancement rules.'
  } finally {
    catalogBusy.value = false
  }
}
async function loadRules() {
  spellCatalogBusy.value = false
  spellDetail.value = null
  grantDetail.value = null
  const run = ++generation
  rulesBusy.value = true
  error.value = ''
  rules.value = null
  try {
    const result = await loadAdvancementRules(
      base.value,
      clone(decisions),
      catalog.value,
    )
    if (alive && run === generation) {
      rules.value = result
      decisions.manualSlots = Object.fromEntries(
        Array.from({ length: 9 }, (_, i) => [
          `l${i + 1}`,
          base.value.spellcasting.slots[`l${i + 1}`]?.max ?? 0,
        ]),
      )
      await loadSpells(result, run)
    }
  } catch (e) {
    if (run === generation)
      error.value = e instanceof Error ? e.message : 'Rules could not load.'
  } finally {
    if (run === generation) rulesBusy.value = false
  }
}
async function chooseClass(event: Event) {
  const c = classOptions.value.find(
    (c) => c.index === (event.target as HTMLSelectElement).value,
  )
  if (!c) return
  const fresh = newAdvancement(base.value)
  Object.assign(decisions, fresh, { className: c.name, classIndex: c.index })
  featIndex.value = ''
  step.value = 0
  await loadRules()
}
async function chooseSubclass(event: Event) {
  const index = (event.target as HTMLSelectElement).value
  decisions.subclassIndex = index
  decisions.subclass =
    rules.value?.subclasses.find((s) => s.index === index)?.name ?? ''
  decisions.choices = {}
  decisions.reviewed = {}
  await loadRules()
}
async function loadSpells(r: AdvancementRules, run: number) {
  spells.value = []
  spellList.value = []
  spellError.value = ''
  if (
    !r.casting ||
    (!r.casting.spells && !r.casting.cantrips && !r.casting.replacements)
  )
    return
  spellCatalogBusy.value = true
  try {
    const [all, list] = await Promise.all([
      srd.spells() as Promise<(SrdRef & { level: number })[]>,
      standardClasses[ruleName(r.name)] && r.source === '2014 SRD'
        ? srd.classSpells(ruleName(r.name))
        : Promise.resolve([]),
    ])
    if (run !== generation) return
    spells.value = [...all, ...catalog.value.spells]
    spellList.value = r.workshop?.magic.spellList.length
      ? r.workshop.magic.spellList
      : list.map((s) => s.index)
    spellList.value = [
      ...new Set([...spellList.value, ...(r.spellListExtras ?? [])]),
    ]
    r.casting!.eligible = spells.value
      .filter(
        (s) =>
          Number.isInteger(s.level) &&
          (!spellList.value.length || spellList.value.includes(s.index)),
      )
      .map((s) => ({ id: s.index, level: s.level }))
  } catch {
    spellError.value =
      'Spell choices could not load. Retry rules before selecting spells.'
  } finally {
    if (run === generation) spellCatalogBusy.value = false
  }
}
async function go(index: number) {
  if (store.saving) return
  step.value = index
  attempted.value = false
  await nextTick()
  heading.value?.focus({ preventScroll: true })
  revealNavigationTarget(heading.value)
}
function next() {
  attempted.value = true
  if (!rules.value || rulesBusy.value || currentIssues.value.length) return
  void go(Math.min(5, step.value + 1))
}
function optionProblem(f: AdvancementFeature, o: AdvancementOption) {
  return rules.value
    ? advancementOptionProblem(base.value, rules.value, decisions, f, o)
    : undefined
}
function optionDisabled(f: AdvancementFeature, o: AdvancementOption) {
  const current = decisions.choices[f.id] ?? []
  return (
    !current.includes(o.id) &&
    (current.length >= (f.choose ?? 0) || !!optionProblem(f, o))
  )
}

function toggleChoice(id: string, value: string) {
  const selected = decisions.choices[id] ?? []
  decisions.choices[id] = selected.includes(value)
    ? selected.filter((v) => v !== value)
    : [...selected, value]
}
const newResourceId = () => crypto.randomUUID()
function selectFeat() {
  const f = catalog.value.feats.find((f) => f.index === featIndex.value)
  decisions.feat = f ? { name: f.name, description: f.description } : undefined
  decisions.featReviewed = false
}
async function inspectSpell(s: SrdRef) {
  spellBusy.value = true
  spellDetail.value = null
  try {
    spellDetail.value = s.index.startsWith('homebrew-')
      ? await import('../../lib/api').then(({ api }) =>
          api.get<SrdSpell>(
            `/api/characters/${base.value._id}/spell-definition/${encodeURIComponent(s.index)}`,
          ),
        )
      : await srd.spell(s.index)
  } catch (e) {
    spellError.value =
      e instanceof Error ? e.message : 'Spell definition unavailable.'
  } finally {
    spellBusy.value = false
  }
}
function addSpell() {
  const s = spellDetail.value
  if (!s) return
  const key = s.level === 0 ? 'cantrips' : 'spells'
  if (
    decisions[key].length >=
    (rules.value?.casting?.[key] ?? 0) +
      (key === 'spells' ? decisions.removedSpells.length : 0)
  )
    return
  decisions[key].push(s.index)
  spellDetail.value = null
}
function removeSpell(id: string) {
  decisions.spells = decisions.spells.filter((s) => s !== id)
  decisions.cantrips = decisions.cantrips.filter((s) => s !== id)
}
const spellName = (id: string) =>
  spells.value.find((s) => s.index === id)?.name ??
  grantOptions.value.find((s) => s.index === id)?.name ??
  pretty(id)
function cancel() {
  if (store.saving) return
  if (
    window.confirm('Discard this level-up draft and return to the saved sheet?')
  ) {
    emit('dirty', false)
    emit('cancel')
  }
}
async function restart() {
  if (
    !window.confirm(
      'Reload the latest sheet and start this level-up again? Your current choices will be cleared.',
    )
  )
    return
  conflict.value = false
  step.value = 0
  await initialise()
}
async function save() {
  if (
    !base.value.updatedAt ||
    !plan.value ||
    plan.value.pending.length ||
    rulesBusy.value ||
    store.saving ||
    conflict.value ||
    saveDone.value
  )
    return
  error.value = ''
  try {
    const next = plan.value.next
    await store.update(
      base.value._id,
      {
        meta: next.meta,
        combat: next.combat,
        abilities: next.abilities,
        features: next.features,
        spellcasting: next.spellcasting,
        resources: next.resources,
        skills: next.skills,
        proficiencies: next.proficiencies,
        saves: next.saves,
        homebrew: next.homebrew,
        personality: next.personality,
      },
      {
        expectedUpdatedAt: base.value.updatedAt,
        expectedLibraryRevision: catalog.value.libraryRevision,
      },
    )
    saveDone.value = true
    emit('dirty', false)
    emit('saved')
  } catch (e) {
    conflict.value = e instanceof ApiError && e.status === 409
    error.value = conflict.value
      ? 'The saved sheet changed during this level-up. Nothing from this draft was applied. Reload the latest sheet and restart so HP, spells, and spent resources stay correct.'
      : e instanceof Error
        ? e.message
        : 'Could not save. Your level-up choices are kept here.'
  }
}
</script>

<template>
  <section
    class="level-up"
    aria-label="Guided level up"
    :aria-busy="store.saving"
  >
    <header class="level-up-heading">
      <div>
        <p class="sheet-small">{{ base.meta.name }} · 2014 rules</p>
        <h2>
          Level {{ base.meta.level }} <span aria-hidden="true">→</span>
          {{ base.meta.level + 1 }}
        </h2>
        <p>Build the next level. Review every change before applying it.</p>
      </div>
      <button
        type="button"
        class="sheet-button"
        :disabled="store.saving"
        @click="cancel"
      >
        Cancel level up
      </button>
    </header>
    <p v-if="catalogBusy || rulesBusy" class="sheet-notice" role="status">
      Loading class progression and available choices…
    </p>
    <div v-if="error" class="sheet-alert" role="alert">
      <p>{{ error }}</p>
      <button
        v-if="conflict"
        type="button"
        class="sheet-button"
        @click="restart"
      >
        Reload latest & restart</button
      ><button
        v-else-if="!rules"
        type="button"
        class="sheet-button"
        @click="initialised ? loadRules() : initialise()"
      >
        Retry rules
      </button>
    </div>
    <div class="level-up-layout">
      <nav class="level-up-steps" aria-label="Level up steps">
        <button
          v-for="(s, i) in steps"
          :key="s.key"
          type="button"
          :aria-current="step === i ? 'step' : undefined"
          :disabled="store.saving"
          @click="go(i)"
        >
          <span class="level-up-step-number">{{ i + 1 }}</span
          ><span
            ><strong>{{ s.name }}</strong
            ><small>{{ s.hint }}</small></span
          ><span
            v-if="plan && i !== step"
            class="level-up-step-state"
            :aria-label="
              plan.issues[s.key].length
                ? `${plan.issues[s.key].length} remaining`
                : 'Ready'
            "
            >{{ plan.issues[s.key].length || '✓' }}</span
          >
        </button>
        <p v-if="rules" class="sheet-small">
          {{ rules.source }}<br />{{ rules.name }} {{ rules.classLevel
          }}<br />{{ plan?.pending.length }} items remaining
        </p>
      </nav>
      <div
        class="level-up-main"
        :inert="store.saving || conflict || catalogBusy || rulesBusy"
      >
        <h3 ref="heading" tabindex="-1" class="level-up-step-title">
          {{ currentStep.name }}
        </h3>
        <template v-if="step === 0">
          <p>
            Gain one level in your current class, or begin another class with
            your DM’s approval. Your total character level increases by one.
          </p>
          <div class="level-up-fields">
            <label
              >Class gaining this level<select
                :value="decisions.classIndex"
                :disabled="catalogBusy || rulesBusy || store.saving"
                @change="chooseClass"
              >
                <option
                  v-for="c in classOptions"
                  :key="c.index"
                  :value="c.index"
                >
                  {{ c.name
                  }}{{ c.index.startsWith('homebrew-') ? ' · imported' : '' }}
                </option>
              </select></label
            >
            <div v-if="rules" class="level-up-result">
              <small>Class level</small
              ><strong
                >{{ rules.name }} {{ rules.classLevel - 1 }} →
                {{ rules.classLevel }}</strong
              >
            </div>
          </div>
          <p v-if="rules" class="sheet-small">
            {{ rules.source }} · d{{ rules.hitDie }} Hit Die
          </p>
          <label
            v-if="base.meta.xp < (levelUpXP[base.meta.level] ?? Infinity)"
            class="level-up-check"
            ><input v-model="decisions.milestone" type="checkbox" />My DM
            awarded this level through milestone advancement.
            <small
              >{{ base.meta.xp.toLocaleString() }} XP saved;
              {{ (levelUpXP[base.meta.level] ?? 0).toLocaleString() }} required
              for XP advancement. XP stays unchanged.</small
            ></label
          >
          <label v-if="needsSubclass"
            >Choose a subclass<select
              :value="decisions.subclassIndex"
              :disabled="rulesBusy"
              @change="chooseSubclass"
            >
              <option value="">Choose your subclass…</option>
              <option
                v-for="s in rules?.subclasses"
                :key="s.index"
                :value="s.index"
              >
                {{ s.name }}
              </option>
            </select></label
          >
          <p
            v-if="needsSubclass && !rules?.subclasses.length"
            class="sheet-notice"
          >
            No subclass definition is available. Import or publish its rules in
            the Workshop before completing this level.
          </p>
          <div v-if="classIsNew" class="sheet-notice">
            <p>
              Multiclassing grants limited training. No starting equipment or
              saving throws are added.
            </p>
            <p v-if="rules?.grants">
              Granted:
              {{ Object.values(rules.grants).flat().join(', ') || 'None' }}.
              Complete any proficiency choices under Features & choices.
            </p>
          </div>
          <ul v-if="rules?.blocked?.length" class="sheet-alert">
            <li v-for="message in rules.blocked" :key="message">
              {{ message }}
            </li>
          </ul>
          <div v-if="rules" class="level-up-earned">
            <h4>At this level</h4>
            <ul>
              <li>One d{{ rules.hitDie }} Hit Die and an HP increase</li>
              <li v-if="rules.asi">
                An ability score improvement or an optional feat
              </li>
              <li v-for="f in rules.features" :key="f.id">
                {{ f.name }}{{ f.choose ? ` · choose ${f.choose}` : '' }}
              </li>
              <li v-if="rules.casting">
                {{ rules.casting.cantrips }} new cantrips ·
                {{ rules.casting.spells }} new levelled spells · spell slots
                reviewed
              </li>
              <li>
                Proficiency bonus {{ signed(plan?.proficiency.before ?? 0) }} →
                {{ signed(plan?.proficiency.after ?? 0) }}
              </li>
            </ul>
          </div>
        </template>
        <template v-else-if="step === 1 && rules && plan">
          <p>
            Add this class’s Hit Die result and your Constitution modifier.
            Constitution improvements apply to earlier character levels too.
          </p>
          <fieldset class="level-up-radio">
            <legend>HP method</legend>
            <label
              ><input
                v-model="decisions.hpMode"
                type="radio"
                value="average"
              />Fixed average ({{ Math.floor(rules.hitDie / 2) + 1 }})</label
            ><label
              ><input
                v-model="decisions.hpMode"
                type="radio"
                value="rolled"
              />Enter a d{{ rules.hitDie }} roll</label
            >
          </fieldset>
          <label v-if="decisions.hpMode === 'rolled'"
            >Rolled result, before modifiers<input
              v-model.number="decisions.hpRoll"
              type="number"
              min="1"
              :max="rules.hitDie"
          /></label>
          <dl class="level-up-math">
            <div>
              <dt>
                This level, with CON
                {{ signed(abilityMod(plan.next.abilities.con)) }}
              </dt>
              <dd>{{ signed(plan.hpGain) }}</dd>
            </div>
            <div v-if="plan.retro">
              <dt>Earlier levels · CON / new Tough feat</dt>
              <dd>{{ signed(plan.retro) }}</dd>
            </div>
            <div>
              <dt>Maximum HP</dt>
              <dd>{{ base.combat.hpMax }} → {{ plan.next.combat.hpMax }}</dd>
            </div>
            <div>
              <dt>Hit dice total · spent preserved</dt>
              <dd>
                {{ base.combat.hitDiceTotal }} →
                {{ plan.next.combat.hitDiceTotal }} ({{
                  base.combat.hitDiceUsed
                }}
                spent)
              </dd>
            </div>
          </dl>
          <label
            >Current HP after levelling<select v-model="decisions.hpCurrent">
              <option value="keep">
                Keep current HP ({{ base.combat.hpCurrent }})
              </option>
              <option value="increase">
                Increase current HP by the maximum-HP gain
              </option>
            </select></label
          >
          <p class="sheet-small">
            Levelling is not a rest. Temporary HP, death saves, spent Hit Dice,
            and an unconscious character’s current HP are preserved.
          </p>
          <details>
            <summary>Other HP granted by a feature</summary>
            <label
              >Additional HP for this level<input
                v-model.number="decisions.hpExtra"
                type="number"
                min="0"
                max="100"
            /></label>
            <p class="sheet-small">
              Tough and Dwarven Toughness are recognised by name. Do not enter
              those bonuses again. Explain other grants in the review notes.
            </p>
          </details>
        </template>
        <template v-else-if="step === 2 && rules">
          <template v-if="rules.asi"
            ><p>
              {{ rules.name }} level {{ rules.classLevel }} grants one
              advancement. Improve abilities or take a feat if your DM allows
              it.
            </p>
            <fieldset class="level-up-radio">
              <legend>Your advancement</legend>
              <label
                ><input
                  v-model="decisions.asi"
                  type="radio"
                  value="abilities"
                  @change="
                    decisions.increases = {
                      str: 0,
                      dex: 0,
                      con: 0,
                      int: 0,
                      wis: 0,
                      cha: 0,
                    }
                  "
                />Ability score improvement</label
              ><label
                ><input
                  v-model="decisions.asi"
                  type="radio"
                  value="feat"
                  @change="
                    decisions.increases = {
                      str: 0,
                      dex: 0,
                      con: 0,
                      int: 0,
                      wis: 0,
                      cha: 0,
                    }
                  "
                />Feat</label
              >
            </fieldset>
            <template v-if="decisions.asi === 'feat'"
              ><label
                >Find a feat<input
                  ref="featSearchInput"
                  v-model="featQuery"
                  type="search"
                  placeholder="Search available feats…" /></label
              >
              <div class="level-up-fields">
                <label>Effect
                  <select v-model="featEffect" aria-label="Effect" aria-describedby="feat-filter-help">
                    <option value="">All effects</option>
                    <option v-for="effect in featEffects" :key="effect.id" :value="effect.id">{{ effect.name }}</option>
                  </select>
                </label>
                <label v-if="featSources.length > 1">Source
                  <select v-model="featSource" aria-label="Source">
                    <option value="">All sources</option>
                    <option v-for="source in featSources" :key="source" :value="source">{{ source }}</option>
                  </select>
                </label>
              </div>
              <p id="feat-filter-help" class="sheet-small">Effect filters use available rules and descriptions. Review the feat’s full rules and prerequisites.</p>
              <div class="level-up-filter-status">
                <span role="status">{{ availableFeats.length }} of {{ catalog.feats.length }} feats<span v-if="featEffect"> · {{ featEffects.find(e => e.id === featEffect)?.name }}</span><span v-if="featSource"> · {{ featSource }}</span></span>
                <button v-if="featQuery || featEffect || featSource" type="button" class="sheet-button" @click="resetFeatFilters">Clear filters</button>
              </div>
              <p v-if="catalog.feats.length && !availableFeats.length" class="sheet-notice">No feats match. Clear filters or try another search.</p>
              <label
                >Available feats<select
                  v-model="featIndex"
                  @change="selectFeat"
                >
                  <option value="">Choose an imported feat…</option>
                  <option v-if="selectedFeat && !availableFeats.some(f => f.index === featIndex)" :value="selectedFeat.index">{{ selectedFeat.name }} (selected; outside filters)</option>
                  <option
                    v-for="f in availableFeats"
                    :key="f.index"
                    :value="f.index"
                  >
                    {{ f.name }}
                  </option>
                </select></label
              >
              <p v-if="!catalog.feats.length" class="sheet-small">
                No imported feats are available. Enter a DM-approved feat below.
              </p>
              <button
                v-if="!decisions.feat"
                type="button"
                class="sheet-button"
                @click="decisions.feat = { name: '', description: '' }"
              >
                Enter another feat</button
              ><template v-if="decisions.feat"
                ><label>Feat name<input v-model="decisions.feat.name" /></label
                ><label
                  >Feat rules & prerequisites<textarea
                    v-model="decisions.feat.description"
                    rows="6"
                  /></label
                ><label class="level-up-check"
                  ><input v-model="decisions.featReviewed" type="checkbox" />I
                  meet its prerequisites and have recorded its mechanical
                  choices.
                  <small
                    >Use ability bonuses below; add granted skills, features,
                    spells, or trackers in the following steps. Rule text is
                    retained on the sheet.</small
                  ></label
                ></template
              ></template
            >
            <div v-if="decisions.asi" class="level-up-abilities">
              <label v-for="a in ABILITY_KEYS" :key="a"
                >{{ a.toUpperCase()
                }}<small
                  >{{ base.abilities[a] }} →
                  {{ plan?.next.abilities[a] }}</small
                ><input
                  v-model.number="decisions.increases[a]"
                  type="number"
                  min="0"
                  max="2"
                  :aria-label="`${a.toUpperCase()} increase`"
              /></label>
            </div>
            <p v-if="decisions.asi === 'abilities'" class="sheet-small">
              {{
                Object.values(decisions.increases).reduce((a, b) => a + b, 0)
              }}
              / 2 points allocated. Maximum score 20.
            </p>
            <p v-else-if="decisions.asi === 'feat'" class="sheet-small">
              Enter only bonuses explicitly granted by this feat. These are not
              two free ability points.
            </p>
          </template>
          <p v-else>
            No ability score improvement is granted at {{ rules.name }} level
            {{ rules.classLevel }}. Existing scores and feats stay unchanged.
          </p>
        </template>
        <template v-else-if="step === 3 && rules">
          <p>
            Read this level’s rules and complete each required choice. Newly
            gained features and your selections are saved with the character.
          </p>
          <p v-if="!rules.features.length" class="sheet-notice">
            No new named class features at this level. Existing features,
            resources, or spellcasting may still improve.
          </p>
          <article
            v-for="f in rules.features"
            :key="f.id"
            class="level-up-feature"
          >
            <h4>
              {{ f.name }} <small>{{ f.origin }} · level {{ f.level }}</small>
            </h4>
            <details>
              <summary>Read the rule</summary>
              <p class="level-up-rule-text">{{ f.description }}</p>
            </details>
            <fieldset v-if="f.choose">
              <legend>
                Choose {{ f.choose }} ·
                {{ decisions.choices[f.id]?.length ?? 0 }} selected
              </legend>
              <label v-if="(f.options?.length ?? 0) > 8"
                >Find an option<input
                  v-model="featureQueries[f.id]"
                  type="search"
                  :placeholder="`Search ${f.name} options...`"
              /></label>
              <p v-if="(f.options?.length ?? 0) > 30" class="sheet-small">
                Search to narrow the options. Selected choices stay visible.
              </p>
              <div
                v-for="o in featureOptions(f)"
                :key="o.id"
                class="level-up-option"
              >
                <label class="level-up-check"
                  ><input
                    type="checkbox"
                    :checked="decisions.choices[f.id]?.includes(o.id)"
                    :disabled="!!optionDisabled(f, o)"
                    @change="toggleChoice(f.id, o.id)"
                  /><span
                    >{{ o.name
                    }}<small v-if="optionProblem(f, o)">{{
                      optionProblem(f, o)
                    }}</small
                    ><small v-if="o.prerequisites?.length"
                      >Prerequisites: {{ o.prerequisites.join('; ') }}</small
                    ></span
                  ></label
                >
                <details v-if="o.description">
                  <summary>Read {{ o.name }} rules</summary>
                  <p class="level-up-rule-text">{{ o.description }}</p>
                </details>
              </div>
            </fieldset>
            <label class="level-up-check"
              ><input
                v-model="decisions.reviewed[f.id]"
                type="checkbox"
              />Reviewed {{ f.name }} and its effects on the sheet.</label
            >
          </article>
          <div v-if="rules.scaling?.length">
            <h4>Features that improve</h4>
            <dl class="level-up-math">
              <div v-for="change in rules.scaling" :key="change.name">
                <dt>{{ pretty(change.name) }}</dt>
                <dd>{{ change.before }} &rarr; {{ change.after }}</dd>
              </div>
            </dl>
            <p class="sheet-small">
              Use these new values with the feature rules on your sheet.
            </p>
          </div>
          <div v-if="rules.existingReviews?.length">
            <h4>Existing rules with level-based effects</h4>
            <p>
              Check racial unlocks, feat scaling, and other saved rules. Record
              any new grants below; these descriptions are kept on your sheet.
            </p>
            <article
              v-for="review in rules.existingReviews"
              :key="review.id"
              class="level-up-feature"
            >
              <h4>{{ review.name }}</h4>
              <details>
                <summary>Read the existing rule</summary>
                <p class="level-up-rule-text">{{ review.description }}</p>
              </details>
              <label class="level-up-check"
                ><input
                  v-model="decisions.reviewed[review.id]"
                  type="checkbox"
                />Checked {{ review.name }} at character level
                {{ base.meta.level + 1 }}.</label
              >
            </article>
          </div>
          <aside v-if="rules.warnings.length" class="level-up-coverage">
            <h4>Rules to check</h4>
            <ul>
              <li v-for="w in rules.warnings" :key="w">{{ w }}</li>
            </ul>
            <label class="level-up-check"
              ><input
                v-model="decisions.reviewed['source-warnings']"
                type="checkbox"
              />I checked these notes and recorded any missing grants
              below.</label
            >
          </aside>
          <details class="level-up-extra">
            <summary>Additional grants, training & trackers</summary>
            <p>
              Use these for racial unlocks, feat effects, multiclass training,
              or rules described only in text.
            </p>
            <label
              >Movement speed granted by a feature (feet)<input
                v-model.number="decisions.speed"
                type="number"
                min="0"
                max="1000"
                :placeholder="`Keep current speed (${base.combat.speed})`"
                @change="
                  decisions.speed =
                    decisions.speed === null || String(decisions.speed) === ''
                      ? null
                      : decisions.speed
                "
            /></label>
            <div class="level-up-fields">
              <label
                v-for="group in [
                  'armor',
                  'weapons',
                  'tools',
                  'languages',
                ] as const"
                :key="group"
                >New {{ group }} proficiencies<input
                  :value="decisions.grants[group].join(', ')"
                  placeholder="Comma-separated grants"
                  @change="
                    decisions.grants[group] = (
                      $event.target as HTMLInputElement
                    ).value
                      .split(',')
                      .map((v) => v.trim())
                      .filter(Boolean)
                  "
              /></label>
            </div>
            <fieldset class="level-up-skill-grid">
              <legend>Granted saving throw proficiency</legend>
              <label
                v-for="key in ABILITY_KEYS"
                :key="key"
                class="level-up-check"
                ><input
                  v-model="decisions.saveGrants"
                  :value="key"
                  type="checkbox"
                  :disabled="base.saves[key]"
                />{{ key.toUpperCase() }}</label
              >
            </fieldset>
            <fieldset class="level-up-skill-grid">
              <legend>New skill proficiencies</legend>
              <label
                v-for="(_, key) in SKILL_ABILITY"
                :key="key"
                class="level-up-check"
                ><input
                  v-model="decisions.skills[key]"
                  type="checkbox"
                  :disabled="
                    base.skills[key] === 'prof' || base.skills[key] === 'expert'
                  "
                />{{ pretty(key) }}</label
              >
            </fieldset>
            <article v-for="(f, i) in decisions.customFeatures" :key="i">
              <label>Granted feature name<input v-model="f.name" /></label
              ><label
                >Rule text & mechanical choices<textarea
                  v-model="f.description"
                  rows="3"
                /></label
              ><button
                type="button"
                class="sheet-button"
                @click="decisions.customFeatures.splice(i, 1)"
              >
                Remove feature
              </button>
            </article>
            <button
              type="button"
              class="sheet-button"
              @click="
                decisions.customFeatures.push({ name: '', description: '' })
              "
            >
              Add granted feature
            </button>
            <article
              v-for="(r, i) in decisions.customResources"
              :key="r.id"
              class="level-up-fields"
            >
              <label>Tracker name<input v-model="r.name" /></label
              ><label
                >Maximum uses<input
                  v-model.number="r.max"
                  type="number"
                  min="0"
                  max="999" /></label
              ><label
                >Recovery<select v-model="r.recovery">
                  <option value="short">Short rest</option>
                  <option value="long">Long rest</option>
                  <option value="manual">Manual</option>
                </select></label
              ><button
                type="button"
                class="sheet-button"
                @click="decisions.customResources.splice(i, 1)"
              >
                Remove tracker
              </button>
            </article>
            <button
              type="button"
              class="sheet-button"
              @click="
                decisions.customResources.push({
                  id: newResourceId(),
                  name: '',
                  max: 1,
                  recovery: 'long',
                })
              "
            >
              Add resource tracker
            </button>
          </details>
        </template>
        <template v-else-if="step === 4 && rules && plan">
          <template v-if="rules.casting"
            ><p>
              {{
                rules.casting.learning === 'book'
                  ? 'Add new spells to your spellbook.'
                  : rules.casting.learning === 'prepared'
                    ? 'Your class prepares spells; no new spells-known choices are required.'
                    : 'Choose spells learned at this class level.'
              }}
              Choices use {{ rules.name }} level {{ rules.classLevel }}, even
              with higher multiclass slots.
            </p>
            <p class="level-up-selection-count">
              Cantrips {{ decisions.cantrips.length }} /
              {{ rules.casting.cantrips }} · New spells
              {{ decisions.spells.length }} /
              {{ rules.casting.spells + decisions.removedSpells.length }}
            </p>
            <p v-if="prepareMax !== null" class="sheet-small">
              Prepared-spell allowance: {{ prepareMax }} (new class level and
              casting ability). Preparation stays unchanged; change it after the
              required rest.
            </p>
            <p v-if="spellCatalogBusy" role="status">
              Loading available spells…
            </p>
            <div v-if="spellError" class="sheet-alert" role="alert">
              <p>{{ spellError }}</p>
              <button type="button" class="sheet-button" @click="loadRules">
                Retry spell choices
              </button>
            </div>
            <div
              v-if="rules.casting.spells || rules.casting.cantrips"
              class="level-up-spell-picker"
            >
              <label
                >Find a spell<input
                  v-model="spellQuery"
                  type="search"
                  placeholder="Search this class’s spell list…"
              /></label>
              <div class="level-up-spell-list">
                <button
                  v-for="s in availableSpells"
                  :key="s.index"
                  type="button"
                  :disabled="spellBusy"
                  @click="inspectSpell(s)"
                >
                  <strong>{{ s.name }}</strong
                  ><small>{{
                    s.level === 0 ? 'Cantrip' : `Level ${s.level}`
                  }}</small>
                </button>
              </div>
              <p
                v-if="!availableSpells.length && !spellCatalogBusy"
                class="sheet-small"
              >
                No matching eligible spells.
              </p>
              <p v-if="spellBusy" role="status">Loading spell rules…</p>
              <article v-if="spellDetail" class="level-up-feature">
                <h4>{{ spellDetail.name }}</h4>
                <p class="sheet-small">
                  {{ spellDetail.casting_time }} · {{ spellDetail.range }} ·
                  {{ spellDetail.duration }}
                </p>
                <p
                  v-for="line in spellDetail.desc"
                  :key="line"
                  class="level-up-rule-text"
                >
                  {{ line }}
                </p>
                <button
                  type="button"
                  class="sheet-button"
                  :disabled="
                    spellDetail.level === 0
                      ? decisions.cantrips.length >= rules.casting.cantrips
                      : decisions.spells.length >=
                        rules.casting.spells + decisions.removedSpells.length
                  "
                  @click="addSpell"
                >
                  Learn {{ spellDetail.name }}
                </button>
              </article>
            </div>
            <ul
              v-if="decisions.spells.length || decisions.cantrips.length"
              class="level-up-chosen"
            >
              <li
                v-for="id in [...decisions.cantrips, ...decisions.spells]"
                :key="id"
              >
                {{ spellName(id)
                }}<button
                  type="button"
                  class="sheet-button"
                  :aria-label="`Remove ${spellName(id)}`"
                  @click="removeSpell(id)"
                >
                  Remove
                </button>
              </li>
            </ul>
            <label class="level-up-check"
              ><input
                v-model="decisions.magicReviewed"
                type="checkbox"
              />Reviewed spell learning and preparation. No rest or slot
              recovery is included.</label
            >
          </template>
          <p v-else>
            This class level does not grant standard spellcasting. Existing
            spells remain on the sheet.
          </p>
          <details
            v-if="rules.casting?.replacements && spells.length"
            class="level-up-extra"
          >
            <summary>Optional: replace one known spell</summary>
            <p>
              Replace a levelled spell learned from this class. A multiclass
              character must confirm the original class; the saved sheet has one
              shared spell list.
            </p>
            <label
              >Spell to replace<select
                :value="decisions.removedSpells[0] ?? ''"
                @change="
                  decisions.removedSpells = ($event.target as HTMLSelectElement)
                    .value
                    ? [($event.target as HTMLSelectElement).value]
                    : []
                "
              >
                <option value="">Keep all existing spells</option>
                <option
                  v-for="id in base.spellcasting.known.filter((id) =>
                    rules!.casting?.eligible?.some(
                      (s) => s.id === id && s.level > 0,
                    ),
                  )"
                  :key="id"
                  :value="id"
                >
                  {{ spellName(id) }}
                </option>
              </select></label
            >
            <p v-if="decisions.removedSpells.length">
              Choose one additional replacement spell above. The removed spell
              will also be removed from prepared spells.
            </p>
          </details>
          <details class="level-up-extra" @toggle="loadGrants">
            <summary>Spells granted by another feature or feat</summary>
            <p>
              Choose only spells explicitly granted by the reviewed rule. Record
              their source and casting limits in the review notes; these do not
              use the class learning allowance.
            </p>
            <label
              >Find a granted spell<input
                v-model="grantQuery"
                type="search"
                placeholder="Search all spell definitions..."
            /></label>
            <p v-if="grantBusy" role="status">Loading spell definitions...</p>
            <p v-if="grantError" class="sheet-alert" role="alert">
              {{ grantError }}
            </p>
            <div v-if="grantQuery" class="level-up-spell-list">
              <button
                v-for="s in matchingGrants"
                :key="s.index"
                type="button"
                :disabled="grantBusy"
                @click="inspectGrant(s)"
              >
                <strong>{{ s.name }}</strong
                ><small>{{
                  s.level === 0 ? 'Cantrip' : `Level ${s.level}`
                }}</small>
              </button>
            </div>
            <article v-if="grantDetail" class="level-up-feature">
              <h4>{{ grantDetail.name }}</h4>
              <p
                v-for="line in grantDetail.desc"
                :key="line"
                class="level-up-rule-text"
              >
                {{ line }}
              </p>
              <button type="button" class="sheet-button" @click="addGrant">
                Add granted spell
              </button>
            </article>
            <ul class="level-up-chosen">
              <li v-for="id in decisions.extraSpells" :key="id">
                {{ spellName(id)
                }}<button
                  type="button"
                  class="sheet-button"
                  :aria-label="`Remove granted ${spellName(id)}`"
                  @click="
                    decisions.extraSpells = decisions.extraSpells.filter(
                      (s) => s !== id,
                    )
                  "
                >
                  Remove
                </button>
              </li>
            </ul>
          </details>
          <h4>Spell slots</h4>
          <div v-if="plan.slotMode === 'manual'">
            <p class="sheet-notice">
              Custom multiclass spellcasting requires a manual slot review.
              Separate Pact Magic and Spellcasting pools cannot be merged by
              this wizard.
            </p>
            <div class="level-up-abilities">
              <label v-for="i in 9" :key="i"
                >Level {{ i
                }}<input
                  v-model.number="decisions.manualSlots[`l${i}`]"
                  type="number"
                  min="0"
                  max="99"
              /></label>
            </div>
            <label class="level-up-check"
              ><input v-model="decisions.slotsReviewed" type="checkbox" />These
              totals correctly represent my table’s casting rules.</label
            >
          </div>
          <dl v-else class="level-up-math">
            <div v-for="[key, s] in changedSlots" :key="key">
              <dt>Level {{ key.slice(1) }} · {{ s.recovery }} rest</dt>
              <dd>
                {{ base.spellcasting.slots[key]?.max ?? 0 }} → {{ s.max }}
                <small>({{ s.used }} spent)</small>
              </dd>
            </div>
          </dl>
          <p v-if="!changedSlots.length" class="sheet-small">No spell slots.</p>
          <h4>Resources after levelling</h4>
          <dl class="level-up-math">
            <div v-for="r in resources" :key="r.id">
              <dt>
                {{ r.name }} <small>{{ r.recovery }} recovery</small>
              </dt>
              <dd>
                {{ base.resources?.find((v) => v.id === r.id)?.max ?? 'New' }} →
                {{ r.unlimited ? 'Unlimited' : r.max }}
                <small>({{ r.used }} spent)</small>
              </dd>
            </div>
          </dl>
          <p v-if="!resources.length" class="sheet-small">
            No tracked class resources.
          </p>
        </template>
        <template v-else-if="step === 5 && plan && rules"
          ><p>
            Apply {{ rules.name }} level {{ rules.classLevel }} to
            {{ base.meta.name }}. Nothing is saved until you choose Apply level
            up.
          </p>
          <dl class="level-up-math level-up-ledger">
            <div v-for="row in statChanges" :key="row.name">
              <dt>{{ row.name }}</dt>
              <dd>
                {{ row.before }} → <strong>{{ row.after }}</strong>
              </dd>
            </div>
          </dl>
          <h4
            v-if="
              rules.asi ||
              rules.features.length ||
              decisions.customFeatures.length
            "
          >
            Features & choices
          </h4>
          <ul
            v-if="
              rules.asi ||
              rules.features.length ||
              decisions.customFeatures.length
            "
          >
            <li v-if="rules.asi">
              {{
                decisions.asi === 'feat'
                  ? decisions.feat?.name
                  : 'Ability score improvement'
              }}
            </li>
            <li v-for="f in rules.features" :key="f.id">
              {{ f.name
              }}<small v-if="decisions.choices[f.id]?.length">
                —
                {{
                  decisions.choices[f.id]
                    ?.map(
                      (id) => f.options?.find((o) => o.id === id)?.name ?? id,
                    )
                    .join(', ')
                }}</small
              >
            </li>
            <li v-for="f in decisions.customFeatures" :key="f.name">
              {{ f.name }}
            </li>
          </ul>
          <h4 v-if="newSpellIds.length">New spells</h4>
          <p>
            {{ newSpellIds.map(spellName).join(', ') }}
          </p>
          <p v-if="decisions.removedSpells.length">
            Replaced: {{ decisions.removedSpells.map(spellName).join(', ') }}
          </p>
          <h4
            v-if="
              Object.values(decisions.skills).some(Boolean) ||
              decisions.saveGrants.length ||
              Object.values(decisions.grants).flat().length ||
              rules.grants
            "
          >
            Training granted
          </h4>
          <p>
            {{
              [
                ...Object.keys(decisions.skills)
                  .filter((k) => decisions.skills[k])
                  .map(pretty),
                ...decisions.saveGrants.map((k) => `${k.toUpperCase()} saves`),
                ...Object.values(decisions.grants).flat(),
                ...Object.values(rules.grants ?? {}).flat(),
              ].join(', ')
            }}
          </p>
          <p class="sheet-small">
            {{ changedSlots.length }} spell-slot pools and
            {{ resources.length }} resource trackers reviewed. Inventory, XP,
            temporary HP, spent uses, and existing choices are retained.
          </p>
          <label
            >Advancement notes<textarea
              v-model="decisions.notes"
              rows="3"
              placeholder="Record table rulings or explain additional grants…"
            />
          </label>
          <div v-if="plan.pending.length" class="sheet-alert">
            <h4>Before applying</h4>
            <ul>
              <li
                v-for="s in steps.filter((s) => plan!.issues[s.key].length)"
                :key="s.key"
              >
                <button
                  type="button"
                  class="level-up-fix"
                  @click="go(steps.indexOf(s))"
                >
                  {{ s.name }}</button
                >: {{ plan.issues[s.key].join(' ') }}
              </li>
            </ul>
          </div>
          <p v-else class="sheet-notice" role="status">
            All required choices are complete. Ready to apply one level.
          </p></template
        >
        <ul
          v-if="attempted && currentIssues.length"
          class="sheet-alert"
          role="alert"
        >
          <li v-for="message in currentIssues" :key="message">{{ message }}</li>
        </ul>
        <footer class="level-up-actions">
          <span>Step {{ step + 1 }} of {{ steps.length }}</span
          ><button
            v-if="step"
            type="button"
            class="sheet-button"
            :disabled="store.saving"
            @click="go(step - 1)"
          >
            Back</button
          ><button
            v-if="step < 5"
            type="button"
            class="sheet-button sheet-button-primary"
            :disabled="
              catalogBusy || rulesBusy || !rules || conflict || store.saving
            "
            @click="next"
          >
            Continue</button
          ><button
            v-else
            type="button"
            class="sheet-button sheet-button-primary"
            :disabled="
              !plan ||
              !!plan.pending.length ||
              rulesBusy ||
              store.saving ||
              conflict ||
              saveDone
            "
            @click="save"
          >
            {{ store.saving ? 'Applying level…' : 'Apply level up' }}
          </button>
        </footer>
      </div>
    </div>
  </section>
</template>
