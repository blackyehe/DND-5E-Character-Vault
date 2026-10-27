import { gzipSync,gunzipSync } from 'node:zlib'
import { TextDecoder } from 'node:util'
import { MAX_PACK_BYTES,MAX_STORED_PACK_BYTES,MAX_PACK_MIB } from '../../shared/pack-limits'
export { MAX_PACK_BYTES,MAX_STORED_PACK_BYTES } from '../../shared/pack-limits'

export const PLAIN_PACK_BYTES=8*1024*1024
type Data=Record<string,unknown>
const data=(v:unknown):Data=>v&&typeof v==='object'?v as Data:{}

/** Compression is storage-only: readers, editors, hashes and exports use exact UTF-8 source. */
export function packSource(value:unknown):string {
  const v=data(value)
  if(typeof v.source!=='string')throw new Error('Saved Orcbrew file has no source text')
  if(!v.sourceEncoding){if(Buffer.byteLength(v.source)>MAX_PACK_BYTES)throw new Error(`Pack exceeds ${MAX_PACK_MIB} MiB`);return v.source}
  if(v.sourceEncoding!=='gzip-base64'||v.source.length>MAX_STORED_PACK_BYTES||!/^[A-Za-z0-9+/]*={0,2}$/.test(v.source))throw new Error('Invalid compressed pack encoding')
  const compressed=Buffer.from(v.source,'base64')
  if(compressed.toString('base64')!==v.source)throw new Error('Invalid compressed pack encoding')
  const bytes=gunzipSync(compressed,{maxOutputLength:MAX_PACK_BYTES})
  if(bytes.length!==v.sourceBytes)throw new Error('Compressed pack size does not match its manifest')
  return new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes)
}
export function decodedPackData(value:unknown):Data&{source:string} {
  const {sourceEncoding:_,sourceBytes:__,...rest}=data(value)
  return {...rest,source:packSource(value)}
}
export function storedPackData(value:unknown):Data {
  const decoded=decodedPackData(value),bytes=Buffer.byteLength(decoded.source)
  if(bytes<=PLAIN_PACK_BYTES)return decoded
  const source=gzipSync(Buffer.from(decoded.source),{level:9}).toString('base64')
  if(source.length>MAX_STORED_PACK_BYTES)throw new Error('Compressed pack exceeds safe database storage; split the pack into smaller files')
  return {...decoded,source,sourceEncoding:'gzip-base64',sourceBytes:bytes}
}
