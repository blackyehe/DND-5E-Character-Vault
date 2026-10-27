import type { Character, CharacterFeature, CharacterResource } from './character'
import { abilityMod, profBonus } from './calc'
import { featNames } from '../src/lib/feat-references'

type FeatCharacter = Pick<Character, 'meta' | 'abilities'> & Partial<Pick<Character, 'features'>>
type Grant = { key: string; label: string; max: number; recovery: CharacterResource['recovery']; notes?: string }
const keyOf = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, '')
const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const clean = (text: string) => text.normalize('NFKC').replace(/\u00ad/g, '').replace(/[’‘]/g, "'").replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
const baseName = (name: string) => clean(name).replace(/\s*(?:\(|\[|\||prerequisite\b|tcoe\b|2014\b|2024\b).*$/i, '').trim()
export const featResourceKey = (name: string) => keyOf(baseName(name))
const numbers: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, once: 1, twice: 2 }
const count = (value: string) => numbers[value.toLowerCase()] ?? Number(value)

/** A rest elsewhere in the description (or a restriction on the target) is not a recharge rule. */
function recoveryOf(text: string): CharacterResource['recovery'] | undefined {
  const direct = [...text.matchAll(/(?:\byou (?:must )?(?:finish|complete)|\b(?:per(?: every)?|each|every)) (?:a |an? )?(short(?: or long)?|long(?: or short)?) rest/gi)]
  const kinds = new Set(direct.map(m => /short/i.test(m[1]!) ? 'short' : 'long'))
  return kinds.size === 1 ? [...kinds][0] as 'short' | 'long' : undefined
}

/** Grants only explicit, unambiguous pools. This deliberately ignores at-will/per-turn
 * effects, target-specific limits (Healer), and effects that spend another pool. */
function explicitGrant(c: FeatCharacter, text: string): Grant[] {
  const recovery = recoveryOf(text)
  if (!recovery) return []
  const pools = [...text.matchAll(/\byou (?:have|gain) (\d+|one|two|three|four|five|six|seven|eight|nine|ten) ([a-z][a-z -]{0,45}?(?:points?|dice|die|uses?|charges?))\b/gi)].filter(m => !/(?:hit|experience) points?$/i.test(m[2]!))
  if (pools.length === 1) {
    const pool = pools[0]!, max = count(pool[1]!)
    if (max > 0 && max <= 999) return [{ key: 'pool', label: pool[2]!.replace(/^./, v => v.toUpperCase()), max, recovery }]
  }
  if (pools.length > 1) return []
  const uses = [...text.matchAll(/\byou can (?:use|activate|create|regain) (?:this|your|these|it)\b[^.]{0,80}? (?:a number of times equal to your (proficiency bonus|strength|dexterity|constitution|intelligence|wisdom|charisma)(?: modifier)?|(\d+|one|two|three|four|five|six) times)/gi)]
  if (uses.length === 1) {
    const use = uses[0]!, ability = use[1]?.toLowerCase()
    const abilities = { strength: 'str', dexterity: 'dex', constitution: 'con', intelligence: 'int', wisdom: 'wis', charisma: 'cha' } as const
    const max = ability === 'proficiency bonus' ? profBonus(c.meta.level) : ability && ability in abilities ? Math.max(/minimum (?:of )?(?:one|1)/i.test(text) ? 1 : 0, abilityMod(c.abilities[abilities[ability as keyof typeof abilities]])) : count(use[2] ?? '')
    if (max > 0 && max <= 999) return [{ key: 'uses', label: 'Uses', max, recovery }]
  }
  if (uses.length > 1) return []
  // Keep the single-use clause specific to the owner; don't infer a pool from e.g.
  // "a creature can't benefit again until it rests" or from casting a cantrip.
  const lockouts = [...text.matchAll(/\byou (?:can't|cannot|must finish)\b[^.]{0,180}?\b(?:again|rest)\b/gi)]
  if (lockouts.length > 1) return []
  if (/\bonce per (?:every )?(?:short(?: or long)?|long(?: or short)?) rest\b/i.test(text) || /\b(?:once|after) you (?:use|cast)\b.{0,160}?\byou (?:can't|cannot|must finish)\b/i.test(text) || /\byou can cast\b.{0,100}?\bonce\b/i.test(text) || /\byou (?:can't|cannot) [^.]{0,120}?again until you (?:finish|complete)\b/i.test(text) || /\byou can cast\b[^.]{0,180}?\byou must finish\b/i.test(text)) {
    return [{ key: 'uses', label: 'Uses', max: 1, recovery }]
  }
  return []
}

/** Rule shapes from the site's 2014-era imported feat definitions. Descriptions win
 * over name-only fallbacks; e.g. UA Telepathic grants no Detect Thoughts cast. */
function grantsFor(c: FeatCharacter, feat: CharacterFeature): Grant[] {
  const name = baseName(feat.name), key = keyOf(name), text = clean(feat.description)
  const spell = (label: string, recovery: CharacterResource['recovery'] = 'long'): Grant => ({ key: slug(label), label, max: 1, recovery, notes: 'Free feat cast; ordinary spell slots are tracked separately.' })
  const known = !text
  if (key === 'lucky') {
    if (known) return [{ key: 'pool', label: 'Luck points', max: /2024/.test(feat.name) ? profBonus(c.meta.level) : 3, recovery: 'long' }]
    const grant = explicitGrant(c, text)
    if (grant.length) return grant.map(g => ({ ...g, label: 'Luck points' }))
    if (/luck points?.{0,70}equal to your proficiency bonus/i.test(text)) return [{ key: 'pool', label: 'Luck points', max: profBonus(c.meta.level), recovery: recoveryOf(text) ?? 'long' }]
    return []
  }
  if (key === 'metamagicadept' && (known || /you gain (?:2|two) sorcery points/i.test(text))) return [{ key: 'pool', label: 'Sorcery points', max: 2, recovery: recoveryOf(text) ?? 'long', notes: 'These two extra points can only be spent on Metamagic.' }]
  if (key === 'martialadept' && (known || /you gain (?:one|1) superiority (?:die|dice)/i.test(text))) return [{ key: 'pool', label: 'Superiority die (d6)', max: 1, recovery: recoveryOf(text) ?? 'short', notes: 'One additional maneuver die granted by this feat.' }]
  if (key === 'magicinitiate' || key === 'artificerinitiate' || key === 'aberrantdragonmark') {
    if (known || recoveryOf(text) && /\b(?:1st.level spell|spell's 1st.level|feat's 1st.level)/i.test(text)) return [spell('1st-level spell', recoveryOf(text) ?? (key === 'aberrantdragonmark' ? 'short' : 'long'))]
  }
  if (key === 'arcanist' && (known || /cast detect magic once/i.test(text))) return [spell('Detect Magic', recoveryOf(text) ?? 'long')]
  if (key === 'telepathic' && (known && !/psionic talent|wild talent/i.test(feat.name) || /detect thoughts/i.test(text) && recoveryOf(text))) return [spell('Detect Thoughts', recoveryOf(text) ?? 'long')]
  if (key === 'feyteleportation' && (known || /misty step/i.test(text) && recoveryOf(text))) return [spell('Misty Step', recoveryOf(text) ?? 'short')]
  if (key === 'feytouched' || key === 'shadowtouched') {
    if (known || /each of these spells/i.test(text) && recoveryOf(text)) return [spell(key === 'feytouched' ? 'Misty Step' : /darkness spell/i.test(text) ? 'Darkness' : 'Invisibility', recoveryOf(text) ?? 'long'), spell('Chosen 1st-level spell', recoveryOf(text) ?? 'long')]
  }
  if (key === 'drowhighmagic' && (known || /each of which you can cast once/i.test(text))) return [spell('Levitate'), spell('Dispel Magic')]
  if (key === 'woodelfmagic' && (known || /each of which you can cast once/i.test(text))) return [spell('Longstrider'), spell('Pass without Trace')]
  if (key === 'svirfneblinmagic' && (known || /following spells once/i.test(text))) return [spell('Blindness/Deafness'), spell('Blur'), spell('Disguise Self')]
  if (key === 'giftofthechromaticdragon' && (known || /chromatic infusion/i.test(text) && /reactive resistance/i.test(text))) return [{ key: 'infusion', label: 'Chromatic Infusion', max: 1, recovery: 'long' }, { key: 'resistance', label: 'Reactive Resistance', max: profBonus(c.meta.level), recovery: 'long' }]
  if (key === 'giftofthegemdragon' && (known || /telekinetic reprisal/i.test(text))) return [{ key: 'reprisal', label: 'Telekinetic Reprisal', max: profBonus(c.meta.level), recovery: 'long' }]
  if (key === 'giftofthemetallicdragon' && (known || /draconic healing/i.test(text) && /protective wings/i.test(text))) return [spell('Cure Wounds'), { key: 'wings', label: 'Protective Wings', max: profBonus(c.meta.level), recovery: 'long' }]
  if (key === 'chef' && (known || /number of treats equal to your proficiency bonus/i.test(text))) return [{ key: 'treats', label: 'Treats', max: profBonus(c.meta.level), recovery: 'manual', notes: 'Prepare a batch after an hour of work or a long rest, then Recover it here. Treats expire after 8 hours.' }]
  if (key === 'secondchance' && (known || recoveryOf(text))) return [{ key: 'uses', label: 'Uses', max: 1, recovery: recoveryOf(text) ?? 'short', notes: /roll initiative/i.test(text) || known ? 'Also recover this use when you roll initiative.' : undefined }]
  return explicitGrant(c, text)
}

export function featResources(c: FeatCharacter): CharacterResource[] {
  const selected = new Map<string, CharacterFeature>()
  const eligible = (c.features ?? []).filter(f => (f.level ?? 1) <= c.meta.level)
  const explicitFeats = new Set((c.features ?? []).filter(f => f.origin === 'feat').map(f => featResourceKey(f.name)))
  for (const feature of eligible) {
    if (!/^feats?$/i.test(feature.name.trim())) continue
    for (const name of featNames(feature.description)) {
      const key = keyOf(baseName(name))
      if (!explicitFeats.has(key) && !selected.has(key)) selected.set(key, { name, description: '', origin: 'feat' })
    }
  }
  for (const feature of eligible) {
    const key = featResourceKey(feature.name)
    if (/^feats?$/i.test(feature.name.trim()) || feature.origin !== 'feat' && !(selected.has(key) && !feature.origin)) continue
    // A full saved feat definition takes precedence over a duplicate legacy list.
    if (!selected.get(key)?.description || feature.description) selected.set(key, feature)
  }
  return [...selected.entries()].flatMap(([key, feat]) => grantsFor(c, feat).map(grant => ({
    id: `auto:feat:${key.slice(0, 90)}:${grant.key}`,
    name: `${baseName(feat.name)} · ${grant.label}`,
    max: grant.max, used: 0, recovery: grant.recovery, automatic: true,
    ...(grant.notes ? { notes: grant.notes } : {}),
  })))
}

/** Respect existing hand-made trackers without silently merging distinct feat pools. */
export function matchesFeatResource(saved: CharacterResource, grant: CharacterResource, grants: CharacterResource[]): boolean {
  if (!grant.id.startsWith('auto:feat:')) return false
  const [feat, label] = grant.name.split(' · '), name = keyOf(saved.name)
  const singlePool = grants.filter(r => r.id.split(':').slice(0, 3).join(':') === grant.id.split(':').slice(0, 3).join(':')).length === 1
  return name === keyOf(grant.name) || singlePool && name === keyOf(feat ?? '') || label !== 'Uses' && !/sorcery|superiority/i.test(label ?? '') && name === keyOf(label ?? '') && !saved.ruleId
}
