import mongoose from 'mongoose'
import {CustomContent} from '../models/CustomContent'
import {preparePackSummary} from '../lib/pack-summary-backfill'
const args=process.argv.slice(2),value=(key:string)=>args.find(a=>a.startsWith('--'+key+'='))?.slice(key.length+3)
if(args.some(a=>!/^(--check|--apply|--user=[a-f\d]{24}|--after=[a-f\d]{24}|--limit=\d+)$/i.test(a))||args.includes('--check')&&args.includes('--apply'))throw Error('Use --check (default) or --apply with --user=OBJECTID, optional --after=OBJECTID --limit=1..100')
const owner=value('user'),after=value('after'),limit=Number(value('limit')??25),apply=args.includes('--apply'),uri=process.env.MONGO_URI??process.env.MONGODB_URI
if(!owner||!uri||!Number.isInteger(limit)||limit<1||limit>100)throw Error('Supply an explicit database, owner and a limit between 1 and 100')
try{
 await mongoose.connect(uri,{autoCreate:false,autoIndex:false,maxPoolSize:1,serverSelectionTimeoutMS:8000})
 const rows=await CustomContent.find({userId:owner,type:'orcbrew',...after?{_id:{$gt:new mongoose.Types.ObjectId(after)}}:{}}).select('_id').sort({_id:1}).limit(limit+1).lean(),results=[]
 for(const row of rows.slice(0,limit))try{results.push({id:String(row._id),...await preparePackSummary(owner,String(row._id),apply)})}catch(e){results.push({id:String(row._id),status:'not-changed',code:(e as {status?:number}).status??503})}
 console.log(JSON.stringify({mode:apply?'apply':'check',results,next:rows.length>limit?String(rows[limit-1]!._id):null},null,2))
 if(results.some(r=>r.status==='not-changed'||r.status==='oversize-report'))process.exitCode=2
}catch{console.error('Pack summary preparation failed. Check options and database availability. No source or credentials are logged.');process.exitCode=1}
finally{await mongoose.disconnect()}
