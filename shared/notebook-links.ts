import {notebookSearchText} from './notebook-codex'
import type {NotebookEntryType, NotebookSection} from './notebook'

/** Title-only catalog, filtered by the room and ancestor-folder permissions. */
export interface NotebookLinkTarget {
  id: string
  title: string
  section?: NotebookSection
  codexType?: NotebookEntryType
  folder?: string
}

export function notebookWikiLink(value: string) {
  const separator = value.indexOf('|')
  const source = (separator < 0 ? value : value.slice(0, separator)).trim()
  const target = source.split('#')[0]!.replace(/\.md$/i, '').trim()
  return {target, alias: separator < 0 ? undefined : value.slice(separator + 1), suffix: source.includes('#') ? source.slice(source.indexOf('#')) : ''}
}

const titleKey = (value:string) => value.trim().normalize('NFC').toLocaleLowerCase('hu')
export function notebookLinkResolver<T extends NotebookLinkTarget>(entries: readonly T[]) {
  const byId = new Map(entries.map(entry => [entry.id,entry])), byTitle = new Map<string,T[]>()
  for(const entry of byId.values()) {const key=titleKey(entry.title);byTitle.set(key,[...(byTitle.get(key)??[]),entry])}
  return (value:string):T[] => {
    const {target}=notebookWikiLink(value)
    if(!target)return []
    const idMatch=byId.get(target)
    return idMatch?[idMatch]:byTitle.get(titleKey(target))??[]
  }
}
export function notebookLinkMatches<T extends NotebookLinkTarget>(value: string, entries: readonly T[]): T[] {
  return notebookLinkResolver(entries)(value)
}

export function notebookLinkSuggestions(value: string, entries: readonly NotebookLinkTarget[], excludeId?: string) {
  const target = notebookWikiLink(value).target, key = notebookSearchText(target)
  return entries.filter(entry => entry.id !== excludeId && (entry.id === target || notebookSearchText(entry.title).includes(key)))
    .sort((a, b) => Number(b.id === target || notebookSearchText(b.title) === key) - Number(a.id === target || notebookSearchText(a.title) === key) || a.title.localeCompare(b.title, 'hu') || a.id.localeCompare(b.id))
    .slice(0, 8)
}

/** Finds only the wiki link at the caret. Code stays literal, including open fences. */
export function activeNotebookLink(body: string, caret: number, end = caret) {
  if (caret !== end) return null
  const before = body.slice(0, caret), lines = before.split('\n')
  let fenced = false
  for (const line of lines.slice(0, -1)) if (/^```/.test(line)) fenced = !fenced
  const line = lines.at(-1) ?? ''
  if (fenced || /^```/.test(line)) return null
  const offset = line.lastIndexOf('[[')
  if (offset < 0 || line.slice(0, offset).split('`').length % 2 === 0) return null
  const start = caret - line.length + offset
  const close = body.indexOf(']]', start + 2), newline = body.indexOf('\n', start)
  if (close >= 0 && (newline < 0 || close < newline)) {
    if (caret > close + 2) return null
    return {start, end: close + 2, value: body.slice(start + 2, close)}
  }
  const value = body.slice(start + 2, caret)
  if (value.includes(']')) return null
  return {start, end: caret, value}
}

export function insertNotebookLink(body: string, active: NonNullable<ReturnType<typeof activeNotebookLink>>, entry: NotebookLinkTarget) {
  const {alias, suffix} = notebookWikiLink(active.value)
  // A stable ID avoids silently choosing a different note after a rename or duplicate title.
  const label = (alias ?? entry.title).replace(/[\]\n\r]/g, '')
  const replacement = `[[${entry.id}${suffix}|${label}]]`
  return {body: body.slice(0, active.start) + replacement + body.slice(active.end), caret: active.start + replacement.length}
}
