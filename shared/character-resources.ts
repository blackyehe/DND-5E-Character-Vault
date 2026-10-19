import type { Character, CharacterResource } from './character'
import { abilityMod } from '../src/lib/calc'
import { scaledResource } from './character-progression'
import { isRevenantShadow } from './class-rules'
import { featResources, matchesFeatResource } from './feat-resources'

export function classes(c: Pick<Character, 'meta'>) {
  if (c.meta.classLevels?.length) return c.meta.classLevels
  // Older multiclass imports have no per-class levels. Never assign total level to each class.
  return c.meta.klass.includes('/') ? [] : [{ name: c.meta.klass.replace(/\s*[·(—].*$/, '').trim(), level: c.meta.level }]
}
export function automaticResources(c: Pick<Character, 'meta' | 'abilities'> & Partial<Pick<Character,'homebrew'|'features'>>): CharacterResource[] {
  const result: CharacterResource[] = []
  const add = (id: string, name: string, max: number, recovery: CharacterResource['recovery'], unlimited=false, notes?:string) => {
    const previous=result.find(r=>r.id===`auto:${id}`)
    if(previous){previous.max=Math.max(previous.max,max);previous.unlimited=previous.unlimited||unlimited}
    else result.push({ id: `auto:${id}`, name, max, used: 0, recovery, automatic: true, unlimited, ...(notes?{notes}:{}) })
  }
  const constitutionUses=Math.max(1,abilityMod(c.abilities.con))
  const race=c.meta.race.toLowerCase().replace(/\s*[·(—].*$/, '').replace(/[^a-z0-9]/g,'')
  if(race==='shadowtouched'&&c.meta.level>=3) add('shadow-step','Step through the Shadows',constitutionUses,'long',c.meta.level>=14,'CON modifier, minimum 1 use. Unlimited from character level 14.')
  for (const entry of classes(c)) {
    const key = entry.name.toLowerCase().replace(/\s*[·(—].*$/, '').trim(), l = entry.level
    if(c.homebrew?.bindings.some(b=>b.rule.kind==='class'&&b.className.toLowerCase()===entry.name.toLowerCase()))continue
    if (isRevenantShadow(entry.name)) {
      add('shadow', 'Shadow points', l, 'long')
      if(l>=3)add('mantle-darkness','Mantle of Darkness',constitutionUses,'long',false,'CON modifier, minimum 1 use.')
    }
    if (key === 'wizard' && /riftborne sycoph?ant/i.test(c.meta.subclass)) {
      if (l >= 2) add('rift', `Rift points · ${l >= 12 ? 'd20' : l >= 6 ? 'd12' : 'd8'}`, l, 'long')
      if (l >= 6) add('rift-slot', `Riftborne bonus slot · level ${Math.min(9,Math.ceil(l/2))}`, 1, 'long')
    }
    if (key === 'sorcerer' && l >= 2) add('sorcery', 'Sorcery points', l, 'long')
    if (key === 'monk' && l >= 2) add('ki', 'Ki points', l, 'short')
    if (key === 'barbarian') add('rage', 'Rage', l >= 17 ? 6 : l >= 12 ? 5 : l >= 6 ? 4 : l >= 3 ? 3 : 2, 'long', l>=20)
    if (key === 'fighter') { add('second-wind', 'Second Wind', 1, 'short'); if (l >= 2) add('action-surge', 'Action Surge', l >= 17 ? 2 : 1, 'short'); if (l >= 9) add('indomitable', 'Indomitable', l >= 17 ? 3 : l >= 13 ? 2 : 1, 'long') }
    if (key === 'warlock' && l >= 6 && /great old one/i.test(c.meta.subclass)) add('entropic-ward', 'Entropic Ward', 1, 'short')
    if (key === 'bard') add('bardic-inspiration', 'Bardic Inspiration', Math.max(1, abilityMod(c.abilities.cha)), l >= 5 ? 'short' : 'long')
    if (key === 'cleric' && l >= 2) add('channel-divinity', 'Channel Divinity', l >= 18 ? 3 : l >= 6 ? 2 : 1, 'short')
    if (key === 'paladin') { add('lay-on-hands', 'Lay on Hands', l * 5, 'long'); if (l >= 3 && !result.some(r => r.id === 'auto:channel-divinity')) add('channel-divinity', 'Channel Divinity', 1, 'short'); add('divine-sense', 'Divine Sense', Math.max(1, 1 + abilityMod(c.abilities.cha)), 'long') }
    if (key === 'druid' && l >= 2) add('wild-shape', 'Wild Shape', 2, 'short',l>=20)
    if (key === 'wizard') add('arcane-recovery', 'Arcane Recovery', 1, 'long')
    if (key === 'rogue' && l >= 20) add('stroke-of-luck', 'Stroke of Luck', 1, 'short')
    if (key === 'paladin' && l >= 14) add('cleansing-touch', 'Cleansing Touch', Math.max(1,abilityMod(c.abilities.cha)), 'long')
  }
  return [...result, ...featResources(c)]
}
export function resourcesFor(c: Pick<Character, 'meta' | 'abilities' | 'resources'> & Partial<Pick<Character,'homebrew'|'features'>>): CharacterResource[] {
  const saved = c.resources ?? []
  const defaults=automaticResources(c).filter(r=>!c.homebrew?.bindings.some(b=>b.rule.resources.some(resource=>resource.name.toLowerCase()===r.name.toLowerCase()||/^rift points/i.test(resource.name)&&/^rift points/i.test(r.name)||/^riftborne bonus slot/i.test(resource.name)&&/^riftborne bonus slot/i.test(r.name))))
  return [...defaults.filter(a => !saved.some(r => r.id === a.id || r.name.toLowerCase() === a.name.toLowerCase() || !r.automatic && matchesFeatResource(r,a,defaults))), ...saved.flatMap(r=>{
    if(!r.automatic)return [scaledResource(c,r)]
    const current=defaults.find(d=>d.id===r.id)
    return current?[{...current,used:Math.min(current.max,r.used)}]:[]
  })].filter(r=>r.max>0 || !r.automatic)
}
