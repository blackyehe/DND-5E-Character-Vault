import {Types, mongo} from 'mongoose'
import {NOTEBOOK_LISTING_VERSION, notebookDerived, notebookDerivedConsistent, type NotebookDerivedSource} from './notebook-derived'

type SourceRecord = mongo.Document & NotebookDerivedSource & {_id: Types.ObjectId; revision: number; listing?: unknown}
export interface NotebookBackfillProgress {after: string | null; retryIds: string[]}
export interface NotebookBackfillOptions {
  apply?: boolean; batchSize?: number; maxBatches?: number; roomId?: Types.ObjectId
  progress?: NotebookBackfillProgress
  checkpoint?: (progress: NotebookBackfillProgress) => Promise<void>
}

/** Raw collection writes deliberately preserve revision, timestamps, history and prose.
 * A racing writer wins. Conflicts remain in the checkpoint even below the cursor. */
export async function backfillNotebookListing(collection: mongo.Collection, options: NotebookBackfillOptions = {}) {
  const batchSize = options.batchSize ?? 200
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 1000) throw Error('Invalid batch size')
  const progress: NotebookBackfillProgress = {after: options.progress?.after ?? null, retryIds: [...options.progress?.retryIds ?? []]}
  const stats = {checked: 0, inconsistent: 0, updated: 0, conflicts: 0, invalid: 0, batches: 0, complete: false, progress}
  const filter = {kind: 'entry', ...(options.roomId ? {roomId: options.roomId} : {})}
  const projection = {_id: 1, revision: 1, section: 1, title: 1, body: 1, codexType: 1, showInEvents: 1, questStatus: 1, tags: 1, listing: 1}
  const retries = new Set(progress.retryIds)
  async function inspect(record: SourceRecord) {
    stats.checked++
    try {
      if (notebookDerivedConsistent(record)) {retries.delete(String(record._id)); return}
      stats.inconsistent++
      if (!options.apply) return
      if (!Number.isInteger(record.revision)) {stats.invalid++; retries.add(String(record._id)); return}
      const result = await collection.updateOne({_id: record._id, revision: record.revision}, {$set: {listing: notebookDerived(record)}})
      if (result.matchedCount) {stats.updated++; retries.delete(String(record._id))}
      else {stats.conflicts++; retries.add(String(record._id))}
    } catch (error) {
      // Malformed source data is reported for repair, never silently marked current.
      if (error instanceof Error && error.message === 'Invalid notebook section') {stats.invalid++; retries.add(String(record._id))}
      else throw error
    }
  }
  // Retry prior conflicts first; missing/deleted records no longer require work.
  for (const id of [...retries]) {
    const record = await collection.findOne({...filter, _id: new Types.ObjectId(id)}, {projection}) as SourceRecord | null
    if (record) await inspect(record)
    else retries.delete(id)
  }
  while (stats.batches < (options.maxBatches ?? Infinity)) {
    const records = await collection.find({...filter, ...(progress.after ? {_id: {$gt: new Types.ObjectId(progress.after)}} : {})}, {projection}).sort({_id: 1}).limit(batchSize).toArray() as SourceRecord[]
    if (!records.length) {stats.complete = retries.size === 0; break}
    for (const record of records) await inspect(record)
    progress.after = String(records.at(-1)!._id)
    progress.retryIds = [...retries]
    stats.batches++
    if (options.apply) await options.checkpoint?.({...progress, retryIds: [...retries]})
  }
  progress.retryIds = [...retries]
  if (options.apply) await options.checkpoint?.(progress)
  return stats
}

/** Only the backfill may certify an existing room. Always inspect the entire room
 * from the start, not just the resumed checkpoint or the current user's scope.
 * Entry writers increment this epoch in their source transaction, so a concurrent
 * write makes the final compare-and-set fail rather than certifying a stale scan. */
export async function certifyNotebookRoom(entries: mongo.Collection, rooms: mongo.Collection, roomId: Types.ObjectId) {
  const room = await rooms.findOne({_id: roomId}, {projection: {'notebookChanges.dm.all': 1}})
  if (!room) return {ready: false, reason: 'missing-room' as const}
  const epoch = room.notebookChanges?.dm?.all
  const check = await backfillNotebookListing(entries, {roomId})
  if (!check.complete || check.inconsistent || check.invalid || check.conflicts) return {ready: false, reason: 'inconsistent' as const, check}
  const result = await rooms.updateOne({_id: roomId, 'notebookChanges.dm.all': epoch === undefined ? {$exists: false} : epoch}, {$set: {notebookListingVersion: NOTEBOOK_LISTING_VERSION}})
  return {ready: result.matchedCount === 1, reason: result.matchedCount === 1 ? 'consistent' as const : 'concurrent-write' as const, check}
}
