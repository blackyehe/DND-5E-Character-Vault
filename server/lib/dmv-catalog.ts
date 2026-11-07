import {env} from '../env'
import {CustomContent} from '../models/CustomContent'
import {buildOrcbrewCatalog,type CatalogPack} from './orcbrew'
import {parsedPack} from './orcbrew-library'
import {componentContext,componentMetadata,readComponentCatalogues} from './compendium-components'

// These are all the custom categories resolved by the DMV converter. Equipment
// and magic-item references come from SRD; monster/source trees are not needed.
const kinds=['classes','subclasses','races','subraces','backgrounds','feats','spells'] as const
const owners=new Set(env.COMPENDIUM_PREPARED_USERS.split(',').map(s=>s.trim()).filter(Boolean))

export async function dmvImportCatalog(userId:string|undefined){
 if(userId&&env.COMPENDIUM_READER==='prepared'&&(owners.has('*')||owners.has(userId))){
  try{
   const deadline=performance.now()+2500,metadata=await componentMetadata(userId,deadline)
   // Only verified existing components are used. Import preview never repairs
   // or publishes derived records and never accepts an incomplete pack set.
   const packs=await readComponentCatalogues(userId,kinds,metadata,false,deadline)
   if(packs){
    const catalog=buildOrcbrewCatalog(packs)
    const latest=await componentMetadata(userId,deadline)
    if(JSON.stringify(latest.map(componentContext))===JSON.stringify(metadata.map(componentContext)))return{catalog,reader:'prepared' as const}
   }
  }catch{/* Preserve the exact source reader when components cannot be verified. */}
 }
 const docs=await CustomContent.find({userId,type:'orcbrew'}).lean(),packs:CatalogPack[]=[]
 for(const doc of docs){
  const data=doc.data as {filename:string;includeDisabled?:boolean}
  try{packs.push({id:String(doc._id),filename:data.filename,includeDisabled:data.includeDisabled,parsed:parsedPack(data)})}catch{/* Broken sources remain reported on the files page. */}
 }
 return{catalog:buildOrcbrewCatalog(packs),reader:'legacy' as const}
}
