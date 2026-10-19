import { classSpellDefaults } from '../../shared/class-rules'
import { applyWorkshopRules, choiceKey } from '../../shared/workshop-character'
import type { PublishedWorkshopRule } from '../../shared/homebrew-workshop'
import { resolveCharacterProgression } from '../../shared/character-progression'
import type { SpellSlotRule, CharacterResource } from '../../shared/character'
import { spellSelectionProblems, type SpellPolicy } from './spell-selection'
import { featOpportunities, type AdvancementChoice } from './advancements'
import { XP_THRESHOLDS } from './character-sheet'
import { ABILITY_KEYS, SKILL_ABILITY, abilityMod, maxHP, type AbilityKey } from './calc'
import { emptyCharacter, type Character, type EquipmentItem } from '../stores/characters'
import { contentLabel, type HomebrewTrait, type SrdClass, type SrdEquipment, type SrdRace, type SrdRef, type SrdSubrace } from './srd'

export const BUILDER_STEPS = [
  { id: 'race', title: 'Race & ancestry', short: 'Your origin', icon: 'leaf', description: 'Every story starts somewhere. Choose the people and heritage that shaped you.' },
  { id: 'class', title: 'Class & level', short: 'Your calling', icon: 'swords', description: 'Steel, spellcraft, or something in between. Find your place in the party.' },
  { id: 'abilities', title: 'Ability scores', short: 'Your strengths', icon: 'dice', description: 'Shape your strengths. Racial bonuses are included in the final scores below.' },
  { id: 'feats', title: 'Feats & advancements', short: 'Your growth', icon: 'star', description: 'Choose a feat or ability increase for each earned opportunity. Browse your imported feats here.' },
  { id: 'background', title: 'Background', short: 'Your past', icon: 'book', description: 'Before the adventure, there was a life. Decide what you bring from it.' },
  { id: 'skills', title: 'Proficiencies', short: 'Your talents', icon: 'star', description: 'Choose the skills, languages, and tools your character knows best.' },
  { id: 'spells', title: 'Spells', short: 'Your magic', icon: 'wand', description: 'Build a starting spellbook. Read a spell before adding it to your character.' },
  { id: 'equipment', title: 'Equipment', short: 'Your essentials', icon: 'bag', description: 'Pack for the road ahead. Pick starting gear and add your own essentials.' },
  { id: 'identity', title: 'Identity & story', short: 'Your character', icon: 'person', description: 'A collection of abilities becomes a character when you give them a story.' },
  { id: 'review', title: 'Review & finish', short: 'Your first chapter', icon: 'check', description: 'Take one last look. Every choice here will carry into your character sheet.' },
] as const
export type BuilderStep = typeof BUILDER_STEPS[number]['id']
export type AbilityScores = Record<AbilityKey, number>
export type BuilderTrait = HomebrewTrait
export interface BuilderSpell { index: string; name: string; level: number; description: string; prepared: boolean; source?: string }
export interface BuilderEquipment extends EquipmentItem {
  index: string
  armor_class?: SrdEquipment['armor_class']
  armor_category?: string
}
export interface BuilderDraft {
  ruleChoices:Record<string,string[]>
  version: 1
  step: BuilderStep
  name: string
  level: number
  race: string
  subrace: string
  klass: string
  subclass: string
  background: string
  customBackground: string
  method: 'standard' | 'pointBuy' | 'manual'
  scores: AbilityScores
  adjustments: AbilityScores
  skills: string[]
  additionalSkills: string[]
  expertise: string[]
  extraLanguages: string[]
  tools: string
  feats: string[]
  advancements: Record<string,AdvancementChoice>
  featLimitOverride: boolean
  racialFeatCountOverride: number|null
  spells: BuilderSpell[]
  equipment: BuilderEquipment[]
  spellLimitOverride: boolean
  spellAbility: AbilityKey | ''
  slotOverrides: Record<string, number>
  slotRule?: SpellSlotRule
  resources: CharacterResource[]
  hpOverride: number | null
  acOverride: number | null
  alignment: string
  age: string
  pronouns: string
  portrait: string
  personality: Character['personality']
}
export interface BuilderBackground extends SrdRef {
  description: string
  traits: BuilderTrait[]
  skills: string[]
  languages: number
  equipment: { equipment: SrdRef; quantity: number }[]
  suggestions: Partial<Record<'traits' | 'ideals' | 'bonds' | 'flaws', string[]>>
}
export interface BuilderContext {
  ruleDefinitions?:PublishedWorkshopRule[]
  spellPolicy?: SpellPolicy
  race: (SrdRace & { homebrew_traits?: BuilderTrait[] }) | null
  subrace: (SrdSubrace & { speed?: number; homebrew_traits?: BuilderTrait[] }) | null
  klass: SrdClass | null
  subclass: SrdRef | null
  background: BuilderBackground | null
  features: BuilderTrait[]
  fixedSkills: string[]
  skillChoice: { choose: number; options: string[] }
  proficiencies: Character['proficiencies']
  slots: Record<string, number>
  spellAbility: AbilityKey
}
export const STANDARD_SCORES: AbilityScores = { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 }
export const POINT_COST: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 }
export const signed = (value: number) => value >= 0 ? `+${value}` : String(value)
export const skillKey = (value: string) => value.replace(/^.*\//, '').replace(/^:?skill-/, '').replace(/-([a-z])/g, (_, char: string) => char.toUpperCase())

export function newBuilderDraft(): BuilderDraft {
  return {
    version: 1, ruleChoices:{}, step: 'race', name: '', level: 1, race: '', subrace: '', klass: '', subclass: '', background: '', customBackground: '',
    method: 'standard', scores: { ...STANDARD_SCORES }, adjustments: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
    skills: [], additionalSkills: [], expertise: [], extraLanguages: [], tools: '', feats: [], advancements: {}, featLimitOverride: false, racialFeatCountOverride: null, spells: [], equipment: [], spellLimitOverride: false, spellAbility: '', slotOverrides: {}, resources: [],
    hpOverride: null, acOverride: null, alignment: '', age: '', pronouns: '', portrait: '', personality: emptyCharacter().personality,
  }
}

export function restoreBuilderDraft(value: unknown): BuilderDraft {
  const fallback = newBuilderDraft()
  if (!value || typeof value !== 'object' || (value as { version?: number }).version !== 1) return fallback
  const raw = value as Record<string, unknown>
  const restored = { ...fallback }
  if(raw.ruleChoices&&typeof raw.ruleChoices==='object')restored.ruleChoices=Object.fromEntries(Object.entries(raw.ruleChoices).filter(([,v])=>Array.isArray(v)&&v.every(item=>typeof item==='string')))
  restored.spellLimitOverride = raw.spellLimitOverride === true
  restored.featLimitOverride = raw.featLimitOverride === true
  if(Number.isInteger(raw.racialFeatCountOverride)&&Number(raw.racialFeatCountOverride)>=0&&Number(raw.racialFeatCountOverride)<=10)restored.racialFeatCountOverride=Number(raw.racialFeatCountOverride)
  if(raw.advancements&&typeof raw.advancements==='object')for(const [key,value] of Object.entries(raw.advancements)){
    const choice=value as AdvancementChoice
    if(!/^(class-\d+|racial-\d+|extra-[a-z0-9-]+)$/.test(key)||!choice||!['later','asi','feat'].includes(choice.kind))continue
    restored.advancements[key]={kind:choice.kind,feat:typeof choice.feat==='string'?choice.feat:'',increases:Object.fromEntries(ABILITY_KEYS.filter(k=>typeof choice.increases?.[k]==='number').map(k=>[k,choice.increases[k]]))}
  }
  for (const key of ['name', 'race', 'subrace', 'klass', 'subclass', 'background', 'customBackground', 'tools', 'alignment', 'age', 'pronouns', 'portrait'] as const) {
    if (typeof raw[key] === 'string') restored[key] = raw[key]
  }
  if (BUILDER_STEPS.some((step) => step.id === raw.step)) restored.step = raw.step as BuilderStep
  if (['standard', 'pointBuy', 'manual'].includes(String(raw.method))) restored.method = raw.method as BuilderDraft['method']
  if (typeof raw.level === 'number') restored.level = raw.level
  for (const key of ['scores', 'adjustments'] as const) {
    const scores = raw[key] as Record<string, unknown> | undefined
    for (const ability of ABILITY_KEYS) if (typeof scores?.[ability] === 'number') restored[key][ability] = scores[ability]
  }
  for (const key of ['skills', 'additionalSkills', 'expertise', 'extraLanguages', 'feats'] as const) {
    if (Array.isArray(raw[key])) restored[key] = [...new Set(raw[key].filter((item): item is string => typeof item === 'string'))]
  }
  for (const key of Object.keys(fallback.personality) as (keyof Character['personality'])[]) {
    const text = (raw.personality as Record<string, unknown> | undefined)?.[key]
    if (typeof text === 'string') restored.personality[key] = text
  }
  if (Array.isArray(raw.spells)) restored.spells = raw.spells.filter((item): item is BuilderSpell =>
    !!item && typeof item.index === 'string' && typeof item.name === 'string' && Number.isInteger(item.level) && item.level >= 0 && item.level <= 9,
  ).map((item) => ({ ...item, description: typeof item.description === 'string' ? item.description : '', prepared: item.prepared !== false }))
  if (Array.isArray(raw.equipment)) restored.equipment = raw.equipment.filter((item): item is BuilderEquipment =>
    !!item && typeof item.name === 'string' && Number.isFinite(item.qty) && item.qty > 0 && Number.isFinite(item.weight) && item.weight >= 0,
  ).map((item) => ({ ...item, index: typeof item.index === 'string' ? item.index : item.name, notes: typeof item.notes === 'string' ? item.notes : '', equipped: item.equipped === true }))
  const slotRule = raw.slotRule as SpellSlotRule | undefined
  if (slotRule && ['full','half','third','pact'].includes(slotRule.progression)) restored.slotRule = { progression: slotRule.progression, ...(typeof slotRule.className === 'string' ? {className:slotRule.className} : {}) }
  if (Array.isArray(raw.resources)) restored.resources = raw.resources.filter((r): r is CharacterResource => !!r && typeof r.id === 'string' && typeof r.name === 'string' && Number.isInteger(r.max) && r.max >= 0 && r.max <= 999 && ['short','long','manual'].includes(r.recovery)).map(r => ({ id:r.id, name:r.name, ...(typeof r.notes==='string'?{notes:r.notes}:{}), max:r.max, used:0, recovery:r.recovery, automatic:r.automatic===true, unlimited:r.unlimited===true, ...(r.scaling && Number.isInteger(r.scaling.perLevel) && r.scaling.perLevel >= 0 && r.scaling.perLevel <= 999 && Number.isInteger(r.scaling.base) && r.scaling.base >= 0 && r.scaling.base <= 999 ? { scaling:{ perLevel:r.scaling.perLevel, base:r.scaling.base, ...(typeof r.scaling.className === 'string' ? {className:r.scaling.className} : {}) } } : {}) }))
  if (ABILITY_KEYS.includes(raw.spellAbility as AbilityKey)) restored.spellAbility = raw.spellAbility as AbilityKey
  for (const key of ['hpOverride', 'acOverride'] as const) if (typeof raw[key] === 'number' && Number.isFinite(raw[key])) restored[key] = raw[key]
  for (let level = 1; level <= 9; level++) {
    const count = (raw.slotOverrides as Record<string, unknown> | undefined)?.[`l${level}`]
    if (typeof count === 'number' && Number.isInteger(count) && count >= 0 && count <= 99) restored.slotOverrides[`l${level}`] = count
  }
  return restored
}

export function abilityTotals(draft: BuilderDraft, context: Pick<BuilderContext, 'race' | 'subrace'> & Partial<Pick<BuilderContext,'klass'>>): AbilityScores {
  const result = { ...draft.scores }
  for (const key of ABILITY_KEYS) result[key] += draft.adjustments[key]
  for(const slot of featOpportunities(draft,context).slots){const choice=draft.advancements?.[slot.key];if(choice&&choice.kind!=='later')for(const key of ABILITY_KEYS)result[key]+=choice.increases[key]??0}
  for (const bonus of [...(context.race?.ability_bonuses ?? []), ...(context.subrace?.ability_bonuses ?? [])]) {
    const key = bonus.ability_score.index as AbilityKey
    if (ABILITY_KEYS.includes(key)) result[key] += bonus.bonus
  }
  return result
}

export function abilityProblem(draft: BuilderDraft): string {
  const values = ABILITY_KEYS.map((key) => draft.scores[key])
  if (values.some((score) => !Number.isInteger(score))) return 'Enter a whole number for every ability score.'
  if (draft.method === 'standard' && [...values].sort((a, b) => a - b).join(',') !== '8,10,12,13,14,15') return 'Use each standard-array score exactly once.'
  if (draft.method === 'pointBuy') {
    if (values.some((score) => POINT_COST[score] === undefined)) return 'Point-buy scores must be between 8 and 15.'
    if (values.reduce((sum, score) => sum + POINT_COST[score]!, 0) > 27) return 'Your ability scores exceed the 27-point budget.'
  }
  if (draft.method === 'manual' && values.some((score) => score < 3 || score > 20)) return 'Manual base scores must be between 3 and 20.'
  if (ABILITY_KEYS.some((key) => !Number.isInteger(draft.adjustments[key]))) return 'Ability adjustments must be whole numbers.'
  return ''
}

export function armorClass(draft: BuilderDraft, scores: AbilityScores): number {
  if (draft.acOverride !== null) return draft.acOverride
  const dex = abilityMod(scores.dex)
  let ac: number | null = null
  let shield = 0
  for (const item of draft.equipment.filter((item) => item.equipped && item.armor_class)) {
    const armor = item.armor_class!
    if (item.armor_category === 'Shield') shield = Math.max(shield, armor.base)
    else ac = Math.max(ac ?? -Infinity, armor.base + (armor.dex_bonus ? Math.min(dex, armor.max_bonus ?? Infinity) : 0))
  }
  return (ac ?? 10 + dex) + shield
}

export function builderIssues(draft: BuilderDraft, context: BuilderContext) {
  const issues: { step: BuilderStep; message: string }[] = []
  if (!context.race) issues.push({ step: 'race', message: 'Choose a race and load its details.' })
  if (draft.subrace && !context.subrace) issues.push({ step: 'race', message: 'The selected subrace is unavailable.' })
  if (!context.klass) issues.push({ step: 'class', message: 'Choose a class and load its details.' })
  for(const rule of context.ruleDefinitions??[])for(const f of rule.draft.features.filter(f=>f.choice&&f.level<=draft.level&&f.options.length)){
    const chosen=draft.ruleChoices[choiceKey(rule.id,f.id)]??[]
    if(chosen.length!==f.choose||chosen.some(v=>!f.options.includes(v)))issues.push({step:'class',message:`${f.name}: choose ${f.choose} available option${f.choose===1?'':'s'}.`})
  }
  if(context.klass?.workshop&&draft.expertise.length>context.klass.workshop.expertiseCount)issues.push({step:'skills',message:`This class grants ${context.klass.workshop.expertiseCount} expertise choices. Review the selected expertise skills.`})
  if (draft.subclass && !context.subclass) issues.push({ step: 'class', message: 'The selected subclass is unavailable.' })
  if (draft.background && !context.background) issues.push({ step: 'background', message: 'The selected background is unavailable.' })
  if (!Number.isInteger(draft.level) || draft.level < 1 || draft.level > 20) issues.push({ step: 'class', message: 'Choose a level between 1 and 20.' })
  const scoresProblem = abilityProblem(draft)
  if (scoresProblem) issues.push({ step: 'abilities', message: scoresProblem })
  const totals = abilityTotals(draft, context)
  const opportunities=featOpportunities(draft,context)
  if(draft.racialFeatCountOverride!==null&&(!Number.isInteger(draft.racialFeatCountOverride)||draft.racialFeatCountOverride<0||draft.racialFeatCountOverride>10))issues.push({step:'feats',message:'Racial feat opportunities must be a whole number from 0 to 10.'})
  for(const slot of opportunities.slots){const choice=draft.advancements?.[slot.key];if(!choice||choice.kind==='later')continue
    const values=ABILITY_KEYS.map(k=>choice.increases[k]??0)
    if(values.some(v=>!Number.isInteger(v)||v<0||v>2))issues.push({step:'feats',message:`Check ability increases for ${slot.label}.`})
    if(choice.kind==='asi'&&(slot.racial||values.reduce((sum,v)=>sum+v,0)!==2))issues.push({step:'feats',message:`Allocate exactly two ability points for ${slot.label}, or choose a feat instead.`})
    if(choice.kind==='feat'&&!choice.feat)issues.push({step:'feats',message:`Choose a feat for ${slot.label}, or leave it for later.`})
  }
  const assigned=opportunities.slots.flatMap(s=>{const a=draft.advancements?.[s.key];return a?.kind==='feat'&&a.feat?[a.feat]:[]})
  if(new Set(assigned).size!==assigned.length)issues.push({step:'feats',message:'The same feat is assigned to more than one opportunity. Use distinct feats.'})
  if(draft.feats.length&&!draft.featLimitOverride)issues.push({step:'feats',message:'Assign previous-draft feats to earned opportunities or enable the extra-feat override.'})
  if(!draft.featLimitOverride&&opportunities.slots.some(s=>draft.advancements?.[s.key]?.kind==='asi')&&ABILITY_KEYS.some(k=>totals[k]>20))issues.push({step:'feats',message:'An ability increase cannot raise an ability above 20. Review the increases or enable the table-rule override.'})
  if (ABILITY_KEYS.some((key) => !Number.isFinite(totals[key]) || totals[key] < 1 || totals[key] > 30)) issues.push({ step: 'abilities', message: 'Final ability scores must be between 1 and 30.' })
  const skills = draft.skills.filter((key) => context.skillChoice.options.includes(key) && !context.fixedSkills.includes(key))
  if (context.skillChoice.choose && skills.length !== context.skillChoice.choose) issues.push({ step: 'skills', message: `Choose ${context.skillChoice.choose} class skills (${skills.length} selected).` })
  if (draft.skills.some((key) => !(key in SKILL_ABILITY) || (context.skillChoice.choose > 0 && !context.skillChoice.options.includes(key))) || draft.additionalSkills.some((key) => !(key in SKILL_ABILITY))) issues.push({ step: 'skills', message: 'Check your selected skill proficiencies.' })
  if (context.background?.languages && new Set(draft.extraLanguages.filter((language) => !context.proficiencies.languages.includes(language))).size < context.background.languages) issues.push({ step: 'skills', message: `Choose ${context.background.languages} additional background languages.` })
  if (draft.spellAbility && !ABILITY_KEYS.includes(draft.spellAbility)) issues.push({ step: 'spells', message: 'Choose a valid spellcasting ability.' })
  if (draft.resources.some(r=>!r.name.trim()||!Number.isInteger(r.max)||r.max<0||r.max>999||r.scaling&&(!Number.isInteger(r.scaling.perLevel)||r.scaling.perLevel<0||r.scaling.perLevel>999||!Number.isInteger(r.scaling.base)||r.scaling.base<0||r.scaling.base>999))) issues.push({step:'spells',message:'Check custom point totals and points per level: use whole numbers from 0 to 999.'})
  if (Object.values(draft.slotOverrides).some((count) => !Number.isInteger(count) || count < 0 || count > 99)) issues.push({ step: 'spells', message: 'Spell slot counts must be whole numbers between 0 and 99.' })
  if (!draft.spellLimitOverride && context.spellPolicy) for (const message of spellSelectionProblems(draft.spells, context.spellPolicy)) issues.push({ step: 'spells', message })
  if (!draft.name.trim()) issues.push({ step: 'identity', message: 'Give your character a name.' })
  if (draft.hpOverride !== null && (!Number.isInteger(draft.hpOverride) || draft.hpOverride < 1)) issues.push({ step: 'review', message: 'Maximum hit points must be a positive whole number.' })
  if (draft.acOverride !== null && (!Number.isInteger(draft.acOverride) || draft.acOverride < 1)) issues.push({ step: 'review', message: 'Armor class must be a positive whole number.' })
  if (draft.equipment.some((item) => !item.name.trim() || !Number.isInteger(item.qty) || item.qty < 1 || !Number.isFinite(item.weight) || item.weight < 0)) issues.push({ step: 'equipment', message: 'Check equipment names, quantities, and weights.' })
  return issues
}

export function composeCharacter(draft: BuilderDraft, context: BuilderContext): Omit<Character, '_id' | 'updatedAt'> {
  if (builderIssues(draft, context).length) throw new Error('Complete the required character choices first.')
  const result = emptyCharacter()
  const totals = abilityTotals(draft, context)
  const hp = draft.hpOverride ?? maxHP(context.klass!.hit_die, totals.con, draft.level)
  Object.assign(result.meta, { name: draft.name.trim(), level: draft.level, race: contentLabel(context.race!), klass: contentLabel(context.klass!),
    subrace: context.subrace ? contentLabel(context.subrace) : '', subclass: context.subclass ? contentLabel(context.subclass) : '',
    background: context.background ? contentLabel(context.background) : draft.customBackground.trim(), alignment: draft.alignment, portrait: draft.portrait })
  result.abilities = totals
  for (const key of ABILITY_KEYS) result.saves[key] = context.klass!.saving_throws.some((save) => save.index === key)
  for (const key of new Set([...context.fixedSkills, ...draft.skills, ...draft.additionalSkills])) result.skills[key] = draft.expertise.includes(key) ? 'expert' : 'prof'
  Object.assign(result.combat, { ac: armorClass(draft, totals), hpMax: hp, hpCurrent: hp, speed: context.subrace?.speed ?? context.race!.speed, hitDiceTotal: draft.level })
  result.proficiencies = {
    armor: [...new Set(context.proficiencies.armor)], weapons: [...new Set(context.proficiencies.weapons)],
    tools: [...new Set([...context.proficiencies.tools, ...draft.tools.split(',').map((tool) => tool.trim()).filter(Boolean)])],
    languages: [...new Set([...context.proficiencies.languages, ...draft.extraLanguages])],
  }
  result.meta.xp = XP_THRESHOLDS[draft.level-1]??0
  result.meta.classLevels=[{name:context.klass!.name,level:draft.level}]
  result.meta.classIndex=context.klass!.index;result.meta.subclassIndex=context.subclass?.index;result.meta.raceIndex=context.race?.index
  result.meta.classLevels[0]!.index=context.klass!.index
  result.combat.acMode=draft.acOverride!==null?'manual':'equipment'
  result.equipment = draft.equipment.map(item => ({ ...item, armor:item.armor??(item.armor_class?{base:item.armor_class.base,dex:item.armor_class.dex_bonus,cap:item.armor_class.max_bonus,shield:item.armor_category==='Shield'}:undefined) }))
  result.attacks = draft.equipment.filter(i=>i.weapon&&i.equipped).map(i=>({name:i.name,ability:i.weapon!.ranged||i.weapon!.finesse&&totals.dex>totals.str?'dex':'str',range:i.weapon!.range,damageDice:i.weapon!.dice,damageBonus:0,damageType:i.weapon!.damageType,notes:'',magicBonus:i.magicBonus??0}))
  result.resources = draft.resources.map(r => ({...r,used:0}))
  result.spellcasting.slotRule = draft.slotRule ?? (classSpellDefaults(context.klass!.name) && !Object.keys(draft.slotOverrides).length ? {progression:classSpellDefaults(context.klass!.name)!.progression,className:context.klass!.name} : undefined)
  result.spellcasting.ability = draft.spellAbility || context.spellAbility
  result.spellcasting.known = [...new Set(draft.spells.map((spell) => spell.index))]
  result.spellcasting.prepared = [...new Set(draft.spells.filter((spell) => spell.level === 0 || (context.spellPolicy?.available && context.spellPolicy.prepared === null) || spell.prepared).map((spell) => spell.index))]
  for (let level = 1; level <= 9; level++) result.spellcasting.slots[`l${level}`] = { max: draft.slotOverrides[`l${level}`] ?? context.slots[`l${level}`] ?? 0, used: 0, recovery:context.klass!.index==='warlock'?'short':'long' }
  result.personality = { ...draft.personality, appearance: [draft.age ? `Age: ${draft.age}` : '', draft.pronouns ? `Pronouns: ${draft.pronouns}` : '', draft.personality.appearance].filter(Boolean).join('\n') }
  const seen = new Set<string>()
  result.features = context.features.filter((feature) => {
    if ((feature.level ?? 1) > draft.level) return false
    const key = `${feature.name}\u0000${feature.description}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).map(feature => ({ ...feature }))
  if(context.ruleDefinitions?.length)result.homebrew={bindings:[],choices:draft.ruleChoices,conflicts:[],acknowledged:[]}
  return resolveCharacterProgression(applyWorkshopRules(result as Character,context.ruleDefinitions??[]))
}
