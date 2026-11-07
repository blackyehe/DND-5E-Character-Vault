import {CustomContent} from '../models/CustomContent'
import {cachedPackReport,storedPackSummary} from './pack-summary'
import {readPackDocuments} from './pack-source'
import {parsedPack} from './orcbrew-library'
import {sourceHash} from './orcbrew'

const failure=(status:number,message:string)=>Object.assign(new Error(message),{status})
/** One exact, owner-scoped pack per request. Source and catalogue revisions do
 * not change when a derived report is written. No unbounded bulk parse on GET. */
export async function preparePackSummary(userId:string,id:string,apply=false){
 const current=await CustomContent.findOne({_id:id,userId,type:'orcbrew'}).select('_id userId sourceHash updatedAt data.filename data.includeDisabled data.packReport').lean()
 if(!current)throw failure(404,'Pack not found.')
 if(cachedPackReport(current))return{status:'ready' as const}
 const guard={_id:current._id,userId:current.userId,type:'orcbrew',updatedAt:current.updatedAt,...current.sourceHash?{sourceHash:current.sourceHash}:{sourceHash:{$exists:false}}}
 const [size]=await CustomContent.aggregate<{stored:number;decoded:number}>([{$match:guard},{$project:{_id:0,stored:{$strLenBytes:{$ifNull:['$data.source','']}},decoded:{$cond:[{$eq:['$data.sourceEncoding','gzip-base64']},'$data.sourceBytes',{$strLenBytes:{$ifNull:['$data.source','']}}]}}}]).option({maxTimeMS:2000,timeoutMS:4000})
 if(!size)throw failure(409,'This pack changed. Refresh before preparing its summary.')
 if(!Number.isSafeInteger(size.decoded)||size.decoded<=0||size.decoded>16*1024*1024||!Number.isSafeInteger(size.stored)||size.stored<=0||size.stored>32*1024*1024)throw failure(413,'This pack exceeds bounded summary preparation. Its source remains available.')
 const doc=(await readPackDocuments(userId,id,{maxDecodedBytes:16*1024*1024,maxStoredBytes:32*1024*1024}))[0]
 if(!doc)throw failure(409,'This pack changed. Refresh before preparing its summary.')
 const source=doc.data.source
 if(typeof source!=='string')throw failure(422,'The saved pack source cannot be read.')
 const hash=sourceHash(source)
 if(doc.sourceHash&&doc.sourceHash!==hash)throw failure(409,'The source fingerprint requires reconciliation before preparing a summary.')
 if(!doc.sourceHash&&(!(doc.updatedAt instanceof Date)||!Number.isFinite(doc.updatedAt.getTime())))throw failure(409,'This legacy source needs a reliable revision before preparing a summary.')
 let report:ReturnType<typeof parsedPack>['report']
 try{report=parsedPack(doc.data).report}catch{throw failure(422,'The saved pack could not be parsed. Its source was not changed.')}
 const summary=storedPackSummary(source,report,doc.updatedAt)
 if(!summary)return{status:'oversize-report' as const}
 if(!apply)return{status:'pending' as const,bytes:Buffer.byteLength(JSON.stringify(summary))}
 const saved=await CustomContent.updateOne({_id:doc._id,userId,type:'orcbrew',updatedAt:doc.updatedAt,...doc.sourceHash?{sourceHash:doc.sourceHash}:{sourceHash:{$exists:false}}},{$set:{'data.packReport':summary}},{timestamps:false})
 if(!saved.matchedCount)throw failure(409,'This pack changed while preparing. Its source was not modified.')
 return{status:'prepared' as const,bytes:Buffer.byteLength(JSON.stringify(summary))}
}
