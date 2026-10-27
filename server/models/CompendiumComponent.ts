import mongoose from 'mongoose'
const options={autoCreate:false,autoIndex:false}
const ready=new mongoose.Schema({
 version:{type:String,required:true},
 userId:{type:mongoose.Schema.Types.ObjectId,required:true},context:{type:String,required:true},generation:{type:String,required:true},
 counts:{type:mongoose.Schema.Types.Mixed,required:true},bytes:{type:mongoose.Schema.Types.Mixed,required:true},sources:{type:Boolean,required:true},createdAt:{type:Date,required:true},
},options)
ready.index({userId:1,context:1},{unique:true})
const object=new mongoose.Schema({
 version:{type:String,required:true},
 userId:{type:mongoose.Schema.Types.ObjectId,required:true},generation:{type:String,required:true},kind:{type:String,required:true},role:{type:String,required:true},index:{type:String,required:true},
 createdAt:{type:Date,required:true},
 part:{type:Number,required:true},parts:{type:Number,required:true},digest:{type:String,required:true},payload:{type:Buffer,required:true},
},options)
object.index({userId:1,generation:1,kind:1,role:1,index:1,part:1},{unique:true})
export const CompendiumComponent=mongoose.model('CompendiumComponent',ready)
export const CompendiumComponentObject=mongoose.model('CompendiumComponentObject',object)
