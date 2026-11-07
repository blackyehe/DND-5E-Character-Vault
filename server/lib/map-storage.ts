import type {ClientSession} from 'mongoose'
import {MAP_LIMITS} from '../../shared/room-maps'
import {MapQuota} from '../models/RoomMap'
import {libraryFail as fail} from './room-library-access'

export async function reserveMapStorage(ownerId: unknown, roomId: unknown, bytes: number, session: ClientSession, newMap = true) {
  const budgets = [
    {key: 'site', max: MAP_LIMITS.siteBytes, count: Number.MAX_SAFE_INTEGER, message: 'Map image storage is full. Ask the DM to remove unused maps.'},
    {key: `owner:${ownerId}`, max: MAP_LIMITS.ownerBytes, count: Number.MAX_SAFE_INTEGER, message: 'Your map images have reached the 25 MiB account limit. Remove an unused map first.'},
    {key: `room:${roomId}`, max: MAP_LIMITS.roomBytes, count: MAP_LIMITS.mapsPerRoom, message: 'This room has reached its map limit (10 MiB or 25 maps). Remove an unused map first.'},
  ]
  for (const b of budgets) {
    if (newMap) await MapQuota.updateOne({_id: b.key}, {$setOnInsert: {bytes: 0, count: 0}}, {upsert: true, session})
    const result = await MapQuota.updateOne({_id: b.key, bytes: {$lte: b.max - bytes}, ...(newMap ? {count: {$lt: b.count}} : {})}, {$inc: {bytes, ...(newMap ? {count: 1} : {})}}, {session})
    // Existing-map backfills require an existing ledger; never initialize one at zero.
    if (!result.modifiedCount) fail(413, b.message)
  }
}
