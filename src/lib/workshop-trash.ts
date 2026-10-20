import { api } from './api'

type Pack = { id: string; filename: string; hash: string }
export type DeleteCreation =
  | { scope: 'record'; id: string; kind: 'item' | 'monster-action'; revision: number; name: string }
  | { scope: 'pack'; index: string; kind: 'class' | 'subclass' | 'race' | 'monster'; name: string; packs: Pack[] }
  | { scope: 'draft'; id: string; name: string; storageKey: string }
export type DeletedCreation = { scope: 'record' | 'pack' | 'draft'; id: string; name: string; kind: string; deletedAt: string; revision?: number; packId?: string; packName?: string }
type DeviceEntry = DeletedCreation & { scope: 'draft'; storageKey: string; value: Record<string, unknown> }
export const deviceTrashKey = (userId: string) => `codex:workshop-trash:v1:${userId}`
const identity = (value: Record<string, unknown>) => String(value.localId ?? value.id)
export function deviceTrash(userId: string): DeviceEntry[] {
  const data = JSON.parse(localStorage.getItem(deviceTrashKey(userId)) ?? '[]')
  if (!Array.isArray(data)) throw new Error('Recently deleted drafts could not be read. Download a backup before changing browser storage.')
  return data
}
export async function deleteCreation(target: DeleteCreation, userId: string, packId: string) {
  if (target.scope === 'record') return api.post<{ message: string }>(`/api/workshop-trash/records/${target.id}/delete`, { kind: target.kind, revision: target.revision })
  if (target.scope === 'pack') {
    const pack = target.packs.find(p => p.id === packId)
    if (!pack) throw new Error('Choose the pack containing this definition.')
    return api.post<{ message: string }>(`/api/workshop-trash/packs/${pack.id}/delete`, { kind: target.kind, index: target.index, hash: pack.hash })
  }
  const active = JSON.parse(localStorage.getItem(target.storageKey) ?? '[]') as Record<string, unknown>[]
  if (!Array.isArray(active)) throw new Error('The draft list could not be read. Download a backup before deleting.')
  const value = active.find(d => identity(d) === target.id)
  if (!value) throw new Error('This draft changed. Reload the library before deleting.')
  const old = deviceTrash(userId)
  if (old.length >= 200) throw new Error('Recovery storage has 200 drafts. Download a backup before managing more drafts.')
  const entry: DeviceEntry = { scope: 'draft', id: crypto.randomUUID(), name: target.name, kind: String(value.kind ?? 'monster') + ' draft', deletedAt: new Date().toISOString(), storageKey: target.storageKey, value }
  // Save recovery first. A storage failure must never destroy the only copy.
  localStorage.setItem(deviceTrashKey(userId), JSON.stringify([...old.filter(d => d.storageKey !== target.storageKey || identity(d.value) !== target.id), entry]))
  localStorage.setItem(target.storageKey, JSON.stringify(active.filter(d => identity(d) !== target.id)))
  return { message: 'Draft moved to Recently deleted on this device. Saved pack definitions are unchanged.' }
}
export async function restoreCreation(entry: DeletedCreation, userId: string) {
  if (entry.scope === 'record') return api.post<{ message: string }>(`/api/workshop-trash/records/${entry.id}/restore`, { revision: entry.revision })
  if (entry.scope === 'pack') return api.post<{ message: string }>(`/api/workshop-trash/packs/${entry.packId}/restore/${entry.id}`)
  const trash = deviceTrash(userId), saved = trash.find(d => d.id === entry.id)
  if (!saved) throw new Error('This draft was already restored. Reload Recently deleted.')
  const allowed = [`codex:homebrew-workshop:v1:${userId}`, `codex:monster-workshop:v1:${userId}`]
  if (!allowed.includes(saved.storageKey)) throw new Error('This draft belongs to another library.')
  const active = JSON.parse(localStorage.getItem(saved.storageKey) ?? '[]') as Record<string, unknown>[]
  if (!Array.isArray(active) || active.some(d => identity(d) === identity(saved.value))) throw new Error('A draft with this identity already exists. The current draft has been kept.')
  localStorage.setItem(saved.storageKey, JSON.stringify([saved.value, ...active]))
  localStorage.setItem(deviceTrashKey(userId), JSON.stringify(trash.filter(d => d.id !== entry.id)))
  return { message: 'Draft restored on this device.' }
}
export function announceWorkshopChange() {
  try { localStorage.setItem('codex:workshop-revision', String(Date.now())) } catch { /* Focus refresh remains available. */ }
  window.dispatchEvent(new Event('codex:workshop-published'))
}
