import { describe,it,expect } from 'vitest'
import { fiveToolsItemView,type FiveToolsItemRecord } from './five-tools-item'
import { inspectOrcbrew,canonicalContent } from '../server/lib/orcbrew'
import { writeEdn } from '../server/lib/workshop-pack'
import { itemBrowseEntry } from '../server/lib/orcbrew-items'
import { normalizeItemName } from './item-reference'

describe('5etools item references',()=>{
  it('groups common SRD bonus suffixes without merging different enchantment levels',()=>{
    expect(normalizeItemName('Longsword, +1')).toBe(normalizeItemName('+1 Longsword'))
    expect(normalizeItemName('Longsword, +2')).not.toBe(normalizeItemName('+1 Longsword'))
  })
  it('keeps resolved rules and artwork while separating compact filters from full detail',()=>{
    const record:FiveToolsItemRecord={item:{name:'+1 Longsword',source:'DMG',type:'M',weapon:true,dmg1:'1d8',dmg2:'1d10',dmgType:'S',bonusWeapon:'+1',weaponCategory:'martial',_baseName:'Longsword',property:['V'],weight:3,rarity:'uncommon',future:{rules:['untouched']}},fluff:{entries:['Item history'],images:[{href:{type:'internal',path:'items/DMG/weapon.webp'}}]},description:'You have a +1 bonus to attack and damage rolls.',mundane:false,sourceName:'Dungeon Master’s Guide (2014)',hash:'%2b1%20longsword_dmg',typeText:'martial weapon'}
    const raw={':name':record.item.name,':option-pack':'DMG',':codex/item':record},text=writeEdn({':orcpub.dnd.e5/magic-items':{':weapon':raw}})
    const entry=inspectOrcbrew(text).entries['magic-items'][0]!,view=fiveToolsItemView(record)
    expect(canonicalContent(entry.details)).toBe(canonicalContent(raw))
    expect(view.filterItem.weapon).toMatchObject({damageType:'slashing',dice:'1d8'})
    expect(view.filterItem.index).toBe('longsword')
    expect(view.stats).toContainEqual(['Two-handed damage','1d10'])
    expect(view.info).toContain('Item history')
    expect(view.images[0]!.url).toBe('https://5e.tools/img/items/DMG/weapon.webp')
    const index=itemBrowseEntry(entry,'magic-items')
    expect(JSON.stringify(index)).not.toContain('attack and damage rolls')
    expect(index.itemDetailUrl).toContain('/magic-items/homebrew-magic-items-')
    expect(index).not.toHaveProperty('details');expect(index).not.toHaveProperty('itemView')
  })
  it('keeps mundane and magical editions separate without inventing unknown AC or cost',()=>{
    const record:FiveToolsItemRecord={item:{name:'Odd Plate',source:'TEST',type:'HA',rarity:'none'},description:'Special armour rules.',mundane:true,hash:'odd_test',sourceName:'Test source',typeText:'heavy armour'}
    const view=fiveToolsItemView(record)
    expect(view.filterItem.magical).toBe(false)
    expect(view.stats.some(([name])=>name==='Base AC'||name==='Value')).toBe(false)
    const text=writeEdn({':orcpub.dnd.e5/equipment':{':plate':{':name':'Odd Plate',':codex/item':record}}})
    expect(inspectOrcbrew(text).entries.equipment).toHaveLength(1)
  })
  it('uses existing base filter names and includes explicitly described extra damage',()=>{
    const record:FiveToolsItemRecord={item:{name:'Flame Tongue',source:'DMG',weapon:true,type:'M',_baseName:'Light Crossbow',dmg1:'1d8',dmgType:'P'},description:'Deals an extra 2d6 fire damage.',mundane:false,hash:'flame_dmg',sourceName:'DMG',typeText:'weapon'}
    expect(fiveToolsItemView(record).filterItem.index).toBe('crossbow-light')
    expect(fiveToolsItemView(record).damageTypes).toEqual(['piercing','fire'])
    expect(fiveToolsItemView({...record,item:{...record.item,type:'HA',_baseName:'Chain Mail'}}).filterItem.index).toBe('chain-mail')
  })
})
