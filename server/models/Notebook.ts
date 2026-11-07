import mongoose from 'mongoose'
import {NOTEBOOK_COVER_MAX_LENGTH} from '../../shared/notebook-cover'
import {NOTEBOOK_CLUE_BODY_LIMIT} from '../../shared/notebook-clues'
import {NOTEBOOK_ARTWORK_MAX_LENGTH} from '../../shared/notebook-gallery'
import {NOTEBOOK_COLLATION} from '../lib/notebook-derived'

const oid = mongoose.Schema.Types.ObjectId
const artworkSchema = new mongoose.Schema({
  id:{type:String,required:true},image:{type:String,required:true,maxlength:NOTEBOOK_ARTWORK_MAX_LENGTH},
  title:{type:String,default:'',maxlength:120},caption:{type:String,default:'',maxlength:1000},
},{_id:false})
const questClueSchema = new mongoose.Schema({
  id: {type: String, required: true}, title: {type: String, required: true, maxlength: 120},
  body: {type: String, default: '', maxlength: NOTEBOOK_CLUE_BODY_LIMIT},
  sessions: {type: [Number], default: []}, audience: {type: String, enum: ['dm','room'], default: 'dm'},
}, {_id: false})
const notebookSchema = new mongoose.Schema({
  roomId: {type: oid, required: true},
  kind: {type: String, enum: ['entry', 'folder'], required: true},
  section: {type: String, enum: ['journal', 'story-items'], required: true},
  codexType: {type: String, enum: ['people', 'places', 'objects', 'factions', 'sessions', 'quests', 'events'], default: null},
  showInEvents: {type: Boolean, default: false},
  questStatus: {type: String, enum: ['active', 'finished'], default: null},
  questClues: {type: [questClueSchema], default: []},
  tags: {type: [String], default: []},
  title: {type: String, required: true, maxlength: 120},
  // Keep editable Markdown as source. Future imports and map pins refer to stable entry IDs.
  body: {type: String, default: '', maxlength: 60000},
  coverImage: {type: String, default: '', maxlength: NOTEBOOK_COVER_MAX_LENGTH},
  gallery: {type:[artworkSchema],default:[]},
  folderId: {type: oid, default: null},
  parentId: {type: oid, default: null},
  audience: {type: String, enum: ['room', 'characters', 'dm'], default: 'room'},
  characterIds: {type: [oid], default: []},
  relevantCharacterIds: {type: [oid], default: []},
  relatedIds: {type: [oid], default: []},
  revision: {type: Number, required: true, default: 1},
  editedBy: {type: String, required: true, maxlength: 100},
  createdBy: {type: oid, required: true},
  deletedAt: {type: Date, default: null},
  // Optional until the resumable backfill has verified each existing entry.
  listing: {type: new mongoose.Schema({
    version: {type: Number, required: true},
    sourceRevision: {type: Number, required: true},
    type: {type: String, required: true},
    event: {type: Boolean, required: true},
    questStatus: {type: String, default: null},
    sessions: {type: [Number], required: true},
    firstSession: {type: Number, required: true},
    tagNames: {type: [String], required: true},
    tagKeys: {type: [String], required: true},
  }, {_id: false}), default: undefined},
}, {timestamps: true})
notebookSchema.index({roomId: 1, kind: 1, section: 1, deletedAt: 1, title: 1, _id: 1})
notebookSchema.index({roomId: 1, relatedIds: 1})
notebookSchema.index({roomId: 1, kind: 1, section: 1, deletedAt: 1, title: 1, _id: 1}, {name: 'notebook_section_title_hu', collation: NOTEBOOK_COLLATION})
notebookSchema.index({roomId: 1, kind: 1, deletedAt: 1, title: 1, _id: 1}, {name: 'notebook_title_hu', collation: NOTEBOOK_COLLATION})
notebookSchema.index({roomId: 1, kind: 1, section: 1, deletedAt: 1, 'listing.type': 1, 'listing.firstSession': 1, title: 1, _id: 1}, {name: 'notebook_section_session_hu', collation: NOTEBOOK_COLLATION})
notebookSchema.index({roomId: 1, kind: 1, deletedAt: 1, 'listing.type': 1, 'listing.firstSession': 1, title: 1, _id: 1}, {name: 'notebook_session_hu', collation: NOTEBOOK_COLLATION})
// Exact player counts can evaluate both visibility branches without fetching
// entries. Keep section/category in the index for the common filtered lists.
notebookSchema.index({roomId: 1, kind: 1, deletedAt: 1, audience: 1, characterIds: 1, section: 1, 'listing.type': 1}, {name: 'notebook_count_scope_hu', collation: NOTEBOOK_COLLATION})
export const Notebook = mongoose.model('Notebook', notebookSchema)

const revisionSchema = new mongoose.Schema({
  roomId: {type: oid, required: true}, entryId: {type: oid, required: true},
  revision: {type: Number, required: true}, snapshot: {type: mongoose.Schema.Types.Mixed, required: true},
  editedBy: {type: String, required: true}, action: {type: String, required: true}, savedAt: {type: Date, default: Date.now},
})
revisionSchema.index({entryId: 1, revision: -1}, {unique: true})
export const NotebookRevision = mongoose.model('NotebookRevision', revisionSchema)
