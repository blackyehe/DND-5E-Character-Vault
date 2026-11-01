import type {BrowseEntry,BrowseKind} from './compendium-browse'

// Bump when detail interpretation or bundled rule/enrichment snapshots change.
export const COMPENDIUM_DETAIL_VERSION='compendium-details-1'
export interface CompendiumDetailRevision {owner:string;kind:BrowseKind;version:typeof COMPENDIUM_DETAIL_VERSION;revision:string}
export interface CompendiumDetailResponse extends CompendiumDetailRevision {index:string;entry:BrowseEntry}
export const COMPENDIUM_PRELOAD_LIMITS={page:25,batch:3,requests:16,indexLength:256,entryBytes:256*1024,batchBytes:512*1024,pageBytes:2*1024*1024,idleMs:900,betweenMs:350,joinMs:120,requestMs:12000} as const
export interface CompendiumDetailBatch extends CompendiumDetailRevision {entries:{index:string;entry:BrowseEntry}[];skipped:string[]}
