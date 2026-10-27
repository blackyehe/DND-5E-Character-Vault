import type {NotebookQuestClue} from './notebook'

export const NOTEBOOK_CLUE_LIMIT = 50
export const NOTEBOOK_CLUE_BODY_LIMIT = 4000

/** Never return hidden clues, their IDs or counts to a player or player preview. */
export function notebookQuestClues(entry: {codexType?: string | null; questClues?: readonly NotebookQuestClue[] | null}, dm: boolean): NotebookQuestClue[] {
  if (entry.codexType !== 'quests') return []
  return (entry.questClues ?? []).filter(clue => dm || clue.audience === 'room').map(clue => ({
    id: clue.id, title: clue.title, body: clue.body, sessions: [...clue.sessions], audience: clue.audience,
  }))
}
