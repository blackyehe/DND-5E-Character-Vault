import type { Character, EquipmentItem } from './character'

export const itemKinds = ['weapon','armour','accessory','consumable','treasure','gear'] as const
export function itemKind(item:EquipmentItem):NonNullable<EquipmentItem['kind']> {
  if(item.kind)return item.kind
  if(item.weapon)return 'weapon'
  if(item.armor)return 'armour'
  const category=item.category?.toLowerCase()??''
  if(/\bweapons?\b/.test(category))return 'weapon'
  if(/\b(armou?rs?|shields?)\b/.test(category))return 'armour'
  if(/\b(rings?|amulets?|wondrous|accessor|rods?|staff|staves|wands?)/.test(category))return 'accessory'
  if(/\b(potions?|scrolls?|consumables?|ammunition)\b/.test(category))return 'consumable'
  if(/\b(treasure|currency|coins?|valuables?|gems?)\b/.test(category)||/^(cp|sp|ep|gp|pp|gold|silver|copper|electrum|platinum)$/i.test(item.name.trim()))return 'treasure'
  return 'gear'
}
export const itemActive=(item:EquipmentItem)=>item.equipped&&item.qty>0&&(!item.requiresAttunement||item.attuned===true)
const identity=(item:EquipmentItem)=>item.magicIndex??item.templateId??item.name.toLowerCase().replace(/[^a-z0-9]/g,'')
/** Identical magic items don't stack; quantities are inventory counts, not bonus multipliers. */
export function itemBonuses(c:Pick<Character,'equipment'>) {
  let ac=0,saves=0
  const seen=new Set<string>()
  for(const item of c.equipment){
    if(!itemActive(item))continue
    const key=identity(item)
    if((item.magical||item.magicIndex)&&seen.has(key))continue
    seen.add(key);ac+=item.effects?.ac??0;saves+=item.effects?.saves??0
  }
  return {ac,saves}
}
export function attunementError(items:EquipmentItem[]):string|undefined {
  const attuned=items.filter(i=>i.requiresAttunement&&i.attuned&&i.qty>0)
  if(attuned.length>3)return 'A character can attune to three items. End another attunement first.'
  if(new Set(attuned.map(identity)).size!==attuned.length)return 'A character cannot attune to two copies of the same magic item.'
}
/** Preserve the imported total once, then track changes in worn-item bonuses. */
export function withItemBaseline<T extends Pick<Character,'equipment'|'combat'>>(c:T):T {
  return c.combat.itemAcBaseline===undefined?{...c,combat:{...c.combat,itemAcBaseline:c.combat.acMode==='equipment'?0:itemBonuses(c).ac}}:c
}
