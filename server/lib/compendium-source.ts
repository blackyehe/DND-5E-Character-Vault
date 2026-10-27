import { CustomContent } from '../models/CustomContent'
import { workshopLibrary } from './workshop-library'
import { localSrdRule } from './srd-snapshot'
import { readSrdRule } from './srd-client'
import { env } from '../env'
import { enrichedMonsterEntries, enrichedStandardMonster } from './monster-enrichment'
import { prepareItem } from './inventory'
import { activeWorkshopEntries } from './workshop-schema'
import type { EquipmentItem } from '../../shared/character'
import type { CompendiumKind, EntryData } from '../../shared/compendium-editing'

export async function compendiumSource(userId:string|undefined,kind:CompendiumKind,index:string):Promise<EntryData|null> {
  if(index.startsWith('workshop-item-')&&(kind==='equipment'||kind==='magic-items')){
    const id=index.slice('workshop-item-'.length)
    if(!/^[a-f0-9]{24}$/i.test(id))return null
    const doc=await CustomContent.findOne({_id:id,userId,type:'item'}).lean()
    if(!doc)return null
    const item=prepareItem(doc.data as EquipmentItem)
    if(!!item.magical!==(kind==='magic-items'))return null
    return {index,name:item.name,displayName:`${item.name} · My Workshop`,url:'',sourcePack:'My Workshop',workshopItem:item}
  }
  if(index.startsWith('homebrew-')){
    const catalog=(await workshopLibrary(userId)).catalog
    const entries=kind==='classes'||kind==='subclasses'||kind==='races'?activeWorkshopEntries(catalog[kind],kind):catalog[kind]
    const entry=entries.find(e=>e.index===index)
    if(!entry)return null
    return kind==='monsters'?(await enrichedMonsterEntries(userId,[entry]))[0]!:entry
  }
  if(!/^[a-z0-9-]+$/i.test(index)||!['spells','equipment','magic-items','classes','subclasses','races','subraces','monsters','backgrounds','feats','languages'].includes(kind))return null
  const path=`${kind}/${index}`,local=localSrdRule(path)
  const entry=local===undefined?await readSrdRule(env.SRD_API_URL,path,{interactive:true}):local
  if(!entry||typeof entry!=='object')return null
  const result=enrichedStandardMonster(entry,path) as EntryData
  // A builder needs complete feature text, not just the reader's reference links.
  if(['classes','subclasses','races','subraces'].includes(kind)){
    const read=(path:string)=>readSrdRule(env.SRD_API_URL,path,{interactive:true})
    const list=(v:unknown)=>Array.isArray(v)?v as EntryData[]:[]
    const levels=kind==='classes'||kind==='subclasses'?list(await read(`${kind}/${index}/levels`)):[]
    const refs:EntryData[]=[...levels.flatMap(row=>list(row.features).map(feature=>({...feature,level:row.level}))),...list(result.traits??result.racial_traits)]
    const unique=[...new Map(refs.map(f=>[f.index,f])).values()]
    const features=await Promise.all(unique.map(async f=>{
      if(Array.isArray(f.desc))return f
      const endpoint=String(f.url??'').replace(/^\/api\/(?:2014\/)?/,'')
      const full=await read(endpoint||`${kind==='races'||kind==='subraces'?'traits':'features'}/${f.index}`) as EntryData|null
      if(!full)throw new Error(`The rules for ${String(f.name)} could not load. Retry the entry before editing.`)
      return {...full,level:f.level??1}
    }))
    return {...result,builderLevels:levels,builderFeatures:features}
  }
  return result
}
