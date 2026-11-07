import {Types, type InferSchemaType, type PipelineStage} from 'mongoose'
import {Notebook} from '../models/Notebook'
import {env} from '../env'
import {libraryScope, libraryFail, type LibraryContext} from './room-library-access'
import {NOTEBOOK_COLLATION, NOTEBOOK_LISTING_VERSION} from './notebook-derived'
import {folderDescendants, type FolderAccess} from '../../shared/notebook-folders'
import {notebookEntryTypes, notebookQuestStatuses} from '../../shared/notebook-codex'
import {notebookTagKey} from '../../shared/notebook-tags'
import type {NotebookEntryType, NotebookSummary, NotebookNavigation, NotebookPage} from '../../shared/notebook'

type Stored = InferSchemaType<typeof Notebook.schema> & {_id: Types.ObjectId}
type Folder = Pick<Stored, '_id' | 'section' | 'title' | 'revision' | 'parentId' | 'deletedAt'>
export interface NotebookListQuery {
  section: 'journal' | 'story-items' | 'all'; type: string; questStatus: string
  offset: number; folder: string; deleted: 'true' | 'false'; character: string; ids: string
}
type Context = LibraryContext & {folders: Map<string, FolderAccess>}
type NavigationQuery = Pick<NotebookListQuery, 'section' | 'deleted'>
interface Navigation {
  unprepared?: {_id: Types.ObjectId}[]
  counts: {_id: {type: NotebookEntryType; event: boolean; questStatus: string | null}; count: number}[]
  folders: {_id: Types.ObjectId | null; count: number}[]
  tags: {_id: string; name: string; count: number}[]
}
export function notebookDatabaseReady(ctx: Pick<LibraryContext,'room'>) {
  const rooms=new Set(env.NOTEBOOK_DB_ROOMS.split(',').map(id=>id.trim().toLowerCase()).filter(Boolean))
  return env.NOTEBOOK_DB_LISTING === 'on' && ctx.room.notebookListingVersion === NOTEBOOK_LISTING_VERSION && (rooms.has('*')||rooms.has(String(ctx.room._id).toLowerCase()))
}
export const NOTEBOOK_LIST_PROJECTION = '_id section title folderId audience characterIds relevantCharacterIds revision updatedAt editedBy deletedAt tags listing'
export const notebookTitleSort = {title: 1, _id: 1} as const
export const notebookSessionSort = {'listing.firstSession': 1, title: 1, _id: 1} as const
// An older writer can advance source revision without maintaining derived data.
// Detect this even outside the current page/category before trusting metadata.
export const notebookUnprepared = {$or: [
  {'listing.version': {$ne: NOTEBOOK_LISTING_VERSION}},
  {$expr: {$ne: [{$ifNull: ['$listing.sourceRevision', null]}, '$revision']}},
]}

function summary(entry: Stored, ctx: LibraryContext): NotebookSummary {
  const listing = entry.listing!
  return {
    id: String(entry._id), section: entry.section, title: entry.title,
    folderId: entry.folderId ? String(entry.folderId) : null,
    audience: entry.audience,
    characterIds: entry.characterIds.map(String).filter(id => ctx.dm || ctx.allowed.includes(id)),
    relevantCharacterIds: entry.relevantCharacterIds.map(String).filter(id => ctx.dm || ctx.allowed.includes(id)),
    revision: entry.revision, updatedAt: entry.updatedAt.toISOString(), editedBy: entry.editedBy,
    deletedAt: entry.deletedAt?.toISOString() ?? null,
    codexType: listing.type as NotebookEntryType, showInEvents: listing.event,
    sessions: listing.sessions, questStatus: listing.questStatus as NotebookSummary['questStatus'], tags: listing.tagNames,
  }
}

/** Navigation describes the entire visible section, independently of page filters.
 * Missing derived versions deliberately retain the old reader until backfilled. */
function listingBase(ctx: Context, query: NavigationQuery) {
  return {roomId: ctx.room._id, kind: 'entry' as const, ...(query.section === 'all' ? {} : {section: query.section}), ...libraryScope(ctx),...ctx.dm?{}:{deletedAt:null}}
}
async function navigationFacet(ctx: Context, query: NavigationQuery) {
  const base = listingBase(ctx, query)
  const active = {$match: {deletedAt: null}}
  const pipeline: PipelineStage[] = [{$match: {...base, ...libraryScope(ctx, true)}}, {$facet: {
    // A missing row can be outside the selected page/session query. Detect it
    // before trusting counts or silently excluding it through listing filters.
    unprepared: [{$match: notebookUnprepared}, {$limit: 1}, {$project: {_id: 1}}],
    counts: [active, {$group: {_id: {type: '$listing.type', event: '$listing.event', questStatus: '$listing.questStatus'}, count: {$sum: 1}}}],
    folders: [active, {$group: {_id: '$folderId', count: {$sum: 1}}}],
    tags: [{$match: query.deleted === 'true' ? ctx.dm ? {deletedAt: {$ne: null}} : {_id: {$in: []}} : {deletedAt: null}},
      {$unwind: {path: '$listing.tagNames', includeArrayIndex: 'tagPosition'}},
      {$group: {_id: {$arrayElemAt: ['$listing.tagKeys', '$tagPosition']}, name: {$first: '$listing.tagNames'}, count: {$sum: 1}}}],
  }}]
  const [navigation] = await Notebook.aggregate<Navigation>(pipeline).collation(NOTEBOOK_COLLATION).option({comment: 'notebook-navigation'})
  return navigation?.unprepared?.length ? null : navigation ?? null
}
function listingFilter(ctx: Context, query: NotebookListQuery, selectedTags: string[], folders: readonly Folder[]) {
  const base = listingBase(ctx, query)
  const filter: Record<string, unknown> = {...base, deletedAt: query.deleted === 'true' ? {$ne: null} : null}
  if (query.deleted === 'true' && !ctx.dm) filter._id = {$in: []}
  if (notebookEntryTypes.includes(query.type as NotebookEntryType)) {
    if (query.type === 'events') filter['listing.event'] = true
    else filter['listing.type'] = query.type
  }
  if (query.questStatus !== 'all') filter['listing.questStatus'] = query.questStatus
  if (selectedTags.length) filter['listing.tagKeys'] = {$all: selectedTags.map(notebookTagKey)}
  const assigned = new Set(ctx.room.assignments.filter(a => ctx.room.members.some(m => String(m) === String(a.userId))).map(a => String(a.characterId)))
  if (query.character && assigned.has(query.character)) filter.relevantCharacterIds = new Types.ObjectId(query.character)
  if (query.folder === 'unfiled') filter.$and = [{$or: [{folderId: null}, {folderId: {$nin: folders.filter(f => !f.deletedAt).map(f => f._id)}}]}]
  else if (query.folder !== 'all') {
    if (!Types.ObjectId.isValid(query.folder)) return libraryFail(400, 'Invalid folder.')
    if (!folders.some(f => String(f._id) === query.folder)) return libraryFail(404, 'Folder not found or access has ended.')
    filter.folderId = {$in: [...folderDescendants(query.folder, folders.map(f => ({id: String(f._id), parentId: f.parentId ? String(f.parentId) : null})))].map(id => new Types.ObjectId(id))}
  }
  if (query.ids) {
    const ids = query.ids.split(',')
    if (ids.length > 100 || !ids.every(id => Types.ObjectId.isValid(id))) return libraryFail(400, 'Invalid notebook values.')
    // Do not override the empty result imposed on a non-DM trash request.
    filter.$and = [...(filter.$and as Record<string, unknown>[] ?? []), {_id: {$in: ids.map(id => new Types.ObjectId(id))}}]
  } else if (query.type === 'pinned') filter._id = {$in: []}
  return filter
}
function sessionRead(ctx: Context, query: NavigationQuery) {
  return Notebook.find({...listingBase(ctx, query), deletedAt: null, 'listing.type': 'sessions'}).select(NOTEBOOK_LIST_PROJECTION).collation(NOTEBOOK_COLLATION).sort(notebookSessionSort).comment('notebook-navigation').lean()
}
function navigationOutput(ctx: Context, navigation: Navigation, sessionEntries: Stored[], folders: readonly Folder[]): NotebookNavigation {
  const assigned = new Set(ctx.room.assignments.filter(a => ctx.room.members.some(m => String(m) === String(a.userId))).map(a => String(a.characterId)))
  const counts = Object.fromEntries(notebookEntryTypes.map(type => [type, 0])) as Record<NotebookEntryType, number>
  const questCounts = Object.fromEntries(notebookQuestStatuses.map(status => [status, 0])) as Record<'active' | 'finished', number>
  let entryCount = 0
  for (const row of navigation.counts) {
    entryCount += row.count
    if (row._id.type !== 'events') counts[row._id.type] += row.count
    if (row._id.event) counts.events += row.count
    if (row._id.type === 'quests') questCounts[row._id.questStatus === 'finished' ? 'finished' : 'active'] += row.count
  }
  const tags = new Map(navigation.tags.map(t => [t._id, {name: t.name, count: t.count}]))
  if (ctx.dm) for (const tag of ctx.room.notebookTagCatalog ?? []) if (!tags.has(notebookTagKey(tag.name))) tags.set(notebookTagKey(tag.name), {name: tag.name, count: 0})
  const folderCounts = new Map(navigation.folders.map(f => [String(f._id), f.count]))
  return {
    entryCount,
    counts, questCounts, tags: [...tags.values()].sort((a, b) => a.name.localeCompare(b.name, 'hu')),
    sessionEntries: sessionEntries.map(e => summary(e, ctx)),
    folders: folders.map(f => {
      const descendants = folderDescendants(String(f._id), [...ctx.folders.values()])
      return {id: String(f._id), title: f.title, section: f.section, revision: f.revision, parentId: f.parentId ? String(f.parentId) : null,
        audience: 'room' as const, characterIds: [], deletedAt: f.deletedAt?.toISOString() ?? null,
        count: [...descendants].reduce((sum, id) => sum + (folderCounts.get(id) ?? 0), 0)}
    }),
    characters: ctx.characters.map(c => ({id: String(c._id), name: c.meta.name, assigned: assigned.has(String(c._id))})),
    role: ctx.dm ? 'dm' : 'player', readOnly: ctx.readOnly,
  }
}

/** No server cache: every navigation request authorizes and reads its visible set. */
export async function notebookNavigation(ctx: Context, query: NavigationQuery, folders: readonly Folder[]) {
  if (!notebookDatabaseReady(ctx)) return null
  const navigation = await navigationFacet(ctx, query)
  if (!navigation) return null
  const sessions = await sessionRead(ctx, query)
  if (sessions.some(e => e.listing?.version !== NOTEBOOK_LISTING_VERSION || e.listing.sourceRevision !== e.revision)) return null
  return {body:navigationOutput(ctx, navigation, sessions, folders)}
}

export async function notebookListing(ctx: Context, query: NotebookListQuery, selectedTags: string[], folders: readonly Folder[], includeNavigation = true) {
  if (!notebookDatabaseReady(ctx)) return null
  const navigation = includeNavigation ? await navigationFacet(ctx, query) : null
  if (includeNavigation && !navigation) return null
  const filter = listingFilter(ctx, query, selectedTags, folders)
  const sort = query.type === 'sessions' ? notebookSessionSort : notebookTitleSort
  const [entries, total, sessions, unprepared] = await Promise.all([
    Notebook.find(filter).select(NOTEBOOK_LIST_PROJECTION).collation(NOTEBOOK_COLLATION).sort(sort).skip(query.offset).limit(60).comment('notebook-listing').lean(),
    Notebook.countDocuments(filter).collation(NOTEBOOK_COLLATION).comment('notebook-navigation'),
    includeNavigation ? sessionRead(ctx, query) : [],
    includeNavigation ? null : Notebook.findOne({...listingBase(ctx,query), $and: [notebookUnprepared]}).select('_id').collation(NOTEBOOK_COLLATION).comment('notebook-readiness').lean(),
  ])
  if (unprepared) return null
  if ([...entries, ...sessions].some(e => e.listing?.version !== NOTEBOOK_LISTING_VERSION || e.listing.sourceRevision !== e.revision)) return null
  const page: NotebookPage = {entries: entries.map(e => summary(e, ctx)), total, nextOffset: query.offset + entries.length < total ? query.offset + entries.length : null}
  return {body:navigation ? {...page, ...navigationOutput(ctx, navigation, sessions, folders)} : page}
}
