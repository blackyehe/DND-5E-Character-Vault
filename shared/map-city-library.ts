import type {NotebookAudience} from './notebook'

export const CITY_CATEGORIES = ['People', 'Places', 'Quests', 'Lore & items'] as const
export const CITY_LIMITS = {categories: 20, entries: 300} as const
export interface CityAssociation {id: string; category: string; relation: string; description: string}
export interface CityEntry extends CityAssociation {
  title: string; audience: NotebookAudience; unavailable: boolean
}
export interface CityDraft {description: string; categories: string[]; entries: CityAssociation[]}
export interface CityLibrary {
  entryId: string; title: string; description: string; revision: number
  categories: string[]; entries: CityEntry[]; canUndo: boolean
}
