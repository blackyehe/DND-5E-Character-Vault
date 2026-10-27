import type { Character, CharacterFeature } from './character'
import type { WorkshopDraft } from './homebrew-workshop'
import { applyWorkshopRules, choiceKey, ruleName } from './workshop-character'
import { progressionClasses, slotMaximums } from './character-progression'
import { resourcesFor } from './character-resources'
import {
  abilityMod,
  profBonus,
  SKILL_ABILITY,
  type AbilityKey,
} from './calc'

export interface AdvancementOption {
  id: string
  name: string
  description: string
  skill?: string
  tool?: string
  prerequisites?: string[]
  requirements?: { level?: number; spell?: string; feature?: string }[]
  training?: boolean
  spell?: string
}
export interface AdvancementFeature {
  id: string
  name: string
  description: string
  origin: 'class' | 'subclass' | 'racial'
  level: number
  choose?: number
  options?: AdvancementOption[]
  ruleId?: string
  featureId?: string
  skillMode?: 'prof' | 'expert'
}
export interface AdvancementRules {
  name: string
  index: string
  hitDie: number
  source: string
  classLevel: number
  subclassLevel: number
  subclasses: { index: string; name: string }[]
  features: AdvancementFeature[]
  asi: boolean
  casting?: {
    ability: AbilityKey
    learning: 'known' | 'prepared' | 'book'
    cantrips: number
    spells: number
    maxSpellLevel: number
    slots: Record<string, number>
    eligible?: { id: string; level: number }[]
    replacements?: number
  }
  workshop?: WorkshopDraft
  bindings?: { index: string; rule: WorkshopDraft }[]
  grants?: Partial<Character['proficiencies']>
  extraSpellOptions?: string[]
  spellListExtras?: string[]
  grantedSpells?: {
    id: string
    name: string
    prepared?: boolean
    requires?: { id: string; name: string }[]
  }[]
  blocked?: string[]
  scaling?: { name: string; before: string; after: string }[]
  warnings: string[]
  existingReviews?: { id: string; name: string; description: string }[]
  progressionSummary?: string
}
export interface AdvancementDecisions {
  className: string
  classIndex: string
  subclass: string
  subclassIndex: string
  milestone: boolean
  hpMode: 'average' | 'rolled'
  hpRoll: number
  hpCurrent: 'keep' | 'increase'
  hpExtra: number
  asi: 'abilities' | 'feat' | ''
  increases: Record<AbilityKey, number>
  feat?: { name: string; description: string }
  featReviewed: boolean
  choices: Record<string, string[]>
  reviewed: Record<string, boolean>
  skills: Record<string, boolean>
  spells: string[]
  cantrips: string[]
  removedSpells: string[]
  prepared: string[]
  magicReviewed: boolean
  customFeatures: { name: string; description: string }[]
  customResources: {
    id: string
    name: string
    max: number
    recovery: 'short' | 'long' | 'manual'
  }[]
  manualSlots: Record<string, number>
  slotsReviewed: boolean
  notes: string
  grants: Character['proficiencies']
  saveGrants: AbilityKey[]
  extraSpells: string[]
  speed: number | null
}
export const standardClasses: Record<
  string,
  {
    hitDie: number
    subclassLevel: number
    ability?: AbilityKey
    casting?: 'full' | 'half' | 'pact'
  }
> = {
  barbarian: { hitDie: 12, subclassLevel: 3 },
  bard: { hitDie: 8, subclassLevel: 3, ability: 'cha', casting: 'full' },
  cleric: { hitDie: 8, subclassLevel: 1, ability: 'wis', casting: 'full' },
  druid: { hitDie: 8, subclassLevel: 2, ability: 'wis', casting: 'full' },
  fighter: { hitDie: 10, subclassLevel: 3 },
  monk: { hitDie: 8, subclassLevel: 3 },
  paladin: { hitDie: 10, subclassLevel: 3, ability: 'cha', casting: 'half' },
  ranger: { hitDie: 10, subclassLevel: 3, ability: 'wis', casting: 'half' },
  rogue: { hitDie: 8, subclassLevel: 3 },
  sorcerer: { hitDie: 6, subclassLevel: 1, ability: 'cha', casting: 'full' },
  warlock: { hitDie: 8, subclassLevel: 1, ability: 'cha', casting: 'pact' },
  wizard: { hitDie: 6, subclassLevel: 2, ability: 'int', casting: 'full' },
}
export const levelUpXP = [
  0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000,
  120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000,
]
export function newAdvancement(c: Character): AdvancementDecisions {
  const entry = progressionClasses(c)[0]
  return {
    className: entry?.name ?? c.meta.klass,
    classIndex: entry?.index ?? c.meta.classIndex ?? '',
    subclass: '',
    subclassIndex: '',
    milestone: false,
    hpMode: 'average',
    hpRoll: 0,
    hpCurrent: 'keep',
    hpExtra: 0,
    asi: '',
    increases: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
    featReviewed: false,
    choices: {},
    reviewed: {},
    skills: {},
    spells: [],
    cantrips: [],
    removedSpells: [],
    prepared: [...c.spellcasting.prepared],
    magicReviewed: false,
    customFeatures: [],
    customResources: [],
    manualSlots: {},
    slotsReviewed: false,
    notes: '',
    grants: { armor: [], weapons: [], tools: [], languages: [] },
    saveGrants: [],
    extraSpells: [],
    speed: null,
  }
}
export function multiclassProblems(c: Character, name: string) {
  const existing = progressionClasses(c)
  if (existing.some((e) => ruleName(e.name) === ruleName(name))) return []
  const result: string[] = []
  for (const n of [...new Set([...existing.map((e) => e.name), name])]) {
    const a = c.abilities,
      k = ruleName(n)
    const ok =
      k === 'fighter'
        ? Math.max(a.str, a.dex) >= 13
        : k === 'monk'
          ? a.dex >= 13 && a.wis >= 13
          : k === 'paladin'
            ? a.str >= 13 && a.cha >= 13
            : k === 'ranger'
              ? a.dex >= 13 && a.wis >= 13
              : k === 'barbarian'
                ? a.str >= 13
                : k === 'rogue'
                  ? a.dex >= 13
                  : ['bard', 'sorcerer', 'warlock'].includes(k)
                    ? a.cha >= 13
                    : ['cleric', 'druid'].includes(k)
                      ? a.wis >= 13
                      : k === 'wizard'
                        ? a.int >= 13
                        : null
    if (ok === false)
      result.push(`${n}: multiclass ability requirements are not met.`)
    if (ok === null)
      result.push(
        `${n}: multiclass prerequisites need a structured class definition.`,
      )
  }
  return result
}
export function targetClasses(c: Character, d: AdvancementDecisions) {
  const entries = JSON.parse(
    JSON.stringify(progressionClasses(c)),
  ) as NonNullable<Character['meta']['classLevels']>
  if (entries.length === 1) {
    entries[0]!.index ??= c.meta.classIndex
    entries[0]!.subclass ??= c.meta.subclass
    entries[0]!.subclassIndex ??= c.meta.subclassIndex
  }
  const current = entries.find(
    (e) => ruleName(e.name) === ruleName(d.className),
  )
  if (current) {
    current.level++
    current.index = d.classIndex || current.index
  } else entries.push({ name: d.className, level: 1, index: d.classIndex })
  return entries
}
export function levelUpPlan(
  base: Character,
  r: AdvancementRules,
  d: AdvancementDecisions,
) {
  const next = JSON.parse(JSON.stringify(base)) as Character,
    oldClasses = progressionClasses(base),
    entries = targetClasses(base, d),
    newLevel = base.meta.level + 1,
    issues: Record<string, string[]> = {
      class: [],
      health: [],
      training: [],
      features: [],
      magic: [],
      review: [],
    }
  const issue = (step: string, s: string) => issues[step]!.push(s)
  if (base.meta.level >= 20)
    issue('class', 'Level 20 is the maximum supported character level.')
  if (
    !oldClasses.length ||
    oldClasses.reduce((s, e) => s + e.level, 0) !== base.meta.level
  )
    issue(
      'class',
      'Record accurate per-class levels in Edit character before advancing.',
    )
  if (!d.className.trim() || r.name !== d.className)
    issue('class', 'Load the rules for the class gaining this level.')
  if (base.meta.xp < (levelUpXP[base.meta.level] ?? Infinity) && !d.milestone)
    issue('class', 'Confirm a DM-awarded milestone or earn the required XP.')
  multiclassProblems(base, d.className).forEach((s) => issue('class', s))
  r.blocked?.forEach((message) => issue('class', message))
  const classLevel = entries.find(
    (e) => ruleName(e.name) === ruleName(d.className),
  )!.level
  const classEntry = oldClasses.find(
      (e) => ruleName(e.name) === ruleName(d.className),
    ),
    subclass =
      classEntry?.subclass ??
      (classEntry && oldClasses.length === 1 ? base.meta.subclass : '')
  if (classLevel >= r.subclassLevel && !subclass && !d.subclass)
    issue('class', 'Choose this class’s subclass before continuing.')
  next.meta.level = newLevel
  next.meta.classLevels = entries
  next.meta.klass = entries.map((e) => e.name).join(' / ')
  const target = entries.find(
    (e) => ruleName(e.name) === ruleName(d.className),
  )!
  if (d.subclass) {
    target.subclass = d.subclass
    target.subclassIndex = d.subclassIndex
    if (entries.length === 1) {
      next.meta.subclass = d.subclass
      next.meta.subclassIndex = d.subclassIndex
    }
  }
  if (entries.length === 1)
    next.meta.classIndex = d.classIndex || next.meta.classIndex
  if (r.asi) {
    if (
      d.asi === 'feat' &&
      Object.values(d.increases).reduce((a, b) => a + b, 0) > 2
    )
      issue(
        'training',
        'A feat cannot grant more than two ability points in this wizard.',
      )
    if (!d.asi)
      issue('training', 'Choose an ability score improvement or a feat.')
    if (
      d.asi === 'abilities' &&
      Object.values(d.increases).reduce((a, b) => a + b, 0) !== 2
    )
      issue('training', 'Allocate exactly two ability points.')
    if (
      d.asi === 'feat' &&
      (!d.feat?.name.trim() || !d.feat.description.trim() || !d.featReviewed)
    )
      issue(
        'training',
        'Choose a feat and review its prerequisites and mechanical effects.',
      )
    for (const [key, n] of Object.entries(d.increases)) {
      const k = key as AbilityKey
      if (
        !Number.isInteger(n) ||
        n < 0 ||
        n > 2 ||
        (base.abilities[k] + n > 20 && n > 0)
      )
        issue(
          'training',
          `${key.toUpperCase()}: increases must be 0–2 and cannot raise the score above 20.`,
        )
      if (d.asi) next.abilities[k] += n
    }
    if (d.asi === 'feat' && d.feat)
      next.features.push({ ...d.feat, origin: 'feat', level: newLevel })
  }
  const conChange =
      abilityMod(next.abilities.con) - abilityMod(base.abilities.con),
    die = r.hitDie
  if (![4, 6, 8, 10, 12].includes(die))
    issue('health', 'Confirm a valid class hit die.')
  if (
    d.hpMode === 'rolled' &&
    (!Number.isInteger(d.hpRoll) || d.hpRoll < 1 || d.hpRoll > die)
  )
    issue(
      'health',
      `Enter the rolled result, from 1 to ${die}, before modifiers.`,
    )
  if (!Number.isInteger(d.hpExtra) || d.hpExtra < 0 || d.hpExtra > 100)
    issue(
      'health',
      'Additional HP for this level must be a whole number from 0 to 100.',
    )
  const oldTough = base.features.some((f) => /^tough$/i.test(f.name)),
    newTough = next.features.some((f) => /^tough$/i.test(f.name)),
    dwarf = next.features.some((f) => /dwarven toughness/i.test(f.name)),
    hpBase = d.hpMode === 'average' ? Math.floor(die / 2) + 1 : d.hpRoll
  const hpGain =
      Math.max(1, hpBase + abilityMod(next.abilities.con)) +
      (newTough ? 2 : 0) +
      (dwarf ? 1 : 0) +
      d.hpExtra,
    retro =
      base.meta.level * conChange +
      (!oldTough && newTough ? base.meta.level * 2 : 0),
    hpDelta = hpGain + retro
  next.combat.hpMax = Math.max(1, base.combat.hpMax + hpDelta)
  next.combat.hitDiceTotal = newLevel
  if (base.combat.hitDiceUsed > newLevel)
    issue(
      'health',
      'Spent Hit Dice exceed the new total. Correct the saved Hit Dice in the sheet before advancing.',
    )
  if (d.hpCurrent === 'increase' && base.combat.hpCurrent > 0)
    next.combat.hpCurrent = Math.min(
      next.combat.hpMax,
      Math.max(0, base.combat.hpCurrent + hpDelta),
    )
  for (const binding of r.bindings ?? []) {
    next.homebrew ??= {
      bindings: [],
      choices: {},
      conflicts: [],
      acknowledged: [],
    }
    if (!next.homebrew.bindings.some((b) => b.ruleId === binding.rule.id))
      next.homebrew.bindings.push({
        ruleId: binding.rule.id,
        revision: 0,
        index: binding.index,
        className: d.className,
        rule: binding.rule,
      })
  }
  for (const f of r.features) {
    const choices = d.choices[f.id] ?? []
    if (new Set(choices).size !== choices.length)
      issue('features', `${f.name}: each choice must be different.`)
    if (f.choose && choices.length !== f.choose)
      issue(
        'features',
        `${f.name}: choose ${f.choose} option${f.choose === 1 ? '' : 's'}.`,
      )
    if (f.choose && choices.some((id) => !f.options?.some((o) => o.id === id)))
      issue('features', `${f.name}: remove unavailable options.`)
    if (!d.reviewed[f.id]) issue('features', `Review ${f.name}.`)
    for (const id of choices) {
      const option = f.options?.find((o) => o.id === id)
      if (option) {
        const reason = advancementOptionProblem(base, r, d, f, option)
        if (reason) issue('features', `${option.name}: ${reason}`)
      }
    }
    if (f.ruleId && next.homebrew)
      next.homebrew.choices[choiceKey(f.ruleId, f.featureId!)] = choices
    const feature: CharacterFeature = {
      name: f.name,
      description: f.description,
      origin: f.origin,
      level: f.level,
      selectedOptions: choices,
      ruleId: f.ruleId,
      featureId: f.featureId,
    }
    const old = next.features.findIndex((v) =>
      f.ruleId
        ? v.ruleId === f.ruleId && v.featureId === f.featureId
        : ruleName(v.name) === ruleName(f.name),
    )
    if (old >= 0) {
      feature.pinned = next.features[old]!.pinned
      if (!f.ruleId)
        feature.selectedOptions = [
          ...new Set([
            ...(next.features[old]!.selectedOptions ?? []),
            ...choices,
          ]),
        ]
      next.features[old] = { ...next.features[old], ...feature }
    } else next.features.push(feature)
    for (const id of choices) {
      const option = f.options?.find((o) => o.id === id)
      if (!option) continue
      if (option.skill)
        next.skills[option.skill] = /expertise/i.test(f.name)
          ? 'expert'
          : next.skills[option.skill] === 'expert'
            ? 'expert'
            : 'prof'
      else if (option.tool) {
        if (
          !next.proficiencies.tools.some(
            (t) => ruleName(t) === ruleName(option.tool!),
          )
        )
          next.proficiencies.tools.push(option.tool)
        next.features.push({
          name: `${f.name}: ${option.name}`,
          description: option.description,
          origin: f.origin,
          level: newLevel,
        })
      } else if (option.description)
        next.features.push({
          name: option.name,
          description: option.description,
          origin: f.origin,
          level: newLevel,
        })
    }
  }
  for (const [skill, selected] of Object.entries(d.skills))
    if (selected && skill in SKILL_ABILITY && next.skills[skill] !== 'expert')
      next.skills[skill] = 'prof'
  for (const group of ['armor', 'weapons', 'tools', 'languages'] as const)
    for (const grant of [...(r.grants?.[group] ?? []), ...d.grants[group]])
      if (
        grant.trim() &&
        !next.proficiencies[group].some((v) => ruleName(v) === ruleName(grant))
      )
        next.proficiencies[group].push(grant.trim())
  for (const key of d.saveGrants) next.saves[key] = true
  for (const f of d.customFeatures) {
    if (!f.name.trim() || !f.description.trim())
      issue('features', 'Additional features need both a name and rule text.')
    else next.features.push({ ...f, origin: 'other', level: newLevel })
  }
  if (r.warnings.length && !d.reviewed['source-warnings'])
    issue(
      'features',
      'Review the rule coverage notes and record missing grants.',
    )
  if (d.speed !== null) {
    if (!Number.isInteger(d.speed) || d.speed < 0 || d.speed > 1000)
      issue('features', 'Movement speed must be a whole number from 0 to 1000.')
    else next.combat.speed = d.speed
  }
  for (const review of r.existingReviews ?? [])
    if (!d.reviewed[review.id])
      issue('features', `Review level-based changes in ${review.name}.`)
  if (r.progressionSummary && r.scaling?.length) {
    const id = `srd:${r.index}:scaling`,
      current = next.features.find((f) => f.featureId === id)
    if (current)
      Object.assign(current, {
        description: r.progressionSummary,
        level: classLevel,
      })
    else
      next.features.push({
        featureId: id,
        name: `${r.name} progression`,
        description: r.progressionSummary,
        level: classLevel,
        origin: 'class',
      })
  }
  let resolved = applyWorkshopRules(next)
  // Slots and allowances are class-level based. Multiclass combined slots are
  // calculated separately; Pact Magic needs separate pools the old sheet lacks.
  let maxima = r.casting?.slots,
    slotMode: 'automatic' | 'manual' = 'automatic'
  if (entries.length > 1) {
    const casting = entries.filter((e) => {
      const rule = standardClasses[ruleName(e.name)]
      return rule?.casting && (rule.casting !== 'half' || e.level >= 2)
    })
    const customCaster = entries.some((e) =>
      base.homebrew?.bindings.some(
        (b) =>
          ruleName(b.className) === ruleName(e.name) && b.rule.magic.enabled,
      ),
    )
    if (
      casting.some(
        (e) => standardClasses[ruleName(e.name)]?.casting === 'pact',
      ) &&
      (casting.length > 1 || customCaster)
    ) {
      issue(
        'magic',
        'Pact Magic and Spellcasting need separate slot pools. This sheet cannot safely represent both yet; use the manual editor for this multiclass.',
      )
      maxima = undefined
    } else if (customCaster || (r.workshop?.magic.enabled && casting.length)) {
      slotMode = 'manual'
      maxima = d.manualSlots
      if (!d.slotsReviewed)
        issue(
          'magic',
          'Enter and review your custom combined slot progression.',
        )
    } else if (casting.length === 1) {
      const caster = casting[0]!,
        kind = standardClasses[ruleName(caster.name)]!.casting!
      maxima = slotMaximums(
        kind === 'half' ? 'half' : kind === 'pact' ? 'pact' : 'full',
        caster.level,
      )
    } else if (casting.length > 1) {
      const casterLevel = casting.reduce(
        (sum, e) =>
          sum +
          (standardClasses[ruleName(e.name)]?.casting === 'half'
            ? Math.floor(e.level / 2)
            : e.level),
        0,
      )
      maxima = slotMaximums('full', casterLevel)
    }
  }

  const pactOnly =
    entries.some(
      (e) => standardClasses[ruleName(e.name)]?.casting === 'pact',
    ) &&
    !entries.some((e) => {
      const kind = standardClasses[ruleName(e.name)]?.casting
      return kind && kind !== 'pact'
    })
  const pactSpent = pactOnly
    ? Object.values(base.spellcasting.slots).reduce(
        (sum, s) => sum + (s?.used ?? 0),
        0,
      )
    : 0
  if (maxima) {
    delete resolved.spellcasting.slotRule
    for (let i = 1; i <= 9; i++) {
      const key = `l${i}`,
        max = maxima[key] ?? 0,
        used = pactOnly
          ? max > 0
            ? pactSpent
            : 0
          : (base.spellcasting.slots[key]?.used ?? 0)
      if (!Number.isInteger(max) || max < used || max > 99)
        issue(
          'magic',
          `Level ${i} slots: total must be a whole number, at least ${used} spent, and no more than 99.`,
        )
      resolved.spellcasting.slots[key] = {
        max,
        used,
        recovery: entries.some(
          (e) => standardClasses[ruleName(e.name)]?.casting === 'pact',
        )
          ? 'short'
          : 'long',
      }
    }
  }
  if (r.casting) {
    resolved.spellcasting.ability =
      entries.filter((e) => standardClasses[ruleName(e.name)]?.casting)
        .length <= 1
        ? r.casting.ability
        : base.spellcasting.ability
    if (d.spells.length !== r.casting.spells + d.removedSpells.length)
      issue(
        'magic',
        `Choose ${r.casting.spells + d.removedSpells.length} new levelled spell${r.casting.spells === 1 ? '' : 's'}.`,
      )
    if (d.cantrips.length !== r.casting.cantrips)
      issue(
        'magic',
        `Choose ${r.casting.cantrips} new cantrip${r.casting.cantrips === 1 ? '' : 's'}.`,
      )
    if (
      d.removedSpells.length > (r.casting.replacements ?? 0) ||
      d.removedSpells.some(
        (id) =>
          !base.spellcasting.known.includes(id) ||
          !r.casting?.eligible?.some((s) => s.id === id && s.level > 0),
      )
    )
      issue(
        'magic',
        'Only an eligible levelled spell can be replaced at this class level.',
      )
    for (const [kind, ids] of [
      ['spells', d.spells],
      ['cantrips', d.cantrips],
    ] as const) {
      if (new Set(ids).size !== ids.length)
        issue('magic', 'Choose different spells.')
      for (const id of ids) {
        const spell = r.casting.eligible?.find((s) => s.id === id)
        if (
          !spell ||
          base.spellcasting.known.includes(id) ||
          spell.level > r.casting.maxSpellLevel ||
          (kind === 'cantrips' ? spell.level !== 0 : spell.level === 0)
        )
          issue(
            'magic',
            `${id}: select an eligible new ${kind === 'cantrips' ? 'cantrip' : 'spell'} from this class’s list.`,
          )
      }
    }
    if (!d.magicReviewed)
      issue('magic', 'Review spell learning, preparation, and casting changes.')
    resolved.spellcasting.known = [
      ...new Set([
        ...base.spellcasting.known.filter(
          (id) => !d.removedSpells.includes(id),
        ),
        ...d.spells,
        ...d.cantrips,
      ]),
    ]
    resolved.spellcasting.prepared = base.spellcasting.prepared.filter((id) =>
      resolved.spellcasting.known.includes(id),
    )
  }
  const selectedFeatures = [
    ...base.features.flatMap((f) => [f.name, ...(f.selectedOptions ?? [])]),
    ...d.customFeatures.map((f) => f.name),
    ...Object.values(d.choices).flat(),
  ].map(ruleName)
  const granted = (r.grantedSpells ?? []).filter(
    (s) =>
      !s.requires?.length ||
      s.requires.every(
        (req) =>
          selectedFeatures.includes(ruleName(req.id)) ||
          selectedFeatures.includes(ruleName(req.name)),
      ),
  )
  if (r.grantedSpells?.some((s) => s.requires?.length) && !granted.length)
    issue(
      'features',
      'These subclass spells require a saved subclass path. Select its feature choice, or record the exact path name under Additional grants.',
    )
  const chosenSpells = r.features.flatMap((f) =>
    (d.choices[f.id] ?? []).flatMap((id) => {
      const spell = f.options?.find((o) => o.id === id)?.spell
      return spell ? [spell] : []
    }),
  )
  resolved.spellcasting.known = [
    ...new Set([
      ...resolved.spellcasting.known,
      ...granted.map((s) => s.id),
      ...chosenSpells,
    ]),
  ]
  resolved.spellcasting.prepared = [
    ...new Set([
      ...resolved.spellcasting.prepared,
      ...granted.filter((s) => s.prepared).map((s) => s.id),
    ]),
  ]
  for (const f of r.features.filter((f) => /mystic arcanum/i.test(f.name))) {
    const id = `arcanum:${f.name.match(/\d+/)?.[0]}`
    if (!resolved.resources?.some((v) => v.id === id))
      (resolved.resources ??= []).push({
        id,
        name: f.name,
        max: 1,
        used: 0,
        recovery: 'long',
        notes: 'Cast the chosen arcanum once without expending a spell slot.',
      })
  }
  for (const id of d.extraSpells)
    if (!r.extraSpellOptions?.includes(id))
      issue(
        'magic',
        `${id}: load and select a spell definition before adding the grant.`,
      )
  if (d.extraSpells.length && !d.notes.trim())
    issue(
      'review',
      'Record the source and casting limits of extra spell grants in advancement notes.',
    )
  resolved.spellcasting.known = [
    ...new Set([...resolved.spellcasting.known, ...d.extraSpells]),
  ]
  for (const resource of d.customResources) {
    if (
      base.resources?.some((r) => r.id === resource.id) ||
      d.customResources.filter((r) => r.id === resource.id).length > 1
    )
      issue('features', 'New resource trackers need distinct identifiers.')
    if (
      !resource.name.trim() ||
      !Number.isInteger(resource.max) ||
      resource.max < 0 ||
      resource.max > 999
    )
      issue(
        'features',
        'Resource trackers need a name and a maximum from 0 to 999.',
      )
    else (resolved.resources ??= []).push({ ...resource, used: 0 })
  }
  resolved.resources = resourcesFor(resolved).map((r) => {
    const old = base.resources?.find((v) => v.id === r.id)
    return old ? { ...r, used: old.used } : r
  })
  for (const r of resolved.resources)
    if (r.used > r.max && !r.unlimited)
      issue(
        'features',
        `${r.name}: the new maximum is below already-spent uses. Review its rule.`,
      )
  if (d.notes.trim())
    resolved.personality.notes = [
      base.personality.notes,
      `Level ${newLevel} (${d.className} ${classLevel})\n${d.notes.trim()}`,
    ]
      .filter(Boolean)
      .join('\n\n')
  for (const c of resolved.homebrew?.conflicts ?? [])
    if (!base.homebrew?.conflicts.some((v) => v.id === c.id))
      issue('features', c.message)
  return {
    next: resolved,
    issues,
    classLevel,
    newLevel,
    hpGain,
    retro,
    hpDelta,
    conChange,
    slotMode,
    proficiency: {
      before: profBonus(base.meta.level),
      after: profBonus(newLevel),
    },
    pending: Object.values(issues).flat(),
  }
}

/** Both the picker and final planner enforce eligibility. Text-only prerequisites
 * remain visible for explicit review rather than being silently guessed. */
export function advancementOptionProblem(
  base: Character,
  r: AdvancementRules,
  d: AdvancementDecisions,
  f: AdvancementFeature,
  o: AdvancementOption,
): string | undefined {
  const allFeatures = [
    ...base.features.map((v) => ruleName(v.name)),
    ...r.features
      .filter((v) => v.id !== f.id)
      .flatMap((v) =>
        (d.choices[v.id] ?? []).map((id) =>
          ruleName(v.options?.find((x) => x.id === id)?.name ?? id),
        ),
      ),
  ]
  if (
    o.skill &&
    /expertise/i.test(f.name) &&
    (base.skills[o.skill] === 'expert' ||
      (base.skills[o.skill] !== 'prof' &&
        !r.features
          .filter((v) => v.id !== f.id && v.skillMode === 'prof')
          .some((v) =>
            (d.choices[v.id] ?? []).includes(
              'skill-' +
                o.skill!.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase()),
            ),
          )))
  )
    return 'Choose a skill you are proficient in, without existing expertise.'
  if (
    o.skill &&
    f.skillMode === 'prof' &&
    base.skills[o.skill] &&
    base.skills[o.skill] !== 'none'
  )
    return 'Already proficient in this skill.'
  if (
    o.tool &&
    /expertise/i.test(f.name) &&
    !base.proficiencies.tools.some((t) => ruleName(t) === ruleName(o.tool!))
  )
    return 'Requires proficiency in these tools.'
  if (
    /expertise/i.test(f.name) &&
    o.tool &&
    base.features.some(
      (v) =>
        v.selectedOptions?.includes(o.id) ||
        ruleName(v.name) === ruleName(`${f.name}: ${o.name}`),
    )
  )
    return 'Expertise already selected for these tools.'
  if (
    !o.skill &&
    !o.tool &&
    !o.training &&
    allFeatures.includes(ruleName(o.name))
  )
    return 'This option is already on the character.'
  if (
    o.spell &&
    [
      ...base.spellcasting.known,
      ...d.spells,
      ...d.cantrips,
      ...r.features
        .filter((other) => other.id !== f.id)
        .flatMap((other) =>
          (d.choices[other.id] ?? []).flatMap((id) => {
            const spell = other.options?.find((v) => v.id === id)?.spell
            return spell ? [spell] : []
          }),
        ),
    ].includes(o.spell)
  )
    return 'This spell is already known or selected.'
  for (const req of o.requirements ?? []) {
    if (req.level && r.classLevel < req.level)
      return `Requires ${r.name} level ${req.level}.`
    if (
      req.spell &&
      ![...base.spellcasting.known, ...d.cantrips, ...d.spells].includes(
        req.spell,
      )
    )
      return `Requires ${req.spell.replace(/-/g, ' ')}.`
    if (
      req.feature &&
      !base.features.some(
        (v) =>
          v.selectedOptions?.includes(req.feature!) ||
          ruleName(v.name).replace(/[^a-z0-9]+/g, '-') === req.feature,
      ) &&
      !Object.values(d.choices).some((ids) => ids.includes(req.feature!))
    )
      return `Requires ${req.feature.replace(/-/g, ' ')}.`
  }
  return undefined
}
