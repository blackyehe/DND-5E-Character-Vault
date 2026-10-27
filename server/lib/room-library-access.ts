import {isValidObjectId, type ClientSession} from 'mongoose'
import {Room} from '../models/Room'
import {Character} from '../models/Character'

export class RoomLibraryError extends Error {
  status: number
  constructor(status: number, message: string) {super(message); this.status = status}
}
export const libraryFail = (status: number, message: string): never => {throw new RoomLibraryError(status, message)}

/** Notebook and Maps use the same current membership/assignment and preview rules. */
export async function libraryContext(roomId: string, userId: string, previewCharacter?: string, session?: ClientSession) {
  if (!isValidObjectId(roomId)) return libraryFail(404, 'Room not found or access has ended.')
  const room = await Room.findOne({_id: roomId, $or: [{ownerId: userId}, {members: userId}]}).session(session ?? null).lean()
  if (!room) return libraryFail(404, 'Room not found or access has ended.')
  const owner = String(room.ownerId) === userId
  if (previewCharacter && (!owner || !isValidObjectId(previewCharacter))) return libraryFail(403, 'Player preview is unavailable.')
  const previewUser = previewCharacter ? room.assignments.find(a => String(a.characterId) === previewCharacter && room.members.some(m => String(m) === String(a.userId)))?.userId : undefined
  const assigned = room.assignments.filter(a => String(a.userId) === String(previewUser ?? userId) && room.members.some(m => String(m) === String(a.userId))).map(a => a.characterId)
  const characters = await Character.find({userId: room.ownerId, ...(!owner ? {_id: {$in: assigned}} : {})}).select('meta.name').session(session ?? null).lean()
  const validIds = characters.map(c => String(c._id))
  const allowed = previewCharacter ? (previewUser ? assigned.map(String) : [previewCharacter]).filter(value => validIds.includes(value)) : validIds
  if (previewCharacter && !validIds.includes(previewCharacter)) return libraryFail(404, 'Character access has ended.')
  const dm = owner && !previewCharacter
  return {room, dm, owner, readOnly: !!previewCharacter, allowed, characters: characters.filter(c => dm || allowed.includes(String(c._id))), userId}
}
export type LibraryContext = Awaited<ReturnType<typeof libraryContext>>
export function libraryScope(ctx: LibraryContext): Record<string, unknown> {
  return ctx.dm ? {} : {$or: [{audience: 'room'}, {audience: 'characters', characterIds: {$in: ctx.allowed}}]}
}
export function libraryVisible(entry: {audience?: unknown; characterIds?: unknown}, ctx: LibraryContext) {
  return ctx.dm || entry.audience === 'room' || entry.audience === 'characters' && Array.isArray(entry.characterIds) && entry.characterIds.some(value => ctx.allowed.includes(String(value)))
}
/** Notebook references in Maps and city libraries follow entry visibility only. */
export async function notebookScope(ctx: LibraryContext) {
  return libraryScope(ctx)
}
