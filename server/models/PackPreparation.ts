import mongoose from 'mongoose'
const options={autoCreate:false,autoIndex:false,versionKey:false} as const
const job=new mongoose.Schema({
 _id:{type:mongoose.Schema.Types.ObjectId,required:true},userId:{type:mongoose.Schema.Types.ObjectId,required:true},version:{type:String,required:true},
 context:{type:String,required:true},state:{type:String,enum:['queued','running','ready','blocked','cancelled'],required:true},
 attempts:{type:Number,required:true},runAt:{type:Date,required:true},updatedAt:{type:Date,required:true},
 token:String,leaseUntil:Date,generation:String,reason:String,bytes:Number,objects:Number,expiresAt:Date,
},options)
job.index({version:1,state:1,runAt:1})
job.index({userId:1})
job.index({expiresAt:1},{expireAfterSeconds:0})
const lease=new mongoose.Schema({_id:String,token:String,until:{type:Date,required:true}},options)
const generation=new mongoose.Schema({
 _id:{type:String,required:true},version:{type:String,required:true},userId:{type:mongoose.Schema.Types.ObjectId,required:true},packId:{type:mongoose.Schema.Types.ObjectId,required:true},
 context:{type:String,required:true},state:{type:String,enum:['staging','published'],required:true},bytes:{type:Number,required:true},objects:{type:Number,required:true},createdAt:{type:Date,required:true},checkedAt:Date,obsoleteAt:Date,
},options)
generation.index({userId:1,createdAt:1})
generation.index({createdAt:1})
generation.index({checkedAt:1,createdAt:1})
export const PackPreparationJob=mongoose.model('PackPreparationJob',job)
export const PackPreparationLease=mongoose.model('PackPreparationLease',lease)
export const PackPreparationGeneration=mongoose.model('PackPreparationGeneration',generation)
