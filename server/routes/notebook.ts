import {Router} from 'express'
import mongoose, {isValidObjectId, type ClientSession} from 'mongoose'
import {z} from 'zod'
import {libraryContext, libraryScope, RoomLibraryError as NotebookError, libraryFail as fail} from '../lib/room-library-access'
import {Character} from '../models/Character'
import {User} from '../models/User'
import {Room} from '../models/Room'
import {Notebook, NotebookRevision} from '../models/Notebook'
import {requireAuth} from '../middleware/auth'
import {requestLimit} from '../middleware/request-limit'
import {recoverableModelInitialization} from '../lib/model-initialization'
import {withDatabaseStage} from '../lib/database-error'
import {audienceAllows, folderDescendants, validFolderParent, type FolderAccess} from '../../shared/notebook-folders'
import {notebookEntryType, notebookEntryTypes, notebookIsEvent, notebookQuestStatus, notebookQuestStatuses, notebookReading, notebookSearchText, notebookSessionNumbers, notebookSectionForType} from '../../shared/notebook-codex'
import type {NotebookSection} from '../../shared/notebook'
import {isNotebookCover, NOTEBOOK_COVER_MAX_LENGTH} from '../../shared/notebook-cover'
import {isNotebookArtwork, NOTEBOOK_ARTWORK_MAX_LENGTH, NOTEBOOK_GALLERY_LIMIT} from '../../shared/notebook-gallery'
import {notebookQuestClues, NOTEBOOK_CLUE_LIMIT, NOTEBOOK_CLUE_BODY_LIMIT} from '../../shared/notebook-clues'
import {notebookTags, notebookTagOptions, notebookMatchesTags, notebookTagKey, NOTEBOOK_TAG_LIMIT, NOTEBOOK_TAG_LENGTH} from '../../shared/notebook-tags'

const router = Router({mergeParams: true})
router.use(requireAuth)
const id = z.string().refine(isValidObjectId), ids = z.array(id).max(100).transform(values => [...new Set(values)])
const section = z.enum(['journal', 'story-items'])
const tagSchema=z.string().trim().min(1).max(NOTEBOOK_TAG_LENGTH).refine(value=>!/[\p{Cc}\p{Cf}]/u.test(value),'Tags cannot contain control characters.')
const tagsSchema=z.array(tagSchema).max(NOTEBOOK_TAG_LIMIT).transform(notebookTags)
const clueSchema = z.object({
  id: z.uuid(), title: z.string().trim().min(1).max(120), body: z.string().max(NOTEBOOK_CLUE_BODY_LIMIT),
  sessions: z.array(z.number().int().min(1).max(10000)).max(100).transform(values => [...new Set(values)].sort((a,b) => a-b)),
  audience: z.enum(['dm','room']).default('dm'),
}).strict()
const draftSchema = z.object({
  title: z.string().trim().min(1).max(120), body: z.string().max(60000), section,
  folderId: id.nullable(), audience: z.enum(['room', 'characters', 'dm']), characterIds: ids,
  relevantCharacterIds: ids, relatedIds: ids,
  codexType: z.enum(notebookEntryTypes).optional(),
  showInEvents: z.boolean().optional(),
  questStatus: z.enum(notebookQuestStatuses).nullable().optional(),
  questClues: z.array(clueSchema).max(NOTEBOOK_CLUE_LIMIT).refine(values => new Set(values.map(c => c.id)).size === values.length, 'Clue IDs must be unique.').optional(),
  tags: tagsSchema.optional(),
  coverImage: z.string().max(NOTEBOOK_COVER_MAX_LENGTH).refine(isNotebookCover, 'Choose a valid JPG, PNG or WebP cover image.').optional(),
  gallery:z.array(z.object({id:z.uuid(),image:z.string().max(NOTEBOOK_ARTWORK_MAX_LENGTH).refine(isNotebookArtwork,'Choose a valid JPG, PNG or WebP gallery image.'),title:z.string().trim().max(120),caption:z.string().trim().max(1000)}).strict()).max(NOTEBOOK_GALLERY_LIMIT).refine(values=>new Set(values.map(v=>v.id)).size===values.length,'Gallery image IDs must be unique.').optional(),
}).strict().refine(d => d.audience !== 'characters' || d.characterIds.length > 0, 'Choose at least one character.')
const folderFields = {title: z.string().trim().min(1).max(120), parentId: id.nullable(), audience: z.enum(['room', 'characters', 'dm']), characterIds: ids}
const folderCreateSchema = z.object({...folderFields, section, parentId: folderFields.parentId.default(null), audience: folderFields.audience.default('room'), characterIds: ids.default([])}).strict()
const folderPatchSchema = z.object(folderFields).partial().extend({expectedRevision: z.number().int().min(1)}).strict()
type Draft = z.infer<typeof draftSchema>
type RecordData = mongoose.InferSchemaType<typeof Notebook.schema> & {_id: mongoose.Types.ObjectId}
async function context(roomId: string, userId: string, previewCharacter?: string, session?: ClientSession) {
  const base = await libraryContext(roomId,userId,previewCharacter,session)
  const {room} = base
  const folderRecords = await Notebook.find({roomId: room._id, kind: 'folder'}).session(session ?? null).lean()
  const folders = new Map<string, FolderAccess>(folderRecords.map(f => [String(f._id), {id:String(f._id), parentId:f.parentId ? String(f.parentId) : null, section:f.section, deletedAt:f.deletedAt, audience:f.audience, characterIds:f.characterIds.map(String)}]))
  return {...base, folders, folderRecords}
}
type Context = Awaited<ReturnType<typeof context>>
function scope(ctx: Context): Record<string, unknown> {
  return libraryScope(ctx)
}
function visible(entry: {kind?: unknown; _id?: unknown; folderId?: unknown; audience?: unknown; characterIds?: unknown}, ctx: Context) {
  return ctx.dm || entry.kind === 'folder' || audienceAllows(entry, ctx.allowed)
}
function editable(entry: {section: string; codexType?: string | null}, ctx: Context) {return !ctx.readOnly && (ctx.dm || entry.section === 'journal' && !['quests','events'].includes(entry.codexType ?? ''))}
function validateFolder(data: z.infer<typeof folderCreateSchema>, ctx: Context, existingId: string | null) {
  if (!validFolderParent(existingId, data.parentId, data.section, ctx.folders)) return fail(400, 'Choose a parent in this section. A folder cannot contain itself or its ancestors.')
}
function summary(entry: RecordData, ctx: Context) {
  return {id: String(entry._id), section: entry.section, title: entry.title, folderId: entry.folderId ? String(entry.folderId) : null,
    audience: entry.audience, characterIds: entry.characterIds.map(String).filter(value => ctx.dm || ctx.allowed.includes(value)),
    relevantCharacterIds: entry.relevantCharacterIds.map(String).filter(value => ctx.dm || ctx.allowed.includes(value)),
    revision: entry.revision, updatedAt: entry.updatedAt.toISOString(), editedBy: entry.editedBy, deletedAt: entry.deletedAt?.toISOString() ?? null,
    codexType: notebookEntryType({...entry, section: entry.section as NotebookSection}), showInEvents: notebookIsEvent(entry), sessions: notebookSessionNumbers(entry.body), questStatus: notebookQuestStatus(entry), tags:notebookTags(entry.tags??[])}
}
async function detail(entry: RecordData, ctx: Context) {
  const links = await Notebook.find({roomId: ctx.room._id, kind: 'entry', deletedAt: null, $and: [scope(ctx), {$or: [{_id: {$in: entry.relatedIds}}, {relatedIds: entry._id}]}]}).select('title section codexType relatedIds').lean()
  return {...summary(entry, ctx), body: entry.body, coverImage: entry.coverImage ?? '', gallery:entry.codexType==='places'?entry.gallery??[]:[], questClues: notebookQuestClues(entry,ctx.dm), reading: notebookReading(entry.body), relatedIds: links.filter(link => entry.relatedIds.some(value => String(value) === String(link._id))).map(link => String(link._id)),
    connections: links.map(link => ({id: String(link._id), title: link.title, section: link.section, codexType: notebookEntryType({...link, section: link.section as NotebookSection}), direction: entry.relatedIds.some(value => String(value) === String(link._id)) ? 'outgoing' : 'incoming'}))}
}
async function validateDraft(data: Draft, ctx: Context, existing?: RecordData, session?: ClientSession) {
  const codexType=data.codexType??notebookEntryType({title:data.title,section:data.section,codexType:existing?.section===data.section?existing.codexType:undefined})
  if (codexType === 'events' && !ctx.dm) return fail(403, 'Only the DM can manage events.')
  const showInEvents = codexType === 'events' || (data.showInEvents ?? notebookIsEvent(existing ?? {}))
  if (!ctx.dm && showInEvents !== notebookIsEvent(existing ?? {})) return fail(403, 'Only the DM can change Events listings.')
  if (existing?.codexType === 'quests' && codexType !== 'quests') return fail(400, 'Quests stay in Quests. Mark the quest finished when it is no longer active.')
  if (codexType === 'quests') {
    if (!ctx.dm) return fail(403, 'Only the DM can manage quests.')
    if (!['dm','room'].includes(data.audience) || data.characterIds.length || data.folderId !== null) return fail(400, 'Quests can be DM only or Whole room and cannot be placed in folders.')
  } else if (data.questStatus != null) return fail(400, 'Quest status belongs to quest entries.')
  if (codexType !== 'quests' && data.questClues?.length) return fail(400, 'Add gathered clues to a quest.')
  const questClues = codexType === 'quests' ? data.questClues ?? notebookQuestClues(existing ?? {},true) : []
  const questStatus = codexType === 'quests' ? data.questStatus ?? (existing?.codexType === 'quests' ? notebookQuestStatus(existing) : 'active') : null
  const tags=data.tags??notebookTags(existing?.tags??[])
  if(!ctx.dm&&data.tags!==undefined&&JSON.stringify(tags.map(notebookTagKey).sort())!==JSON.stringify(notebookTags(existing?.tags??[]).map(notebookTagKey).sort()))return fail(403,'Only the DM can change entry tags.')
  if (data.coverImage && codexType !== 'places') return fail(400, 'Cover images belong to place entries.')
  const coverImage = codexType === 'places' ? data.coverImage ?? existing?.coverImage ?? '' : ''
  if(data.gallery?.length&&codexType!=='places')return fail(400,'Galleries belong to place entries.')
  const gallery=codexType==='places'?data.gallery??existing?.gallery??[]:[]
  if (!ctx.dm) {
    if (data.section !== 'journal' || existing && (data.audience !== existing.audience || data.characterIds.join(',') !== existing.characterIds.map(String).filter(value => ctx.allowed.includes(value)).join(','))) return fail(403, 'Only the DM can change sharing or story items.')
    if (!existing && data.audience !== 'room') return fail(403, 'New player notes are shared with the room. Ask the DM to change sharing.')
    if (existing && data.folderId !== (existing.folderId ? String(existing.folderId) : null)) {
      const unfiled = data.folderId === null && existing.folderId && !validFolderParent(null, String(existing.folderId), existing.section, ctx.folders)
      if (!unfiled) return fail(403, 'Only the DM can move existing entries between folders.')
    }
  }
  if (notebookSectionForType(codexType) !== data.section) return fail(400, 'Objects belong in Story items; other categories belong in the Journal.')
  if (existing && data.section !== existing.section && !ctx.dm) return fail(403, 'Only the DM can move entries between collections.')
  if (data.folderId && !validFolderParent(null, data.folderId, data.section, ctx.folders)) return fail(400, 'Choose an available folder in this section.')
  const requested = [...new Set([...data.characterIds, ...data.relevantCharacterIds])]
  const validCharacters = await Character.find({_id: {$in: requested}, userId: ctx.room.ownerId}).select('_id').session(session ?? null).lean()
  if (ctx.dm && validCharacters.length !== requested.length) return fail(400, 'One of the selected characters is no longer owned by the DM.')
  const relations = await Notebook.find({_id: {$in: data.relatedIds}, roomId: ctx.room._id, kind: 'entry', deletedAt: null, ...scope(ctx)}).select('_id').session(session ?? null).lean()
  if (relations.length !== data.relatedIds.length || existing && data.relatedIds.includes(String(existing._id))) return fail(400, 'Choose available entries from this room for connections.')
  let relatedIds = data.relatedIds
  if (!ctx.dm && existing) {
    const accessibleLinks = await Notebook.find({_id: {$in: existing.relatedIds}, roomId: ctx.room._id, ...scope(ctx)}).select('_id').session(session ?? null).lean()
    const accessibleSet = new Set(accessibleLinks.map(value => String(value._id)))
    relatedIds = [...new Set([...data.relatedIds, ...existing.relatedIds.map(String).filter(value => !accessibleSet.has(value))])]
  }
  return {...data, codexType, showInEvents, questStatus, questClues, tags:ctx.dm?tags:notebookTags(existing?.tags??[]), coverImage, gallery, audience: ctx.dm ? data.audience : existing?.audience ?? 'room',
    characterIds: ctx.dm ? data.audience === 'characters' ? data.characterIds : [] : existing?.characterIds ?? [],
    relevantCharacterIds: ctx.dm ? data.relevantCharacterIds : existing?.relevantCharacterIds ?? [], relatedIds}
}
const initializeNotebook = recoverableModelInitialization(() => [Notebook, NotebookRevision])
async function transaction<T>(fn: (session: ClientSession) => Promise<T>) {
  await withDatabaseStage('notebook-initialization', initializeNotebook)
  return withDatabaseStage('notebook-transaction', () => mongoose.connection.transaction(fn))
}
async function saveRevision(entry: RecordData, session: ClientSession, action: string) {
  // History restores text only; keep the raster on the current entry rather than copying it into every version.
  await NotebookRevision.create([{roomId: entry.roomId, entryId: entry._id, revision: entry.revision, snapshot: {...entry, coverImage: undefined, gallery:undefined, questClues: undefined}, editedBy: entry.editedBy, action}], {session})
}
const expectedSchema = z.object({expectedRevision: z.number().int().min(1)}).strict()
const actor = async (userId: string) => (await User.findById(userId).select('displayName').lean())?.displayName ?? 'Room member'
function parsed<T>(schema: z.ZodType<T>, body: unknown): T {const result = schema.safeParse(body); if (!result.success) return fail(400, result.error.issues[0]?.message ?? 'Invalid notebook values.'); return result.data}
async function entryFor(entryId: string, ctx: Context, session?: ClientSession, projection='') {
  if (!isValidObjectId(entryId)) return fail(404, 'Entry not found or access has ended.')
  const query = Notebook.findOne({_id: entryId, roomId: ctx.room._id}).session(session ?? null)
  if(projection)query.select(projection)
  const entry = await query.lean()
  if (!entry || !visible(entry, ctx)) return fail(404, 'Entry not found or access has ended.')
  return entry
}
const params = (req: {params: Record<string, unknown>}) => String(req.params.roomId)
router.get('/link-targets', async (req, res) => {
  const ctx = await context(params(req), req.userId!, typeof req.query.previewCharacter === 'string' ? req.query.previewCharacter : undefined)
  // No descriptions, clues, covers or sharing metadata are loaded for autocomplete.
  // Use the same room membership, entry visibility as normal reads.
  const entries = await Notebook.find({roomId:ctx.room._id,kind:'entry',deletedAt:null,...scope(ctx)}).select('title section codexType folderId').lean()
  const folders = new Map(ctx.folderRecords.map(folder => [String(folder._id),folder.title]))
  res.json({entries:entries.map(entry=>({id:String(entry._id),title:entry.title,section:entry.section,codexType:notebookEntryType({...entry,section:entry.section as NotebookSection}),folder:entry.folderId&&validFolderParent(null,String(entry.folderId),entry.section,ctx.folders)?folders.get(String(entry.folderId))??'':''})).sort((a,b)=>a.title.localeCompare(b.title,'hu')||a.id.localeCompare(b.id))})
})
router.get('/', async (req, res) => {
  const ctx = await context(params(req), req.userId!, typeof req.query.previewCharacter === 'string' ? req.query.previewCharacter : undefined)
  const query = parsed(z.object({section: z.enum(['journal','story-items','all']), type: z.enum([...notebookEntryTypes,'all','pinned']).default('all'), questStatus: z.enum(['all',...notebookQuestStatuses]).default('all'), offset: z.coerce.number().int().min(0).max(100000).default(0), search: z.string().max(120).default(''), tags:z.string().max(2500).default('[]'), folder: z.string().max(30).default('all'), deleted: z.enum(['true', 'false']).default('false'), character: z.string().max(24).default(''), ids: z.string().max(2600).default('')}).strict(), Object.fromEntries(Object.entries(req.query).filter(([key]) => key !== 'previewCharacter')))
  let selectedTags:string[]=[]
  try {selectedTags=parsed(tagsSchema,JSON.parse(typeof req.query.tags==='string'?req.query.tags:'[]'))}catch{return fail(400,'Choose valid tags.')}
  if (query.character && (!isValidObjectId(query.character) || !ctx.characters.some(c => String(c._id) === query.character))) return fail(400, 'Character filter is unavailable.')
  const assignedCharacters = new Set(ctx.room.assignments.filter(a => ctx.room.members.some(member => String(member) === String(a.userId))).map(a => String(a.characterId)))
  const folders = ctx.folderRecords.filter(f => (query.section === 'all' || f.section === query.section) && (ctx.dm || validFolderParent(null,String(f._id),f.section,ctx.folders))).sort((a,b) => a.title.localeCompare(b.title))
  // Apply entry visibility in Mongo before deriving any navigation metadata.
  // Legacy entries have no persisted category or session metadata, so derive it from
  // their existing title/body without a migration or rewriting the saved Markdown.
  const accessible = await Notebook.find({roomId:ctx.room._id,kind:'entry',...(query.section==='all'?{}:{section:query.section}),...scope(ctx)}).select('-coverImage -gallery').lean()
  const active = accessible.filter(entry => !entry.deletedAt)
  const metadata = new Map(accessible.map(entry=>[String(entry._id),summary(entry,ctx)]))
  let matching = accessible.filter(entry => query.deleted==='true' ? ctx.dm && !!entry.deletedAt : !entry.deletedAt)
  if (notebookEntryTypes.includes(query.type as typeof notebookEntryTypes[number])) matching=matching.filter(entry=>query.type==='events'?notebookIsEvent(entry):metadata.get(String(entry._id))!.codexType===query.type)
  if (query.questStatus !== 'all') matching=matching.filter(entry=>notebookQuestStatus(entry)===query.questStatus)
  if(selectedTags.length)matching=matching.filter(entry=>notebookMatchesTags(entry,selectedTags))
  if (query.search) {const search=notebookSearchText(query.search);matching=matching.filter(entry=>notebookSearchText(entry.title+' '+entry.body+' '+notebookQuestClues(entry,ctx.dm).map(clue=>clue.title+' '+clue.body).join(' ')).includes(search))}
  // An NPC shortcut or a removed assignment falls back to the whole library.
  if (query.character && assignedCharacters.has(query.character)) matching=matching.filter(entry=>entry.relevantCharacterIds.some(value=>String(value)===query.character))
  if (query.folder === 'unfiled') {const available=new Set(folders.filter(f=>!f.deletedAt).map(f=>String(f._id)));matching=matching.filter(entry=>!entry.folderId||!available.has(String(entry.folderId)))}
  else if (query.folder !== 'all') {if (!isValidObjectId(query.folder)) return fail(400, 'Invalid folder.'); if (!folders.some(f => String(f._id) === query.folder)) return fail(404, 'Folder not found or access has ended.'); const descendants=folderDescendants(query.folder,folders.map(f=>({id:String(f._id),parentId:f.parentId?String(f.parentId):null})));matching=matching.filter(entry=>descendants.has(String(entry.folderId)))}
  if (query.ids) {const requested=parsed(z.array(id).max(100),query.ids.split(','));matching=matching.filter(entry=>requested.includes(String(entry._id)))}
  else if(query.type==='pinned') matching=[]
  const compare=(a:RecordData,b:RecordData)=>{const am=metadata.get(String(a._id))!,bm=metadata.get(String(b._id))!;return am.codexType==='sessions'&&bm.codexType==='sessions'?(am.sessions[0]??Infinity)-(bm.sessions[0]??Infinity)||a.title.localeCompare(b.title,'hu'):a.title.localeCompare(b.title,'hu')||String(a._id).localeCompare(String(b._id))}
  matching.sort(compare)
  const total=matching.length,entries=matching.slice(query.offset,query.offset+60)
  const counts=Object.fromEntries(notebookEntryTypes.map(type=>[type,active.filter(entry=>type==='events'?notebookIsEvent(entry):metadata.get(String(entry._id))!.codexType===type).length]))
  const questCounts=Object.fromEntries(notebookQuestStatuses.map(status=>[status,active.filter(entry=>notebookQuestStatus(entry)===status).length]))
  res.json({entries:entries.map(entry=>metadata.get(String(entry._id))), total, entryCount:active.length, nextOffset: query.offset + entries.length < total ? query.offset + entries.length : null,counts,questCounts,tags:notebookTagOptions(accessible.filter(entry=>query.deleted==='true'?ctx.dm&&!!entry.deletedAt:!entry.deletedAt),ctx.dm?(ctx.room.notebookTagCatalog??[]).map(tag=>tag.name):[]),
    sessionEntries:active.filter(entry=>metadata.get(String(entry._id))!.codexType==='sessions').sort(compare).map(entry=>metadata.get(String(entry._id))),
    folders: folders.map(f => {const descendants=folderDescendants(String(f._id), [...ctx.folders.values()]); return {id: String(f._id), title: f.title, section: f.section, revision: f.revision, parentId:f.parentId ? String(f.parentId) : null, audience:'room', characterIds:[], deletedAt: f.deletedAt?.toISOString() ?? null, count: active.filter(e => descendants.has(String(e.folderId))).length}}),
    characters: ctx.characters.map(c => ({id: String(c._id), name: c.meta.name, assigned: assignedCharacters.has(String(c._id))})), role: ctx.dm ? 'dm' : 'player', readOnly: ctx.readOnly})
})
router.get('/entries/:entryId', async (req, res) => {
  const ctx = await context(params(req), req.userId!, typeof req.query.previewCharacter === 'string' ? req.query.previewCharacter : undefined)
  if(req.query.knownRevision!==undefined){
    const known=parsed(z.coerce.number().int().min(1),req.query.knownRevision)
    const current=await entryFor(String(req.params.entryId),ctx,undefined,'kind revision audience characterIds folderId')
    if(current.kind!=='entry')return fail(404,'Note not found.')
    if(current.revision===known)return res.json({unchanged:true,revision:current.revision})
  }
  const entry = await entryFor(String(req.params.entryId), ctx)
  if (entry.kind !== 'entry') return fail(404, 'Note not found.')
  res.json(await detail(entry, ctx))
})
router.get('/entries/:entryId/history', async (req, res) => {
  const ctx = await context(params(req), req.userId!, typeof req.query.previewCharacter === 'string' ? req.query.previewCharacter : undefined)
  const entry = await entryFor(String(req.params.entryId), ctx)
  const before = req.query.before === undefined ? entry.revision + 1 : parsed(z.coerce.number().int().min(1), req.query.before)
  const versions = await NotebookRevision.find({roomId: ctx.room._id, entryId: entry._id, revision: {$lt: before}, ...(!ctx.dm ? {$or: [{'snapshot.audience': 'room'}, {'snapshot.audience': 'characters', 'snapshot.characterIds': {$in: ctx.allowed.map(value => new mongoose.Types.ObjectId(value))}}]} : {})}).sort({revision: -1}).limit(15).lean()
  res.json({versions: versions.map(v => ({revision: v.revision, title: v.snapshot.title, body: v.snapshot.body, savedAt: v.savedAt.toISOString(), editedBy: v.editedBy, action: v.action})), nextBefore: versions.length === 15 ? versions.at(-1)!.revision : null})
})
router.use(requestLimit('notebook-write', 100, 60))
router.use((req, _res, next) => {if (req.query.previewCharacter !== undefined) return fail(403, 'The notebook is read-only in player preview.'); next()})
router.post('/tags', async (req, res) => {
  const data = parsed(z.object({name:tagSchema}).strict(), req.body)
  const ctx = await context(params(req), req.userId!)
  if (!ctx.dm || ctx.readOnly) return fail(403, 'Only the DM can create notebook tags.')
  const name = notebookTags([data.name])[0]!, key = notebookTagKey(name)
  // One atomic update prevents concurrent duplicate names or exceeding the catalog limit.
  const result = await Room.updateOne({_id:ctx.room._id, ownerId:req.userId!, 'notebookTagCatalog.key':{$ne:key}, 'notebookTagCatalog.499':{$exists:false}}, {$push:{notebookTagCatalog:{name,key}}})
  if (!result.modifiedCount) {
    const latest = await Room.findById(ctx.room._id).select('notebookTagCatalog').lean()
    const existing = latest?.notebookTagCatalog.find(tag=>tag.key===key)
    if (!existing) return fail(409, 'The tag catalog is full or room access changed. Refresh before trying again.')
    return res.json({name:existing.name})
  }
  res.status(201).json({name})
})
router.post('/entries', async (req, res) => {
  const data = parsed(draftSchema, req.body), editedBy = await actor(req.userId!)
  const result = await transaction(async session => {
    const ctx = await context(params(req), req.userId!, undefined, session)
    if (!editable(data, ctx)) return fail(403, 'Only the DM can manage story items.')
    const value = await validateDraft(data, ctx, undefined, session)
    const [entry] = await Notebook.create([{...value, roomId: ctx.room._id, kind: 'entry', editedBy, createdBy: req.userId!}], {session})
    await saveRevision(entry!.toObject(), session, 'Created')
    return String(entry!._id)
  })
  res.status(201).json({id: result})
})
router.patch('/entries/:entryId/tags', async (req, res) => {
  const data=parsed(z.object({expectedRevision:z.number().int().min(1),tags:tagsSchema}).strict(),req.body),editedBy=await actor(req.userId!)
  const result=await transaction(async session=>{
    const ctx=await context(params(req),req.userId!,undefined,session),entry=await entryFor(String(req.params.entryId),ctx,session)
    if(!ctx.dm||ctx.readOnly||entry.kind!=='entry'||entry.deletedAt)return fail(403,'Only the DM can tag active notebook entries.')
    if(entry.revision!==data.expectedRevision)return fail(409,'This entry changed elsewhere. Load the latest tags before saving.')
    const saved=await Notebook.findOneAndUpdate({_id:entry._id,roomId:ctx.room._id,revision:data.expectedRevision,deletedAt:null},{$set:{tags:data.tags,editedBy},$inc:{revision:1}},{new:true,session}).lean()
    if(!saved)return fail(409,'This entry changed elsewhere. Load the latest tags before saving.')
    await saveRevision(saved,session,'Tags updated')
    return {tags:notebookTags(saved.tags??[]),revision:saved.revision,updatedAt:saved.updatedAt.toISOString(),editedBy:saved.editedBy}
  })
  res.json(result)
})
router.patch('/entries/:entryId', async (req, res) => {
  const data = parsed(z.object({expectedRevision: z.number().int().min(1), draft: draftSchema}).strict(), req.body), editedBy = await actor(req.userId!)
  await transaction(async session => {
    const ctx = await context(params(req), req.userId!, undefined, session), entry = await entryFor(String(req.params.entryId), ctx, session)
    if (entry.kind !== 'entry' || !editable(entry, ctx) || entry.deletedAt) return fail(403, 'This entry cannot be edited.')
    if (entry.revision !== data.expectedRevision) return fail(409, 'This entry changed elsewhere. Your draft is kept. Compare it with the latest version before saving.')
    const value = await validateDraft(data.draft, ctx, entry, session)
    const saved = await Notebook.findOneAndUpdate({_id: entry._id, revision: entry.revision}, {$set: {...value, editedBy}, $inc: {revision: 1}}, {new: true, session}).lean()
    if (!saved) return fail(409, 'The entry changed. Refresh before saving.')
    await saveRevision(saved, session, 'Edited')
  })
  res.json({ok: true})
})
router.post('/folders', async (req, res) => {
  const data = parsed(folderCreateSchema, req.body), editedBy = await actor(req.userId!)
  const result = await transaction(async session => {
    const ctx = await context(params(req), req.userId!, undefined, session)
    if (!ctx.dm || ctx.readOnly) return fail(403, 'Only the DM can manage folders.')
    validateFolder(data, ctx, null)
    const [entry] = await Notebook.create([{...data, audience:'room', characterIds:[], kind: 'folder', roomId: ctx.room._id, editedBy, createdBy: req.userId!}], {session})
    await saveRevision(entry!.toObject(), session, 'Created')
    return String(entry!._id)
  })
  res.status(201).json({id: result})
})
router.patch('/folders/:entryId', async (req, res) => {
  const data = parsed(folderPatchSchema, req.body)
  const editedBy = await actor(req.userId!)
  await transaction(async session => {
    const ctx = await context(params(req), req.userId!, undefined, session), entry = await entryFor(String(req.params.entryId), ctx, session)
    if (entry.kind !== 'folder' || !ctx.dm || ctx.readOnly || entry.deletedAt) return fail(403, 'Only the DM can manage folders.')
    const value = parsed(z.object(folderFields).strict(), {title:data.title??entry.title,parentId:data.parentId===undefined?(entry.parentId?String(entry.parentId):null):data.parentId,audience:data.audience??entry.audience,characterIds:data.characterIds??entry.characterIds.map(String)})
    validateFolder({...value,section:entry.section},ctx,String(entry._id))
    const saved = await Notebook.findOneAndUpdate({_id: entry._id, revision: data.expectedRevision}, {$set: {...value,audience:'room',characterIds:[], editedBy}, $inc: {revision: 1}}, {new: true, session}).lean()
    if (!saved) return fail(409, 'The folder changed. Refresh first.')
    await saveRevision(saved, session, 'Folder updated')
  })
  res.json({ok: true})
})
router.post('/entries/:entryId/:action', async (req, res) => {
  const action = String(req.params.action)
  if (!['delete', 'recover', 'restore-version'].includes(action)) return fail(404, 'Notebook action not found.')
  const data = parsed(expectedSchema.extend({revision: z.number().int().min(1).optional()}), req.body), editedBy = await actor(req.userId!)
  await transaction(async session => {
    const ctx = await context(params(req), req.userId!, undefined, session), entry = await entryFor(String(req.params.entryId), ctx, session)
    if (!editable(entry, ctx) || entry.kind==='folder'&&!ctx.dm) return fail(403, 'Only the DM can manage folders and story items.')
    if (entry.revision !== data.expectedRevision) return fail(409, 'This entry changed. Refresh before repeating the action.')
    if (!ctx.dm && entry.kind === 'folder' && await Notebook.exists({roomId: ctx.room._id, kind: 'entry', folderId: entry._id}).session(session)) return fail(403, 'Only the DM can remove folders that contain entries. No notes were deleted.')
    let changes: Record<string, unknown> = {deletedAt: action === 'delete' ? new Date() : null, editedBy}
    if (action === 'restore-version') {
      if (entry.kind !== 'entry' || entry.deletedAt || !data.revision) return fail(400, 'Restore a saved note version from History.')
      const version = await NotebookRevision.findOne({entryId: entry._id, roomId: ctx.room._id, revision: data.revision}).session(session).lean()
      if (!version || !visible(version.snapshot, ctx)) return fail(404, 'This version is unavailable.')
      // Revert text only: never restore old sharing, links or character assignments implicitly.
      changes = {title: version.snapshot.title, body: version.snapshot.body, editedBy}
    }
    const saved = await Notebook.findOneAndUpdate({_id: entry._id, revision: entry.revision}, {$set: changes, $inc: {revision: 1}}, {new: true, session}).lean()
    if (!saved) return fail(409, 'The entry changed. Refresh first.')
    await saveRevision(saved, session, action === 'delete' ? 'Deleted' : action === 'recover' ? 'Recovered' : `Restored text from version ${data.revision}`)
  })
  res.json({ok: true})
})
router.use((error: Error, _req: unknown, res: import('express').Response, next: import('express').NextFunction) => {
  if (error instanceof NotebookError) return res.status(error.status).json({error: error.message})
  next(error)
})
export default router
