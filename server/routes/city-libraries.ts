import {Router, type Request} from 'express'
import mongoose, {isValidObjectId, type ClientSession} from 'mongoose'
import {z} from 'zod'
import {CityLibrary} from '../models/CityLibrary'
import {Notebook} from '../models/Notebook'
import {requireAuth} from '../middleware/auth'
import {requestLimit} from '../middleware/request-limit'
import {libraryContext, notebookScope, libraryFail as fail, RoomLibraryError, type LibraryContext} from '../lib/room-library-access'
import {CITY_CATEGORIES, CITY_LIMITS} from '../../shared/map-city-library'

const router = Router({mergeParams: true})
router.use(requireAuth)
const id = z.string().refine(isValidObjectId).transform(value => value.toLowerCase())
const expected = z.object({expectedRevision: z.number().int().min(1)}).strict()
const draft = z.object({
  description: z.string().trim().max(500),
  categories: z.array(z.string().trim().min(1).max(30)).min(1).max(CITY_LIMITS.categories),
  entries: z.array(z.object({id, category: z.string().trim().min(1).max(30), relation: z.string().trim().max(60), description: z.string().trim().max(240)}).strict()).max(CITY_LIMITS.entries),
}).strict().superRefine((value, ctx) => {
  if (new Set(value.categories.map(c => c.toLocaleLowerCase())).size !== value.categories.length) ctx.addIssue({code: 'custom', message: 'Category names must be different.'})
  if (value.categories.some(c => c.toLocaleLowerCase() === 'overview')) ctx.addIssue({code: 'custom', message: 'Overview is reserved for the combined city view.'})
  if (new Set(value.entries.map(e => e.id)).size !== value.entries.length) ctx.addIssue({code: 'custom', message: 'Link each note only once per city.'})
  if (value.entries.some(e => !value.categories.includes(e.category))) ctx.addIssue({code: 'custom', message: 'Choose a category for every entry.'})
})
function parsed<T>(schema: z.ZodType<T>, value: unknown): T {const result = schema.safeParse(value); if (!result.success) return fail(400, result.error.issues[0]?.message ?? 'Invalid city library.'); return result.data}
function context(req: Request, session?: ClientSession) {
  const preview = req.query.previewCharacter === undefined ? undefined : parsed(id, req.query.previewCharacter)
  return libraryContext(String(req.params.roomId), req.userId!, preview, session)
}
function manage(ctx: LibraryContext) {if (!ctx.dm || ctx.readOnly) fail(403, 'Only the DM can organise city libraries. Player preview is read-only.')}
async function root(req: Request, ctx: LibraryContext, session?: ClientSession) {
  if (!isValidObjectId(String(req.params.entryId))) return fail(404, 'City note not found or access has ended.')
  const note = await Notebook.findOne({_id: req.params.entryId, roomId: ctx.room._id, kind: 'entry', deletedAt: null, ...await notebookScope(ctx)}).select('title').session(session ?? null).lean()
  if (!note) return fail(404, 'City note not found or access has ended.')
  return note
}
let indexes: Promise<unknown> | undefined
async function transaction<T>(fn: (session: ClientSession) => Promise<T>) {
  indexes ??= CityLibrary.createIndexes().catch(error => {indexes = undefined; throw error})
  await indexes
  return mongoose.connection.transaction(fn)
}
router.get('/:entryId', async (req, res) => {
  const ctx = await context(req), note = await root(req, ctx)
  const city = await CityLibrary.findOne({roomId: ctx.room._id, entryId: note._id, enabled: true}).lean()
  if (!city) return fail(404, 'City library not found.')
  const notes = await Notebook.find({_id: {$in: city.entries.map(e => e.entryId)}, roomId: ctx.room._id, kind: 'entry', ...(!ctx.dm ? {deletedAt: null} : {}), ...await notebookScope(ctx)}).select('title audience deletedAt').lean()
  const byId = new Map(notes.map(n => [String(n._id), n]))
  const entries = city.entries.filter(e => ctx.dm || byId.has(String(e.entryId))).map(e => {
    const linked = byId.get(String(e.entryId))
    return {id: String(e.entryId), title: linked?.title ?? 'Unavailable note', category: e.category, relation: e.relation, description: e.description, audience: linked?.audience ?? 'dm', unavailable: !linked || !!linked.deletedAt}
  })
  // Empty/hidden-only category names and private counts are not sent to players.
  res.json({entryId: String(note._id), title: note.title, description: city.description, revision: city.revision,
    categories: ctx.dm ? city.categories : city.categories.filter(c => entries.some(e => e.category === c)), entries, canUndo: ctx.dm && !!city.previous})
})
router.use(requestLimit('city-library-write', 60, 60))
router.post('/:entryId', async (req, res) => {
  parsed(z.object({}).strict(), req.body)
  await transaction(async session => {
    const ctx = await context(req, session); manage(ctx)
    const note = await root(req, ctx, session)
    const old = await CityLibrary.findOne({roomId: ctx.room._id, entryId: note._id}).session(session).lean()
    if (old?.enabled) return fail(409, 'This city already has a library. Reopen the pin to load it.')
    if (old) await CityLibrary.updateOne({_id: old._id}, {$set: {enabled: true}, $inc: {revision: 1}}, {session})
    else await CityLibrary.create([{roomId: ctx.room._id, entryId: note._id, categories: [...CITY_CATEGORIES]}], {session})
  })
  res.status(201).json({ok: true})
})
router.patch('/:entryId', async (req, res) => {
  const input = parsed(expected.extend({draft}).strict(), req.body)
  await transaction(async session => {
    const ctx = await context(req, session); manage(ctx)
    const note = await root(req, ctx, session)
    const city = await CityLibrary.findOne({roomId: ctx.room._id, entryId: note._id, enabled: true}).session(session).lean()
    if (!city) return fail(404, 'City library not found.')
    if (input.draft.entries.some(e => e.id === String(note._id))) return fail(400, 'Link another notebook entry; the city already has its own note.')
    const linked = await Notebook.find({_id: {$in: input.draft.entries.map(e => e.id)}, roomId: ctx.room._id, kind: 'entry'}).select('deletedAt').session(session).lean()
    const available = new Set(linked.filter(n => !n.deletedAt).map(n => String(n._id))), existing = new Set(city.entries.map(e => String(e.entryId)))
    if (input.draft.entries.some(e => !available.has(e.id) && !existing.has(e.id))) return fail(400, 'Choose available notebook entries from this room.')
    const result = await CityLibrary.updateOne({_id: city._id, revision: input.expectedRevision}, {$set: {
      description: input.draft.description, categories: input.draft.categories,
      entries: input.draft.entries.map(e => ({entryId: e.id, category: e.category, relation: e.relation, description: e.description})),
      previous: {description: city.description, categories: city.categories, entries: city.entries},
    }, $inc: {revision: 1}}, {session})
    if (!result.modifiedCount) fail(409, 'This city library changed elsewhere. Reload it before saving; your draft is kept.')
  })
  res.json({ok: true})
})
router.post('/:entryId/undo', async (req, res) => {
  const input = parsed(expected, req.body)
  await transaction(async session => {
    const ctx = await context(req, session); manage(ctx)
    const note = await root(req, ctx, session), city = await CityLibrary.findOne({roomId: ctx.room._id, entryId: note._id, enabled: true}).session(session).lean()
    if (!city?.previous) return fail(409, 'There is no city edit to undo.')
    const result = await CityLibrary.updateOne({_id: city._id, revision: input.expectedRevision}, {$set: {description: city.previous.description, categories: city.previous.categories, entries: city.previous.entries}, $unset: {previous: 1}, $inc: {revision: 1}}, {session})
    if (!result.modifiedCount) fail(409, 'This city library changed elsewhere. Reload before undoing.')
  })
  res.json({ok: true})
})
router.post('/:entryId/remove', async (req, res) => {
  const input = parsed(expected, req.body)
  await transaction(async session => {
    const ctx = await context(req, session); manage(ctx)
    const note = await root(req, ctx, session)
    const result = await CityLibrary.updateOne({roomId: ctx.room._id, entryId: note._id, enabled: true, revision: input.expectedRevision}, {$set: {enabled: false}, $inc: {revision: 1}}, {session})
    if (!result.modifiedCount) fail(409, 'This city library changed elsewhere. Reload before removing it.')
  })
  res.json({ok: true})
})
router.use((error: Error, _req: unknown, res: import('express').Response, next: import('express').NextFunction) => {
  if (error instanceof RoomLibraryError) return res.status(error.status).json({error: error.message})
  next(error)
})
export default router
