import { Router } from 'express'
import { decodedPackData,storedPackData,packSource,MAX_PACK_BYTES } from '../lib/pack-storage'
import { randomUUID } from 'node:crypto'
import { isValidObjectId } from 'mongoose'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth'
import { CustomContent } from '../models/CustomContent'
import { inspectOrcbrew, sourceHash } from '../lib/orcbrew'
import { archiveDefinition, restoreDefinition, type ArchivedDefinition } from '../lib/workshop-trash'

const router = Router()
router.use(requireAuth)
const kind = z.enum(['class', 'subclass', 'race', 'monster'])
const revision = z.number().int().min(0)
const sections = { class: 'classes', subclass: 'subclasses', race: 'races', monster: 'monsters' } as const
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' ? value as Record<string, unknown> : {}
const versionFilter = (value: number) => value === 0 ? { $or: [{ __v: 0 }, { __v: { $exists: false } }] } : { __v: value }

router.get('/', async (req, res) => {
  const docs = await CustomContent.find({ userId: req.userId, $or: [{ type: 'deleted-content' }, { type: 'orcbrew', 'workshopTrash.0': { $exists: true } }] })
    .select('_id type deletedContent workshopTrash.id workshopTrash.kind workshopTrash.name workshopTrash.deletedAt data.filename __v').lean()
  const entries = docs.flatMap<Record<string, unknown>>(doc => doc.type === 'deleted-content'
    ? [{ scope: 'record', id: String(doc._id), revision: doc.__v ?? 0, ...record(doc.deletedContent) }]
    : ((doc.workshopTrash ?? []) as ArchivedDefinition[]).map(entry => ({ scope: 'pack', id: entry.id, packId: String(doc._id), name: entry.name, kind: entry.kind, deletedAt: entry.deletedAt, packName: record(doc.data).filename })))
  res.json(entries.sort((a, b) => String(b.deletedAt).localeCompare(String(a.deletedAt))))
})

router.post('/records/:id/delete', async (req, res) => {
  const parsed = z.object({ kind: z.enum(['item', 'monster-action']), revision }).strict().safeParse(req.body)
  if (!isValidObjectId(req.params.id) || !parsed.success) return res.status(400).json({ error: 'Reload this creation before deleting it.' })
  const doc = await CustomContent.findOne({ _id: req.params.id, userId: req.userId, type: parsed.data.kind, ...versionFilter(parsed.data.revision) }).select('_id data.name __v updatedAt').lean()
  if (!doc) return res.status(409).json({ error: 'This creation changed or was deleted. Reload the library.' })
  const saved = await CustomContent.findOneAndUpdate({ _id: doc._id, userId: req.userId, type: parsed.data.kind, updatedAt: doc.updatedAt }, {
    $set: { type: 'deleted-content', deletedContent: { kind: parsed.data.kind, name: String(record(doc.data).name ?? 'Untitled creation'), deletedAt: new Date().toISOString() } }, $inc: { __v: 1 },
  }, { new: true, runValidators: true }).select('_id').lean()
  if (!saved) return res.status(409).json({ error: 'This creation changed while deleting. Reload the library.' })
  res.json({ message: 'Moved to Recently deleted. Existing copies are unchanged.' })
})

router.post('/records/:id/restore', async (req, res) => {
  const parsed = z.object({ revision }).strict().safeParse(req.body)
  if (!isValidObjectId(req.params.id) || !parsed.success) return res.status(400).json({ error: 'Reload Recently deleted before restoring.' })
  const doc = await CustomContent.findOne({ _id: req.params.id, userId: req.userId, type: 'deleted-content', ...versionFilter(parsed.data.revision) }).select('_id deletedContent updatedAt').lean()
  const originalKind = z.enum(['item', 'monster-action']).safeParse(record(doc?.deletedContent).kind)
  if (!doc || !originalKind.success) return res.status(409).json({ error: 'This creation changed or was already restored. Reload Recently deleted.' })
  const saved = await CustomContent.findOneAndUpdate({ _id: doc._id, userId: req.userId, type: 'deleted-content', updatedAt: doc.updatedAt }, { $set: { type: originalKind.data }, $unset: { deletedContent: '' }, $inc: { __v: 1 } }, { new: true, runValidators: true }).select('_id').lean()
  if (!saved) return res.status(409).json({ error: 'This creation changed while restoring. Reload Recently deleted.' })
  res.json({ message: 'Creation restored to its library.' })
})

router.post('/packs/:id/delete', async (req, res) => {
  const parsed = z.object({ kind, index: z.string().min(1).max(300), hash: z.string().length(64) }).strict().safeParse(req.body)
  if (!isValidObjectId(req.params.id) || !parsed.success) return res.status(400).json({ error: 'Choose a saved definition and its pack.' })
  const doc = await CustomContent.findOne({ _id: req.params.id, userId: req.userId, type: 'orcbrew' }).lean()
  if (!doc) return res.status(404).json({ error: 'Pack not found.' })
  const data = decodedPackData(doc.data), source = data.source
  if (sourceHash(source) !== parsed.data.hash) return res.status(409).json({ error: 'This pack changed. Reload the library before deleting.' })
  const entry = inspectOrcbrew(source).entries[sections[parsed.data.kind]].find(e => e.index === parsed.data.index)
  const native = record(record(entry?.details)[parsed.data.kind === 'monster' ? ':codex/monster' : ':codex/workshop'])
  if (!entry || typeof native.id !== 'string' || parsed.data.kind !== 'monster' && native.kind !== parsed.data.kind) return res.status(400).json({ error: 'Only definitions saved through the Workshop can be deleted here. Manage imported files in the Compendium.' })
  const archived = archiveDefinition(source, parsed.data.kind, entry), trash = (doc.workshopTrash ?? []) as ArchivedDefinition[]
  // Empty active packs must still have distinct source hashes for the unique pack index.
  const marker = `; Workshop recovery pack ${doc._id}`
  if (!archived.source.includes(marker)) archived.source += `\n${marker}\n`
  const snapshot: ArchivedDefinition = { id: randomUUID(), name: entry.name, kind: parsed.data.kind, deletedAt: new Date().toISOString(), parts: archived.parts }
  if (trash.length >= 200 || Buffer.byteLength(JSON.stringify([...trash, snapshot])) > 6 * 1024 * 1024) return res.status(400).json({ error: 'This pack’s recovery storage is full. Download a backup before managing more definitions.' })
  inspectOrcbrew(archived.source)
  const saved = await CustomContent.findOneAndUpdate({ _id: doc._id, userId: req.userId, type: 'orcbrew', updatedAt: doc.updatedAt }, { $set: { data:storedPackData({...data,source:archived.source}), sourceHash: sourceHash(archived.source), workshopTrash: [...trash, snapshot] } }, { new: true }).select('_id').lean()
  if (!saved) return res.status(409).json({ error: 'This pack changed while deleting. Reload the library.' })
  res.json({ message: 'Moved to Recently deleted. Characters keep their last saved rules; the missing source is flagged for review.' })
})

router.post('/packs/:id/restore/:entryId', async (req, res) => {
  if (!isValidObjectId(req.params.id) || !z.uuid().safeParse(req.params.entryId).success) return res.status(400).json({ error: 'Choose a deleted definition.' })
  const doc = await CustomContent.findOne({ _id: req.params.id, userId: req.userId, type: 'orcbrew' }).lean()
  if (!doc) return res.status(404).json({ error: 'The original pack is unavailable.' })
  const trash = (doc.workshopTrash ?? []) as ArchivedDefinition[], entry = trash.find(e => e.id === req.params.entryId)
  if (!entry) return res.status(409).json({ error: 'This definition was already restored. Reload Recently deleted.' })
  let source: string
  try { source = restoreDefinition(packSource(doc.data), entry.parts); inspectOrcbrew(source) } catch (error) { return res.status(409).json({ error: (error as Error).message }) }
  if (Buffer.byteLength(source) > MAX_PACK_BYTES) return res.status(400).json({ error: 'Restoring would exceed the 64 MB pack limit.' })
  const saved = await CustomContent.findOneAndUpdate({ _id: doc._id, userId: req.userId, type: 'orcbrew', updatedAt: doc.updatedAt }, { $set: { data:storedPackData({...record(doc.data),source,sourceEncoding:undefined,sourceBytes:undefined}), sourceHash: sourceHash(source), workshopTrash: trash.filter(e => e.id !== entry.id) } }, { new: true }).select('_id').lean()
  if (!saved) return res.status(409).json({ error: 'This pack changed while restoring. Reload Recently deleted.' })
  res.json({ message: 'Definition restored to its original pack.' })
})
export default router
