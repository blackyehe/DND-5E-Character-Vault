import mongoose from 'mongoose'
const folder = new mongoose.Schema({ id: { type: String, required: true }, name: { type: String, required: true, maxlength: 80 }, parentId: { type: String, default: null } }, { _id: false })
const placement = new mongoose.Schema({ characterId: { type: String, required: true }, folderId: { type: String, required: true } }, { _id: false })
const schema = new mongoose.Schema({ ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true }, revision: { type: Number, default: 0 }, folders: { type: [folder], default: [] }, placements: { type: [placement], default: [] } }, { timestamps: true })
export const CharacterLibrary = mongoose.model('CharacterLibrary', schema)
