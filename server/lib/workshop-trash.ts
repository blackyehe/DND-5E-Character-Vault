import { readEdn, type EdnSpan } from './edn'
import { canonicalContent, type OrcbrewEntry } from './orcbrew'

export type CreationKind = 'class' | 'subclass' | 'race' | 'monster'
export type ArchivedPart = { path: string[]; section: string; key: string; pair: string }
export type ArchivedDefinition = { id: string; kind: CreationKind; name: string; deletedAt: string; parts: ArchivedPart[] }
const sections = { class: 'classes', subclass: 'subclasses', race: 'races', monster: 'monsters' } as const
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}

/** Remove only the selected native definition. Keep exact EDN forms for restoration. */
export function archiveDefinition(source: string, kind: CreationKind, entry: OrcbrewEntry) {
  const spans = new WeakMap<object, EdnSpan>(), root = readEdn(source, () => {}, spans)
  const section = `:orcpub.dnd.e5/${sections[kind]}`
  const edits: { start: number; end: number }[] = [], parts: ArchivedPart[] = []
  function visit(node: unknown, path: string[]) {
    if (path.length > 16) return
    const record = object(node), group = object(record[section]), groupSpan = spans.get(group)
    for (const [key, value] of Object.entries(group)) {
      if (key.replace(/^:/, '') !== entry.contentKey || canonicalContent(value) !== canonicalContent(entry.details)) continue
      const field = groupSpan?.fields?.[key]
      if (!field) throw new Error('This definition cannot be removed safely.')
      parts.push({ path, section, key, pair: source.slice(field.keyStart, field.end) })
      edits.push({ start: field.keyStart, end: field.end })
    }
    for (const [key, value] of Object.entries(record)) if (!key.startsWith(':') && value && typeof value === 'object' && !Array.isArray(value)) visit(value, [...path, key])
  }
  visit(root, [])
  if (!parts.length) throw new Error('The definition changed. Reload the library before deleting it.')
  if (parts.length > 200) throw new Error('This definition is repeated too many times to archive safely. Download a backup and manage its imported pack instead.')
  let next = source
  for (const edit of edits.sort((a, b) => b.start - a.start)) next = next.slice(0, edit.start) + next.slice(edit.end)
  return { source: next, parts }
}

/** Never replace a newer definition or recreate a missing pack wrapper. */
export function restoreDefinition(source: string, parts: ArchivedPart[]) {
  if (!parts.length || parts.length > 200) throw new Error('This archived definition is invalid.')
  const spans = new WeakMap<object, EdnSpan>(), root = readEdn(source, () => {}, spans)
  const inserts = new Map<number, string[]>()
  for (const part of parts) {
    let parent: unknown = root
    for (const key of part.path) parent = object(parent)[key]
    const group = object(object(parent)[part.section]), span = spans.get(group)
    if (!span || Object.hasOwn(group, part.key)) throw new Error('The original location is missing or its key is already in use. Restore into an unchanged pack before trying again.')
    const rows = inserts.get(span.end - 1) ?? []
    rows.push(part.pair); inserts.set(span.end - 1, rows)
  }
  let next = source
  for (const [at, pairs] of [...inserts].sort(([a], [b]) => b - a)) next = next.slice(0, at) + '\n' + pairs.join('\n') + '\n' + next.slice(at)
  return next
}
