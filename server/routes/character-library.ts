import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { isValidObjectId } from 'mongoose'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth'
import { Character } from '../models/Character'
import { CharacterLibrary } from '../models/CharacterLibrary'
import { applyLibraryAction, emptyLibrary, type CharacterLibrary as Library } from '../../shared/character-library'

const router = Router()
router.use(requireAuth)
const folderId = z.string().uuid(), parentId = folderId.nullable(), name = z.string().trim().min(1).max(80)
const actionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('create'), name, parentId }).strict(),
  z.object({ type: z.literal('rename'), folderId, name }).strict(),
  z.object({ type: z.literal('reparent'), folderId, parentId }).strict(),
  z.object({ type: z.literal('remove'), folderId }).strict(),
  z.object({ type: z.literal('move'), characterIds: z.array(z.string().refine(isValidObjectId)).min(1).max(200).transform(ids => [...new Set(ids)]), folderId: parentId }).strict(),
])
const updateSchema = z.object({ expectedRevision: z.number().int().nonnegative(), action: actionSchema }).strict()
const read = async (ownerId: string): Promise<Library> => {
  const doc = await CharacterLibrary.findOne({ ownerId }).lean()
  return doc ? { revision: doc.revision, folders: doc.folders.map(f => ({ id: f.id, name: f.name, parentId: f.parentId ?? null })), placements: doc.placements.map(p => ({ characterId: p.characterId, folderId: p.folderId })) } : emptyLibrary()
}
router.get('/', async (req, res) => { res.set('Cache-Control', 'no-store').json(await read(req.userId!)) })
router.patch('/', async (req, res) => {
  const parsed = updateSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Check the folder name or selected characters and try again.' })
  const { expectedRevision, action } = parsed.data, ownerId = req.userId!
  const current = await read(ownerId)
  if (current.revision !== expectedRevision) return res.status(409).json({ error: 'Your folders changed in another tab. Latest folders reloaded; review and repeat your move.' })
  if (action.type === 'move') {
    const owned = await Character.countDocuments({ userId: ownerId, _id: { $in: action.characterIds } })
    if (owned !== action.characterIds.length) return res.status(404).json({ error: 'One of the characters is no longer available in your library.' })
  }
  let next: Library
  try { next = applyLibraryAction(current, action, randomUUID()) }
  catch (error) { return res.status(400).json({ error: error instanceof Error ? error.message : 'The folder could not be changed.' }) }
  const conflict = () => res.status(409).json({ error: 'Your folders changed in another tab. Latest folders reloaded; review and repeat the action.' })
  if (!current.revision) {
    try { await CharacterLibrary.create({ ownerId, ...next, revision: 1 }) }
    catch (error) { if ((error as { code?: number }).code === 11000) return conflict(); throw error }
  } else {
    const saved = await CharacterLibrary.findOneAndUpdate({ ownerId, revision: expectedRevision }, { $set: { folders: next.folders, placements: next.placements }, $inc: { revision: 1 } }, { new: true })
    if (!saved) return conflict()
  }
  res.set('Cache-Control', 'no-store').json({ ...next, revision: current.revision + 1 })
})
export default router
