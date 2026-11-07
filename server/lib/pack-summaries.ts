import {CustomContent} from '../models/CustomContent'
import {parsedPack} from './orcbrew-library'
import {readPackDocuments} from './pack-source'
import {cachedPackReport, type PackSummaryRecord} from './pack-summary'

export const PACK_SUMMARY_PROJECTION = '_id userId sourceHash updatedAt data.filename data.includeDisabled data.packReport'
export function packSummary(doc: PackSummaryRecord) {
  const data = doc.data as {filename:string;includeDisabled?:boolean}
  try {return {id:String(doc._id),filename:data.filename,includeDisabled:data.includeDisabled===true,report:cachedPackReport(doc) ?? parsedPack(data).report}}
  catch(error){return {id:String(doc._id),filename:data.filename,error:error instanceof Error?error.message:'Could not read saved file'}}
}
export async function readPackSummaries(userId: string | undefined) {
  const records = await CustomContent.find({userId,type:'orcbrew'}).select(PACK_SUMMARY_PROJECTION).sort({_id:1}).setOptions({maxTimeMS:10000,timeoutMS:12000}).lean()
  const missing = records.filter(record => !cachedPackReport(record))
  if (!missing.length) return records.map(packSummary)
  // One batched legacy read, restricted to cache misses; no source for hits.
  const sources = await readPackDocuments(userId,undefined,{packIds:missing.map(record=>String(record._id))})
  const byId = new Map(sources.map(record=>[String(record._id),record]))
  return records.flatMap(record=>{
    if(cachedPackReport(record))return [packSummary(record)]
    const current=byId.get(String(record._id))
    return current?[packSummary(current)]:[] // A concurrently deleted pack stays deleted.
  })
}
