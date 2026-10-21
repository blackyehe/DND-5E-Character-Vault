import { api } from './api'

export interface SrdListResponse<T> {
  count: number
  results: T[]
}

export interface SrdRef {
  definitionAvailable?:boolean
  workshop?:import('../../shared/homebrew-workshop').WorkshopDraft
  workshopRevision?:number
  index: string
  name: string
  url: string
  displayName?: string
  contentKey?: string
  aliases?: string[]
  sourcePack?: string
}

export const contentLabel = (entry: Pick<SrdRef, 'name' | 'displayName'>) => entry.displayName ?? entry.name

export interface SrdClass extends SrdRef {
  hit_die: number
  multi_classing: unknown
  proficiencies: SrdRef[]
  saving_throws: SrdRef[]
  starting_equipment: unknown
  subclasses: SrdRef[]
  proficiency_choices?: SrdChoice[]
  starting_equipment_options?: SrdChoice[]
  spellcasting?: { spellcasting_ability: SrdRef }
  details?: Record<string, unknown>
}

export interface SrdChoice {
  desc?: string
  choose: number
  from: { options?: { item?: SrdRef; string?: string; desc?: string; [key: string]: unknown }[] }
}
export interface SrdBackground extends SrdRef {
  starting_proficiencies: SrdRef[]
  language_options?: { choose: number }
  starting_equipment: { equipment: SrdRef; quantity: number }[]
  feature?: { name: string; desc: string[] }
  personality_traits?: SrdChoice
  ideals?: SrdChoice
  bonds?: SrdChoice
  flaws?: SrdChoice
}
export interface SrdLevel {
  class_specific?: Record<string, number>
  level: number
  features: SrdRef[]
  spellcasting?: Record<string, number>
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

export interface SrdSubrace extends SrdRef {
  ability_bonuses: { ability_score: SrdRef; bonus: number }[]
  racial_traits: SrdRef[]
}

export interface SrdSpell extends SrdRef {
  referenceFallback?:boolean
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
  desc?: string[]
  special?: string[]
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
  properties?: SrdRef[]
  range?: { normal: number; long?: number }
  throw_range?: { normal: number; long?: number }
  two_handed_damage?: { damage_dice: string; damage_type: SrdRef }
  contents?: { item: SrdRef; quantity: number }[]
  speed?: { quantity: number; unit: string }
  capacity?: string
}

export interface SrdMagicItem extends SrdRef {
  equipment_category: SrdRef
  rarity: { name: string }
  desc: string[]
  variants?: SrdRef[]
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

export interface HomebrewTrait {
  name: string
  description: string
  level?: number
  origin?: import('../../shared/character').FeatureOrigin
}

export interface HomebrewClass extends SrdClass {
  homebrew_traits: HomebrewTrait[]
  homebrew_subclass_title: string
  homebrew: true
  sourcePack: string
}

export interface HomebrewRace extends SrdRace {
  homebrew_traits: HomebrewTrait[]
  homebrew: true
  sourcePack: string
}

export interface HomebrewSpell extends SrdSpell {
  homebrew: true
  sourcePack: string
}

export interface HomebrewBackground extends SrdRef {
  description: string
  traits: HomebrewTrait[]
  equipment: Record<string, unknown>
  homebrew: true
  sourcePack: string
}

export interface HomebrewFeat extends SrdRef {
  description: string
  prerequisites: unknown[]
  ability_increases: unknown[]
  homebrew: true
  sourcePack: string
}

export interface HomebrewSubclass extends SrdRef {
  class: string
  traits: HomebrewTrait[]
  homebrew: true
  sourcePack: string
}

export interface HomebrewSubrace extends SrdSubrace {
  race: string
  speed?: number
  homebrew_traits: HomebrewTrait[]
}

export interface HomebrewReference extends SrdRef {
  description: string
  details: Record<string, unknown>
}

export const homebrew = {
  spells: () => api.get<HomebrewSpell[]>('/api/content/homebrew/spells'),
  races: () => api.get<HomebrewRace[]>('/api/content/homebrew/races'),
  classes: () => api.get<HomebrewClass[]>('/api/content/homebrew/classes'),
  backgrounds: () => api.get<HomebrewBackground[]>('/api/content/homebrew/backgrounds'),
  feats: () => api.get<HomebrewFeat[]>('/api/content/homebrew/feats'),
  subclasses: () => api.get<HomebrewSubclass[]>('/api/content/homebrew/subclasses'),
  subraces: () => api.get<HomebrewSubrace[]>('/api/content/homebrew/subraces'),
  monsters: () => api.get<SrdMonster[]>('/api/content/homebrew/monsters'),
  languages: () => api.get<HomebrewReference[]>('/api/content/homebrew/languages'),
  invocations: () => api.get<HomebrewReference[]>('/api/content/homebrew/invocations'),
  boons: () => api.get<HomebrewReference[]>('/api/content/homebrew/boons'),
  selections: () => api.get<HomebrewReference[]>('/api/content/homebrew/selections'),
  other: () => api.get<HomebrewReference[]>('/api/content/homebrew/other'),
}
const BASE = '/api/2014'

const ruleCache=new Map<string,Promise<unknown>>()
async function getJson<T>(path: string): Promise<T> {
  if(ruleCache.has(path))return ruleCache.get(path) as Promise<T>
  const task=(async()=>{
    const res = await fetch(`${BASE}${path}`,{signal:AbortSignal.timeout(6500)})
    if (!res.ok) throw new Error(`SRD request failed: ${res.status}`)
    return res.json() as Promise<T>
  })()
  if(ruleCache.size>=1000)ruleCache.delete(ruleCache.keys().next().value!)
  ruleCache.set(path,task)
  try{return await task}catch(error){ruleCache.delete(path);throw error}
}

export const srd = {
  async compendium(kind: string) { return (await getJson<SrdListResponse<SrdRef & { filterFacets:import('../../shared/compendium-facets').FacetValues }>>(`/compendium/${kind}`)).results },
  async subclasses() { return (await getJson<SrdListResponse<SrdRef>>('/subclasses')).results },
  async subraces() { return (await getJson<SrdListResponse<SrdRef>>('/subraces')).results },
  async feats() { return (await getJson<SrdListResponse<SrdRef>>('/feats')).results },
  feat: (index: string) => getJson<SrdRef & Record<string, unknown>>(`/feats/${index}`),
  language: (index: string) => getJson<SrdRef & Record<string, unknown>>(`/languages/${index}`),
  subclassLevels: (index: string) => getJson<SrdLevel[]>(`/subclasses/${index}/levels`),
  async backgrounds() {
    return (await getJson<SrdListResponse<SrdRef>>('/backgrounds')).results
  },
  background: (index: string) => getJson<SrdBackground>(`/backgrounds/${index}`),
  subclass: (index: string) => getJson<SrdRef & { desc: string[] }>(`/subclasses/${index}`),
  trait: (index: string) => getJson<SrdRef & { desc: string[]; proficiencies?: SrdRef[] }>(`/traits/${index}`),
  feature: (index: string) => getJson<SrdRef & { desc: string[] }>(`/features/${index}`),
  classLevels: (index: string) => getJson<SrdLevel[]>(`/classes/${index}/levels`),
  async classSpells(index: string) {
    return (await getJson<SrdListResponse<SrdRef>>(`/classes/${index}/spells`)).results
  },
  async languages() {
    return (await getJson<SrdListResponse<SrdRef>>('/languages')).results
  },
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
  async subrace(index: string) {
    return getJson<SrdSubrace>(`/subraces/${index}`)
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
  async magicItems() {
    return (await getJson<SrdListResponse<SrdRef>>('/magic-items')).results
  },
  magicItem: (index: string) => getJson<SrdMagicItem>(`/magic-items/${index}`),
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
