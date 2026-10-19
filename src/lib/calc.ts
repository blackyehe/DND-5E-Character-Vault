export type AbilityKey = 'str' | 'dex' | 'int' | 'wis' | 'con' | 'cha'

export const ABILITY_KEYS: AbilityKey[] = ['str', 'dex', 'int', 'wis', 'con', 'cha']

export const SKILL_ABILITY: Record<string, AbilityKey> = {
  acrobatics: 'dex',
  animalHandling: 'wis',
  arcana: 'int',
  athletics: 'str',
  history: 'int',
  deception: 'cha',
  insight: 'wis',
  intimidation: 'cha',
  investigation: 'int',
  medicine: 'wis',
  nature: 'int',
  perception: 'wis',
  performance: 'cha',
  persuasion: 'cha',
  religion: 'int',
  sleightOfHand: 'dex',
  stealth: 'dex',
  survival: 'wis',
}

export type Proficiency = 'none' | 'prof' | 'expert'

export function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2)
}

export function profBonus(level: number): number {
  return 2 + Math.floor((Math.min(20, Math.max(1, level)) - 1) / 4)
}

export function saveMod(level: number, score: number, proficient: boolean): number {
  return abilityMod(score) + (proficient ? profBonus(level) : 0)
}

export function skillMod(
  level: number,
  score: number,
  profLevel: Proficiency,
): number {
  const pb = profBonus(level)
  if (profLevel === 'expert') return abilityMod(score) + pb * 2
  if (profLevel === 'prof') return abilityMod(score) + pb
  return abilityMod(score)
}

export function passivePerception(level: number, score: number, profLevel: Proficiency): number {
  return 10 + skillMod(level, score, profLevel)
}

export function initiative(dexScore: number): number {
  return abilityMod(dexScore)
}

export function spellAttackBonus(level: number, score: number, profLevel: Proficiency): number {
  return skillMod(level, score, profLevel)
}

export function spellSaveDC(level: number, score: number, profLevel: Proficiency): number {
  return 8 + spellAttackBonus(level, score, profLevel)
}

export function attackBonus(
  level: number,
  abilityScore: number,
  proficient: boolean,
  magicBonus = 0,
): number {
  return abilityMod(abilityScore) + (proficient ? profBonus(level) : 0) + magicBonus
}

export function averageRoll(sides: number): number {
  return (sides + 1) / 2
}

/** Max HP: full hit die + CON at level 1, then average (or fixed) + CON per level. */
export function maxHP(
  hitDie: number,
  conScore: number,
  level: number,
  useFixed = true,
): number {
  const con = abilityMod(conScore)
  if (level <= 1) return Math.max(1, hitDie + con)
  const base = useFixed ? Math.ceil(averageRoll(hitDie)) : averageRoll(hitDie)
  return Math.max(1, hitDie + con) + (level - 1) * Math.max(1, base + con)
}

export function carriedWeight(equipment: { weight: number; qty: number }[]): number {
  return equipment.reduce((sum, e) => sum + (e.weight || 0) * (e.qty || 0), 0)
}
