import { workshopSlots } from '../../shared/homebrew-workshop'
import { classSpellDefaults } from '../../shared/class-rules'
import { slotMaximums } from '../../shared/character-progression'
import { spellSelectionPolicy, spellSelectionCounts, spellSelectionProblems } from '../lib/spell-selection'
import { featOpportunities, selectedFeatIndexes } from '../lib/advancements'
import { equipmentFrom } from '../lib/character-sheet'
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useAuthStore } from '../stores/auth'
import { loadCreationOptions } from '../lib/creation-options-cache'
import { ABILITY_KEYS, SKILL_ABILITY, abilityMod, maxHP, profBonus, type AbilityKey } from '../lib/calc'
import {
  abilityTotals, armorClass, builderIssues, composeCharacter, newBuilderDraft, restoreBuilderDraft, skillKey,
  type BuilderBackground, type BuilderContext, type BuilderTrait,
} from '../lib/character-builder'
import {
  contentLabel, srd, type HomebrewBackground, type HomebrewClass, type HomebrewFeat,
  type HomebrewRace, type HomebrewSpell, type HomebrewSubclass, type HomebrewSubrace,
  type SrdBackground, type SrdClass, type SrdEquipment, type SrdLevel, type SrdRace, type SrdRef, type SrdSpell, type SrdSubrace,
} from '../lib/srd'

type Race = SrdRace & { homebrew_traits?: BuilderTrait[]; details?: Record<string, unknown> }
type Subrace = SrdSubrace & { homebrew_traits?: BuilderTrait[]; speed?: number; details?: Record<string, unknown> }
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
const enabledKeys = (value: unknown) => Object.entries(object(value)).filter(([, enabled]) => enabled === true).map(([key]) => key.replace(/^:/, '').replace(/^.*\//, ''))
const pretty = (name: string) => name.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())

export function useCharacterBuilder() {
  const draft = reactive(newBuilderDraft())
  const ready = ref(false)
  const libraryLoading = ref(false)
  const warnings = ref<string[]>([])
  const detailError = ref('')
  const raceLoading = ref(false), classLoading = ref(false), featureLoading = ref(false), subraceLoading = ref(false), subclassLoading = ref(false), backgroundLoading = ref(false)
  const race = ref<Race | null>(null), klass = ref<(SrdClass & { homebrew_traits?: BuilderTrait[] }) | null>(null)
  const subrace = ref<Subrace | null>(null), subclass = ref<SrdRef | null>(null)
  const background = ref<BuilderBackground | null>(null)
  const races = ref<SrdRef[]>([]), classes = ref<SrdRef[]>([]), backgrounds = ref<SrdRef[]>([]), equipment = ref<SrdRef[]>([]), languages = ref<SrdRef[]>([])
  const customClasses = ref<HomebrewClass[]>([]), customRaces = ref<HomebrewRace[]>([]), customBackgrounds = ref<HomebrewBackground[]>([])
  const customSubraces = ref<HomebrewSubrace[]>([]), customSubclasses = ref<HomebrewSubclass[]>([]), feats = ref<HomebrewFeat[]>([]), customSpells = ref<HomebrewSpell[]>([])
  const raceTraits = ref<BuilderTrait[]>([]), subraceTraits = ref<BuilderTrait[]>([]), classTraits = ref<BuilderTrait[]>([]), subclassTraits = ref<BuilderTrait[]>([])
  const racialProficiencies = ref<SrdRef[]>([]), subracialProficiencies = ref<SrdRef[]>([])
  const levels = ref<SrdLevel[]>([])
  const classSpellIndexes = ref<string[]>([])
  const spellQuery = ref(''), spellLevel = ref('all'), classSpellsOnly = ref(true), spellResults = ref<SrdRef[]>([])
  const spellLoading = ref(false), spellError = ref(''), spellDetail = ref<SrdSpell | null>(null), spellDetailLoading = ref(false)
  const inventoryBusy = ref(false)
  const saved = ref(false), restored = ref(false), storageError = ref('')
  const key = `codex:character-builder:v1:${useAuthStore().user?.id ?? 'local'}`
  const cache = new Map<string, Promise<unknown>>()
  let disposed = false, finished = false
  let raceSequence = 0, classSequence = 0, subraceSequence = 0, subclassSequence = 0, backgroundSequence = 0, featureSequence = 0, spellSequence = 0, spellDetailSequence = 0
  let saveTimer: ReturnType<typeof setTimeout> | undefined, spellTimer: ReturnType<typeof setTimeout> | undefined
  function cached<T>(id: string, load: () => Promise<T>): Promise<T> {
    if (!cache.has(id)) cache.set(id, load().catch((error) => { cache.delete(id); throw error }))
    return cache.get(id) as Promise<T>
  }
  const loadingDetails = computed(() => raceLoading.value || classLoading.value || featureLoading.value || subraceLoading.value || subclassLoading.value || backgroundLoading.value)
  const subclassOptions = computed(() => {
    const parent = (klass.value?.contentKey ?? draft.klass).replace(/^.*\//, '')
    return [...(klass.value?.subclasses ?? []), ...customSubclasses.value.filter((entry) => entry.class === parent||entry.workshop?.parentClass===draft.klass)]
  })
  const subraceOptions = computed(() => {
    const parent = (race.value?.contentKey ?? draft.race).replace(/^.*\//, '')
    return [...(race.value?.subraces ?? []), ...customSubraces.value.filter((entry) => entry.race.replace(/^.*\//, '') === parent)]
  })
  const classLevel = computed(() => levels.value.find((entry) => entry.level === draft.level))
  const skillChoice = computed(() => {
    if(klass.value?.workshop)return {choose:klass.value.workshop.skillCount,options:klass.value.workshop.skillOptions}
    const choice = klass.value?.proficiency_choices?.find((entry) => entry.from.options?.some((option) => option.item?.index.startsWith('skill-')))
    if (choice) return { choose: choice.choose, options: choice.from.options!.flatMap((option) => option.item?.index.startsWith('skill-') ? [skillKey(option.item.index)] : []) }
    const raw = object(object(klass.value?.details?.[':profs'])[':skill-options'])
    return { choose: Number(raw[':choose'] ?? 0), options: enabledKeys(raw[':options']).map(skillKey) }
  })
  const fixedSkills = computed(() => {
    const result = [...(background.value?.skills ?? []), ...[...racialProficiencies.value, ...subracialProficiencies.value].filter((entry) => entry.index.startsWith('skill-')).map((entry) => skillKey(entry.index))]
    for (const entry of [race.value, subrace.value, klass.value]) {
      const props = object(entry?.details?.[':props']), profs = object(entry?.details?.[':profs'])
      result.push(...enabledKeys(props[':skill-prof']).map(skillKey), ...enabledKeys(profs[':skill']).map(skillKey))
    }
    return [...new Set(result)].filter((key) => key in SKILL_ABILITY)
  })
  const context = computed<BuilderContext>(() => {
    const proficiencies: BuilderContext['proficiencies'] = { armor: [], weapons: [], tools: [], languages: [...(race.value?.languages ?? []).map((entry) => entry.name)] }
    for (const proficiency of [...(klass.value?.proficiencies ?? []), ...racialProficiencies.value, ...subracialProficiencies.value]) {
      if (/^(skill-|saving-throw-)/.test(proficiency.index)) continue
      if (/armor|shield/i.test(proficiency.name)) proficiencies.armor.push(proficiency.name)
      else if (/weapon|sword|bow|dagger|sling|club|axe|staff|mace|spear|dart|hammer|rapier|scimitar|lance|flail|trident|maul|pike/i.test(proficiency.name)) proficiencies.weapons.push(proficiency.name)
      else proficiencies.tools.push(proficiency.name)
    }
    for (const entry of [race.value, subrace.value, klass.value]) {
      const props = object(entry?.details?.[':props']), profs = object(entry?.details?.[':profs'])
      proficiencies.armor.push(...enabledKeys(props[':armor-prof']).map(pretty))
      proficiencies.weapons.push(...enabledKeys(props[':weapon-prof']).map(pretty))
      proficiencies.tools.push(...enabledKeys(profs[':tool']).map(pretty))
    }
    const definitions=[klass.value,subclass.value,race.value].flatMap(entry=>entry?.workshop?[{id:entry.workshop.id,index:entry.index,revision:entry.workshopRevision??1,draft:entry.workshop,previousIndexes:[],previousNames:[]}]:[])
    const authored=subclass.value?.workshop?.magic.enabled?subclass.value.workshop:klass.value?.workshop
    if(klass.value?.workshop)for(const group of ['armor','weapons','tools'] as const)proficiencies[group]=[...new Set([...proficiencies[group],...klass.value.workshop[group]])]
    const defaults = classSpellDefaults(klass.value?.name??'')
    const slots: Record<string, number> = {}
    for (let level = 1; level <= 9; level++) slots[`l${level}`] = authored?workshopSlots(authored,draft.level)[`l${level}`]!:defaults ? slotMaximums(defaults.progression,draft.level)[`l${level}`]! : classLevel.value?.spellcasting?.[`spell_slots_level_${level}`] ?? 0
    const classCasting = object(klass.value?.details?.[':spellcasting'])
    const ability = String(authored?.magic.ability??defaults?.ability ?? klass.value?.spellcasting?.spellcasting_ability.index ?? classCasting[':ability'] ?? 'int').replace(/^:/, '').replace(/^.*\//, '') as AbilityKey
    return {
      ruleDefinitions:definitions,
      spellPolicy: spellSelectionPolicy(draft, { klass: klass.value, subrace: subrace.value, subclass: subclass.value, progression: classLevel.value, scores: abilityTotals(draft, { race: race.value, subrace: subrace.value, klass: klass.value }) }),
      race: race.value, subrace: subrace.value, klass: klass.value, subclass: subclass.value, background: background.value,
      fixedSkills: fixedSkills.value, skillChoice: skillChoice.value, proficiencies, slots, spellAbility: ABILITY_KEYS.includes(ability) ? ability : 'int',
      features: [...raceTraits.value.map(f=>({...f,origin:'racial' as const,level:f.level??1})), ...subraceTraits.value.map(f=>({...f,origin:'racial' as const,level:f.level??1})), ...classTraits.value.map(f=>({...f,origin:'class' as const})), ...subclassTraits.value.map(f=>({...f,origin:'subclass' as const})), ...(background.value?.traits ?? []).map(f=>({...f,origin:'background' as const,level:1})),
        ...feats.value.filter((entry) => selectedFeatIndexes(draft,{klass:klass.value,race:race.value,subrace:subrace.value}).includes(entry.index)).map((entry) => ({ name: contentLabel(entry), description: entry.description, origin:'feat' as const, level:featOpportunities(draft,{klass:klass.value,race:race.value,subrace:subrace.value}).slots.find(s=>draft.advancements[s.key]?.feat===entry.index)?.level??1 }))],
    }
  })
  const spellPolicy = computed(() => context.value.spellPolicy!)
  const spellCounts = computed(() => spellSelectionCounts(draft.spells, spellPolicy.value))
  const spellProblems = computed(() => spellSelectionProblems(draft.spells, spellPolicy.value))
  const scores = computed(() => abilityTotals(draft, context.value))
  const issues = computed(() => builderIssues(draft, context.value))
  const canCreate = computed(() => ready.value && !libraryLoading.value && !loadingDetails.value && !inventoryBusy.value && !issues.value.length)
  const stats = computed(() => ({
    hp: draft.hpOverride ?? (klass.value ? maxHP(klass.value.hit_die, scores.value.con, draft.level) : null),
    ac: armorClass(draft, scores.value), speed: subrace.value?.speed ?? race.value?.speed ?? null,
    initiative: abilityMod(scores.value.dex), proficiency: profBonus(draft.level),
  }))
  const canCast = computed(() => !!context.value.ruleDefinitions?.some(r=>r.draft.magic.enabled) || !!classSpellDefaults(klass.value?.name??'') || !!klass.value?.spellcasting || !!klass.value?.details?.[':spellcasting'] || !!classLevel.value?.spellcasting)

  function saveDraft() {
    if (finished || !ready.value) return
    try { localStorage.setItem(key, JSON.stringify(draft)); saved.value = true; storageError.value = '' }
    catch { storageError.value = 'This browser could not save your draft. Keep this page open until you finish.' }
  }
  function clearDraft() { finished = true; clearTimeout(saveTimer); try { localStorage.removeItem(key) } catch { /* saved character is unaffected */ } }
  watch(draft, () => { if (!ready.value) return; saved.value = false; clearTimeout(saveTimer); saveTimer = setTimeout(saveDraft, 450) }, { deep: true })

  async function loadRace() {
    const sequence = ++raceSequence
    raceLoading.value = false
    race.value = null; raceTraits.value = []; racialProficiencies.value = []
    if (!draft.race) return
    raceLoading.value = true
    try {
      const detail: Race = customRaces.value.find((entry) => entry.index === draft.race) ?? await cached(`race:${draft.race}`, () => srd.race(draft.race))
      const traits = detail.homebrew_traits ? [] : await Promise.allSettled(detail.traits.map((entry) => cached(`trait:${entry.index}`, () => srd.trait(entry.index))))
      if (disposed || sequence !== raceSequence) return
      race.value = detail
      raceTraits.value = detail.homebrew_traits ?? traits.flatMap((result) => result.status === 'fulfilled' ? [{ name: result.value.name, description: result.value.desc.join('\n\n') }] : [])
      racialProficiencies.value = traits.flatMap((result) => result.status === 'fulfilled' ? result.value.proficiencies ?? [] : [])
      if (traits.some((result) => result.status === 'rejected')) detailError.value = 'Some racial traits could not be loaded. Reselect the race to retry.'
    } catch { if (sequence === raceSequence) detailError.value = 'Could not load that race. Please choose it again.' }
    finally { if (sequence === raceSequence) raceLoading.value = false }
  }
  async function loadClassFeatures() {
    const sequence = ++featureSequence
    if (klass.value?.homebrew_traits) { classTraits.value = klass.value.homebrew_traits; featureLoading.value = false; return }
    featureLoading.value = true
    const wanted = levels.value.filter((entry) => entry.level <= draft.level).flatMap((entry) => entry.features.map((feature) => ({ ...feature, level: entry.level })))
    const unique = [...new Map(wanted.map((entry) => [entry.index, entry])).values()]
    const results = await Promise.allSettled(unique.map(async (entry) => ({ name: entry.name, level: entry.level,
      description: (await cached(`feature:${entry.index}`, () => srd.feature(entry.index))).desc.join('\n\n') })))
    if (!disposed && sequence === featureSequence) {
      classTraits.value = results.flatMap((result) => result.status === 'fulfilled' ? [result.value] : [])
      featureLoading.value = false
      if (results.some((result) => result.status === 'rejected')) detailError.value = 'Some class features could not be loaded. Reselect the class to retry.'
    }
  }
  async function loadClass() {
    const sequence = ++classSequence
    classLoading.value = false
    ++featureSequence
    klass.value = null; levels.value = []; classTraits.value = []; classSpellIndexes.value = []; featureLoading.value = false
    if (!draft.klass) return
    classLoading.value = true
    try {
      const custom = customClasses.value.find((entry) => entry.index === draft.klass||entry.aliases?.includes(draft.klass))
      const detail = custom ?? await cached(`class:${draft.klass}`, () => srd.class(draft.klass))
      const progression = custom ? [] : await cached(`levels:${draft.klass}`, () => srd.classLevels(draft.klass))
      if (disposed || sequence !== classSequence) return
      if(custom&&draft.klass!==custom.index)draft.klass=custom.index
      klass.value = detail; levels.value = progression
      await loadClassFeatures()
      if (!custom && detail.spellcasting) {
        const spells = await cached(`classSpells:${detail.index}`, () => srd.classSpells(detail.index))
        if (sequence === classSequence) classSpellIndexes.value = spells.map((entry) => entry.index)
      }
    } catch { if (sequence === classSequence) detailError.value = 'Some class details could not be loaded. Reselect the class to retry.' }
    finally { if (sequence === classSequence) classLoading.value = false }
  }
  async function loadSubrace() {
    const sequence = ++subraceSequence
    subraceLoading.value = false
    subrace.value = null; subraceTraits.value = []; subracialProficiencies.value = []
    if (!draft.subrace) return
    subraceLoading.value = true
    try {
      const detail: Subrace = customSubraces.value.find((entry) => entry.index === draft.subrace) ?? await cached(`subrace:${draft.subrace}`, () => srd.subrace(draft.subrace))
      const traits = detail.homebrew_traits ? [] : await Promise.allSettled(detail.racial_traits.map((entry) => cached(`trait:${entry.index}`, () => srd.trait(entry.index))))
      if (disposed || sequence !== subraceSequence) return
      subrace.value = detail
      subraceTraits.value = detail.homebrew_traits ?? traits.flatMap((result) => result.status === 'fulfilled' ? [{ name: result.value.name, description: result.value.desc.join('\n\n') }] : [])
      subracialProficiencies.value = traits.flatMap((result) => result.status === 'fulfilled' ? result.value.proficiencies ?? [] : [])
    } catch { if (sequence === subraceSequence) detailError.value = 'Could not load that subrace.' }
    finally { if (sequence === subraceSequence) subraceLoading.value = false }
  }
  async function loadSubclass() {
    const sequence = ++subclassSequence
    subclassLoading.value = false
    subclass.value = null; subclassTraits.value = []
    if (!draft.subclass) return
    subclassLoading.value = true
    try {
      const custom = customSubclasses.value.find((entry) => entry.index === draft.subclass||entry.aliases?.includes(draft.subclass))
      const detail = custom ?? await cached(`subclass:${draft.subclass}`, () => srd.subclass(draft.subclass))
      if (disposed || sequence !== subclassSequence) return
      if(custom&&draft.subclass!==custom.index)draft.subclass=custom.index
      subclass.value = detail
      subclassTraits.value = custom?.traits ?? [{ name: detail.name, description: 'desc' in detail ? detail.desc.join('\n\n') : '' }]
    } catch { if (sequence === subclassSequence) detailError.value = 'Could not load that subclass.' }
    finally { if (sequence === subclassSequence) subclassLoading.value = false }
  }
  async function loadBackground() {
    const sequence = ++backgroundSequence
    backgroundLoading.value = false
    background.value = null
    if (!draft.background) return
    backgroundLoading.value = true
    try {
      const custom = customBackgrounds.value.find((entry) => entry.index === draft.background)
      let normalized: BuilderBackground
      if (custom) {
        const details = object((custom as HomebrewBackground & { details?: unknown }).details)
        normalized = { ...custom, languages: 0, suggestions: {}, skills: enabledKeys(object(details[':profs'])[':skill']).map(skillKey),
          equipment: Object.entries(custom.equipment).map(([key, count]) => ({ equipment: { index: key.replace(/^:/, ''), name: pretty(key.replace(/^:/, '')), url: '' }, quantity: Number(count) || 1 })) }
      } else {
        const detail: SrdBackground = await cached(`background:${draft.background}`, () => srd.background(draft.background))
        normalized = { ...detail, description: 'A life of faith, service, and the communities that shaped you.',
          traits: detail.feature ? [{ name: detail.feature.name, description: detail.feature.desc.join('\n\n') }] : [],
          skills: detail.starting_proficiencies.filter((entry) => entry.index.startsWith('skill-')).map((entry) => skillKey(entry.index)),
          equipment: detail.starting_equipment, languages: detail.language_options?.choose ?? 0,
          suggestions: Object.fromEntries((['traits', 'ideals', 'bonds', 'flaws'] as const).map((key) => [key,
            (key === 'traits' ? detail.personality_traits : detail[key])?.from.options?.map((option) => option.string ?? option.desc ?? '').filter(Boolean) ?? [],
          ])),
        }
      }
      if (!disposed && sequence === backgroundSequence) background.value = normalized
    } catch { if (sequence === backgroundSequence) detailError.value = 'Could not load that background.' }
    finally { if (sequence === backgroundSequence) backgroundLoading.value = false }
  }

  function chooseRace(index: string) { detailError.value = ''; if (draft.race !== index) { draft.subrace = ''; draft.race = index } else void loadRace() }
  function chooseClass(index: string) { detailError.value = ''; if (draft.klass !== index) { draft.subclass = ''; draft.skills = []; draft.expertise = []; draft.slotOverrides = {}; draft.slotRule = undefined; draft.klass = index } else void loadClass() }
  function chooseBackground(index: string) { detailError.value = ''; if (draft.background !== index) draft.background = index; else void loadBackground() }
  function toggleSkill(key: string) {
    if (fixedSkills.value.includes(key)) return
    if (draft.skills.includes(key)) { draft.skills = draft.skills.filter((value) => value !== key); draft.expertise = draft.expertise.filter((value) => value !== key) }
    else if (!skillChoice.value.choose || draft.skills.length < skillChoice.value.choose) draft.skills.push(key)
  }
  async function searchSpells() {
    const sequence = ++spellSequence
    spellLoading.value = true; spellError.value = ''
    const [standard] = await Promise.allSettled([srd.spells({ ...(spellQuery.value ? { name: spellQuery.value } : {}), ...(spellLevel.value !== 'all' ? { level: spellLevel.value } : {}) })])
    if (sequence !== spellSequence || disposed) return
    const authored=subclass.value?.workshop?.magic.enabled?subclass.value.workshop:klass.value?.workshop
    const allowed = new Set(authored?authored.magic.spellList:classSpellIndexes.value)
    const rawList = object(object(klass.value?.details?.[':spellcasting'])[':spell-list'])
    for (const values of Object.values(authored?{}:rawList)) if (Array.isArray(values)) for (const value of values) allowed.add(String(value).replace(/^:/, ''))
    const parent = klass.value?.contentKey ?? draft.klass
    const custom = customSpells.value.filter((spell) => (spellLevel.value === 'all' || spell.level === Number(spellLevel.value))
      && (!classSpellsOnly.value || !canCast.value || allowed.has(spell.index)||(!authored&&(spell.classes.some((entry) => entry.index === parent) || allowed.has(spell.contentKey ?? '')))))
    spellResults.value = [...(standard.status === 'fulfilled' ? standard.value.filter((entry) => !classSpellsOnly.value || !canCast.value || allowed.has(entry.index)) : []), ...custom]
      .filter((entry) => !spellQuery.value || contentLabel(entry).toLowerCase().includes(spellQuery.value.toLowerCase()))
    if (standard.status === 'rejected') spellError.value = 'The SRD spell list could not be loaded. Imported spells remain available.'
    spellLoading.value = false
  }
  async function inspectSpell(index: string) {
    const sequence = ++spellDetailSequence
    spellDetailLoading.value = true; spellDetail.value = null
    try {
      const detail = customSpells.value.find((entry) => entry.index === index) ?? await cached(`spell:${index}`, () => srd.spell(index))
      if (sequence === spellDetailSequence && !disposed) spellDetail.value = detail
    } catch { spellError.value = 'Could not load that spell.' }
    finally { if (sequence === spellDetailSequence) spellDetailLoading.value = false }
  }
  function spellAddProblem(detail: SrdSpell, prepared = true) {
    if (draft.spells.some((spell) => spell.index === detail.index)) return 'Already added to your character.'
    if (loadingDetails.value || !ready.value) return 'Wait for your character details to finish loading.'
    if (draft.spellLimitOverride) return ''
    if (!spellPolicy.value.available) return 'Enable the override to choose spells for this class.'
    return spellSelectionProblems([...draft.spells, { index: detail.index, name: detail.name, level: detail.level, description: '', prepared: detail.level === 0 || spellPolicy.value.prepared === null || prepared }], spellPolicy.value)[0] ?? ''
  }
  function canPrepareSpell(index: string) {
    if (draft.spellLimitOverride) return true
    return !spellSelectionProblems(draft.spells.map((spell) => spell.index === index ? { ...spell, prepared: true } : spell), spellPolicy.value).length
  }
  function addSpell(detail: SrdSpell, prepared = true) {
    if (spellAddProblem(detail, prepared)) return
    draft.spells.push({ index: detail.index, name: contentLabel(detail), level: detail.level, description: detail.desc.join('\n\n'), prepared: detail.level === 0 || spellPolicy.value.prepared === null || prepared, source: detail.sourcePack })
  }
  async function addEquipment(entry: SrdRef, quantity = 1) {
    inventoryBusy.value = true
    try {
      const detail: SrdEquipment = await cached(`equipment:${entry.index}`, () => srd.equipmentItem(entry.index))
      const existing = draft.equipment.find((item) => item.index === detail.index)
      if (existing) existing.qty += quantity
      else draft.equipment.push({ ...equipmentFrom(detail), index: detail.index, qty: quantity, armor_class: detail.armor_class, armor_category: detail.armor_category })
    } catch { detailError.value = `Could not load ${entry.name}. You can add it as a custom item.` }
    finally { inventoryBusy.value = false }
  }
  async function addFixedEquipment() {
    const fixed = Array.isArray(klass.value?.starting_equipment) ? klass.value.starting_equipment as { equipment: SrdRef; quantity: number }[] : []
    for (const entry of [...fixed, ...(background.value?.equipment ?? [])]) await addEquipment(entry.equipment, entry.quantity)
  }

  watch(() => draft.race, () => { if (ready.value) void loadRace() })
  watch(() => draft.klass, () => { if (ready.value) void loadClass() })
  watch(() => draft.subrace, () => { if (ready.value) void loadSubrace() })
  watch(() => draft.subclass, () => { if (ready.value) void loadSubclass() })
  watch(() => draft.background, () => { if (ready.value) void loadBackground() })
  watch(() => draft.level, () => { if (ready.value) void loadClassFeatures() })
  watch(fixedSkills, (fixed) => { const filtered = draft.skills.filter((key) => !fixed.includes(key)); if (filtered.join() !== draft.skills.join()) draft.skills = filtered })
  watch([spellQuery, spellLevel, classSpellsOnly, classSpellIndexes, () => draft.step], () => {
    if (draft.step !== 'spells' || !ready.value) return
    ++spellSequence; clearTimeout(spellTimer); spellTimer = setTimeout(searchSpells, 250)
  })

  onMounted(async () => {
    try {
      const stored = localStorage.getItem(key)
      if (stored) { Object.assign(draft, restoreBuilderDraft(JSON.parse(stored))); restored.value = true }
    } catch { /* A corrupt draft must not prevent starting a new character. */ }
    await reloadLibrary(false)
  })
  async function reloadLibrary(force=true) {
    if(libraryLoading.value||disposed)return
    libraryLoading.value=true
    try {
    const results = await Promise.allSettled([
      srd.classes(), srd.races(), srd.backgrounds(), srd.equipment(), srd.languages(),
      loadCreationOptions(useAuthStore().user?.id,force),
    ] as const)
    if (disposed) return
    const value = <T>(result: PromiseSettledResult<T>, fallback: T): T => result.status === 'fulfilled' ? result.value : fallback
    const imported=results[5]
    if(imported.status==='fulfilled'){
      const options=imported.value
      customClasses.value=options.classes;customRaces.value=options.races;customBackgrounds.value=options.backgrounds
      customSubraces.value=options.subraces;customSubclasses.value=options.subclasses;feats.value=options.feats;customSpells.value=options.spells
    }
    classes.value = [...value(results[0], classes.value.filter(e=>!e.index.startsWith('homebrew-'))), ...customClasses.value]
    races.value = [...value(results[1], races.value.filter(e=>!e.index.startsWith('homebrew-'))), ...customRaces.value]
    backgrounds.value = [...value(results[2], backgrounds.value.filter(e=>!e.index.startsWith('homebrew-'))), ...customBackgrounds.value]; equipment.value = value(results[3], equipment.value)
    languages.value = [...new Map([...value(results[4], languages.value), ...(imported.status==='fulfilled'?imported.value.languages:[])].map((entry) => [entry.name.toLowerCase(), entry])).values()]
    warnings.value = [
      ...(imported.status==='rejected'?['Imported character options could not load. Retry the library to include your packs.']:[]),
      ...(results.slice(0,5).some(result=>result.status==='rejected')?['Some SRD options could not load. Retry the library to complete the list.']:[]),
    ]
    draft.spells = draft.spells.map((spell) => {
      const current = customSpells.value.find((entry) => entry.index === spell.index || entry.aliases?.includes(spell.index))
      return current ? { ...spell, index: current.index, name: contentLabel(current) } : spell
    })
    await Promise.allSettled(draft.equipment.map(async(item,index)=>{
      if(item.weapon||item.armor||!equipment.value.some(entry=>entry.index===item.index))return
      const detail=await cached(`equipment:${item.index}`,()=>srd.equipmentItem(item.index))
      draft.equipment[index]={...equipmentFrom(detail),...item,armor:item.armor??equipmentFrom(detail).armor,weapon:item.weapon??equipmentFrom(detail).weapon,armor_class:item.armor_class??detail.armor_class,armor_category:item.armor_category??detail.armor_category}
    }))
    ready.value = true
    await Promise.allSettled([loadRace(), loadClass(), loadSubrace(), loadSubclass(), loadBackground()])
    if (draft.step === 'spells') void searchSpells()
    saveDraft()
    } finally { libraryLoading.value=false }
  }
  onBeforeUnmount(() => { disposed = true; clearTimeout(saveTimer); clearTimeout(spellTimer); saveDraft(); ++raceSequence; ++classSequence; ++subraceSequence; ++subclassSequence; ++backgroundSequence; ++featureSequence; ++spellSequence; ++spellDetailSequence })

  return { draft, ready, libraryLoading, reloadLibrary, warnings, detailError, race, klass, subrace, subclass, background, races, classes, backgrounds, equipment, languages, feats,
    raceTraits, classTraits, subraceTraits, subclassTraits, subclassOptions, subraceOptions, skillChoice, fixedSkills, context, scores, issues, stats, canCreate, canCast, loadingDetails,
    spellPolicy, spellCounts, spellProblems, spellAddProblem, canPrepareSpell,
    spellQuery, spellLevel, classSpellsOnly, spellResults, spellLoading, spellError, spellDetail, spellDetailLoading, classLevel,
    inventoryBusy, saved, restored, storageError, saveDraft, clearDraft, chooseRace, chooseClass, chooseBackground, toggleSkill, inspectSpell, addSpell, addEquipment, addFixedEquipment,
    create: () => composeCharacter(draft, context.value),
  }
}
