import mongoose from 'mongoose'

// Derived, disposable metadata only. Original packs remain in CustomContent.
const schema=new mongoose.Schema({
  userId:{type:mongoose.Schema.Types.ObjectId,required:true},
  revision:{type:String,required:true},kind:{type:String,required:true},part:{type:Number,required:true},
  parts:{type:Number,required:true},digest:{type:String,required:true},payload:{type:Buffer,required:true},
  expiresAt:{type:Date,required:true},
})
schema.index({userId:1,revision:1,kind:1,part:1},{unique:true})
schema.index({expiresAt:1},{expireAfterSeconds:0})
export const CompendiumBrowseIndex=mongoose.model('CompendiumBrowseIndex',schema)
