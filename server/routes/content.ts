import { Router } from 'express'
import { isValidObjectId } from 'mongoose'
import { z } from 'zod'
import { CustomContent } from '../models/CustomContent'
import { Character } from '../models/Character'
import { requireAuth } from '../middleware/auth'
import { buildOrcbrewCatalog, ORCBREW_KINDS, sourceHash, type OrcbrewKind } from '../lib/orcbrew'
import { parsedPack } from '../lib/orcbrew-library'
import { activeWorkshopEntries } from '../lib/workshop-schema'
import { workshopLibrary } from '../lib/workshop-library'

const router = Router()
router.use(requireAuth)

type ContentType = 'background' | 'feat' | 'spell' | 'orcbrew'
const TYPE_MAP: Record<string, ContentType> = {
  backgrounds: 'background', feats: 'feat', spells: 'spell', 'orcbrew-packs': 'orcbrew',
}
const createSchema = z.record(z.string(), z.any())
const orcbrewSchema = z.object({
  filename: z.string().min(1).max(255).regex(/\.orcbrew$/i),
  source: z.string().min(1).max(8 * 1024 * 1024)
    .refine((source) => Buffer.byteLength(source, 'utf8') <= 8 * 1024 * 1024, 'File must be 8 MB or smaller'),
})

function packSummary(doc: { _id: unknown; data: unknown }) {
  const data = doc.data as { filename: string; includeDisabled?: boolean }
  try {
    return { id: String(doc._id), filename: data.filename, includeDisabled: data.includeDisabled === true, report: parsedPack(data).report }
  } catch (error) {
    return { id: String(doc._id), filename: data.filename, error: error instanceof Error ? error.message : 'Could not read saved file' }
  }
}

router.get('/homebrew/:kind', async (req, res) => {
  const kind = req.params.kind as OrcbrewKind
  if (!ORCBREW_KINDS.includes(kind)) return res.status(404).json({ error: 'Unknown homebrew content type' })
  const entries=(await workshopLibrary(req.userId)).catalog[kind]
  res.json(kind==='classes'||kind==='subclasses'||kind==='races'?activeWorkshopEntries(entries,kind):entries)
})

router.get('/orcbrew-packs/:id/export', async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid file ID' })
  const doc = await CustomContent.findOne({ _id: req.params.id, userId: req.userId, type: 'orcbrew' }).lean()
  if (!doc) return res.status(404).json({ error: 'File not found' })
  const data = doc.data as { filename: string; source: string }
  res.attachment(data.filename).type('application/octet-stream').send(Buffer.from(data.source, 'utf8'))
})

router.patch('/orcbrew-packs/:id', async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid file ID' })
  const parsed = z.object({ includeDisabled: z.boolean() }).safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid file settings' })
  const doc = await CustomContent.findOneAndUpdate(
    { _id: req.params.id, userId: req.userId, type: 'orcbrew' },
    { $set: { 'data.includeDisabled': parsed.data.includeDisabled } }, { new: true },
  ).lean()
  if (!doc) return res.status(404).json({ error: 'File not found' })
  res.json(packSummary(doc))
})

router.get('/:type', async (req, res) => {
  const type = TYPE_MAP[req.params.type]
  if (!type) return res.status(404).json({ error: 'Unknown content type' })
  const items = await CustomContent.find({ userId: req.userId, type }).lean()
  res.json(type === 'orcbrew' ? items.map(packSummary) : items.map((item) => ({ ...(item.data as Record<string, unknown>), id: item._id })))
})

router.post('/:type', async (req, res) => {
  const type = TYPE_MAP[req.params.type]
  if (!type) return res.status(404).json({ error: 'Unknown content type' })
  if (type !== 'orcbrew') {
    const parsed = createSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' })
    const doc = await CustomContent.create({ userId: req.userId, type, data: parsed.data })
    return res.status(201).json({ ...parsed.data, id: doc._id })
  }
  const parsed = orcbrewSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid Orcbrew file' })
  const hash = sourceHash(parsed.data.source)
  let existing = await CustomContent.findOne({ userId: req.userId, type, sourceHash: hash }).lean()
  if (!existing) {
    const legacy = await CustomContent.find({ userId: req.userId, type, sourceHash: { $exists: false } }).lean()
    existing = legacy.find((doc) => sourceHash(String((doc.data as { source?: string }).source ?? '')) === hash) ?? null
  }
  if (existing) return res.status(200).json({ ...packSummary(existing), duplicate: true })
  const data = { ...parsed.data, includeDisabled: false }
  try {
    parsedPack(data)
  } catch (error) {
    return res.status(400).json({ error: `Could not read Orcbrew file: ${error instanceof Error ? error.message : 'Invalid data'}` })
  }
  try {
    // Store the original once. Derived entries are cached instead of duplicating multi-megabyte files in MongoDB.
    await CustomContent.init()
    const doc = await CustomContent.create({ userId: req.userId, type, sourceHash: hash, data })
    return res.status(201).json({ ...packSummary(doc), duplicate: false })
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error
    const duplicate = await CustomContent.findOne({ userId: req.userId, type, sourceHash: hash }).lean()
    if (!duplicate) throw error
    return res.status(200).json({ ...packSummary(duplicate), duplicate: true })
  }
})

router.put('/:type/:id', async (req, res) => {
  const type = TYPE_MAP[req.params.type]
  if (!type) return res.status(404).json({ error: 'Unknown content type' })
  if (type === 'orcbrew') return res.status(405).json({ error: 'Import the revised Orcbrew file to add a new version' })
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid content ID' })
  const parsed = createSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' })
  const doc = await CustomContent.findOneAndUpdate(
    { _id: req.params.id, userId: req.userId, type }, { $set: { data: parsed.data } }, { new: true },
  ).lean()
  if (!doc) return res.status(404).json({ error: 'Not found' })
  res.json({ ...parsed.data, id: doc._id })
})

router.delete('/:type/:id', async (req, res) => {
  const type = TYPE_MAP[req.params.type]
  if (!type) return res.status(404).json({ error: 'Unknown content type' })
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid content ID' })
  if (type === 'orcbrew') {
    const doc = await CustomContent.findOne({ _id: req.params.id, userId: req.userId, type }).lean()
    if (!doc) return res.status(404).json({ error: 'Not found' })
    let entries: ReturnType<typeof buildOrcbrewCatalog>['spells'] = []
    try {
      const data = doc.data as { filename: string }
      entries = buildOrcbrewCatalog([{ id: String(doc._id), filename: data.filename, includeDisabled: true, parsed: parsedPack(data) }]).spells
    } catch {
      // Corrupt legacy files can still be removed.
    }
    const replacements = entries.flatMap((entry) => (entry.aliases as string[]).map((alias) => ({ alias, index: entry.index })))
    if (replacements.length) {
      const remap = (field: string) => ({ $map: {
        input: { $ifNull: [`$spellcasting.${field}`, []] }, as: 'spell', in: { $switch: {
          branches: replacements.map(({ alias, index }) => ({ case: { $eq: ['$$spell', alias] }, then: index })), default: '$$spell',
        } },
      } })
      // Convert old file-scoped references before removal so surviving overlapping packs keep resolving them.
      await Character.collection.updateMany({
        userId: doc.userId,
        $or: [
          { 'spellcasting.prepared': { $in: replacements.map((item) => item.alias) } },
          { 'spellcasting.known': { $in: replacements.map((item) => item.alias) } },
        ],
      }, [{ $set: { 'spellcasting.prepared': remap('prepared'), 'spellcasting.known': remap('known') } }])
    }
  }
  const result = await CustomContent.deleteOne({ _id: req.params.id, userId: req.userId, type })
  if (!result.deletedCount) return res.status(404).json({ error: 'Not found' })
  res.json({ ok: true })
})

export default router
