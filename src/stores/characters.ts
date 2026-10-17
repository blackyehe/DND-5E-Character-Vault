import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '../lib/api'
import type { AbilityKey, Proficiency } from '../lib/calc'

export interface CharacterSummary {
  _id: string
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
}

export interface EquipmentItem {
  _id?: string
  name: string
  qty: number
  weight: number
  equipped: boolean
  notes: string
}

export interface SpellSlots {
  max: number
  used: number
}

export interface Character {
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
  }
  attacks: Attack[]
  equipment: EquipmentItem[]
  spellcasting: {
    ability: AbilityKey
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
  features: { _id?: string; name: string; description: string }[]
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

export const useCharactersStore = defineStore('characters', () => {
  const list = ref<CharacterSummary[]>([])
  const current = ref<Character | null>(null)
  const loading = ref(false)

  async function fetchList() {
    loading.value = true
    try {
      list.value = await api.get<CharacterSummary[]>('/api/characters')
    } finally {
      loading.value = false
    }
  }

  async function fetchOne(id: string) {
    loading.value = true
    try {
      current.value = await api.get<Character>(`/api/characters/${id}`)
    } finally {
      loading.value = false
    }
  }

  async function create(payload: Partial<Character>) {
    const body = { ...emptyCharacter(), ...payload }
    const created = await api.post<Character>('/api/characters', body)
    list.value.unshift({
      _id: created._id,
      meta: created.meta,
      updatedAt: created.updatedAt,
    })
    return created
  }

  async function update(id: string, patch: Partial<Character>) {
    const updated = await api.patch<Character>(`/api/characters/${id}`, patch)
    current.value = updated
    return updated
  }

  async function remove(id: string) {
    await api.delete(`/api/characters/${id}`)
    list.value = list.value.filter((c) => c._id !== id)
  }

  async function duplicate(id: string) {
    const copy = await api.post<Character>(`/api/characters/${id}/duplicate`)
    list.value.unshift({ _id: copy._id, meta: copy.meta, updatedAt: copy.updatedAt })
    return copy
  }

  async function importCharacter(data: unknown) {
    const created = await api.post<Character>('/api/characters/import', data)
    list.value.unshift({ _id: created._id, meta: created.meta, updatedAt: created.updatedAt })
    return created
  }

  return {
    list,
    current,
    loading,
    fetchList,
    fetchOne,
    create,
    update,
    remove,
    duplicate,
    importCharacter,
  }
})
