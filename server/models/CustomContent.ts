import mongoose from 'mongoose'

const { Schema } = mongoose

const customContentSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['background', 'feat', 'spell', 'orcbrew','item','monster-action','monster-enrichment','deleted-content','compendium-edit'], required: true },
    data: { type: Schema.Types.Mixed, required: true },
    deletedContent: { type: Schema.Types.Mixed },
    workshopTrash: { type: [Schema.Types.Mixed], default: undefined },
    sourceHash: { type: String },
  },
  { timestamps: true },
)

customContentSchema.index({ userId: 1, type: 1 })
customContentSchema.index(
  { userId: 1, type: 1, sourceHash: 1 },
  { unique: true, partialFilterExpression: { sourceHash: { $type: 'string' } } },
)

export const CustomContent = mongoose.model('CustomContent', customContentSchema)
