import mongoose from 'mongoose'
import {PIN_VISIBILITIES, PIN_COLORS, PIN_SYMBOLS, PIN_LABELS} from '../../shared/room-maps'
const oid = mongoose.Schema.Types.ObjectId
const display = new mongoose.Schema({
  visibility: {type: String, enum: PIN_VISIBILITIES, required: true},
  color: {type: String, enum: PIN_COLORS, required: true},
  symbol: {type: String, enum: PIN_SYMBOLS, required: true},
  label: {type: String, enum: PIN_LABELS, required: true},
}, {_id: false})
const pin = new mongoose.Schema({
  label: {type: String, required: true, maxlength: 120}, entryId: {type: oid, required: true},
  x: {type: Number, required: true, min: 0, max: 1}, y: {type: Number, required: true, min: 0, max: 1},
  display: {type: display, required: false},
  audience: {type: String, enum: ['room', 'characters', 'dm'], default: 'room'},
  characterIds: {type: [oid], default: []},
})
const point=new mongoose.Schema({x:{type:Number,required:true,min:0,max:1},y:{type:Number,required:true,min:0,max:1}},{_id:false})
const region=new mongoose.Schema({id:{type:String,required:true},name:{type:String,required:true,maxlength:120},
  color:{type:String,required:true},opacity:{type:Number,required:true,min:.05,max:.6},fadeZoom:{type:Number,required:true,min:1.3,max:3},
  points:{type:[point],required:true}}, {_id:false,id:false})
const schema = new mongoose.Schema({
  roomId: {type: oid, required: true}, ownerId: {type: oid, required: true},
  title: {type: String, required: true, maxlength: 120}, audience: {type: String, enum: ['room','characters','dm'], default: 'dm'},
  characterIds: {type: [oid], default: []}, revision: {type: Number, default: 1, required: true},
  width: {type: Number, required: true}, height: {type: Number, required: true}, bytes: {type: Number, required: true},
  pins: {type: [pin], default: []},
  regions: {type:[region],default:[]},
}, {timestamps: true})
schema.index({roomId: 1, title: 1})
export const RoomMap = mongoose.model('RoomMap', schema)
// Assets never appear in map indexes, notebook documents or revision snapshots.
const assetSchema = new mongoose.Schema({roomId: {type: oid, required: true}, data: {type: Buffer, required: true}}, {timestamps: true})
export const MapAsset = mongoose.model('MapAsset', assetSchema)
const quotaSchema = new mongoose.Schema({_id: {type: String, required: true}, bytes: {type: Number, default: 0}, count: {type: Number, default: 0}})
export const MapQuota = mongoose.model('MapQuota', quotaSchema)
