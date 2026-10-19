import { Router, type RequestHandler } from 'express'
import { isValidObjectId } from 'mongoose'
import { z } from 'zod'
import { requireAuth } from './auth'
import { requestLimit } from './request-limit'
import { Upload, UploadPart } from '../models/Upload'

const CHUNK_BYTES = 768 * 1024
const MAX_BYTES = 50 * 1024 * 1024
const allowed = (method: string, path: string) => method === 'POST' && ['/api/content/orcbrew-packs', '/api/characters', '/api/characters/import', '/api/characters/import/dmv/preview', '/api/library-restore', '/api/workshop/publish', '/api/workshop/export'].includes(path)
  || method === 'PATCH' && /^\/api\/characters\/[a-f0-9]{24}$/i.test(path)
export const uploadRoutes = Router()
uploadRoutes.use(requireAuth)
uploadRoutes.post('/', requestLimit('large-upload', 10, 3600), async (req, res) => {
  const parsed = z.object({ path: z.string(), method: z.enum(['POST', 'PATCH']), bytes: z.number().int().min(1).max(MAX_BYTES), parts: z.number().int().min(1).max(Math.ceil(MAX_BYTES / CHUNK_BYTES)) }).strict().safeParse(req.body)
  if (!parsed.success || !allowed(parsed.data.method, parsed.data.path) || parsed.data.parts !== Math.ceil(parsed.data.bytes / CHUNK_BYTES)) return res.status(400).json({ error: 'Unsupported large upload.' })
  if (await Upload.exists({ userId: req.userId, claimed: false, expiresAt: { $gt: new Date() } })) return res.status(409).json({ error: 'Another upload is still in progress. Finish it or wait 15 minutes before trying again.' })
  const upload = await Upload.create({ ...parsed.data, userId: req.userId, expiresAt: new Date(Date.now() + 15 * 60 * 1000) })
  res.status(201).json({ id: String(upload._id) })
})
uploadRoutes.post('/:id/parts/:index', async (req, res) => {
  if (!isValidObjectId(req.params.id) || !/^\d+$/.test(String(req.params.index))) return res.status(404).json({ error: 'Upload not found.' })
  const upload = await Upload.findOne({ _id: req.params.id, userId: req.userId, claimed: false, expiresAt: { $gt: new Date() } }).lean()
  const index = Number(req.params.index), parsed = z.object({ data: z.string().max(1048576).regex(/^[A-Za-z0-9+/]*={0,2}$/) }).strict().safeParse(req.body)
  if (!upload || index >= upload.parts || !parsed.success) return res.status(400).json({ error: 'Invalid upload part.' })
  const bytes = Buffer.from(parsed.data.data, 'base64'), expected = index === upload.parts - 1 ? upload.bytes - index * CHUNK_BYTES : CHUNK_BYTES
  if (bytes.length !== expected || bytes.toString('base64') !== parsed.data.data) return res.status(400).json({ error: 'Upload part has an invalid size or encoding.' })
  const previous = await UploadPart.findOne({ uploadId: upload._id, index }).lean()
  if (previous && !Buffer.from(previous.data.buffer).equals(bytes)) return res.status(409).json({ error: 'Upload part changed. Start a fresh upload.' })
  if (!previous) await UploadPart.create({ uploadId: upload._id, index, data: bytes, expiresAt: upload.expiresAt })
  res.json({ ok: true })
})
uploadRoutes.delete('/:id', async (req, res) => {
  if (isValidObjectId(req.params.id)) {
    const removed = await Upload.findOneAndDelete({ _id: req.params.id, userId: req.userId })
    if (removed) await UploadPart.deleteMany({ uploadId: removed._id })
  }
  res.json({ ok: true })
})

/** Assemble below the gateway limit, then use the original authenticated route. */
export const finishUpload: RequestHandler = async (req, res, next) => {
  const id = req.get('x-codex-upload')
  if (!id) return next()
  if (!isValidObjectId(id) || !allowed(req.method, req.path)) return res.status(400).json({ error: 'Invalid upload completion.' })
  const upload = await Upload.findOne({ _id: id, userId: req.userId, path: req.path, method: req.method as 'POST' | 'PATCH', claimed: false, expiresAt: { $gt: new Date() } }).lean()
  if (!upload) return res.status(404).json({ error: 'Upload expired or is unavailable.' })
  const parts = await UploadPart.find({ uploadId: upload._id }).sort({ index: 1 }).lean()
  if (parts.length !== upload.parts || parts.some((part, index) => part.index !== index)) return res.status(400).json({ error: 'Upload is incomplete.' })
  const bytes = Buffer.concat(parts.map(part => Buffer.from(part.data.buffer)))
  if (bytes.length !== upload.bytes) return res.status(400).json({ error: 'Upload is incomplete.' })
  try { req.body = JSON.parse(bytes.toString('utf8')) } catch { return res.status(400).json({ error: 'Invalid JSON upload.' }) }
  if (!await Upload.findOneAndUpdate({ _id: upload._id, userId: req.userId, claimed: false }, { $set: { claimed: true } })) return res.status(409).json({ error: 'This upload has already been submitted.' })
  await UploadPart.deleteMany({ uploadId: upload._id })
  await Upload.deleteOne({ _id: upload._id })
  next()
}

/** Stream large catalogs and backups without a buffered gateway response. */
export const streamLargeResponses: RequestHandler = (_req, res, next) => {
  const send = res.send.bind(res)
  res.send = ((body: unknown) => {
    const bytes = typeof body === 'string' ? Buffer.from(body, 'utf8') : Buffer.isBuffer(body) ? body : undefined
    if (!bytes || bytes.length < 2 * 1024 * 1024) return send(body)
    if (!res.getHeader('Content-Type')) res.type(typeof body === 'string' ? 'html' : 'application/octet-stream')
    res.removeHeader('Content-Length')
    res.flushHeaders()
    let offset = 0
    const write = () => {
      if (res.destroyed) return
      while (offset < bytes.length) {
        const end = Math.min(bytes.length, offset + 64 * 1024), chunk = bytes.subarray(offset, end)
        offset = end
        if (!res.write(chunk)) { res.once('drain', write); return }
      }
      res.end()
    }
    write()
    return res
  }) as typeof res.send
  next()
}
