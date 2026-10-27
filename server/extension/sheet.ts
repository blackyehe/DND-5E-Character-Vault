import type { Character } from '../../shared/character'
import { partyMemberSnapshot } from '../../shared/party-dashboard'
import { availableBenefitSpells, characterBenefitRows, benefitSummary, benefitTitle, characterBenefits, benefitSpellAttack, benefitSpellDC } from '../../shared/rule-benefits'
import { innateRaceSpells } from '../../shared/workshop-race'
import { ABILITY_KEYS, SKILL_ABILITY, abilityMod, profBonus, carriedWeight } from '../../src/lib/calc'
import { sheetSkill, sheetSave, sheetInitiative, sheetProficiencies, pretty } from '../../src/lib/character-sheet'
import { combatAttacks, inventoryKind } from '../../src/lib/equipment'
import { spellReferenceLabel } from '../../src/lib/spell-reference'
import { sheetReferences } from '../lib/sheet-references'
import type { WorkshopLibrary } from '../lib/workshop-library'

export const identity = (c: { _id: unknown; meta: { name: string; klass: string; level: number; race: string } }) => ({ id: String(c._id), name: c.meta.name, klass: c.meta.klass, level: c.meta.level, ancestry: c.meta.race })
export function vitals(c: Character) {
  const s = partyMemberSnapshot(c)
  return { ...identity(c), updatedAt: s.updatedAt, hp: s.hp, ac: s.ac, perception: s.perception, speed: s.speed, inspiration: s.inspiration,
    ...(s.saveDC === undefined ? {} : { saveDC: s.saveDC }),
    trackers: { hitDice: { total: c.combat.hitDiceTotal, used: c.combat.hitDiceUsed }, deathSaves: { successes: c.combat.deathSavesSuccess, failures: c.combat.deathSavesFailure } },
    slots: s.slots.map(slot => ({ key: slot.key, max: slot.max, used: slot.used })),
    resources: s.resources.map(r => ({ id: r.id, name: r.name, max: r.max, used: r.used, unlimited: !!r.unlimited })) }
}
const text = (value: unknown) => typeof value === 'string' ? value : ''
const lines = (value: unknown): string[] => typeof value === 'string' ? [value] : Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
const name = (value: unknown) => value && typeof value === 'object' ? text((value as Record<string, unknown>).name) : text(value)

/** Explicit display-only projection. No raw character, pack, account, import,
 * workshop draft, or executable HTML leaves this boundary. All rule calculations
 * call the same website helpers used by the ordinary sheet. */
export function expandedSheet(c: Character, library: WorkshopLibrary, savedFeatureIds = c.features.map(f => String(f._id))) {
  const refs = sheetReferences(c, library), benefits = characterBenefits(c)
  const benefitFacts = [
    { label: 'Condition immunities', value: benefits.conditionImmunities.map(benefitTitle).join(', ') },
    { label: 'Saving throw advantage', value: benefits.saveAdvantage.map(benefitTitle).join(', ') },
    ...(['fly', 'swim', 'climb', 'burrow', 'darkvision', 'blindsight', 'truesight'] as const).map(key => ({ label: benefitTitle(key), value: benefits[key] ? `${benefits[key]} ft.` : '' })),
    { label: 'Attacks per Attack action', value: benefits.attacks > 1 ? String(benefits.attacks) : '' },
  ].filter(fact => fact.value)
  const benefitSources = characterBenefitRows(c).map(row => ({ source: row.source, summary: benefitSummary(row.row), active: row.active }))
  const innate = innateRaceSpells(c)
  const spells = [...new Set([...c.spellcasting.known, ...c.spellcasting.prepared, ...innate.map(s => s.index)])].map(id => {
    const definition = (refs.spells as Record<string, unknown>[]).find(s => s.index === id || s.contentKey === id || Array.isArray(s.aliases) && s.aliases.includes(id))
    const d = definition ?? {}, description = lines(d.desc), grants = innate.filter(s => s.index === id)
    return { id, name: text(d.name) || grants[0]?.name || spellReferenceLabel(id), level: typeof d.level === 'number' ? d.level : null,
      known: c.spellcasting.known.includes(id), prepared: c.spellcasting.prepared.includes(id),
      castingTime: text(d.casting_time), range: text(d.range), duration: text(d.duration), school: name(d.school), components: lines(d.components), material: text(d.material),
      concentration: d.concentration === true, ritual: d.ritual === true, description, higherLevels: lines(d.higher_level),
      source: text(d.sourcePack), fallback: d.referenceFallback === true, available: !!definition && d.definitionAvailable !== false && description.some(v => v.trim()),
      grants: grants.map(s => ({ source: s.source, ability: s.ability, usage: s.usage, needsReview: !!s.needsReview })) }
  }).sort((a, b) => (a.level ?? 99) - (b.level ?? 99) || a.name.localeCompare(b.name))
  const referenceGroups = (['feats', 'races', 'classes', 'subclasses', 'backgrounds'] as const).flatMap(kind => refs[kind].map((entry, i) => {
    const e = entry as Record<string, unknown>
    return { id: `${kind}:${i}`, kind, name: text(e.name), source: text(e.sourcePack),
      description: [...lines(e.description), ...lines(e.desc)].join('\n\n'),
      traits: (Array.isArray(e.homebrew_traits) ? e.homebrew_traits : Array.isArray(e.traits) ? e.traits : []).flatMap(value => {
        if (!value || typeof value !== 'object') return []
        const trait = value as Record<string, unknown>
        return [{ name: text(trait.name), description: [...lines(trait.description), ...lines(trait.desc)].join('\n\n'), level: typeof trait.level === 'number' ? trait.level : null }]
      }) }
  }))
  return { version: 1 as const, character: vitals(c),
    benefits: { facts: benefitFacts, sources: benefitSources },
    statistics: { initiative: sheetInitiative(c), proficiency: profBonus(c.meta.level), xp: c.meta.xp,
      abilities: ABILITY_KEYS.map(key => ({ key, score: c.abilities[key], modifier: abilityMod(c.abilities[key]), save: sheetSave(c, key), proficient: !!benefits.saves[key] })),
      skills: Object.entries(SKILL_ABILITY).map(([key, ability]) => ({ key, name: pretty(key), ability, rank: benefits.skills[key] ?? 'none', modifier: sheetSkill(c, key) })),
      proficiencies: sheetProficiencies(c),
      defenses: { resistances: benefits.resistances, immunities: benefits.immunities, vulnerabilities: benefits.vulnerabilities },
      hitDice: { total: c.combat.hitDiceTotal, used: c.combat.hitDiceUsed }, deathSaves: { successes: c.combat.deathSavesSuccess, failures: c.combat.deathSavesFailure } },
    attacks: combatAttacks(c).map((a, i) => ({ id: String(a._id ?? i), name: a.name, ability: a.ability, proficient: a.proficient, toHit: a.toHit, damage: a.text, damageType: a.damageType, range: a.range, notes: a.notes })),
    inventory: { weight: carriedWeight(c.equipment), items: c.equipment.map((item, i) => ({ id: String(item._id ?? i), name: item.name, quantity: item.qty, weight: item.weight, equipped: item.equipped,
      kind: inventoryKind(item, c), category: item.category ?? '', rarity: item.rarity ?? '', attuned: !!item.attuned, requiresAttunement: !!item.requiresAttunement,
      description: item.description ?? '', referenceDescription: item.referenceDescription ?? '', notes: item.notes, attunementRequirement: item.attunementRequirement ?? '',
      weapon: item.weapon ? { dice: item.weapon.dice, damageType: item.weapon.damageType, range: item.weapon.range } : null,
      armor: item.armor ? { base: item.armor.base, shield: item.armor.shield } : null })) },
    magic: { ability: c.spellcasting.ability, attack: benefitSpellAttack(c), saveDC: benefitSpellDC(c), spells, effects: availableBenefitSpells(c).map(d => ({ id: d.index, name: text(d.entry.name) || spellReferenceLabel(d.index), active: !!c.spellcasting.activeEffects?.includes(d.index) })) },
    features: c.features.map((f, i) => ({ id: String(f._id ?? i), name: f.name, description: f.description, origin: f.origin ?? 'other', level: f.level ?? null, pinned: !!f.pinned, pinnable: /^[a-f0-9]{24}$/i.test(String(f._id)) && savedFeatureIds.filter(id => id === String(f._id)).length === 1 && c.features.filter(other => String(other._id) === String(f._id)).length === 1, selectedOptions: f.selectedOptions ?? [] })),
    references: referenceGroups,
    biography: { background: c.meta.background, alignment: c.meta.alignment, subclass: c.meta.subclass,
      traits: c.personality.traits, ideals: c.personality.ideals, bonds: c.personality.bonds, flaws: c.personality.flaws, appearance: c.personality.appearance, backstory: c.personality.backstory, notes: c.personality.notes },
    warnings: (c.homebrew?.conflicts ?? []).map(conflict => conflict.message) }
}
