import {notebookEntryType, notebookIsEvent, notebookQuestStatus, notebookSessionNumbers} from '../../shared/notebook-codex'
import {notebookTags, notebookTagKey} from '../../shared/notebook-tags'

export const NOTEBOOK_LISTING_VERSION = 1
export const NOTEBOOK_COLLATION = {locale: 'hu'} as const
export interface NotebookDerivedSource {
  revision?: number
  section: string
  title: string
  body?: string | null
  codexType?: string | null
  showInEvents?: boolean | null
  questStatus?: string | null
  tags?: readonly string[] | null
}

/** The sole definition of stored listing metadata. Never includes prose or clues. */
export function notebookDerived(source: NotebookDerivedSource) {
  if (source.section !== 'journal' && source.section !== 'story-items') throw Error('Invalid notebook section')
  const sessions = notebookSessionNumbers(source.body ?? '')
  return {
    version: NOTEBOOK_LISTING_VERSION,
    sourceRevision: source.revision ?? 1,
    type: notebookEntryType({...source, section: source.section}),
    event: notebookIsEvent(source),
    questStatus: notebookQuestStatus(source),
    sessions,
    firstSession: sessions[0] ?? 10001,
    tagNames: notebookTags(source.tags ?? []),
    tagKeys: notebookTags(source.tags ?? []).map(notebookTagKey),
  }
}
export type NotebookDerived = ReturnType<typeof notebookDerived>

/** Query updates do not run document save hooks. Compute from the merged record. */
export function notebookChanges(source: NotebookDerivedSource, changes: Record<string, unknown>) {
  return {...changes, listing: notebookDerived({...source, ...changes, revision: (source.revision ?? 1) + 1})}
}

export function notebookDerivedConsistent(source: NotebookDerivedSource & {listing?: unknown}) {
  const expected = notebookDerived(source)
  const actual = source.listing as Partial<NotebookDerived> | undefined
  return !!actual && Object.entries(expected).every(([key, value]) =>
    JSON.stringify(actual[key as keyof NotebookDerived]) === JSON.stringify(value))
}
