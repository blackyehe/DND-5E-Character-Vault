import mongoose from 'mongoose'

// Disposable source projections. Original Orcbrew documents remain authoritative.
const schema=new mongoose.Schema({
  userId:{type:mongoose.Schema.Types.ObjectId,required:true},
  revision:{type:String,required:true},kind:{type:String,required:true},index:{type:String,required:true},
  payload:{type:Buffer,required:true},digest:{type:String,required:true},expiresAt:{type:Date,required:true},
})
schema.index({userId:1,revision:1,kind:1,index:1},{unique:true})
schema.index({expiresAt:1},{expireAfterSeconds:0})
export const CompendiumEntryCache=mongoose.model('CompendiumEntryCache',schema)
