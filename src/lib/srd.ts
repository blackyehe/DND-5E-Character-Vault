export interface SrdListResponse<T> {
  count: number
  results: T[]
}

export interface SrdRef {
  index: string
  name: string
  url: string
}

export interface SrdClass extends SrdRef {
  hit_die: number
  multi_classing: unknown
  proficiencies: SrdRef[]
  saving_throws: SrdRef[]
  starting_equipment: unknown
  subclasses: SrdRef[]
}

export interface SrdRace extends SrdRef {
  speed: number
  ability_bonuses: { ability_score: SrdRef; bonus: number }[]
  alignment: string
  age: string
  size: string
  languages: SrdRef[]
  language_desc: string
  traits: SrdRef[]
  subraces: SrdRef[]
}

export interface SrdSpell extends SrdRef {
  level: number
  school: SrdRef
  casting_time: string
  range: string
  components: string[]
  duration: string
  concentration: boolean
  ritual: boolean
  desc: string[]
  higher_level?: string[]
  classes: SrdRef[]
  subclasses?: SrdRef[]
}

export interface SrdEquipment extends SrdRef {
  equipment_category: SrdRef
  cost: { quantity: number; unit: string }
  weight: number
  weapon_category?: string
  weapon_range?: string
  damage?: { damage_dice: string; damage_type: SrdRef }
  armor_category?: string
  armor_class?: { base: number; dex_bonus: boolean; max_bonus?: number }
  str_minimum?: number
  stealth_disadvantage?: boolean
}

export interface SrdMonster extends SrdRef {
  size: string
  type: string
  challenge_rating: number
  hit_points: number
  armor_class: unknown
}

export interface SrdSkill extends SrdRef {
  ability_score: SrdRef
  desc?: string[]
}

const BASE = '/api/2014'

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`SRD request failed: ${res.status}`)
  return res.json() as Promise<T>
}

export const srd = {
  async classes() {
    const data = await getJson<SrdListResponse<SrdRef>>('/classes')
    return data.results
  },
  async class(index: string) {
    return getJson<SrdClass>(`/classes/${index}`)
  },
  async races() {
    const data = await getJson<SrdListResponse<SrdRef>>('/races')
    return data.results
  },
  async race(index: string) {
    return getJson<SrdRace>(`/races/${index}`)
  },
  async spells(params?: { level?: string; class?: string; name?: string }) {
    const qs = new URLSearchParams()
    if (params?.level) qs.set('level', params.level)
    if (params?.class) qs.set('class', params.class)
    if (params?.name) qs.set('name', params.name)
    const suffix = qs.toString() ? `?${qs}` : ''
    const data = await getJson<SrdListResponse<SrdRef>>(`/spells${suffix}`)
    return data.results
  },
  async spell(index: string) {
    return getJson<SrdSpell>(`/spells/${index}`)
  },
  async equipment() {
    const data = await getJson<SrdListResponse<SrdRef>>('/equipment')
    return data.results
  },
  async equipmentItem(index: string) {
    return getJson<SrdEquipment>(`/equipment/${index}`)
  },
  async monsters(params?: { name?: string }) {
    const qs = params?.name ? `?name=${encodeURIComponent(params.name)}` : ''
    const data = await getJson<SrdListResponse<SrdRef>>(`/monsters${qs}`)
    return data.results
  },
  async monster(index: string) {
    return getJson<SrdMonster>(`/monsters/${index}`)
  },
  async skills() {
    const data = await getJson<SrdListResponse<SrdSkill>>('/skills')
    return data.results
  },
}
