import mongoose from 'mongoose'
import {MapAsset, RoomMap} from '../models/RoomMap'
import {prepareMapOverviews} from './map-overviews'
import {reserveMapStorage} from './map-storage'

/** Bounded, idempotent, all-or-nothing per map. A check performs no writes. */
export async function backfillMapOverviews(mapId: string, apply = false) {
  const map = await RoomMap.findById(mapId).lean()
  if (!map) return {status: 'missing' as const, additionalBytes: 0}
  if (map.imageVariants?.length || Math.max(map.width, map.height) <= 1024) return {status: 'ready' as const, additionalBytes: 0}
  const asset = await MapAsset.findOne({_id: map._id, roomId: map.roomId}).lean()
  if (!asset?.data) throw Error('Original map asset is missing')
  if (asset.overviews?.length || (map.storageBytes ?? map.bytes) !== map.bytes) throw Error('Map storage requires reconciliation before backfill')
  const original = Buffer.from(asset.data.buffer)
  if (original.length !== map.bytes) throw Error('Original map size does not match accounting')
  const overviews = await prepareMapOverviews(original)
  const additionalBytes = overviews.reduce((n, v) => n + v.bytes, 0)
  if (!overviews.length) return {status: 'no-saving' as const, additionalBytes: 0}
  if (!apply) return {status: 'pending' as const, additionalBytes}
  let status: 'applied' | 'ready' | 'missing' = 'applied'
  await mongoose.connection.transaction(async session => {
    const current = await RoomMap.findById(mapId).session(session).lean()
    if (!current) {status = 'missing'; return}
    if (current.imageVariants?.length) {status = 'ready'; return}
    const fresh = await MapAsset.findOne({_id: map._id, roomId: map.roomId}).session(session).lean()
    if (!fresh?.data || fresh.overviews?.length || !Buffer.from(fresh.data.buffer).equals(original)
      || (current.storageBytes ?? current.bytes) !== map.bytes) throw Error('Map storage changed during backfill')
    await reserveMapStorage(map.ownerId, map.roomId, additionalBytes, session, false)
    await MapAsset.updateOne({_id: map._id}, {$set: {overviews: overviews.map(({edge, data}) => ({edge, data}))}}, {session})
    await RoomMap.updateOne({_id: map._id}, {$set: {imageVariants: overviews.map(({data: _data, ...meta}) => meta), storageBytes: map.bytes + additionalBytes}}, {session, timestamps: false})
  })
  return {status, additionalBytes: status === 'applied' ? additionalBytes : 0}
}
