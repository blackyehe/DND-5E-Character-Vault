import {createHash} from 'node:crypto'
import {gzipSync,gunzipSync} from 'node:zlib'
import type {BrowseEntry,BrowseIndex,BrowseKind} from '../../shared/compendium-browse'

// Bump for parser, source snapshot, projection, grouping or filter changes.
export const PREPARED_VERSION='compendium-prepared-1'
export const PREPARED_INDEX_KEY='catalogue'
const CHUNK_BYTES=512*1024
export interface PreparedChunk {part:number;parts:number;digest:string;payload:Buffer}
export interface StoredPreparedChunk extends Omit<PreparedChunk,'payload'> {payload:unknown}
export function encodePrepared(value:unknown,maxBytes:number):PreparedChunk[] {
  const json=JSON.stringify(value)
  if(Buffer.byteLength(json)>maxBytes)throw new Error('Prepared object exceeds its supported size.')
  const data=gzipSync(json),digest=createHash('sha256').update(data).digest('hex'),parts=Math.ceil(data.length/CHUNK_BYTES)
  return Array.from({length:parts},(_,part)=>({part,parts,digest,payload:data.subarray(part*CHUNK_BYTES,(part+1)*CHUNK_BYTES)}))
}
export function decodePrepared(chunks:StoredPreparedChunk[],maxBytes:number):unknown|null {
  if(!chunks.length||chunks.length>Math.ceil(maxBytes/CHUNK_BYTES)+1)return null
  const sorted=[...chunks].sort((a,b)=>a.part-b.part),first=sorted[0]!
  if(first.parts!==sorted.length||sorted.some((c,i)=>c.part!==i||c.parts!==first.parts||c.digest!==first.digest))return null
  try{
    const data=Buffer.concat(sorted.map(c=>{
      if(c.payload instanceof Uint8Array&&c.payload.length<=CHUNK_BYTES)return Buffer.from(c.payload)
      const binary=c.payload as {buffer?:Uint8Array;position?:number}|null
      if(binary?.buffer instanceof Uint8Array&&typeof binary.position==='number'&&Number.isInteger(binary.position)&&binary.position>=0&&binary.position<=binary.buffer.length&&binary.position<=CHUNK_BYTES)return Buffer.from(binary.buffer.subarray(0,binary.position))
      throw new Error('Invalid prepared object payload')
    }))
    if(data.length>maxBytes+65536||createHash('sha256').update(data).digest('hex')!==first.digest)return null
    return JSON.parse(gunzipSync(data,{maxOutputLength:maxBytes}).toString('utf8'))
  }catch{return null}
}
export function preparedIndex(value:unknown):BrowseIndex|null {
  if(!value||typeof value!=='object')return null
  const index=value as BrowseIndex
  return Array.isArray(index.records)&&index.records.every(r=>r&&typeof r.search==='string'&&r.facts&&typeof r.facts==='object'&&r.entry&&typeof r.entry.index==='string'&&typeof r.entry.name==='string')&&Array.isArray(index.categoryFields)&&Array.isArray(index.commonFields)&&Array.isArray(index.extraTags)&&typeof index.unclassifiedMagicItems==='number'?index:null
}
export function preparedSource(value:unknown,kind:BrowseKind,index:string):BrowseEntry|null {
  if(!value||typeof value!=='object'||!index.startsWith(`homebrew-${kind}-`))return null
  const entry=value as BrowseEntry
  return entry.index===index&&typeof entry.name==='string'&&entry.homebrew===true?entry:null
}
export const PREPARED_INDEX_MAX=64*1024*1024
export const PREPARED_SOURCE_MAX=4*1024*1024
