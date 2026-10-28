import { weapons, armours } from './item-forms.json'
import type { EquipmentItem } from '../../shared/character'
import { equipmentTags } from '../../shared/item-classification'

// Inventory search needs physical forms, not the full item-filter catalogues.
const forms = [
  ...[...weapons].sort((a, b) => a.name.localeCompare(b.name)),
  ...[...armours].sort((a, b) => a.name.localeCompare(b.name)),
]

export function itemSearchText(item: EquipmentItem) {
  const base = forms.find(form => form.index === item.index)
  return [item.name,item.category,item.rarity,base?.name,item.armor?.category,item.weapon?.damageType,item.weapon?.category,...equipmentTags(item)].filter(Boolean).join(' ').toLowerCase()
}
