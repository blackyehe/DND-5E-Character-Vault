import type {NotebookArtwork} from './notebook-gallery'
export type NotebookSection = 'journal' | 'story-items'
export type NotebookAudience = 'room' | 'characters' | 'dm'
export type NotebookEntryType = 'people' | 'places' | 'objects' | 'factions' | 'sessions' | 'quests' | 'events'
export type NotebookQuestStatus = 'active' | 'finished'
export interface NotebookQuestClue {
  id: string; title: string; body: string; sessions: number[]; audience: 'dm' | 'room'
}
export interface NotebookFolder {
  id: string; section: NotebookSection; title: string; revision: number
  deletedAt: string | null; count: number
  parentId: string | null; audience: NotebookAudience; characterIds: string[]
}
export interface NotebookFolderDraft {
  title: string; parentId: string | null
}
export interface NotebookSummary {
  id: string; section: NotebookSection; title: string; folderId: string | null
  audience: NotebookAudience; characterIds: string[]; relevantCharacterIds: string[]
  revision: number; updatedAt: string; editedBy: string; deletedAt: string | null
  codexType: NotebookEntryType; sessions: number[]; questStatus: NotebookQuestStatus | null
  tags: string[]
  showInEvents?: boolean
}
export interface NotebookEntry extends NotebookSummary {
  body: string; relatedIds: string[]
  questClues: NotebookQuestClue[]
  coverImage: string
  gallery?: NotebookArtwork[]
  reading: {description: string; encounters: string; relations: string}
  connections: {id: string; title: string; section: NotebookSection; codexType: NotebookEntryType; direction: 'outgoing' | 'incoming'}[]
}
export interface NotebookIndex {
  entries: NotebookSummary[]; folders: NotebookFolder[]; total: number; nextOffset: number | null
  characters: {id: string; name: string; assigned: boolean}[]; role: 'dm' | 'player'; readOnly: boolean
  counts: Record<NotebookEntryType, number>; sessionEntries: NotebookSummary[]
  questCounts: Record<NotebookQuestStatus, number>
  entryCount?: number
  tags: {name:string; count:number}[]
}
export interface NotebookVersion {
  revision: number; title: string; body: string; editedBy: string; savedAt: string; action: string
}
export interface NotebookDraft {
  title: string; body: string; section: NotebookSection; folderId: string | null
  audience: NotebookAudience; characterIds: string[]; relevantCharacterIds: string[]; relatedIds: string[]
  codexType?: NotebookEntryType
  showInEvents?: boolean
  questStatus?: NotebookQuestStatus | null
  questClues?: NotebookQuestClue[]
  tags?: string[]
  coverImage?: string
  gallery?: NotebookArtwork[]
}
