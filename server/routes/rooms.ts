import { Router } from 'express'
import { randomBytes } from 'node:crypto'
import { isValidObjectId } from 'mongoose'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth'
import { Room } from '../models/Room'
import { Character } from '../models/Character'
import { User } from '../models/User'
import { characterOutput, savedCharacterOutput, quickSheetOutput } from '../lib/character-output'
import { applyPlayUpdate, playUpdateSchema } from '../lib/play-update'
import { workshopLibrary, workshopRevision } from '../lib/workshop-library'
import { activeWorkshopEntries } from '../lib/workshop-schema'
import { ORCBREW_KINDS, type OrcbrewKind } from '../lib/orcbrew'
import type { Character as CharacterData } from '../../shared/character'
import { requestLimit } from '../middleware/request-limit'
import { innateRaceSpells } from '../../shared/workshop-race'
import { sheetReferences } from '../lib/sheet-references'
import { resolveWorkshopCharacter } from '../lib/workshop-library'
import { isRevenantShadow } from '../../shared/class-rules'
import { progressionClasses } from '../../shared/character-progression'

const router = Router()
router.use(requireAuth)
const token = () => randomBytes(32).toString('base64url')
const nameSchema = z.object({ name: z.string().trim().min(1).max(100) }).strict()
const summaryFields = 'meta.name meta.race meta.klass meta.level meta.subclass meta.background meta.portrait companionKind updatedAt'
const accessible = (id: string, userId: string | undefined) => isValidObjectId(id)
  ? Room.findOne({ _id: id, $or: [{ ownerId: userId }, { members: userId }] }) : Promise.resolve(null)

router.get('/', async (req, res) => {
  const rooms = await Room.find({ $or: [{ ownerId: req.userId }, { members: req.userId }] }).select('name ownerId members').sort({ createdAt: -1 }).lean()
  res.json(rooms.map(room => ({ id: String(room._id), name: room.name, role: String(room.ownerId) === req.userId ? 'dm' : 'player', memberCount: room.members.length })))
})

router.post('/', async (req, res) => {
  const parsed = nameSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Give your room a name of up to 100 characters.' })
  const room = await Room.create({ ownerId: req.userId, name: parsed.data.name, joinToken: token() })
  res.status(201).json({ id: String(room._id) })
})

router.post('/join', requestLimit('room-join', 30, 900), async (req, res) => {
  const parsed = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }).strict().safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'This room link is invalid.' })
  const room = await Room.findOne({ joinToken: parsed.data.token })
  if (!room) return res.status(404).json({ error: 'This room link has been replaced or is invalid. Ask your DM for the current link.' })
  if (String(room.ownerId) !== req.userId) await Room.updateOne({ _id: room._id, joinToken: parsed.data.token }, { $addToSet: { members: req.userId }, $inc: { __v: 1 } })
  res.json({ id: String(room._id), name: room.name })
})

router.get('/:roomId', async (req, res) => {
  const room = await accessible(String(req.params.roomId), req.userId)
  if (!room) return res.status(404).json({ error: 'Room not found or access has ended.' })
  const dm = String(room.ownerId) === req.userId
  const members = await User.find({ _id: { $in: dm ? room.members : [req.userId] } }).select('displayName email').lean()
  const assigned = room.assignments.filter(a => dm || String(a.userId) === req.userId)
  const characters = await Character.find({ userId: room.ownerId, ...(dm ? {} : { _id: { $in: assigned.map(a => a.characterId) } }) }).select(summaryFields).sort({ 'meta.name': 1 }).lean()
  res.json({ id: String(room._id), name: room.name, role: dm ? 'dm' : 'player', memberCount: room.members.length, members: members.map(m => ({ id: String(m._id), displayName: m.displayName, ...(dm ? { email: m.email } : {}) })), characters: characters.map(c => ({ ...c, assignedTo: String(assigned.find(a => String(a.characterId) === String(c._id))?.userId ?? '') || null })), ...(dm ? { joinToken: room.joinToken } : {}) })
})

router.patch('/:roomId', async (req, res) => {
  const parsed = nameSchema.safeParse(req.body)
  if (!parsed.success || !isValidObjectId(req.params.roomId)) return res.status(400).json({ error: 'Invalid room name.' })
  const room = await Room.findOneAndUpdate({ _id: req.params.roomId, ownerId: req.userId }, { $set: { name: parsed.data.name }, $inc: { __v: 1 } })
  if (!room) return res.status(404).json({ error: 'Room not found.' })
  res.json({ ok: true })
})

router.post('/:roomId/join-link', async (req, res) => {
  if (!isValidObjectId(req.params.roomId)) return res.status(404).json({ error: 'Room not found.' })
  const room = await Room.findOneAndUpdate({ _id: req.params.roomId, ownerId: req.userId }, { $set: { joinToken: token() }, $inc: { __v: 1 } }, { new: true })
  if (!room) return res.status(404).json({ error: 'Room not found.' })
  res.json({ token: room.joinToken })
})

router.post('/:roomId/assignments', async (req, res) => {
  const parsed = z.object({ characterId: z.string().refine(isValidObjectId), userId: z.string().refine(isValidObjectId).nullable() }).strict().safeParse(req.body)
  if (!parsed.success || !isValidObjectId(req.params.roomId)) return res.status(400).json({ error: 'Invalid character assignment.' })
  const room = await Room.findOne({ _id: req.params.roomId, ownerId: req.userId })
  if (!room) return res.status(404).json({ error: 'Room not found.' })
  const { characterId, userId } = parsed.data
  if (userId && !room.members.some(id => String(id) === userId)) return res.status(400).json({ error: 'The player must join this room first.' })
  if (!await Character.exists({ _id: characterId, userId: req.userId })) return res.status(404).json({ error: 'You can assign only characters you own.' })
  room.assignments = room.assignments.filter(a => String(a.characterId) !== characterId) as typeof room.assignments
  if (userId) room.assignments.push({ characterId, userId } as never)
  try { await room.save() } catch (error) { if (error instanceof Error && error.name === 'VersionError') return res.status(409).json({ error: 'The room changed. Refresh and try the assignment again.' }); throw error }
  res.json({ ok: true })
})

router.delete('/:roomId/members/:userId', async (req, res) => {
  if (!isValidObjectId(req.params.roomId) || !isValidObjectId(req.params.userId)) return res.status(404).json({ error: 'Room member not found.' })
  const room = await Room.findOneAndUpdate({ _id: req.params.roomId, ownerId: req.userId }, { $pull: { members: req.params.userId, assignments: { userId: req.params.userId } }, $inc: { __v: 1 } })
  if (!room) return res.status(404).json({ error: 'Room not found.' })
  res.json({ ok: true })
})

// Every sheet and reference request checks membership, assignment, and current ownership.
router.use('/:roomId/characters/:characterId', async (req, res, next) => {
  const room = await accessible(String(req.params.roomId), req.userId)
  if (!room || !isValidObjectId(req.params.characterId)) return res.status(404).json({ error: 'Character access is unavailable.' })
  const dm = String(room.ownerId) === req.userId
  if (!dm && !room.assignments.some(a => String(a.characterId) === req.params.characterId && String(a.userId) === req.userId)) return res.status(404).json({ error: 'Character access is unavailable.' })
  const character = await Character.findOne({ _id: req.params.characterId, userId: room.ownerId }).lean()
  if (!character) return res.status(404).json({ error: 'Character access is unavailable.' })
  res.locals.roomCharacter = { ownerId: String(room.ownerId), dm, raw: character }
  next()
})

router.get('/:roomId/characters/:characterId', async (req, res) => {
  const { raw, ownerId, dm } = res.locals.roomCharacter
  res.json(req.query.view==='quick'?{...quickSheetOutput(raw,!dm),libraryRevision:await workshopRevision(ownerId)}:await characterOutput(raw, ownerId, !dm))
})
router.get('/:roomId/characters/:characterId/references',async(_req,res)=>{
  const {raw,ownerId,dm}=res.locals.roomCharacter
  const library=await workshopLibrary(ownerId)
  const resolved=await resolveWorkshopCharacter(raw,ownerId,library)
  res.json({...sheetReferences(resolved,library),character:savedCharacterOutput(resolved,!dm)})
})

const hasChampions=(raw:CharacterData)=>progressionClasses(raw).some(entry=>isRevenantShadow(entry.name))
router.get('/:roomId/characters/:characterId/champions',async(_req,res)=>{
  const {raw,ownerId}=res.locals.roomCharacter
  if(!hasChampions(raw))return res.status(404).json({error:'This character has no Shadow Champions feature.'})
  res.json(await Character.find({userId:ownerId,companionKind:'shadow-champion'}).select(summaryFields).sort({'meta.name':1}).lean())
})
// Companion reads inherit the source character's membership/assignment check above.
// Only explicitly marked companions are exposed, and this path has no write route.
router.use('/:roomId/characters/:characterId/champions/:championId',async(req,res,next)=>{
  const {raw,ownerId}=res.locals.roomCharacter
  if(!hasChampions(raw)||!isValidObjectId(req.params.championId))return res.status(404).json({error:'Champion access is unavailable.'})
  const champion=await Character.findOne({_id:req.params.championId,userId:ownerId,companionKind:'shadow-champion'}).lean()
  if(!champion)return res.status(404).json({error:'Champion access is unavailable.'})
  res.locals.roomCharacter={raw:champion,ownerId,dm:false};next()
})
router.get('/:roomId/characters/:characterId/champions/:championId',async(req,res)=>{
  const {raw,ownerId}=res.locals.roomCharacter
  res.json(req.query.view==='quick'?{...quickSheetOutput(raw,true),libraryRevision:await workshopRevision(ownerId)}:await characterOutput(raw,ownerId,true))
})
router.get('/:roomId/characters/:characterId/champions/:championId/references',async(_req,res)=>{
  const {raw,ownerId}=res.locals.roomCharacter,library=await workshopLibrary(ownerId)
  const resolved=await resolveWorkshopCharacter(raw,ownerId,library)
  res.json({...sheetReferences(resolved,library),character:savedCharacterOutput(resolved,true)})
})

router.patch('/:roomId/characters/:characterId/play', async (req, res) => {
  const parsed = playUpdateSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid play action. Permanent character changes require the DM.' })
  const { raw, ownerId, dm } = res.locals.roomCharacter
  if (new Date(raw.updatedAt).toISOString() !== parsed.data.expectedUpdatedAt) return res.status(409).json({ error: 'This sheet changed elsewhere. Refresh before repeating your action.' })
  const before = await characterOutput(raw, ownerId)
  let set: Record<string, unknown>
  try { set = applyPlayUpdate(before, parsed.data) } catch (error) { return res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid play action.' }) }
  if (!Object.keys(set).length) return res.json(await characterOutput(raw, ownerId, !dm))
  const saved = await Character.findOneAndUpdate({ _id: raw._id, userId: ownerId, updatedAt: raw.updatedAt }, { $set: set }, { new: true, runValidators: true }).lean()
  if (!saved) return res.status(409).json({ error: 'This sheet changed elsewhere. Refresh before repeating your action.' })
  res.json(await characterOutput(saved, ownerId, !dm))
})

router.get('/:roomId/characters/:characterId/references/:kind', async (req, res) => {
  const kind = req.params.kind as OrcbrewKind
  if (!ORCBREW_KINDS.includes(kind)) return res.status(404).json({ error: 'Reference not found.' })
  const { raw, ownerId } = res.locals.roomCharacter
  const library = await workshopLibrary(ownerId)
  const c = await characterOutput(raw, ownerId) as CharacterData
  const entries = library.catalog[kind]
  const wantedNames = [c.meta.race, c.meta.subrace, c.meta.klass, c.meta.subclass, c.meta.background, ...(c.meta.classLevels ?? []).map(e => e.name), ...c.features.map(f => f.name), ...c.features.filter(f => /^feats?$/i.test(f.name.trim())).flatMap(f => f.description.split(/[,;\n]/))].map(s => s.trim().toLowerCase())
  const spellIds = new Set([...c.spellcasting.known, ...c.spellcasting.prepared,...innateRaceSpells(c).map(s=>s.index)])
  const filtered = entries.filter(e => kind === 'spells' ? spellIds.has(e.index) || (e.aliases as string[]).some(a => spellIds.has(a)) : wantedNames.includes(e.name.toLowerCase()))
  res.json(kind === 'classes' || kind === 'subclasses' || kind === 'races' ? activeWorkshopEntries(filtered, kind) : filtered)
})

export default router
