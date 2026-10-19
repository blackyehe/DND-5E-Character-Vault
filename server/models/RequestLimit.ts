import mongoose from 'mongoose'

const schema = new mongoose.Schema({
  _id: { type: String, required: true },
  count: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
})
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })
export const RequestLimit = mongoose.model('RequestLimit', schema)
