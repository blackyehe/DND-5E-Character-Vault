// Generate factual filter tags from the same 2014 dataset used by dnd5eapi.co.
// Usage: node scripts/build-magic-item-filters.mjs <Magic-Items.json> <Equipment.json>
// Source revision: 5e-bits/5e-srd-api@85acb251dad0b044a72c554c2d7f2d0c11e43504
import { readFile, writeFile } from 'node:fs/promises'

const [magicPath, equipmentPath] = process.argv.slice(2)
if (!magicPath || !equipmentPath) throw new Error('Provide the 2014 SRD magic item and equipment JSON files.')
const magic = JSON.parse(await readFile(magicPath, 'utf8'))
const equipment = JSON.parse(await readFile(equipmentPath, 'utf8'))
const weapons = equipment.filter(e => e.equipment_category.index === 'weapon')
const armours = equipment.filter(e => e.equipment_category.index === 'armor')
const swords = ['greatsword', 'longsword', 'rapier', 'scimitar', 'shortsword']
const axes = ['handaxe', 'battleaxe', 'greataxe']
// These are damage dealt by weapon attacks or their special attacks, never resistances.
const bonusDamage = {
  'dagger-of-venom': ['poison'], 'flame-tongue': ['fire'], 'frost-brand': ['cold'],
  'holy-avenger': ['radiant'], 'javelin-of-lightning': ['lightning'],
  'mace-of-disruption': ['radiant'], 'sword-of-life-stealing': ['necrotic'],
  'sword-of-wounding': ['necrotic'], 'sun-blade': ['radiant'],
}
const tags = Object.fromEntries(magic.map(item => {
  const category = item.equipment_category.index
  const restriction = item.desc[0]?.match(/^(?:Weapon|Armor) \(([^)]+)\)/i)?.[1].toLowerCase() ?? ''
  const tag = { category }
  if (category === 'weapon') {
    let types = weapons.filter(w => restriction === 'any' || restriction.includes(w.name.toLowerCase()) || restriction.includes(w.index.replaceAll('-', ' ')))
    if (/\bsword\b/.test(restriction)) types.push(...weapons.filter(w => swords.includes(w.index)))
    if (/\baxe\b/.test(restriction)) types.push(...weapons.filter(w => axes.includes(w.index)))
    if (restriction.includes('slashing damage')) types = types.filter(w => w.damage?.damage_type.index === 'slashing')
    tag.weaponTypes = [...new Set(types.map(w => w.index))].sort()
    if (!tag.weaponTypes.length) throw new Error(`Unclassified weapon: ${item.index}`)
    if (bonusDamage[item.index]) tag.bonusDamageTypes = bonusDamage[item.index]
    if (item.index === 'sun-blade') tag.replacesDamage = true
  }
  if (category === 'armor') {
    tag.armourTypes = armours.filter(a => {
      const name = a.name.toLowerCase().replace(/ armor$/, '')
      return (restriction.includes(a.armor_category.toLowerCase()) || restriction.includes(name)) && !(restriction.includes('not hide') && a.index === 'hide-armor')
    }).map(a => a.index).sort()
    if (!tag.armourTypes.length) throw new Error(`Unclassified armour: ${item.index}`)
  }
  return [item.index, tag]
}))
const forms = {
  source: 'https://github.com/5e-bits/5e-srd-api/tree/85acb251dad0b044a72c554c2d7f2d0c11e43504/packages/5e-database/src/2014/en',
  weapons: weapons.map(w => ({ index: w.index, name: w.name, group: w.weapon_category, range: w.weapon_range, damage: w.damage?.damage_type.index ?? '' })),
  armours: armours.map(a => ({ index: a.index, name: a.name, group: a.armor_category })),
}
const data = { source: forms.source, items: tags }
await writeFile(new URL('../src/lib/item-forms.json', import.meta.url), JSON.stringify(forms, null, 2) + '\n')
await writeFile(new URL('../src/lib/magic-item-filter-data.json', import.meta.url), JSON.stringify(data, null, 2) + '\n')
console.log(`Generated filter metadata for ${magic.length} magic items.`)
