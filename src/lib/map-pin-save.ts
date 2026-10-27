import {pinDisplay, type MapPin, type MapPinDraft, type RoomMap} from '../../shared/room-maps'

export interface PinSaveAttempt {
  kind: 'create' | 'update' | 'remove'
  before: RoomMap
  value: MapPinDraft
  id: string
  remember: boolean
  acknowledged: boolean
  rejected: boolean
}

export function samePinValues(pin: MapPinDraft, value: MapPinDraft): boolean {
  const normalize = (p: MapPinDraft) => ({
    label: p.label.trim(), entryId: p.entryId, x: p.x, y: p.y,
    display: pinDisplay(p), audience: p.audience ?? 'room',
    characterIds: (p.audience ?? 'room') === 'characters' ? [...new Set(p.characterIds ?? [])].sort() : [],
  })
  return JSON.stringify(normalize(pin)) === JSON.stringify(normalize(value))
}

export function createdPin(attempt: PinSaveAttempt, map: RoomMap): MapPin | undefined {
  const added = map.pins.filter(p => !attempt.before.pins.some(old => old.id === p.id) && samePinValues(p, attempt.value))
  return added.length === 1 ? added[0] : undefined
}

/** Reconcile reads only. Never repeat a mutation whose response was lost. */
export function pinSaveOutcome(attempt: PinSaveAttempt, map: RoomMap): 'saved' | 'retry' | 'review' {
  if (map.id !== attempt.before.id || map.revision < attempt.before.revision) return 'review'
  if (attempt.acknowledged) return map.revision > attempt.before.revision ? 'saved' : 'review'
  if (!attempt.rejected && map.revision > attempt.before.revision) {
    const pin = map.pins.find(p => p.id === attempt.id)
    const matches = attempt.kind === 'create' ? !!createdPin(attempt, map)
      : attempt.kind === 'remove' ? !pin : !!pin && samePinValues(pin, attempt.value)
    if (matches) return 'saved'
  }
  if (map.revision === attempt.before.revision || attempt.rejected) {
    if (attempt.kind !== 'create' && !map.pins.some(p => p.id === attempt.id)) return 'review'
    return 'retry'
  }
  return 'review'
}
