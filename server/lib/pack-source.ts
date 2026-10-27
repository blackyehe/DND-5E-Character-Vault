import { CustomContent } from '../models/CustomContent'
import { decodedPackData } from './pack-storage'

export const PACK_SOURCE_CHARS=192*1024
const PARALLEL_READS=4

/** Bound each database reply instead of receiving a multi-megabyte cursor batch.
 * Every piece belongs to the same owner, document version and source hash.
 * Code-point offsets preserve Unicode at piece boundaries. */
export async function readPackDocuments(userId:string|undefined,packId?:string) {
  const records=await CustomContent.find({userId,type:'orcbrew',...(packId?{_id:packId}:{})}).select('_id userId type data.filename data.includeDisabled data.sourceEncoding data.sourceBytes sourceHash createdAt updatedAt').sort({_id:1}).lean()
  const docs=[]
  for(const record of records){
    const filter={_id:record._id,userId:record.userId,type:'orcbrew',updatedAt:record.updatedAt,...(record.sourceHash?{sourceHash:record.sourceHash}:{})}
    const read=async(offset:number)=>{
      const source={$cond:[{$eq:[{$type:'$data.source'},'string']},'$data.source','']}
      const [part]=await CustomContent.aggregate<{part:string;length:number;valid:boolean}>([
        {$match:filter},
        {$project:{_id:0,valid:{$eq:[{$type:'$data.source'},'string']},
          part:{$substrCP:[source,offset,PACK_SOURCE_CHARS]},
          length:{$strLenCP:source}}},
      ])
      if(!part)throw new Error('A homebrew pack changed while reading. Please refresh.')
      return part
    }
    const first=await read(0),pieces=[first.part]
    if(!first.valid){docs.push({...record,data:{...(record.data as {filename:string;includeDisabled?:boolean}),source:undefined}});continue}
    for(let start=PACK_SOURCE_CHARS;start<first.length;start+=PACK_SOURCE_CHARS*PARALLEL_READS){
      const offsets=Array.from({length:PARALLEL_READS},(_,i)=>start+i*PACK_SOURCE_CHARS).filter(offset=>offset<first.length)
      const group=await Promise.all(offsets.map(read))
      if(group.some(part=>part.length!==first.length))throw new Error('A homebrew pack changed while reading. Please refresh.')
      pieces.push(...group.map(part=>part.part))
    }
    docs.push({...record,data:decodedPackData({...(record.data as {filename:string;includeDisabled?:boolean}),source:pieces.join('')})})
  }
  return docs
}
