// Rebuild search-only metadata from the bundled SRD; no network requests.
import fs from 'node:fs'
import { equipmentFrom, type EquipmentDefinition, type MagicItemDefinition } from '../shared/equipment-definitions'
import { inferItemTags } from '../shared/item-classification'
const file='src/lib/magic-item-filter-data.json'
const data=JSON.parse(fs.readFileSync(file,'utf8'))
const magic:MagicItemDefinition[]=JSON.parse(fs.readFileSync('server/data/srd-2014-magic-items.json','utf8'))
for(const entry of magic){
  const tag=data.items[entry.index]
  if(!tag)continue
  tag.tags=['weapon','armor','ammunition'].includes(tag.category)?[]:inferItemTags(entry.name)
  tag.rarity=entry.rarity?.name.toLowerCase()
  tag.attunement=/requires attunement/i.test(entry.desc.join(' '))
}
fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n')
const equipment:EquipmentDefinition[]=JSON.parse(fs.readFileSync('server/data/srd-2014-equipment.json','utf8'))
const normal=equipment.map(entry=>{const {description,...item}=equipmentFrom(entry);return [entry.index,{...item,...(item.weapon||item.armor?{referenceDescription:description}:{})}]})
fs.writeFileSync('src/lib/equipment-filter-data.json',JSON.stringify(Object.fromEntries(normal))+'\n')
