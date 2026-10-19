import { abilityMod } from './calc'
import type { AbilityScores, BuilderDraft, BuilderSpell } from './character-builder'
import type { SrdClass, SrdLevel, SrdRef } from './srd'
import { classSpellDefaults, scheduleTotal } from '../../shared/class-rules'
import { slotMaximums } from '../../shared/character-progression'
import { scheduleAt, workshopSlots } from '../../shared/homebrew-workshop'

export interface SpellPolicy {
  available: boolean
  cantrips: number | null
  spells: number | null
  prepared: number | null
  maxLevel: number | null
  arcanum: number[]
  spellLabel: string
  note: string
}
interface PolicyContext { klass: SrdClass | null; subrace: SrdRef | null; subclass: SrdRef | null; progression: SrdLevel | undefined; scores: AbilityScores }
export function spellSelectionPolicy(draft: BuilderDraft, context: PolicyContext): SpellPolicy {
  const unknown: SpellPolicy = { available: false, cantrips: null, spells: null, prepared: null, maxLevel: null, arcanum: [], spellLabel: 'Spells selected', note: 'Choose a class and wait for its spell progression to load.' }
  if (!context.klass) return unknown
  const klass = context.klass
  const customRule=context.subclass?.workshop?.magic.enabled?context.subclass.workshop:klass.workshop
  if(customRule){
    const magic=customRule.magic,active=magic.enabled&&draft.level>=magic.startsAt,slots=workshopSlots(customRule,draft.level)
    const maximum=Math.max(0,...Object.entries(slots).filter(([,n])=>n>0).map(([key])=>Number(key.slice(1))))
    const prepared=Math.max(1,(magic.preparedLevel==='full'?draft.level:magic.preparedLevel==='half'?Math.floor(draft.level/2):0)+abilityMod(context.scores[magic.ability])+magic.preparedBase)
    return {available:true,cantrips:(active?scheduleAt(magic.cantrips,draft.level):0)+(context.subrace?.index==='high-elf'?1:0),spells:active?(magic.learning==='prepared'?null:scheduleAt(magic.spells,draft.level)):0,prepared:active&&magic.learning!=='known'?prepared:null,maxLevel:maximum,arcanum:[],spellLabel:magic.learning==='book'?'Starting spellbook':magic.learning==='prepared'?'Class list available':'Spells known',note:active?`${customRule.name}: saved class rules · ${magic.ability.toUpperCase()} casting. Slots and spell allowances follow your class level.`:'This class grants no spell choices at this level.'}
  }
  const homebrew = (klass as SrdClass & { homebrew?: boolean }).homebrew
  const defaults = classSpellDefaults(klass.name)
  if (defaults) {
    const casting = (klass as SrdClass & { details?: Record<string, unknown> }).details?.[':spellcasting'] as Record<string, unknown> | undefined
    const cantrips = scheduleTotal(casting?.[':cantrips-known'], draft.level)
    const spells = scheduleTotal(casting?.[':spells-known'], draft.level)
    const slots = slotMaximums(defaults.progression, draft.level)
    return { available:true, cantrips:cantrips === null ? null : cantrips + (context.subrace?.index === 'high-elf' ? 1 : 0), spells, prepared:null,
      maxLevel:Math.max(0,...Object.entries(slots).filter(([,n])=>n>0).map(([key])=>Number(key.slice(1)))), arcanum:[], spellLabel:'Spells known',
      note:`Full caster slots; Constitution spellcasting. ${cantrips === null || spells === null ? 'This source has no complete spell-choice schedule; record spell choices manually.' : 'Spell choices use the imported class schedule.'} Feature-granted spells can use the override; shadow points are a separate pool equal to your class level.` }
  }
  const subclassCasting = (context.subclass as (SrdRef & { homebrew?: boolean }) | null)?.homebrew && ['fighter', 'rogue', 'monk', 'barbarian'].includes(klass.index)
  if (homebrew || subclassCasting) return { ...unknown, note: 'Automatic allowances are unavailable for this imported class or subclass. Enable the override to follow its rules manually.' }
  if (!context.progression) return unknown
  const casting = context.progression.spellcasting ?? {}
  const value = (key: string) => Number.isInteger(casting[key]) && casting[key]! >= 0 ? casting[key]! : 0
  const maxLevel = Math.max(0, ...Array.from({ length: 9 }, (_, i) => value(`spell_slots_level_${i + 1}`) > 0 ? i + 1 : 0))
  const racialCantrip = context.subrace?.index === 'high-elf' ? 1 : 0
  const policy: SpellPolicy = { available: true, cantrips: value('cantrips_known') + racialCantrip, spells: 0, prepared: null, maxLevel, arcanum: [], spellLabel: 'Spells known', note: 'Known spells are available without daily preparation.' }
  if (['bard', 'sorcerer', 'warlock', 'ranger'].includes(klass.index)) {
    policy.spells = value('spells_known') + (klass.index === 'bard' && context.subclass?.index === 'lore' && draft.level >= 6 ? 2 : 0)
  } else if (klass.index === 'wizard') {
    policy.spells = 6 + 2 * (draft.level - 1)
    policy.prepared = Math.max(1, draft.level + abilityMod(context.scores.int))
    policy.spellLabel = 'Starting spellbook'
    policy.note = 'Your starting book has 6 spells plus 2 per later wizard level. Prepare wizard level + Intelligence modifier (minimum 1). Copied spells and special grants can use the override.'
  } else if (['cleric', 'druid', 'paladin'].includes(klass.index)) {
    policy.spells = maxLevel > 0 ? null : 0
    policy.prepared = maxLevel > 0 ? Math.max(1, (klass.index === 'paladin' ? Math.floor(draft.level / 2) : draft.level) + abilityMod(context.scores[klass.index === 'paladin' ? 'cha' : 'wis'])) : 0
    policy.spellLabel = 'Class list available'
    policy.note = 'You have access to your class spell list. The limit applies to prepared spells, not the number of spells you can browse or record unprepared. Always-prepared domain, oath, or circle spells can use the override.'
  } else policy.note = 'This class grants no spell choices at this level. Use the override for spells granted by other features.'
  if (klass.index === 'warlock') policy.arcanum = [6, 7, 8, 9].filter((level) => (context.progression?.class_specific?.[`mystic_arcanum_level_${level}`] ?? 0) > 0)
  if (racialCantrip) policy.note += ' The cantrip allowance includes 1 High Elf cantrip.'
  return policy
}
export function spellSelectionCounts(spells: BuilderSpell[], policy: SpellPolicy) {
  return { cantrips: spells.filter((spell) => spell.level === 0).length,
    spells: spells.filter((spell) => spell.level > 0 && !policy.arcanum.includes(spell.level)).length,
    prepared: spells.filter((spell) => spell.level > 0 && spell.prepared && !policy.arcanum.includes(spell.level)).length }
}
export function spellSelectionProblems(spells: BuilderSpell[], policy: SpellPolicy): string[] {
  if (!policy.available) return spells.length ? ['Spell allowances are unavailable. Enable the override to keep these selections.'] : []
  const counts = spellSelectionCounts(spells, policy)
  const problems: string[] = []
  if (policy.cantrips !== null && counts.cantrips > policy.cantrips) problems.push(`Cantrip limit reached (${policy.cantrips}). Remove a cantrip or enable the override.`)
  if (policy.spells !== null && counts.spells > policy.spells) problems.push(`${policy.spellLabel} limit reached (${policy.spells}). Remove a spell or enable the override.`)
  if (policy.prepared !== null && counts.prepared > policy.prepared) problems.push(`Prepared spell limit reached (${policy.prepared}). Unprepare a spell or enable the override.`)
  if (policy.maxLevel !== null && spells.some((spell) => spell.level > policy.maxLevel! && !policy.arcanum.includes(spell.level))) problems.push(`This class can select spells up to level ${policy.maxLevel}. Higher-level choices need the override.`)
  for (const level of policy.arcanum) if (spells.filter((spell) => spell.level === level).length > 1) problems.push(`Choose only one level ${level} Mystic Arcanum, or enable the override.`)
  return problems
}
