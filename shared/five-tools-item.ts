import type { EquipmentItem } from './character'
import { inferItemTags } from './item-classification'
import { fiveToolsText } from './five-tools-monster'

export interface FiveToolsItemRecord {item:Record<string,unknown>;fluff?:Record<string,unknown>|null;description:string;mundane:boolean;hash:string;sourceName:string;typeText:string}
const obj=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{}
const str=(v:unknown)=>typeof v==='string'||typeof v==='number'?String(v):''
const list=(v:unknown):unknown[]=>Array.isArray(v)?v:[]
const slug=(v:unknown)=>str(v).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')
const damage:Record<string,string>={A:'acid',B:'bludgeoning',C:'cold',F:'fire',O:'force',L:'lightning',N:'necrotic',P:'piercing',I:'poison',Y:'psychic',R:'radiant',S:'slashing',T:'thunder'}
const types:Record<string,string>={LA:'light',MA:'medium',HA:'heavy',S:'shield'}
const baseIndex=(name:string)=>({ 'light-crossbow':'crossbow-light','hand-crossbow':'crossbow-hand','heavy-crossbow':'crossbow-heavy','padded':'padded-armor','leather':'leather-armor','studded-leather':'studded-leather-armor','hide':'hide-armor','half-plate':'half-plate-armor','splint':'splint-armor','plate':'plate-armor' } as Record<string,string>)[slug(name)]??slug(name)
/** Resolved item rules are reference data; importing them never equips or applies effects. */
export function fiveToolsItemView(record:FiveToolsItemRecord) {
  const m=record.item,type=str(m.type).split('|')[0]!,armorType=types[type]
  const weapon=m.weapon===true||['M','R'].includes(type),armor=!!armorType
  const category=weapon?'weapon':armor?'armor':({A:'ammunition',AF:'ammunition',P:'potion',RG:'ring',RD:'rod',SC:'scroll',SCF:'gear',SHP:'gear',SPC:'gear',WD:'wand',ST:'staff'} as Record<string,string>)[type]??(m.wondrous?'wondrous-items':'gear')
  const attune=m.reqAttune!==undefined&&m.reqAttune!==false&&m.reqAttune!=='',base=str(m._baseName||str(m.baseItem).split('|')[0]||m.name)
  const filterItem:EquipmentItem={name:str(m.name),qty:1,weight:typeof m.weight==='number'?m.weight:0,equipped:false,notes:'',magical:!record.mundane,
    category,kind:weapon?'weapon':armor?'armour':['potion','scroll','ammunition'].includes(category)?'consumable':m.wondrous||['ring','rod','staff','wand'].includes(category)?'accessory':'gear',
    index:baseIndex(base),
    tags:inferItemTags(str(m.name)),rarity:str(m.rarity),requiresAttunement:attune,attunementRequirement:typeof m.reqAttune==='string'?m.reqAttune:'',
    ...(typeof m.value==='number'?{value:{amount:m.value/100,currency:'gp' as const}}:{}),
    ...(weapon?{weapon:{dice:str(m.dmg1),damageType:damage[str(m.dmgType)]??str(m.dmgType),range:str(m.range)||(type==='R'?'ranged':'melee'),ranged:type==='R',finesse:list(m.property).some(p=>str(p).split('|')[0]==='F'),category:str(m.weaponCategory)}}:{}),
    ...(armor?{armor:{base:typeof m.ac==='number'?m.ac:0,dex:armorType==='light'||armorType==='medium',...(armorType==='medium'?{cap:2}:{}),shield:armorType==='shield',category:armorType as 'light'|'medium'|'heavy'|'shield'}}:{}),
  }
  const stats:[string,string][]=[]
  const add=(label:string,value:unknown)=>{if(value!==undefined&&value!==null&&str(value)!=='')stats.push([label,str(value)])}
  add('Type',record.typeText||category);add('Rarity',m.rarity);add('Attunement',attune?typeof m.reqAttune==='string'?`Required ${m.reqAttune}`:'Required':'Not required')
  add('Weight',m.weight===undefined?m.weightNote:`${m.weight} lb${m.weightNote?' · '+m.weightNote:''}`);add('Value',typeof m.value==='number'?`${m.value/100} gp`:m.value)
  add('Damage',m.dmg1?`${m.dmg1} ${damage[str(m.dmgType)]??str(m.dmgType)}`:undefined);add('Two-handed damage',m.dmg2);add('Range',m.range);add(armorType==='shield'?'Shield AC bonus':'Base AC',m.ac)
  add('Strength required',m.strength);add('Stealth',m.stealth?'Disadvantage':undefined);add('Properties',list(m.property).map(p=>str(p).split('|')[0]).join(', '));add('Mastery',list(m.mastery).map(p=>str(p).split('|')[0]).join(', '))
  add('Charges',m.charges);add('Recharge',m.recharge);add('Attacks / damage bonus',m.bonusWeapon);add('AC bonus',m.bonusAc);add('Saving throw bonus',m.bonusSavingThrow);add('Spell attack bonus',m.bonusSpellAttack);add('Spell save DC bonus',m.bonusSpellSaveDc)
  const images=list(record.fluff?.images).flatMap(v=>{const image=obj(v),href=obj(image.href),url=href.type==='external'?str(href.url):href.type==='internal'?'https://5e.tools/img/'+str(href.path):'';return /^https:\/\//.test(url)?[{url,title:str(image.title)||str(m.name)}]:[]})
  const damageTypes=[...new Set([damage[str(m.dmgType)]??'',...[...record.description.matchAll(/\b(?:\d+d\d+(?:\s*[+-]\s*\d+)?|\d+)\s+(acid|bludgeoning|cold|fire|force|lightning|necrotic|piercing|poison|psychic|radiant|slashing|thunder)\s+damage\b/gi)].map(m=>m[1]!.toLowerCase())].filter(Boolean))]
  return {filterItem,damageTypes,stats,description:record.description||fiveToolsText(m._fullEntries??m.entries),info:fiveToolsText(record.fluff?.entries),images,sourceName:record.sourceName,page:m.page,upstream:'https://5e.tools/items.html#'+record.hash}
}
