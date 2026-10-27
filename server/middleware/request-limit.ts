import { createHmac } from 'node:crypto'
import type { RequestHandler } from 'express'
import { RequestLimit } from '../models/RequestLimit'
import { env } from '../env'

/** Shared database limits remain effective across Vercel function instances. */
export function requestLimit(scope: string, maximum: number, seconds: number): RequestHandler {
  return async (req, res, next) => {
    const bucket = Math.floor(Date.now() / (seconds * 1000))
    const identifier = createHmac('sha256', env.JWT_SECRET).update(`${scope}:${req.ip ?? 'unknown'}:${bucket}`).digest('hex')
    res.locals.databaseOperation = 'request-limit'
    const record = await RequestLimit.findOneAndUpdate({ _id: identifier }, { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((bucket + 1) * seconds * 1000) } }, { upsert: true, new: true })
    delete res.locals.databaseOperation
    if (record.count > maximum) {
      res.setHeader('Retry-After', Math.max(1, Math.ceil(((bucket + 1) * seconds * 1000 - Date.now()) / 1000)))
      return res.status(429).json({ error: 'Too many attempts. Please wait before trying again.' })
    }
    next()
  }
}
