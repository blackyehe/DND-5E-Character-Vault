import mongoose from 'mongoose'

const association = new mongoose.Schema({
  entryId: {type: mongoose.Schema.Types.ObjectId, required: true},
  category: {type: String, required: true, maxlength: 30},
  relation: {type: String, default: '', maxlength: 60},
  description: {type: String, default: '', maxlength: 240},
}, {_id: false})
const fields = {
  description: {type: String, default: '', maxlength: 500},
  categories: {type: [String], default: []},
  entries: {type: [association], default: []},
}
const snapshot = new mongoose.Schema(fields, {_id: false})
const schema = new mongoose.Schema({
  roomId: {type: mongoose.Schema.Types.ObjectId, required: true},
  entryId: {type: mongoose.Schema.Types.ObjectId, required: true},
  enabled: {type: Boolean, default: true},
  revision: {type: Number, default: 1, required: true},
  ...fields,
  previous: {type: snapshot, default: undefined},
}, {timestamps: true})
schema.index({roomId: 1, entryId: 1}, {unique: true})
export const CityLibrary = mongoose.model('CityLibrary', schema)
