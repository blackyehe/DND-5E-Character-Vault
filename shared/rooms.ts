import type { Character, CharacterSummary } from './character'

export interface RoomSummary {
  id: string
  name: string
  role: 'dm' | 'player'
  memberCount: number
}
export interface RoomDetail extends RoomSummary {
  members: { id: string; displayName: string; email?: string }[]
  characters: (CharacterSummary & { assignedTo: string | null })[]
  joinToken?: string
}

/** Only mutable play state crosses the player-write boundary. */
export interface PlayUpdate {
  expectedUpdatedAt: string
  combat?: Partial<Pick<Character['combat'], 'hpCurrent' | 'hpTemp' | 'hitDiceUsed' | 'deathSavesSuccess' | 'deathSavesFailure' | 'inspiration'>>
  slots?: { key: string; used: number }[]
  resources?: { id: string; used: number }[]
  equipment?: { id: string; qty: number; equipped: boolean; attuned?:boolean }[]
  prepared?: string[]
  features?: { id: string; pinned?: boolean; order?: number }[]
}

export function playUpdate(before: Character, patch: Partial<Character>): PlayUpdate {
  const result: PlayUpdate = { expectedUpdatedAt: before.updatedAt }
  if (patch.combat) {
    result.combat = {}
    for (const key of ['hpCurrent', 'hpTemp', 'hitDiceUsed', 'deathSavesSuccess', 'deathSavesFailure', 'inspiration'] as const) {
      if (patch.combat[key] !== before.combat[key]) Object.assign(result.combat, { [key]: patch.combat[key] })
    }
  }
  if (patch.spellcasting) {
    result.slots = Object.entries(patch.spellcasting.slots).filter(([key, slot]) => slot.used !== before.spellcasting.slots[key]?.used).map(([key, slot]) => ({ key, used: slot.used }))
    if (JSON.stringify(patch.spellcasting.prepared) !== JSON.stringify(before.spellcasting.prepared)) result.prepared = patch.spellcasting.prepared
  }
  if (patch.resources) result.resources = patch.resources.filter(r => r.used !== before.resources?.find(v => v.id === r.id)?.used).map(r => ({ id: r.id, used: r.used }))
  if (patch.equipment) result.equipment = patch.equipment.flatMap(item => {
    const old = before.equipment.find(v => v._id === item._id)
    return item._id && old && (old.qty !== item.qty || old.equipped !== item.equipped || old.attuned!==item.attuned) ? [{ id: item._id, qty: item.qty, equipped: item.equipped,attuned:item.attuned }] : []
  })
  if (patch.features) result.features = patch.features.flatMap(feature => {
    const old = before.features.find(v => v._id === feature._id)
    return feature._id && old && (old.pinned !== feature.pinned || old.order !== feature.order) ? [{ id: feature._id, pinned: feature.pinned, order: feature.order }] : []
  })
  return result
}
