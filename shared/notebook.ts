export type NotebookSection = 'journal' | 'story-items'
export type NotebookAudience = 'room' | 'characters' | 'dm'
export interface NotebookFolder {
  id: string; section: NotebookSection; title: string; revision: number
  deletedAt: string | null; count: number
}
export interface NotebookSummary {
  id: string; section: NotebookSection; title: string; folderId: string | null
  audience: NotebookAudience; characterIds: string[]; relevantCharacterIds: string[]
  revision: number; updatedAt: string; editedBy: string; deletedAt: string | null
}
export interface NotebookEntry extends NotebookSummary {
  body: string; relatedIds: string[]
  connections: {id: string; title: string; section: NotebookSection; direction: 'outgoing' | 'incoming'}[]
}
export interface NotebookIndex {
  entries: NotebookSummary[]; folders: NotebookFolder[]; total: number; nextOffset: number | null
  characters: {id: string; name: string; assigned: boolean}[]; role: 'dm' | 'player'; readOnly: boolean
}
export interface NotebookVersion {
  revision: number; title: string; body: string; editedBy: string; savedAt: string; action: string
}
export interface NotebookDraft {
  title: string; body: string; section: NotebookSection; folderId: string | null
  audience: NotebookAudience; characterIds: string[]; relevantCharacterIds: string[]; relatedIds: string[]
}
