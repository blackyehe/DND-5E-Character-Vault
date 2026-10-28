import { api } from './api'
import {
  srd,
  type SrdRef,
  type SrdLevel,
  type SrdClass,
  type HomebrewClass,
  type HomebrewSubclass,
} from './srd'
import type { Character } from '../../shared/character'
import {
  standardClasses,
  targetClasses,
  type AdvancementDecisions,
  type AdvancementFeature,
  type AdvancementRules,
} from '../../shared/level-up'
import { ruleName } from '../../shared/workshop-character'
import {
  scheduleAt,
  workshopSlots,
  type WorkshopDraft,
} from '../../shared/homebrew-workshop'
import { raceFeatures } from '../../shared/workshop-race'
import { abilityMod } from './calc'
import { sortSpellsByLevel } from './advancement-discovery'
import { subclassMatchesClass } from '../../shared/subclass-identity'

export interface AdvancementCatalog {
  character?: Character
  libraryRevision?: string
  rules: (SrdRef & { workshop: WorkshopDraft })[]
  classes: HomebrewClass[]
  subclasses: HomebrewSubclass[]
  feats: {
    index: string
    name: string
    description: string
    prerequisites?: unknown[]
    ability_increases?: unknown[]
    sourcePack?: string
  }[]
  spells: (SrdRef & { level: number })[]
}
type Detail = SrdRef & {
  desc: string[]
  level?: number
  feature_specific?: Record<string, unknown>
  prerequisites?: {
    type: string
    level?: number
    spell?: string
    feature?: string
  }[]
}
type Choice = { choose: number; from: { options?: { item?: SrdRef }[] } }
const skillKey = (s: string) =>
  s
    .replace(/^skill-/, '')
    .replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
const slug = (s: string) => ruleName(s).replace(/[^a-z0-9]+/g, '-')
export async function advancementCatalog(
  id: string,
): Promise<AdvancementCatalog> {
  return api.get<AdvancementCatalog>(
    `/api/characters/${id}/advancement-options`,
    { timeoutMs: 60000 },
  )
}
export async function loadAdvancementRules(
  c: Character,
  d: AdvancementDecisions,
  catalog: AdvancementCatalog,
): Promise<AdvancementRules> {
  const entries = targetClasses(c, d),
    entry = entries.find((e) => ruleName(e.name) === ruleName(d.className))!,
    old = entry.level - 1,
    key = slug(d.className),
    standard = standardClasses[key]
  const saved = c.homebrew?.bindings.find(
    (b) =>
      b.rule.kind === 'class' &&
      ruleName(b.className) === ruleName(d.className),
  )
  const authored =
    catalog.rules.find(
      (r) =>
        r.workshop.kind === 'class' &&
        (d.classIndex
          ? r.index === d.classIndex
          : r.workshop.name === d.className),
    )?.workshop ??
    (!d.classIndex || d.classIndex === saved?.index ? saved?.rule : undefined)
  const imported = catalog.classes.find((r) =>
    d.classIndex ? r.index === d.classIndex||r.aliases?.includes(d.classIndex) : r.name === d.className,
  )
  // A saved imported class named like a standard class must not silently fall
  // through to SRD progression when its authored rules differ.
  const useStandard = !!standard && !authored && !imported
  let definition: SrdClass | undefined,
    levels: SrdLevel[] = [],
    previous: SrdLevel | undefined,
    current: SrdLevel | undefined
  if (useStandard) {
    ;[definition, levels] = await Promise.all([
      srd.class(key),
      srd.classLevels(key),
    ])
    previous = levels.find((l) => l.level === old)
    current = levels.find((l) => l.level === entry.level)
    if (!current)
      throw new Error(
        'The class progression for this level is unavailable. Retry before continuing.',
      )
  }
  const subclassRules = catalog.rules.filter(
    (r) =>
      r.workshop.kind === 'subclass' &&
      subclassMatchesClass(r,{...imported,index:d.classIndex,name:d.className}),
  )
  const subclasses = [
    ...(definition?.subclasses ?? []),
    ...catalog.subclasses
      .filter((s) => subclassMatchesClass(s,{...imported,index:d.classIndex,name:d.className}))
      .map((s) => ({ index: s.index, name: s.name })),
    ...subclassRules.map((s) => ({ index: s.index, name: s.name })),
  ]
  const r: AdvancementRules = {
    name: d.className,
    index: d.classIndex || key,
    hitDie: authored?.hitDie ?? imported?.hit_die ?? definition?.hit_die ?? 0,
    source: authored
      ? 'Saved Workshop definition'
      : imported
        ? `Imported rules · ${imported.sourcePack}`
        : '2014 SRD',
    classLevel: entry.level,
    subclassLevel: authored?.subclassLevel ?? standard?.subclassLevel ?? 1,
    subclasses: [...new Map(subclasses.map((s) => [s.index, s])).values()],
    features: [],
    asi:
      authored?.asiLevels.includes(entry.level) ??
      (useStandard
        ? (key === 'fighter'
            ? [4, 6, 8, 12, 14, 16, 19]
            : key === 'rogue'
              ? [4, 8, 10, 12, 16, 19]
              : [4, 8, 12, 16, 19]
          ).includes(entry.level)
        : !!imported?.homebrew_traits.some(
            (f) =>
              f.level === entry.level &&
              /ability score improvement/i.test(f.name),
          )),
    warnings: [],
    workshop: authored,
  }
  const prerequisites = (detail: Detail) =>
    detail.prerequisites?.map((p) => ({
      level: p.type === 'level' ? p.level : undefined,
      spell: p.spell?.split('/').pop(),
      feature: p.feature?.split('/').pop(),
    }))
  const prerequisiteText = (detail: Detail) =>
    prerequisites(detail)?.map((p) =>
      p.level
        ? `${d.className} level ${p.level}`
        : (p.spell ?? p.feature ?? 'See source prerequisites').replace(
            /-/g,
            ' ',
          ),
    )
  const feature = async (
    ref: SrdRef,
    origin: 'class' | 'subclass' = 'class',
  ): Promise<AdvancementFeature> => {
    const detail = (await srd.feature(ref.index)) as Detail,
      options = (detail.feature_specific?.subfeature_options ??
        detail.feature_specific?.expertise_options) as Choice | undefined
    const choices = await Promise.all(
      (options?.from.options ?? [])
        .flatMap((o) => (o.item ? [o.item] : []))
        .map(async (item) => {
          const skill = item.index.startsWith('skill-')
              ? skillKey(item.index)
              : undefined,
            tool = /thieves/i.test(item.name) ? "Thieves' tools" : undefined
          if (skill || tool)
            return {
              id: item.index,
              name: item.name.replace(/^Skill: /, ''),
              description: tool
                ? 'Expertise in thieves’ tools; retained as a feature for tool checks.'
                : '',
              skill,
              tool,
            }
          const child = (await srd.feature(item.index)) as Detail
          return {
            id: item.index,
            name: item.name,
            description: child.desc.join('\n\n'),
            prerequisites: prerequisiteText(child),
            requirements: prerequisites(child),
          }
        }),
    )
    return {
      id: ref.index,
      name: detail.name,
      description: detail.desc.join('\n\n'),
      level: entry.level,
      origin,
      choose: options?.choose,
      options: choices,
    }
  }
  if (useStandard)
    r.features = await Promise.all(
      (current!.features ?? [])
        .filter((f) => !/ability.score.improvement/i.test(f.name))
        .map((f) => feature(f)),
    )
  function addWorkshop(w: WorkshopDraft) {
    for (const f of w.features.filter((f) => f.level === entry.level))
      r.features.push({
        id: `${w.id}:${f.id}`,
        name: f.name,
        description: f.description,
        level: f.level,
        origin: w.kind === 'subclass' ? 'subclass' : 'class',
        choose: f.choice ? f.choose : undefined,
        options: f.options.map((name) => ({ id: name, name, description: '' })),
        ruleId: w.id,
        featureId: f.id,
      })
  }
  if (authored) {
    addWorkshop(authored)
    r.bindings = [{ index: r.index, rule: authored }]
    if (old === 0)
      r.blocked = [
        'This custom class has no structured multiclass prerequisites or limited proficiency grants. Define and review them in the manual editor before advancing.',
      ]
  }
  if (useStandard && old === 0) {
    const mc = definition!.multi_classing as {
      proficiencies: SrdRef[]
      proficiency_choices?: Choice[]
    }
    r.grants = { armor: [], weapons: [], tools: [], languages: [] }
    for (const p of mc.proficiencies ?? []) {
      const group = /armor|shield/.test(p.index)
        ? 'armor'
        : /weapon/.test(p.index)
          ? 'weapons'
          : 'tools'
      r.grants[group]!.push(p.name)
    }
    for (const [i, choice] of (mc.proficiency_choices ?? []).entries())
      r.features.push({
        id: `multiclass:${i}`,
        name: 'Multiclass proficiency choice',
        description:
          'Choose only the limited training granted when entering this class. No saving throws or starting equipment are granted.',
        origin: 'class',
        level: 1,
        choose: choice.choose,
        skillMode: 'prof',
        options: (choice.from.options ?? []).flatMap((o) =>
          o.item
            ? [
                {
                  id: o.item.index,
                  name: o.item.name.replace(/^Skill: /, ''),
                  description: '',
                  skill: o.item.index.startsWith('skill-')
                    ? skillKey(o.item.index)
                    : undefined,
                  tool: !o.item.index.startsWith('skill-')
                    ? o.item.name
                    : undefined,
                  training: true,
                },
              ]
            : [],
        ),
      })
  }
  if (imported && !authored) {
    r.blocked = [
      'This imported class has no complete advancement definition. Publish its hit die, ASI schedule, features, and spell progression in Workshop before using guided level up.',
    ]
    r.features.push(
      ...imported.homebrew_traits
        .filter(
          (f) =>
            f.level === entry.level &&
            !/ability score improvement/i.test(f.name),
        )
        .map((f, i) => ({
          id: `import:${i}`,
          name: f.name,
          description: f.description,
          origin: 'class' as const,
          level: entry.level,
        })),
    )
    r.warnings.push(
      'This imported class has descriptive traits but no complete Workshop progression. Confirm its hit die, advancement schedule, spell allowances, and resources against the source; add missing grants below. Publish its progression in Workshop for automatic future levels.',
    )
  }
  if (!standard && !authored && !imported)
    throw new Error(
      'No class definition matches this character. Link its imported class in Edit character → Rules & choices first.',
    )
  const subclassIndex =
    d.subclassIndex ||
    entry.subclassIndex ||
    (entries.length === 1 ? c.meta.subclassIndex : '') ||
    r.subclasses.find(
      (s) =>
        ruleName(s.name) ===
        ruleName(
          d.subclass ||
            entry.subclass ||
            (entries.length === 1 ? c.meta.subclass : ''),
        ),
    )?.index
  if (subclassIndex) {
    const workshop =
        subclassRules.find((s) => s.index === subclassIndex)?.workshop ??
        c.homebrew?.bindings.find(
          (b) => b.rule.kind === 'subclass' && b.index === subclassIndex,
        )?.rule,
      custom = catalog.subclasses.find((s) => s.index === subclassIndex||s.aliases?.includes(subclassIndex))
    if (workshop) {
      addWorkshop(workshop)
      ;(r.bindings ??= []).push({ index: subclassIndex, rule: workshop })
      if (workshop.magic.enabled && (!authored || !authored.magic.enabled))
        r.workshop = workshop
    } else if (custom) {
      r.warnings.push(
        `${custom.name} has descriptive subclass rules. Record any choices, spellcasting, or proficiencies not structured in its traits.`,
      )
      r.features.push(
        ...custom.traits
          .filter((f) => f.level === entry.level)
          .map((f, i) => ({
            id: `sub:${i}`,
            name: f.name,
            description: f.description,
            level: entry.level,
            origin: 'subclass' as const,
          })),
      )
    } else {
      const [subLevels, subDefinition] = await Promise.all([
        srd.subclassLevels(subclassIndex),
        srd.subclass(subclassIndex),
      ])
      const subSpells =
        (
          subDefinition as SrdRef & {
            spells?: {
              prerequisites: { type: string; index: string; name: string }[]
              spell: SrdRef
            }[]
          }
        ).spells ?? []
      const spellGrants = subSpells.filter((s) =>
        s.prerequisites.some(
          (p) =>
            p.type === 'level' &&
            Number(p.index.split('-').pop()) === entry.level,
        ),
      )
      if (key === 'warlock') {
        r.spellListExtras = subSpells
          .filter((s) =>
            s.prerequisites.every(
              (p) =>
                p.type !== 'level' ||
                Number(p.index.split('-').pop()) <= entry.level,
            ),
          )
          .map((s) => s.spell.index)
        if (spellGrants.length)
          r.warnings.push(
            'Your patron expands your class spell list. Expanded spells are available choices, not automatically learned spells.',
          )
      } else if (spellGrants.length) {
        r.grantedSpells = spellGrants.map((s) => ({
          id: s.spell.index,
          name: s.spell.name,
          prepared: true,
          requires: s.prerequisites
            .filter((p) => p.type === 'feature')
            .map((p) => ({ id: p.index, name: p.name })),
        }))
        r.features.push({
          id: 'subclass-spell-grants',
          name: 'Subclass spell grants',
          description:
            spellGrants
              .map(
                (s) =>
                  `${s.spell.name}${
                    s.prerequisites.some((p) => p.type === 'feature')
                      ? ` (${s.prerequisites
                          .filter((p) => p.type === 'feature')
                          .map((p) => p.name)
                          .join(', ')})`
                      : ''
                  }`,
              )
              .join('\n') +
            '\nThese spells are always prepared and do not count against ordinary preparation. Only the selected subclass path is applied.',
          origin: 'subclass',
          level: entry.level,
        })
      }
      r.features.push(
        ...(await Promise.all(
          subLevels
            .filter((l) => l.level === entry.level)
            .flatMap((l) => l.features)
            .map((f) => feature(f, 'subclass')),
        )),
      )
    }
  } else if (old > 0 && c.meta.subclass && entry.level >= r.subclassLevel)
    r.warnings.push(
      `“${c.meta.subclass}” has no matching subclass definition. Its features cannot be added automatically; record this level’s grants below.`,
    )
  const magic = r.workshop?.magic
  if (magic?.enabled && entry.level >= magic.startsAt) {
    const slots = workshopSlots(r.workshop!, entry.level)
    r.casting = {
      ability: magic.ability,
      learning: magic.learning,
      cantrips: Math.max(
        0,
        scheduleAt(magic.cantrips, entry.level) -
          scheduleAt(magic.cantrips, old),
      ),
      spells:
        magic.learning === 'prepared'
          ? 0
          : Math.max(
              0,
              scheduleAt(magic.spells, entry.level) -
                scheduleAt(magic.spells, old),
            ),
      maxSpellLevel: Math.max(
        0,
        ...Object.entries(slots)
          .filter(([, v]) => v > 0)
          .map(([key]) => Number(key.slice(1))),
      ),
      slots,
    }
  } else if (useStandard && current?.spellcasting) {
    const sc = current.spellcasting,
      prev = previous?.spellcasting,
      slots = Object.fromEntries(
        Array.from({ length: 9 }, (_, i) => [
          `l${i + 1}`,
          sc[`spell_slots_level_${i + 1}`] ?? 0,
        ]),
      )
    r.casting = {
      ability: standard!.ability ?? c.spellcasting.ability,
      learning:
        key === 'wizard'
          ? 'book'
          : ['cleric', 'druid', 'paladin'].includes(key)
            ? 'prepared'
            : 'known',
      cantrips: Math.max(
        0,
        (sc.cantrips_known ?? 0) - (prev?.cantrips_known ?? 0),
      ),
      spells:
        key === 'wizard'
          ? old === 0
            ? 6
            : 2
          : Math.max(0, (sc.spells_known ?? 0) - (prev?.spells_known ?? 0)),
      maxSpellLevel: Math.max(
        0,
        ...Object.entries(slots)
          .filter(([, n]) => n > 0)
          .map(([key]) => Number(key.slice(1))),
      ),
      slots,
      replacements:
        ['bard', 'ranger', 'sorcerer', 'warlock'].includes(key) && old > 0
          ? 1
          : 0,
    }
  }
  // Mystic Arcana and Magical Secrets are separate feature choices, not generic
  // spells known from this class's ordinary list or higher multiclass slots.
  const specialSpells = r.features.filter((f) =>
    /mystic arcanum|magical secrets/i.test(f.name),
  )
  if (specialSpells.length) {
    const [all, classList] = await Promise.all([
      srd.spells() as Promise<(SrdRef & { level: number })[]>,
      srd.classSpells(key),
    ])
    for (const f of specialSpells) {
      const arcanum = /mystic arcanum/i.test(f.name),
        rank = arcanum
          ? Number(f.name.match(/\d+/)?.[0])
          : Math.min(9, Math.ceil(entry.level / 2))
      f.choose = arcanum ? 1 : 2
      f.options = sortSpellsByLevel(all)
        .filter((s) =>
          arcanum
            ? s.level === rank && classList.some((v) => v.index === s.index)
            : s.level <= rank,
        )
        .map((s) => ({
          id: s.index,
          name: s.name,
          description: `${s.level === 0 ? 'Cantrip' : `Level ${s.level} spell`}. ${arcanum ? 'Cast this arcanum once per long rest without a slot.' : 'Counts as a bard spell for you.'}`,
          spell: s.index,
        }))
      if (arcanum) {
        r.warnings.push(
          `${f.name} uses its own once-per-long-rest allowance, not Pact Magic slots. A dedicated tracker is added.`,
        )
      } else if (f.origin === 'class' && r.casting)
        r.casting.spells = Math.max(0, r.casting.spells - 2)
    }
  }
  // Invocation gains are not emitted as a new feature at every known-count increase.
  if (useStandard && key === 'warlock') {
    const gained =
      (current?.class_specific?.invocations_known ?? 0) -
      (previous?.class_specific?.invocations_known ?? 0)
    if (gained > 0) {
      const inv = (await srd.feature('eldritch-invocations')) as Detail
      const options = await Promise.all(
        ((inv.feature_specific?.invocations ?? []) as SrdRef[]).map(
          async (x) => {
            const detail = (await srd.feature(x.index)) as Detail
            return {
              id: x.index,
              name: x.name,
              description: detail.desc.join('\n\n'),
              prerequisites: prerequisiteText(detail),
              requirements: prerequisites(detail),
            }
          },
        ),
      )
      r.features = r.features.filter((f) => f.id !== 'eldritch-invocations')
      r.features.push({
        id: 'invocations',
        name: 'Eldritch Invocations',
        description: inv.desc.join('\n\n'),
        origin: 'class',
        level: entry.level,
        choose: gained,
        options,
      })
    }
  }
  // Character-level racial unlocks are reviewed alongside class-level grants.
  for (const binding of c.homebrew?.bindings.filter(
    (b) => b.rule.kind === 'race',
  ) ?? []) {
    const w = binding.rule
    for (const f of raceFeatures(w).filter(
      (f) => f.level === c.meta.level + 1,
    )) {
      const choice = w.features.find((v) => v.id === f.featureId)
      r.features.push({
        id: `${w.id}:${f.featureId}`,
        name: f.name,
        description: f.description,
        origin: 'racial',
        level: f.level!,
        ruleId: w.id,
        featureId: f.featureId,
        choose: choice?.choice ? choice.choose : undefined,
        options: choice?.options.map((name) => ({
          id: name,
          name,
          description: '',
        })),
      })
    }
  }
  // Display numerical feature scaling even when the API emits no new feature.
  const value = (v: unknown): string => {
    if (!v || typeof v !== 'object') return String(v)
    if (Array.isArray(v)) return v.map(value).join('; ')
    const record = v as Record<string, unknown>
    if (
      typeof record.dice_count === 'number' &&
      typeof record.dice_value === 'number'
    )
      return `${record.dice_count}d${record.dice_value}`
    return Object.entries(record)
      .map(([key, entry]) => `${key.replace(/_/g, ' ')}: ${value(entry)}`)
      .join(', ')
  }
  r.scaling = Object.entries(current?.class_specific ?? {})
    .filter(([key, v]) => value(v) !== value(previous?.class_specific?.[key]))
    .map(([key, v]) => ({
      name: key.replace(/_/g, ' '),
      before:
        previous?.class_specific?.[key] === undefined
          ? '-'
          : value(previous.class_specific[key]),
      after: value(v),
    }))
  r.progressionSummary = Object.entries(current?.class_specific ?? {})
    .map(([key, v]) => `${key.replace(/_/g, ' ')}: ${value(v)}`)
    .join('\n')
  r.existingReviews = c.features
    .filter(
      (f) =>
        (f.origin === 'racial' ||
          f.origin === 'feat' ||
          f.origin === 'other') &&
        /level/i.test(f.description) &&
        !r.features.some((v) => ruleName(v.name) === ruleName(f.name)),
    )
    .map((f, i) => ({
      id: `existing:${f._id ?? i}`,
      name: f.name,
      description: f.description,
    }))
  // Keep eligibility transparent: prerequisites expressed only as rule text are
  // shown with the option and require review rather than being assumed satisfied.
  if (r.features.some((f) => f.options?.some((o) => o.prerequisites?.length)))
    r.warnings.push(
      'Some feature options have prerequisites. Their rule text is shown; confirm level, spell, and earlier-feature requirements before selecting them.',
    )
  if (
    r.features.some(
      (f) => /choose|choice|select/i.test(f.description) && !f.choose,
    )
  )
    r.warnings.push(
      'Some choices are described only in the rule text. Record their named options and mechanical grants under Additional grants before marking the feature reviewed.',
    )
  if (r.workshop?.magic.enabled && !r.workshop.magic.spellList.length)
    r.warnings.push(
      'This Workshop definition has no spell list. Confirm every spell choice against your class source before proceeding.',
    )
  const castingAbilities = entries.flatMap((e) => {
    const custom = c.homebrew?.bindings.find(
      (b) => ruleName(b.className) === ruleName(e.name) && b.rule.magic.enabled,
    )?.rule.magic
    const standardRule = standardClasses[ruleName(e.name)]
    return custom
      ? [custom.ability]
      : standardRule?.casting &&
          (standardRule.casting !== 'half' || e.level >= 2)
        ? [standardRule.ability!]
        : []
  })
  if (new Set(castingAbilities).size > 1)
    (r.blocked ??= []).push(
      'This multiclass uses different spellcasting abilities. The current sheet stores one casting ability, so guided advancement cannot safely represent its separate spell attacks and save DCs yet.',
    )
  if (entries.length > 1)
    r.warnings.push(
      'Spells are learned by individual class level, not combined slot level. No starting equipment or saving-throw proficiencies are granted for multiclassing. Review the limited multiclass proficiencies below.',
    )
  if (r.casting?.learning === 'prepared')
    r.warnings.push(
      `Prepared spells may be changed after a long rest. Review your preparation allowance using your new ${r.casting.ability.toUpperCase()} modifier; levelling does not grant a free rest.`,
    )
  return r
}

export function preparedLimit(c: Character, r: AdvancementRules) {
  if (!r.casting || r.casting.learning !== 'prepared') return null
  const k = ruleName(r.name),
    magic = r.workshop?.magic
  if (magic?.enabled)
    return Math.max(
      1,
      abilityMod(c.abilities[r.casting.ability]) +
        (magic.preparedLevel === 'full'
          ? r.classLevel
          : magic.preparedLevel === 'half'
            ? Math.floor(r.classLevel / 2)
            : 0) +
        magic.preparedBase,
    )
  return Math.max(
    1,
    abilityMod(c.abilities[r.casting.ability]) +
      (k === 'paladin' ? Math.floor(r.classLevel / 2) : r.classLevel),
  )
}
