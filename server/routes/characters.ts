import { Router } from 'express'
import { z } from 'zod'
import { Character } from '../models/Character'
import { requireAuth } from '../middleware/auth'

const router = Router()
router.use(requireAuth)

const SUMMARY_FIELDS =
  'meta.name meta.race meta.klass meta.level meta.subclass meta.background meta.portrait updatedAt'

router.get('/', async (req, res) => {
  const chars = await Character.find({ userId: req.userId })
    .select(SUMMARY_FIELDS)
    .sort({ updatedAt: -1 })
    .lean()
  res.json(chars)
})

router.post('/', async (req, res) => {
  const char = await Character.create({ userId: req.userId, ...req.body })
  res.status(201).json(char)
})

router.get('/:id', async (req, res) => {
  const char = await Character.findOne({ _id: req.params.id, userId: req.userId }).lean()
  if (!char) return res.status(404).json({ error: 'Character not found' })
  res.json(char)
})

router.patch('/:id', async (req, res) => {
  const char = await Character.findOneAndUpdate(
    { _id: req.params.id, userId: req.userId },
    { $set: req.body },
    { new: true, runValidators: true },
  ).lean()
  if (!char) return res.status(404).json({ error: 'Character not found' })
  res.json(char)
})

router.delete('/:id', async (req, res) => {
  const result = await Character.deleteOne({ _id: req.params.id, userId: req.userId })
  if (result.deletedCount === 0) return res.status(404).json({ error: 'Character not found' })
  res.json({ ok: true })
})

router.post('/:id/duplicate', async (req, res) => {
  const original = await Character.findOne({ _id: req.params.id, userId: req.userId }).lean()
  if (!original) return res.status(404).json({ error: 'Character not found' })
  const { _id, createdAt, updatedAt, __v, ...rest } = original as any
  delete rest.userId
  const copy = await Character.create({
    ...rest,
    meta: { ...rest.meta, name: `${rest.meta?.name ?? 'Character'} (copy)` },
  })
  res.status(201).json(copy)
})

router.get('/:id/export', async (req, res) => {
  const char = await Character.findOne({ _id: req.params.id, userId: req.userId }).lean()
  if (!char) return res.status(404).json({ error: 'Character not found' })
  const name = (char.meta as any)?.name ?? 'character'
  const filename = `${name.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}.json`
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.send(JSON.stringify(char, null, 2))
})

const importSchema = z.record(z.string(), z.any())

router.post('/import', async (req, res) => {
  const parsed = importSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid JSON' })
  const data: any = parsed.data
  // strip identity fields so we never import another user's id
  delete data._id
  delete data.userId
  delete data.createdAt
  delete data.updatedAt
  delete data.__v
  const char = await Character.create({ userId: req.userId, ...data })
  res.status(201).json(char)
})

export default router
