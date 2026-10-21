import mongoose from 'mongoose'

const oid = mongoose.Schema.Types.ObjectId
const notebookSchema = new mongoose.Schema({
  roomId: {type: oid, required: true},
  kind: {type: String, enum: ['entry', 'folder'], required: true},
  section: {type: String, enum: ['journal', 'story-items'], required: true},
  title: {type: String, required: true, maxlength: 120},
  // Keep editable Markdown as source. Future imports and map pins refer to stable entry IDs.
  body: {type: String, default: '', maxlength: 60000},
  folderId: {type: oid, default: null},
  audience: {type: String, enum: ['room', 'characters', 'dm'], default: 'room'},
  characterIds: {type: [oid], default: []},
  relevantCharacterIds: {type: [oid], default: []},
  relatedIds: {type: [oid], default: []},
  revision: {type: Number, required: true, default: 1},
  editedBy: {type: String, required: true, maxlength: 100},
  createdBy: {type: oid, required: true},
  deletedAt: {type: Date, default: null},
}, {timestamps: true})
notebookSchema.index({roomId: 1, kind: 1, section: 1, deletedAt: 1, title: 1, _id: 1})
notebookSchema.index({roomId: 1, relatedIds: 1})
export const Notebook = mongoose.model('Notebook', notebookSchema)

const revisionSchema = new mongoose.Schema({
  roomId: {type: oid, required: true}, entryId: {type: oid, required: true},
  revision: {type: Number, required: true}, snapshot: {type: mongoose.Schema.Types.Mixed, required: true},
  editedBy: {type: String, required: true}, action: {type: String, required: true}, savedAt: {type: Date, default: Date.now},
})
revisionSchema.index({entryId: 1, revision: -1}, {unique: true})
export const NotebookRevision = mongoose.model('NotebookRevision', revisionSchema)
