import mongoose from 'mongoose'
import {RoomMap} from '../models/RoomMap'
import {backfillMapOverviews} from '../lib/map-overview-backfill'

const args = process.argv.slice(2)
if (args.some(a => !/^(--apply|--check|--limit=\d+|--room=[a-f\d]{24})$/i.test(a)) || args.includes('--apply') && args.includes('--check')) throw Error('Use --check (default) or --apply, with optional --limit=1..100 and --room=OBJECTID')
const option = (key: string) => args.find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3)
const limit = Number(option('limit') ?? 25), room = option('room'), apply = args.includes('--apply')
if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw Error('Limit must be between 1 and 100')
const uri = process.env.MONGO_URI ?? process.env.MONGODB_URI
if (!uri) throw Error('Set MONGO_URI explicitly; no implicit database is modified')
try {
  await mongoose.connect(uri, {autoCreate: false, autoIndex: false, maxPoolSize: 1, serverSelectionTimeoutMS: 8000})
  const maps = await RoomMap.find({'imageVariants.0': {$exists: false}, $or: [{width: {$gt: 1024}}, {height: {$gt: 1024}}], ...(room ? {roomId: new mongoose.Types.ObjectId(room)} : {})}).select('_id').sort({_id: 1}).limit(limit).lean()
  const counts: Record<string, number> = {}, failures: {id: string; reason: string}[] = []
  let additionalBytes = 0
  for (const map of maps) {
    try {
      const result = await backfillMapOverviews(String(map._id), apply)
      counts[result.status] = (counts[result.status] ?? 0) + 1
      additionalBytes += result.additionalBytes
    } catch {
      failures.push({id: String(map._id), reason: 'Map not changed. Check source integrity, quota headroom and database availability.'})
    }
  }
  console.log(JSON.stringify({mode: apply ? 'apply' : 'check', examined: maps.length, limit, counts, additionalBytes, failures}, null, 2))
  if (failures.length) process.exitCode = 2
} catch {
  console.error('Map overview operation failed. Check database connectivity and options. Credentials and image data are not logged.')
  process.exitCode = 1
} finally {await mongoose.disconnect()}
