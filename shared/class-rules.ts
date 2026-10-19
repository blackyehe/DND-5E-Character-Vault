import type { AbilityKey } from '../src/lib/calc'
import type { SlotProgression } from './character'

const classKey = (name: string) => name.toLowerCase().replace(/\s*[·(—].*$/, '').replace(/[^a-z0-9]/g, '')
export const isRevenantShadow = (name: string) => ['revenantshadow','shadowrevenant'].includes(classKey(name))
export function classSpellDefaults(name: string): { progression: SlotProgression; ability: AbilityKey } | undefined {
  if (isRevenantShadow(name)) return { progression: 'full', ability: 'con' }
}

/** Orcbrew schedules record choices gained at each level, rather than running totals. */
export function scheduleTotal(schedule: unknown, level: number): number | null {
  if (!schedule || typeof schedule !== 'object' || Array.isArray(schedule)) return null
  const entries = Object.entries(schedule)
  if (entries.some(([key,n]) => !/^\d+$/.test(key) || !Number.isInteger(n) || Number(n) < 0)) return null
  return entries.reduce((sum,[key,n]) => Number(key) <= level ? sum + Number(n) : sum, 0)
}
