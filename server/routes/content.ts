import { Router } from 'express'
import { z } from 'zod'
import { CustomContent } from '../models/CustomContent'
import { requireAuth } from '../middleware/auth'

const router = Router()
router.use(requireAuth)

type ContentType = 'background' | 'feat' | 'spell'

const TYPE_MAP: Record<string, ContentType> = {
  backgrounds: 'background',
  feats: 'feat',
  spells: 'spell',
}

router.get('/:type', async (req, res) => {
  const type = TYPE_MAP[req.params.type]
  if (!type) return res.status(404).json({ error: 'Unknown content type' })
  const items = await CustomContent.find({ userId: req.userId, type }).lean()
  res.json(items.map((i) => ({ id: i._id, ...(i.data as Record<string, unknown>) })))
})

const createSchema = z.record(z.string(), z.any())

router.post('/:type', async (req, res) => {
  const type = TYPE_MAP[req.params.type]
  if (!type) return res.status(404).json({ error: 'Unknown content type' })
  const parsed = createSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' })
  const doc = await CustomContent.create({
    userId: req.userId,
    type,
    data: parsed.data as Record<string, unknown>,
  })
  res.status(201).json({ id: doc._id, ...(parsed.data as Record<string, unknown>) })
})

router.put('/:type/:id', async (req, res) => {
  const type = TYPE_MAP[req.params.type]
  if (!type) return res.status(404).json({ error: 'Unknown content type' })
  const parsed = createSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' })
  const doc = await CustomContent.findOneAndUpdate(
    { _id: req.params.id, userId: req.userId, type },
    { $set: { data: parsed.data as Record<string, unknown> } },
    { new: true },
  ).lean()
  if (!doc) return res.status(404).json({ error: 'Not found' })
  res.json({ id: doc._id, ...(parsed.data as Record<string, unknown>) })
})

router.delete('/:type/:id', async (req, res) => {
  const type = TYPE_MAP[req.params.type]
  if (!type) return res.status(404).json({ error: 'Unknown content type' })
  const result = await CustomContent.deleteOne({
    _id: req.params.id,
    userId: req.userId,
    type,
  })
  if (result.deletedCount === 0) return res.status(404).json({ error: 'Not found' })
  res.json({ ok: true })
})

export default router
