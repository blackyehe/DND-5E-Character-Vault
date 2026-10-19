import type { AbilityKey, Proficiency } from '../src/lib/calc'

export interface CharacterSummary {
  _id: string
  companionKind?: 'shadow-champion'
  meta: {
    name: string
    race: string
    klass: string
    level: number
    subclass?: string
    background?: string
    portrait?: string
  }
  updatedAt: string
}

export interface Attack {
  _id?: string
  name: string
  ability: AbilityKey
  range: string
  damageDice: string
  damageBonus: number
  damageType: string
  notes: string
  magicBonus: number
  proficient?: boolean
  addAbilityDamage?: boolean
}

export interface EquipmentItem {
  _id?: string
  name: string
  qty: number
  weight: number
  equipped: boolean
  notes: string
  index?: string
  magicIndex?: string
  category?: string
  tags?: string[]
  rarity?: string
  value?: { amount: number; currency: 'cp'|'sp'|'ep'|'gp'|'pp' }
  attunementRequirement?: string
  description?: string
  referenceDescription?: string
  armor?: { base: number; dex: boolean; cap?: number; shield: boolean; category?: 'light'|'medium'|'heavy'|'shield' }
  weapon?: { dice: string; damageType: string; range: string; finesse: boolean; ranged: boolean; category?: string; noDamage?: boolean }
  magicBonus?: number
  kind?: 'weapon'|'armour'|'accessory'|'consumable'|'treasure'|'gear'
  magical?: boolean
  requiresAttunement?: boolean
  attuned?: boolean
  effects?: { ac: number; saves: number }
  templateId?: string
  templateRevision?: number
  grantId?: string
}

export type FeatureOrigin = 'racial' | 'class' | 'subclass' | 'background' | 'feat' | 'other'
export interface CharacterFeature {
  selectedOptions?:string[]
  ruleId?:string
  featureId?:string
  _id?: string
  name: string
  description: string
  origin?: FeatureOrigin
  level?: number
  pinned?: boolean
  combatHidden?: boolean
  order?: number
}
export interface CharacterResource {
  ruleId?:string
  id: string
  name: string
  max: number
  used: number
  recovery: 'short' | 'long' | 'manual'
  automatic?: boolean
  unlimited?: boolean
  scaling?: { perLevel: number; base: number; className?: string }
  notes?: string
}

export type SlotProgression = 'full' | 'half' | 'third' | 'pact'
export interface SpellSlotRule {
  workshopId?:string
  progression: SlotProgression
  className?: string
}

export interface SpellSlots {
  max: number
  used: number
  recovery?: 'short' | 'long'
}

export interface ExternalCharacterImport {
  provider: 'dmv'
  sourceUrl: string
  source: string
  importedAt: string
  warnings: string[]
}
export interface Character {
  homebrew?: {
    bindings:{ruleId:string;revision:number;index:string;className:string;rule:import('./homebrew-workshop').WorkshopDraft}[]
    choices:Record<string,string[]>
    conflicts:{id:string;message:string}[]
    acknowledged:string[]
  }
  companionKind?: 'shadow-champion'
  externalImport?: ExternalCharacterImport
  _id: string
  meta: {
    name: string
    race: string
    subrace: string
    klass: string
    subclass: string
    background: string
    level: number
    alignment: string
    xp: number
    portrait: string
    classLevels?: { name: string; level: number; index?:string }[]
    classIndex?:string
    subclassIndex?:string
    raceIndex?:string
  }
  abilities: Record<AbilityKey, number>
  saves: Record<AbilityKey, boolean>
  skills: Record<string, Proficiency>
  combat: {
    ac: number
    hpMax: number
    hpCurrent: number
    hpTemp: number
    hitDiceTotal: number
    hitDiceUsed: number
    deathSavesSuccess: number
    deathSavesFailure: number
    speed: number
    inspiration: boolean
    acMode?: 'manual' | 'equipment'
    itemAcBaseline?: number
  }
  attacks: Attack[]
  resources?: CharacterResource[]
  equipment: EquipmentItem[]
  spellcasting: {
    ability: AbilityKey
    limitOverride?:boolean
    slotRule?: SpellSlotRule
    slots: Record<string, SpellSlots>
    prepared: string[]
    known: string[]
  }
  personality: {
    traits: string
    ideals: string
    bonds: string
    flaws: string
    appearance: string
    backstory: string
    notes: string
  }
  features: CharacterFeature[]
  proficiencies: {
    armor: string[]
    weapons: string[]
    tools: string[]
    languages: string[]
  }
  updatedAt: string
}

export function emptyCharacter(): Omit<Character, '_id' | 'updatedAt'> {
  return {
    meta: {
      name: '',
      race: '',
      subrace: '',
      klass: '',
      subclass: '',
      background: '',
      level: 1,
      alignment: '',
      xp: 0,
      portrait: '',
    },
    abilities: { str: 10, dex: 10, int: 10, wis: 10, con: 10, cha: 10 },
    saves: { str: false, dex: false, int: false, wis: false, con: false, cha: false },
    skills: {},
    combat: {
      ac: 10,
      hpMax: 10,
      hpCurrent: 10,
      hpTemp: 0,
      hitDiceTotal: 1,
      hitDiceUsed: 0,
      deathSavesSuccess: 0,
      deathSavesFailure: 0,
      speed: 30,
      inspiration: false,
    },
    attacks: [],
    equipment: [],
    spellcasting: {
      ability: 'int',
      slots: {},
      prepared: [],
      known: [],
    },
    personality: {
      traits: '',
      ideals: '',
      bonds: '',
      flaws: '',
      appearance: '',
      backstory: '',
      notes: '',
    },
    features: [],
    proficiencies: { armor: [], weapons: [], tools: [], languages: [] },
  }
}

