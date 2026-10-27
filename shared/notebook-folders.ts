import type {NotebookAudience, NotebookFolder} from './notebook'

export interface FolderAccess {
  id: string; parentId: string | null; section: string; deletedAt: unknown
  audience: NotebookAudience; characterIds: string[]
}
export function audienceAllows(value: {audience?: unknown; characterIds?: unknown}, allowed: readonly string[]) {
  return value.audience === 'room' || value.audience === 'characters' && Array.isArray(value.characterIds) && value.characterIds.some(id => allowed.includes(String(id)))
}
export function folderDescendants(id: string, folders: readonly Pick<FolderAccess, 'id' | 'parentId'>[]) {
  const result = new Set([id]), pending = [id]
  while (pending.length) {
    const parent = pending.pop()!
    for (const folder of folders) if (folder.parentId === parent && !result.has(folder.id)) {result.add(folder.id); pending.push(folder.id)}
  }
  return result
}
export function validFolderParent(id: string | null, parentId: string | null, section: string, folders: ReadonlyMap<string, FolderAccess>) {
  const seen = new Set<string>(id ? [id] : [])
  let current = parentId
  while (current) {
    if (seen.has(current)) return false
    seen.add(current)
    const value = folders.get(current)
    if (!value || value.deletedAt || value.section !== section) return false
    current = value.parentId
  }
  return true
}
/** Stable, alphabetized explorer order and full paths for parent/entry selectors. */
export function notebookFolderRows(folders: readonly NotebookFolder[]) {
  const rows: {folder: NotebookFolder; depth: number; path: string}[] = [], seen = new Set<string>()
  const visit = (parentId: string | null, depth: number, path: string) => {
    for (const folder of folders.filter(f => f.parentId === parentId).sort((a,b) => a.title.localeCompare(b.title))) {
      if (seen.has(folder.id)) continue
      seen.add(folder.id)
      const title = path ? `${path} / ${folder.title}` : folder.title
      rows.push({folder, depth, path: title}); visit(folder.id, depth + 1, title)
    }
  }
  visit(null, 0, '')
  // A removed parent must not make recoverable folders impossible to select.
  for (const folder of folders) if (!seen.has(folder.id)) {rows.push({folder,depth:0,path:folder.title}); seen.add(folder.id)}
  return rows
}
