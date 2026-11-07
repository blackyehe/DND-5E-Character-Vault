import mongoose from 'mongoose'
import {createHash} from 'node:crypto'
import {existsSync, mkdirSync, readFileSync, renameSync, writeFileSync} from 'node:fs'
import {dirname, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {backfillNotebookListing, certifyNotebookRoom, type NotebookBackfillProgress} from '../lib/notebook-backfill'
import {NOTEBOOK_LISTING_VERSION} from '../lib/notebook-derived'

const args = process.argv.slice(2)
if (args.some(a => !/^(--apply|--check|--batch-size=\d+|--max-batches=\d+|--checkpoint=.+|--room=[a-f\d]{24})$/i.test(a)) || args.includes('--apply') && args.includes('--check')) throw Error('Use --check (default) or --apply, optionally --batch-size=N --max-batches=N --checkpoint=PATH --room=OBJECTID')
const option = (key: string) => args.find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3)
const apply = args.includes('--apply')
const checkpointFile = resolve(option('checkpoint') ?? fileURLToPath(new URL('../../.local/notebook-backfill-progress.json', import.meta.url)))
const uri = process.env.MONGO_URI ?? process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/dnd_site'
const client = new mongoose.mongo.MongoClient(uri, {maxPoolSize: 1, serverSelectionTimeoutMS: 8000})
try {
  await client.connect()
  const db = client.db(), room = option('room')
  const scope = createHash('sha256').update(uri + '|' + db.databaseName + '|' + (room ?? '*')).digest('hex')
  let progress: NotebookBackfillProgress | undefined
  if (apply && existsSync(checkpointFile)) {
    const saved = JSON.parse(readFileSync(checkpointFile, 'utf8'))
    if (saved.scope !== scope || saved.version !== NOTEBOOK_LISTING_VERSION) throw Error('Checkpoint belongs to another database, room or metadata version; use a different checkpoint path')
    if (saved.after !== null && !mongoose.isValidObjectId(saved.after) || !Array.isArray(saved.retryIds) || !saved.retryIds.every((id: unknown) => typeof id === 'string' && mongoose.isValidObjectId(id))) throw Error('Invalid checkpoint')
    progress = {after: saved.after, retryIds: saved.retryIds}
  }
  const checkpoint = async (value: NotebookBackfillProgress) => {
    mkdirSync(dirname(checkpointFile), {recursive: true})
    writeFileSync(checkpointFile + '.tmp', JSON.stringify({scope, version: NOTEBOOK_LISTING_VERSION, ...value}, null, 2))
    renameSync(checkpointFile + '.tmp', checkpointFile)
  }
  const roomScope = room ? {_id: new mongoose.Types.ObjectId(room)} : {}
  // Invalidate before modifying derived data, including on resumed runs.
  // --check never changes room markers or notebook data.
  if (apply) await db.collection('rooms').updateMany(roomScope, {$unset: {notebookListingVersion: ''}})
  const result = await backfillNotebookListing(db.collection('notebooks'), {
    apply, progress, batchSize: Number(option('batch-size') ?? 200),
    maxBatches: option('max-batches') ? Number(option('max-batches')) : undefined,
    roomId: room ? new mongoose.Types.ObjectId(room) : undefined, checkpoint,
  })
  const certification: {roomId: string; ready: boolean; reason: string}[] = []
  if (apply && result.complete && !result.invalid && !result.conflicts) {
    for await (const record of db.collection('rooms').find(roomScope, {projection: {_id: 1}})) {
      const certified = await certifyNotebookRoom(db.collection('notebooks'), db.collection('rooms'), record._id)
      certification.push({roomId: String(record._id), ready: certified.ready, reason: certified.reason})
    }
  }
  console.log(JSON.stringify({mode: apply ? 'apply' : 'check', ...result, certification}, null, 2))
  if (certification.some(room => !room.ready)) process.exitCode = 2
  if (result.invalid || result.conflicts || !apply && result.inconsistent) process.exitCode = 2
} catch {
  console.error('Notebook metadata operation failed. Check database connectivity, options and checkpoint scope. No credentials or notebook content are logged.')
  process.exitCode = 1
} finally {await client.close()}
