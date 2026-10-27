import type {NotebookEntryType, NotebookQuestStatus, NotebookSection} from './notebook'

export const notebookEntryTypes = ['people', 'places', 'objects', 'factions', 'sessions', 'quests', 'events'] as const
export const notebookQuestStatuses = ['active', 'finished'] as const

/** Events is a view of existing entries as well as a category for standalone events. */
export function notebookIsEvent(entry: {codexType?: string | null; showInEvents?: boolean | null}) {
  return entry.codexType === 'events' || entry.showInEvents === true
}

/** Existing prose is never reclassified as a quest; quests are explicitly created. */
export function notebookQuestStatus(entry: {codexType?: string | null; questStatus?: string | null}): NotebookQuestStatus | null {
  return entry.codexType === 'quests' ? entry.questStatus === 'finished' ? 'finished' : 'active' : null
}

/** Existing entries remain readable without rewriting campaign content or permissions. */
export function notebookEntryType(entry: {codexType?: string | null; section: NotebookSection; title: string}): NotebookEntryType {
  if (notebookEntryTypes.includes(entry.codexType as NotebookEntryType)) return entry.codexType as NotebookEntryType
  if (entry.section === 'story-items') return 'objects'
  if (/^Session\s+\d+\b/i.test(entry.title)) return 'sessions'
  if (/\bDynasty\b/i.test(entry.title)) return 'factions'
  return 'people'
}

export function notebookSectionForType(type: NotebookEntryType): NotebookSection {
  return type === 'objects' ? 'story-items' : 'journal'
}

/** Split only top-level sections, never headings inside a recovered letter/code fence. */
function sections(body: string) {
  const blocks: string[] = []
  let block: string[] = [], fence = ''
  for (const line of body.split('\n')) {
    const marker = /^\s{0,3}(`{3,}|~{3,})/.exec(line)?.[1]
    if (!fence && /^##\s/.test(line) && block.length) {blocks.push(block.join('\n')); block = []}
    block.push(line)
    if (marker) {
      if (!fence) fence = marker
      else if (marker[0] === fence[0] && marker.length >= fence.length && line.trim() === marker) fence = ''
    }
  }
  blocks.push(block.join('\n'))
  return blocks
}

export function notebookSessionNumbers(body: string) {
  const sources = sections(body).filter(block => /^##\s+(?:Session|Forrás)/i.test(block.trimStart())).join('\n')
  return [...new Set([...sources.matchAll(/\b(\d+)\.(?=\s*(?:session\b|[,és]))|Sessions\/Session (\d+)\.md/gi)].map(match => Number(match[1] ?? match[2])).filter(n => n > 0 && n <= 10000))].sort((a,b) => a-b)
}

/** Source paths are presentation metadata. The saved Markdown remains untouched. */
export function notebookReading(body: string, sessions: {id: string; sessions: number[]}[] = []) {
  const result = {description: '', encounters: '', relations: ''}, numbers = notebookSessionNumbers(body)
  for (const block of sections(body)) {
    const heading = block.trimStart().split('\n')[0] ?? ''
    const kind = /^##\s+(?:Session|Forrás)/i.test(heading) ? 'encounters' : /^##\s+(?:Ismert kapcsolatok|Kapcsolatok)/i.test(heading) ? 'relations' : 'description'
    const displayed = /^##\s+Forrás/i.test(heading)
      ? `## Források\n\n${numbers.length ? numbers.map(n => {
        const matches = sessions.filter(entry => entry.sessions.includes(n))
        return matches.length === 1 ? `- [${n}. session](note:${matches[0]!.id}).` : `- ${n}. session.`
      }).join('\n') : '- A találkozás sessionje nincs megerősítve.'}`
      : kind==='encounters' ? block.replace(/\s+[—–-]\s+Sessions\/Session \d+\.md/g, '') : block
    result[kind] += (result[kind] ? '\n\n' : '') + displayed.trim()
  }
  return result
}

export const notebookSearchText = (value: string) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('hu')
