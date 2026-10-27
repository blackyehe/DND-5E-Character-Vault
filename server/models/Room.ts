import mongoose from 'mongoose'

const objectId = mongoose.Schema.Types.ObjectId
const roomSchema = new mongoose.Schema({
  ownerId: { type: objectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  members: { type: [objectId], default: [] },
  assignments: { type: [new mongoose.Schema({ characterId: { type: objectId, required: true }, userId: { type: objectId, required: true } }, { _id: false })], default: [] },
  // Unassigned notebook tags are visible only to the DM.
  notebookTagCatalog: {type: [new mongoose.Schema({key: {type: String, required: true}, name: {type: String, required: true, maxlength: 48}}, {_id: false})], default: []},
  // The link is a capability to join, never a capability to read a character.
  joinToken: { type: String, required: true, unique: true },
}, { timestamps: true, optimisticConcurrency: true })
roomSchema.index({ members: 1 })
export const Room = mongoose.model('Room', roomSchema)
