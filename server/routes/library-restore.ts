import { Router } from 'express'
import { mongo, Types, isValidObjectId } from 'mongoose'
import { requireAuth } from '../middleware/auth'
import { requestLimit } from '../middleware/request-limit'
import { Character } from '../models/Character'
import { CustomContent } from '../models/CustomContent'
import { parsedPack } from '../lib/orcbrew-library'
import { sourceHash } from '../lib/orcbrew'

const router = Router()
router.use(requireAuth)
router.post('/', requestLimit('library-restore', 5, 3600), async (req, res) => {
  let backup: Record<string, unknown>
  try { backup = mongo.BSON.EJSON.parse(JSON.stringify(req.body)) as Record<string, unknown> } catch { return res.status(400).json({ error: 'This backup could not be read.' }) }
  if (!['codex-public-migration', 'codex-of-heroes-backup'].includes(String(backup.format)) || backup.version !== 1 || !Array.isArray(backup.characters) || !Array.isArray(backup.content) || backup.characters.length > 1000 || backup.content.length > 200) return res.status(400).json({ error: 'Choose a complete Codex library backup.' })
  const userId = new Types.ObjectId(req.userId)
  const identity = (record: Record<string, unknown>) => {
    const id = record._id ?? record.id
    if (!isValidObjectId(id)) throw new Error('The backup contains an invalid record ID.')
    return new Types.ObjectId(String(id))
  }
  let characters: ReturnType<InstanceType<typeof Character>['toObject']>[]
  let content: ReturnType<InstanceType<typeof CustomContent>['toObject']>[]
  try {
    characters = await Promise.all(backup.characters.map(async record => {
      if (!record || typeof record !== 'object') throw new Error('Invalid character record.')
      const {_id, id, userId: _owner, __v, ...data} = record
      const doc = new Character({...data,_id:identity(record),userId})
      await doc.validate()
      return doc.toObject()
    }))
    content = await Promise.all(backup.content.map(async record => {
      if (!record || typeof record !== 'object') throw new Error('Invalid content record.')
      const {_id, id, userId: _owner, __v, ...data} = record
      if (record.type === 'orcbrew') {
        const pack = record.data
        if (!pack || typeof pack.source !== 'string' || Buffer.byteLength(pack.source, 'utf8') > 8 * 1024 * 1024 || typeof pack.filename !== 'string' || !/\.orcbrew$/i.test(pack.filename)) throw new Error('An Orcbrew pack is invalid or exceeds 8 MB.')
        parsedPack(pack)
        data.sourceHash = sourceHash(pack.source)
      }
      const doc = new CustomContent({...data,_id:identity(record),userId})
      await doc.validate()
      return doc.toObject()
    }))
  } catch { return res.status(400).json({ error: 'The backup contains an invalid character or content entry. No data was imported.' }) }
  // Initialising collections/indexes before the transaction also supports an empty Atlas database.
  await Promise.all([Character.init(), CustomContent.init()])
  const session = await Character.db.startSession()
  try {
    await session.withTransaction(async () => {
      if (await Character.exists({userId}).session(session) || await CustomContent.exists({userId}).session(session)) throw new Error('destination-not-empty')
      if (characters.length) await Character.insertMany(characters,{session})
      if (content.length) await CustomContent.insertMany(content,{session})
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'destination-not-empty') return res.status(409).json({error:'Restore into an empty account so no existing characters or content are overwritten.'})
    if ((error as {code?:number}).code === 11000) return res.status(409).json({error:'Some backup records already exist. No data was overwritten.'})
    throw error
  } finally { await session.endSession() }
  res.status(201).json({characters:characters.length,content:content.length})
})
export default router
