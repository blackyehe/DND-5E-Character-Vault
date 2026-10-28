import type { EquipmentItem } from '../../../shared/character'

export interface ItemComposerProps {
  mode: 'draft' | 'give' | 'library' | 'entry'
  characterId?: string
  characterName?: string
  initial?: EquipmentItem
  initialMagical?: boolean
}
