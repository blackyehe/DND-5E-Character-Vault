import type { BrowseIndex, BrowseKind } from './compendium-browse'

// Bump for any change to the browser snapshot or shared query interpretation.
export const LOCAL_COMPENDIUM_VERSION='local-compendium-1'
export const LOCAL_CATEGORY_BYTES=8*1024*1024
export const LOCAL_TOTAL_BYTES=24*1024*1024
export const LOCAL_CATEGORY_RECORDS=30000
export interface LocalCompendiumSnapshot {
 version:typeof LOCAL_COMPENDIUM_VERSION
 owner:string
 kind:BrowseKind
 revision:string
 digest:string
 /** Exact JSON bytes hashed by the server, parsed only inside the worker. */
 payload:string
}
export interface StoredCompendiumSnapshot extends LocalCompendiumSnapshot {savedAt:number;bytes:number}
export interface LocalCompendiumRevision {owner:string;revision:string;version:typeof LOCAL_COMPENDIUM_VERSION}

export async function localIndexDigest(payload:string){
 const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(payload))
 return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('')
}
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value)
const strings=(value:unknown)=>Array.isArray(value)&&value.every(v=>typeof v==='string')
/** Disk is untrusted. Invalid structures must fall back before shared queries. */
export function validLocalBrowseIndex(value:unknown):value is BrowseIndex {
 if(!object(value)||!Array.isArray(value.records)||value.records.length>LOCAL_CATEGORY_RECORDS)return false
 const fields=(v:unknown)=>Array.isArray(v)&&v.every(f=>object(f)&&['key','label','any'].every(k=>typeof f[k]==='string')&&Array.isArray(f.options)&&f.options.every(o=>object(o)&&typeof o.value==='string'&&typeof o.label==='string'))
 return fields(value.categoryFields)&&fields(value.commonFields)&&strings(value.extraTags)&&Number.isSafeInteger(value.unclassifiedMagicItems)&&Number(value.unclassifiedMagicItems)>=0&&value.records.every(r=>object(r)&&object(r.entry)&&typeof r.entry.index==='string'&&typeof r.entry.name==='string'&&typeof r.entry.url==='string'&&typeof r.search==='string'&&object(r.facts)&&Object.values(r.facts).every(strings))
}
