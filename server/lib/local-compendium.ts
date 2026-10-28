import {createHash} from 'node:crypto'
import {gzipSync} from 'node:zlib'
import type {BrowseKind} from '../../shared/compendium-browse'
import {LOCAL_CATEGORY_BYTES,LOCAL_CATEGORY_RECORDS,LOCAL_COMPENDIUM_VERSION,type LocalCompendiumSnapshot} from '../../shared/local-compendium'
import {compendiumBrowseIndex} from './compendium-browse'

/** Explicit synchronization only; normal page browsing does not call this. */
export async function localCompendiumExport(owner:string,kind:BrowseKind){
 const {index,revision}=await compendiumBrowseIndex(owner,kind)
 const payload=JSON.stringify(index)
 if(Buffer.byteLength(payload)>LOCAL_CATEGORY_BYTES||index.records.length>LOCAL_CATEGORY_RECORDS)return null
 const snapshot:LocalCompendiumSnapshot={owner,kind,revision,version:LOCAL_COMPENDIUM_VERSION,digest:createHash('sha256').update(payload).digest('hex'),payload}
 // Send precompressed bytes below the platform response bound, including for
 // categories whose uncompressed metadata would exceed that bound.
 const body=gzipSync(JSON.stringify(snapshot))
 return body.length<=2*1024*1024?body:null
}
