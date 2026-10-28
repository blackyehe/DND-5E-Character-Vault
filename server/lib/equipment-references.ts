import equipmentData from '../data/srd-2014-equipment.json'
import magicData from '../data/srd-2014-magic-items.json'
import type { EquipmentItem } from '../../shared/character'
import { equipmentFrom, magicItemRules, type EquipmentDefinition, type MagicItemDefinition } from '../../shared/equipment-definitions'
import { itemKind } from '../../shared/item-rules'

const equipment=equipmentData as EquipmentDefinition[],magicItems=magicData as MagicItemDefinition[]
const words=(value:string)=>value.toLowerCase().replace(/[’']/g,'').replace(/[^a-z0-9]+/g,' ').trim()
const inside=(text:string,part:string)=>` ${text} `.includes(` ${part} `)
const aliases:Record<string,string[]>={ 'leather-armor':['leather'], 'padded-armor':['padded'], 'studded-leather-armor':['studded leather'], 'hide-armor':['hide'], 'half-plate-armor':['half plate'], 'plate-armor':['plate'], 'splint-armor':['splint'], 'crossbow-light':['light crossbow'], 'crossbow-heavy':['heavy crossbow'], 'crossbow-hand':['hand crossbow'] }

/** Enrich old inventories without changing identity, quantity, equipped state or custom rules. */
export function resolveEquipmentItem(saved:EquipmentItem):EquipmentItem {
  const name=words(saved.name),index=words(saved.index??'')
  const swordName=name.replace(/\b(longsword|shortsword|greatsword|rapier|scimitar)\b/g,'sword')
  const magicMatches=magicItems.filter(item=>inside(name,words(item.name))||inside(swordName,words(item.name))||inside(name,words(item.index))||index===words(item.index))
    .sort((a,b)=>b.name.length-a.name.length)
  // An explicitly selected imported source must not become a guessed SRD item.
  let magic=magicItems.find(item=>item.index===(saved.magicIndex??saved.index))
  if(!magic&&!saved.magicIndex&&magicMatches.length&&(!magicMatches[1]||magicMatches[0]!.name.length>magicMatches[1].name.length))magic=magicMatches[0]
  let base=equipment.find(item=>item.index===saved.index)
  const canInferBase=!magic||['weapon','armor','staff','ammunition'].includes(magic.equipment_category.index)
  if(!base&&canInferBase){
    const candidates=equipment.filter(item=>{
      const names=[words(item.name),words(item.index),...(aliases[item.index]??[])]
      return (item.damage||item.armor_class)?names.some(key=>inside(name,key)||index===key):names.some(key=>name===key||index===key)
    }).sort((a,b)=>Math.max(words(b.name).length,words(b.index).length)-Math.max(words(a.name).length,words(a.index).length))
    const best=candidates[0]
    if(best&&!candidates.some(other=>other!==best&&!inside(words(best.name),words(other.name))&&!inside(words(best.index),words(other.index))))base=best
  }
  const numeric=saved.name.match(/\+([1-3])\b/)??saved.name.match(/(?:weapon|armou?r|sword|bow|axe|shield)[\w\s]*\s([1-3])$/i)
  if(!magic&&!saved.magicIndex&&numeric&&base&&(base.damage||base.armor_class))magic=magicItems.find(item=>item.index===`${base.armor_class?(base.armor_category==='Shield'?'shield':'armor'):'weapon'}-${numeric[1]}`)
  const derived=base?equipmentFrom(base):undefined
  const reference=[magic?.desc.join('\n\n'),derived?.description].filter(Boolean).join('\n\n')
  // Only unconditional numerical weapon/armour enchantments belong in attack/AC math.
  const statedBonus=magic?.desc.join(' ').match(/\+([1-3]) bonus to (?:attack and damage rolls|AC)/i)
  const inferredBonus=statedBonus?Number(statedBonus[1]):numeric?Number(numeric[1]):0
  const imported=/^Imported item: check weight and special effects\.$/i.test(saved.notes.trim())
  const rules=magic?magicItemRules(magic):undefined
  const result:EquipmentItem={...derived,...rules,...saved,index:base?.index??saved.index,magicIndex:magic?.index??saved.magicIndex,
    category:saved.weapon?'Weapon':saved.armor?'Armor':saved.category??derived?.category??magic?.equipment_category.name,
    weapon:saved.weapon??derived?.weapon,armor:saved.armor?{...derived?.armor,...saved.armor}:derived?.armor,
    weight:imported&&saved.weight===0?derived?.weight??0:saved.weight,
    value:saved.value??(!magic&&!saved.magical?derived?.value:undefined),
    magicBonus:saved.magicBonus===undefined||imported&&saved.magicBonus===0?inferredBonus:saved.magicBonus,
    description:saved.description?.trim()?saved.description:reference||saved.description,
    referenceDescription:saved.referenceDescription??(reference&&saved.description?.trim()&&words(saved.description)!==words(reference)?reference:undefined),
    requiresAttunement:saved.requiresAttunement??rules?.requiresAttunement,
    attuned:saved.attuned??(saved.requiresAttunement===undefined&&saved.equipped&&rules?.requiresAttunement?true:false),
    effects:saved.effects??rules?.effects,
  }
  result.kind=itemKind(result)
  return result
}
