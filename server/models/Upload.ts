import mongoose from 'mongoose'
const uploadSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  path: { type: String, required: true },
  method: { type: String, enum: ['POST', 'PATCH'], required: true },
  bytes: { type: Number, required: true },
  parts: { type: Number, required: true },
  claimed: { type: Boolean, default: false },
  expiresAt: { type: Date, required: true },
})
uploadSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })
const partSchema = new mongoose.Schema({
  uploadId: { type: mongoose.Schema.Types.ObjectId, required: true },
  index: { type: Number, required: true },
  data: { type: Buffer, required: true },
  expiresAt: { type: Date, required: true },
})
partSchema.index({ uploadId: 1, index: 1 }, { unique: true })
partSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })
export const Upload = mongoose.model('Upload', uploadSchema)
export const UploadPart = mongoose.model('UploadPart', partSchema)
