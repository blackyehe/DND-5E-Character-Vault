import { createHash } from 'node:crypto'
import { gzipSync, gunzipSync } from 'node:zlib'
import type { BrowseIndex } from '../../shared/compendium-browse'

const CHUNK_BYTES=512*1024
export interface IndexChunk {part:number;parts:number;digest:string;payload:Buffer}
interface StoredChunk extends Omit<IndexChunk,'payload'> {payload:unknown}
export function encodeBrowseIndex(index:BrowseIndex):IndexChunk[] {
  const data=gzipSync(JSON.stringify(index)),digest=createHash('sha256').update(data).digest('hex'),parts=Math.ceil(data.length/CHUNK_BYTES)
  return Array.from({length:parts},(_,part)=>({part,parts,digest,payload:data.subarray(part*CHUNK_BYTES,(part+1)*CHUNK_BYTES)}))
}
export function decodeBrowseIndex(chunks:StoredChunk[]):BrowseIndex|null {
  if(!chunks.length)return null
  const sorted=[...chunks].sort((a,b)=>a.part-b.part),first=sorted[0]!
  if(first.parts!==sorted.length||sorted.some((c,i)=>c.part!==i||c.parts!==first.parts||c.digest!==first.digest))return null
  try{
    // lean() preserves the driver's BSON Binary rather than hydrating a Mongoose
    // Buffer. Both the actual database shape and in-memory chunks are supported.
    const data=Buffer.concat(sorted.map(c=>{
      if(c.payload instanceof Uint8Array)return Buffer.from(c.payload)
      const binary=c.payload as {buffer?:Uint8Array;position?:number}|null
      if(binary?.buffer instanceof Uint8Array&&Number.isInteger(binary.position))return Buffer.from(binary.buffer.subarray(0,binary.position))
      throw new Error('Invalid index payload')
    }))
    if(createHash('sha256').update(data).digest('hex')!==first.digest)return null
    const index=JSON.parse(gunzipSync(data,{maxOutputLength:64*1024*1024}).toString('utf8')) as BrowseIndex
    return Array.isArray(index.records)&&Array.isArray(index.categoryFields)&&Array.isArray(index.commonFields)&&Array.isArray(index.extraTags)?index:null
  }catch{return null}
}
