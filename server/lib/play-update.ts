import { z } from 'zod'
import type { Character } from '../../shared/character'
import { attunementError } from '../../shared/item-rules'

const count = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER)
export const playUpdateSchema = z.object({
  expectedUpdatedAt: z.iso.datetime(),
  combat: z.object({ hpCurrent: count.optional(), hpTemp: count.max(9999).optional(), hitDiceUsed: count.optional(), deathSavesSuccess: count.max(3).optional(), deathSavesFailure: count.max(3).optional(), inspiration: z.boolean().optional() }).strict().optional(),
  slots: z.array(z.object({ key: z.string().regex(/^l[1-9]$/), used: count }).strict()).max(9).optional(),
  resources: z.array(z.object({ id: z.string().max(200), used: count.max(999) }).strict()).max(200).optional(),
  equipment: z.array(z.object({ id: z.string().max(100), qty: count, equipped: z.boolean(),attuned:z.boolean().optional() }).strict()).max(1000).optional(),
  prepared: z.array(z.string().max(300)).max(1000).optional(),
  features: z.array(z.object({ id: z.string().max(100), pinned: z.boolean().optional(), order: count.max(10000).optional() }).strict()).max(1000).optional(),
}).strict()

/** Reject invalid actions; never accept a replacement character or resource maximum. */
export function applyPlayUpdate(before: Character, update: z.infer<typeof playUpdateSchema>): Record<string, unknown> {
  const set: Record<string, unknown> = {}
  const bound = (value: number, max: number, previous = 0) => {
    if (value > Math.max(max, previous)) throw new Error('This action exceeds the character’s current allowance. Refresh the sheet and try again.')
    return value
  }
  for (const [key, value] of Object.entries(update.combat ?? {})) {
    if (typeof value === 'number') {
      const limits: Record<string, number> = { hpCurrent: before.combat.hpMax, hpTemp: 9999, hitDiceUsed: before.combat.hitDiceTotal, deathSavesSuccess: 3, deathSavesFailure: 3 }
      bound(value, limits[key]!, Number(before.combat[key as keyof Character['combat']]) || 0)
    }
    set[`combat.${key}`] = value
  }
  const slots = structuredClone(before.spellcasting.slots)
  for (const item of update.slots ?? []) {
    const slot = slots[item.key]
    if (!slot) throw new Error('Spell slot not found. Refresh the sheet.')
    slot.used = bound(item.used, slot.max, slot.used)
  }
  if (update.slots?.length) set['spellcasting.slots'] = slots
  const resources = structuredClone(before.resources ?? [])
  for (const item of update.resources ?? []) {
    const resource = resources.find(r => r.id === item.id)
    if (!resource || resource.unlimited) throw new Error('That resource cannot be spent.')
    resource.used = bound(item.used, resource.max, resource.used)
  }
  if (update.resources?.length) set.resources = resources
  const equipment = structuredClone(before.equipment)
  for (const item of update.equipment ?? []) {
    const saved = equipment.find(e => String(e._id) === item.id)
    if (!saved) throw new Error('Equipment item not found. Refresh the sheet.')
    saved.qty = item.qty
    saved.equipped = item.qty > 0 && item.equipped
    if(item.attuned!==undefined)saved.attuned=!!saved.requiresAttunement&&item.attuned
  }
  if (update.equipment?.length) {
    if(equipment.some(i=>i.attuned&&i.qty>0&&!before.equipment.some(old=>String(old._id)===String(i._id)&&old.attuned&&old.qty>0))){const error=attunementError(equipment);if(error)throw new Error(error)}
    set.equipment = equipment;set['combat.itemAcBaseline']=before.combat.itemAcBaseline??0
  }
  if (update.prepared) {
    const available = new Set([...before.spellcasting.known, ...before.spellcasting.prepared])
    if (update.prepared.some(index => !available.has(index))) throw new Error('Only spells already on this character can be prepared.')
    set['spellcasting.prepared'] = [...new Set(update.prepared)]
    set['spellcasting.known'] = [...available]
  }
  const features = structuredClone(before.features)
  for (const item of update.features ?? []) {
    const feature = features.find(f => String(f._id) === item.id)
    if (!feature) throw new Error('Feature not found. Refresh the sheet.')
    if (item.pinned !== undefined) feature.pinned = item.pinned
    if (item.order !== undefined) feature.order = item.order
  }
  if (update.features?.length) set.features = features
  return set
}
