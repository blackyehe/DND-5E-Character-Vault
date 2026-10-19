import type { EquipmentItem } from './character'
import { armourCategories, inferItemTags } from './item-classification'

interface Ref {index:string;name:string}
export interface EquipmentDefinition {
  index:string;name:string;weight:number;equipment_category:Ref;desc?:string[];special?:string[];
  armor_class?:{base:number;dex_bonus:boolean;max_bonus?:number};armor_category?:string;
  damage?:{damage_dice:string;damage_type:Ref};weapon_range?:string;weapon_category?:string;
  properties?:Ref[];two_handed_damage?:{damage_dice:string;damage_type:Ref};
  range?:{normal:number;long?:number};throw_range?:{normal:number;long?:number};
  str_minimum?:number;stealth_disadvantage?:boolean;
  cost?:{quantity:number;unit:string};
}
export interface MagicItemDefinition {index:string;name:string;equipment_category:Ref;desc:string[];rarity?:{name:string}}
export function magicItemRules(magic:MagicItemDefinition) {
  const text=magic.desc.join(' ')
  const protection=/^ring-of-protection$|^cloak-of-protection$/.test(magic.index)
  return {magical:true,rarity:magic.rarity?.name.toLowerCase(),tags:inferItemTags(magic.name),attunementRequirement:text.match(/requires attunement (by [^).\n]+)/i)?.[1],requiresAttunement:/requires attunement/i.test(text),effects:{ac:protection?1:0,saves:protection?1:0}}
}

export function magicEquipmentFrom(magic:MagicItemDefinition,base?:EquipmentDefinition):EquipmentItem {
  const item=base?equipmentFrom(base):{name:magic.name,qty:1,weight:0,equipped:false,notes:''}
  const bonus=magic.desc.join(' ').match(/\+([1-3]) bonus to (?:attack and damage rolls|AC)/i)
  return {...item,...magicItemRules(magic),attuned:false,name:base?`${magic.name} (${base.name})`:magic.name,magicIndex:magic.index,
    category:base?.equipment_category.name??magic.equipment_category.name,tags:base?.damage||base?.armor_class?[]:inferItemTags(magic.name),value:undefined,
    description:magic.desc.join('\n\n'),referenceDescription:'description' in item?item.description:undefined,magicBonus:bonus?Number(bonus[1]):0}
}

export function equipmentFrom(detail:EquipmentDefinition):EquipmentItem {
  const properties=detail.properties??[]
  const armourCategory=detail.armor_category?.toLowerCase()
  return {index:detail.index,name:detail.name,qty:1,weight:detail.weight??0,equipped:false,notes:'',category:detail.equipment_category.name,
    tags:detail.damage||detail.armor_class?[]:inferItemTags(detail.name),
    value:detail.cost&&['cp','sp','ep','gp','pp'].includes(detail.cost.unit)?{amount:detail.cost.quantity,currency:detail.cost.unit as NonNullable<EquipmentItem['value']>['currency']}:undefined,
    description:[...(detail.desc??[]),...(detail.special??[]),
      properties.length?`Properties: ${properties.map(p=>p.name).join(', ')}.`:'',
      detail.two_handed_damage?`Two-handed damage: ${detail.two_handed_damage.damage_dice} ${detail.two_handed_damage.damage_type.name}.`:'',
      detail.range?.long?`Range: ${detail.range.normal}/${detail.range.long} ft.`:'',
      detail.throw_range?`Thrown range: ${detail.throw_range.normal}/${detail.throw_range.long??detail.throw_range.normal} ft.`:'',
      detail.str_minimum?`Minimum Strength: ${detail.str_minimum}.`:'',
      detail.stealth_disadvantage?'Disadvantage on Dexterity (Stealth) checks.':'',
    ].filter(Boolean).join('\n\n'),
    ...(detail.armor_class?{armor:{base:detail.armor_class.base,dex:detail.armor_class.dex_bonus,cap:detail.armor_class.max_bonus,shield:detail.armor_category==='Shield',category:armourCategories.find(category=>category===armourCategory)}}:{}),
    ...(detail.damage||detail.equipment_category.index==='weapon'?{weapon:{dice:detail.damage?.damage_dice??'0d1',damageType:detail.damage?.damage_type.name??'none',noDamage:!detail.damage,range:detail.weapon_range==='Ranged'&&detail.range?`${detail.range.normal}${detail.range.long?`/${detail.range.long}`:''} ft.`:detail.weapon_range??'Melee',finesse:properties.some(p=>p.index==='finesse'),ranged:detail.weapon_range==='Ranged',category:detail.weapon_category?.toLowerCase()}}:{}),
  }
}
