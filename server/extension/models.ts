import mongoose from 'mongoose'

const pairingSchema = new mongoose.Schema({
  gameSession: { type: Boolean, default: false },
  _id: String,
  trialEpoch: String,
  trialMode: { type: String, enum: ['play-controls'] },
  challenge: { type: String, required: true },
  origin: { type: String, required: true },
  code: { type: String, required: true },
  details: { type: Boolean, default: false },
  hpWrite: { type: Boolean, default: false },
  slotsWrite: { type: Boolean, default: false },
  tempHpWrite: { type: Boolean, default: false },
  resourcesWrite: { type: Boolean, default: false },
  combatWrite: { type: Boolean, default: false },
  equipmentWrite: { type: Boolean, default: false },
  preparationWrite: { type: Boolean, default: false },
  inventoryWrite: { type: Boolean, default: false },
  effectsWrite: { type: Boolean, default: false },
  featuresWrite: { type: Boolean, default: false },
  state: { type: String, enum: ['pending', 'approved', 'denied', 'consumed'], required: true },
  userId: mongoose.Schema.Types.ObjectId,
  roomId: mongoose.Schema.Types.ObjectId,
  ownerId: mongoose.Schema.Types.ObjectId,
  expiresAt: { type: Date, required: true },
}, { versionKey: false })
pairingSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

const sessionSchema = new mongoose.Schema({
  gameSession: { type: Boolean, default: false },
  trialEpoch: String,
  trialMode: { type: String, enum: ['play-controls'] },
  tokenHash: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  roomId: { type: mongoose.Schema.Types.ObjectId, required: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, required: true },
  origin: { type: String, required: true },
  scope: { type: String, enum: ['character:read'], required: true },
  details: { type: Boolean, default: false },
  hpWrite: { type: Boolean, default: false },
  slotsWrite: { type: Boolean, default: false },
  tempHpWrite: { type: Boolean, default: false },
  resourcesWrite: { type: Boolean, default: false },
  combatWrite: { type: Boolean, default: false },
  equipmentWrite: { type: Boolean, default: false },
  preparationWrite: { type: Boolean, default: false },
  inventoryWrite: { type: Boolean, default: false },
  effectsWrite: { type: Boolean, default: false },
  featuresWrite: { type: Boolean, default: false },
  expiresAt: { type: Date, required: true },
  revokedAt: Date,
}, { timestamps: true, versionKey: false })
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })
sessionSchema.index({ userId: 1, revokedAt: 1, expiresAt: 1 })

export const ExtensionPairing = mongoose.model('ExtensionPairing', pairingSchema)
export const ExtensionSession = mongoose.model('ExtensionSession', sessionSchema)
