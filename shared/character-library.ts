export interface CharacterFolder { id: string; name: string; parentId: string | null }
export interface CharacterPlacement { characterId: string; folderId: string }
export interface CharacterLibrary { revision: number; folders: CharacterFolder[]; placements: CharacterPlacement[] }
export type LibraryAction =
  | { type: 'create'; name: string; parentId: string | null }
  | { type: 'rename'; folderId: string; name: string }
  | { type: 'reparent'; folderId: string; parentId: string | null }
  | { type: 'remove'; folderId: string }
  | { type: 'move'; characterIds: string[]; folderId: string | null }
export const LIBRARY_LIMITS = { folders: 200, depth: 6, name: 80, batch: 200 }
export const emptyLibrary = (): CharacterLibrary => ({ revision: 0, folders: [], placements: [] })
export function folderTrail(folders: CharacterFolder[], id: string | null): CharacterFolder[] {
  const trail: CharacterFolder[] = [], seen = new Set<string>()
  while (id) { const folder = folders.find(f => f.id === id); if (!folder || seen.has(id)) break; trail.unshift(folder); seen.add(id); id = folder.parentId }
  return trail
}
export function folderLabel(folders: CharacterFolder[], id: string | null) { return id ? folderTrail(folders, id).map(f => f.name).join(' / ') : 'Unfiled' }
export function applyLibraryAction(current: CharacterLibrary, action: LibraryAction, newId = ''): CharacterLibrary {
  const next: CharacterLibrary = { revision: current.revision, folders: current.folders.map(f => ({ ...f })), placements: current.placements.map(p => ({ ...p })) }
  const requireFolder = (id: string | null) => { if (id && !next.folders.some(f => f.id === id)) throw new Error('That folder no longer exists. Refresh your library.') }
  if (action.type === 'move') {
    requireFolder(action.folderId)
    const ids = new Set(action.characterIds)
    next.placements = next.placements.filter(p => !ids.has(p.characterId))
    if (action.folderId) for (const characterId of ids) next.placements.push({ characterId, folderId: action.folderId })
    return next
  }
  if (action.type === 'create') {
    requireFolder(action.parentId)
    if (next.folders.length >= LIBRARY_LIMITS.folders) throw new Error('Your library can contain up to 200 folders.')
    if (!newId || next.folders.some(f => f.id === newId)) throw new Error('Could not create a unique folder.')
    next.folders.push({ id: newId, name: action.name.trim(), parentId: action.parentId })
  } else {
    requireFolder(action.folderId)
    const folder = next.folders.find(f => f.id === action.folderId)!
    if (action.type === 'rename') folder.name = action.name.trim()
    if (action.type === 'reparent') { requireFolder(action.parentId); folder.parentId = action.parentId }
    if (action.type === 'remove') {
      if (next.folders.some(f => f.parentId === folder.id)) throw new Error('Move or remove the subfolders first.')
      next.folders = next.folders.filter(f => f.id !== folder.id)
      next.placements = next.placements.flatMap(p => p.folderId !== folder.id ? [p] : folder.parentId ? [{ ...p, folderId: folder.parentId }] : [])
    }
  }
  for (const folder of next.folders) {
    if (!folder.name || folder.name.length > LIBRARY_LIMITS.name) throw new Error('Use a folder name between 1 and 80 characters.')
    if (next.folders.some(f => f.id !== folder.id && f.parentId === folder.parentId && f.name.toLocaleLowerCase() === folder.name.toLocaleLowerCase())) throw new Error('A folder with that name already exists here.')
    const seen = new Set<string>(); let node: CharacterFolder | undefined = folder
    while (node) { if (seen.has(node.id)) throw new Error('A folder cannot be moved into itself or one of its subfolders.'); seen.add(node.id); node = next.folders.find(f => f.id === node!.parentId) }
    if (seen.size > LIBRARY_LIMITS.depth) throw new Error('Folders can be nested up to six levels deep.')
  }
  return next
}
