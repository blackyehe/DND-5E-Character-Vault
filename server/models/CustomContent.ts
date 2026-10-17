import mongoose from 'mongoose'

const { Schema } = mongoose

const customContentSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['background', 'feat', 'spell'], required: true },
    data: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true },
)

customContentSchema.index({ userId: 1, type: 1 })

export const CustomContent = mongoose.model('CustomContent', customContentSchema)
