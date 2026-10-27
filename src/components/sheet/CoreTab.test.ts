import { expect, it } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createPinia, disposePinia } from 'pinia'
import { emptyCharacter, type Character } from '../../../shared/character'
import { useCharactersStore } from '../../stores/characters'
import CoreTab from './CoreTab.vue'

it('renders current training after nested rule, level, equipment, ability and character changes', async () => {
  const pinia = createPinia(), store = useCharactersStore(pinia)
  const c: Character = { ...emptyCharacter(), _id: 'hero', updatedAt: '2026-10-27T00:00:00Z' }
  c.meta.level = 4; c.abilities.dex = 14; c.abilities.wis = 12
  c.features = [{ name: 'Training', description: '' }]
  c.compendiumRules = [{ kind: 'feats', index: 'training', revision: 1, before: {}, entry: { name: 'Training', benefits: [
    { type: 'skill-expertise', value: 'stealth', level: 5 }, { type: 'saving-throw-prof', value: 'wis', level: 5 },
  ] } }]
  c.equipment = [{ name: 'Ward ring', qty: 1, weight: 0, equipped: true, notes: '', requiresAttunement: true, attuned: true, effects: { ac: 0, saves: 1 } }]
  store.current = c
  const check = async (stealth: number, wisdom: number) => {
    const html = await renderToString(createSSRApp(CoreTab).use(pinia))
    expect(html).toContain(`<span>Stealth<small>DEX</small></span><strong>+${stealth}</strong>`)
    expect(html).toContain(` WIS</dt><dd>+${wisdom}</dd>`)
  }
  try {
    await check(2, 2)
    store.current!.meta.level = 5
    await check(8, 5)
    store.current!.equipment[0]!.attuned = false; store.current!.abilities.dex = 18
    await check(10, 4)
    store.current!.compendiumRules![0]!.entry.benefits = []
    await check(4, 1)
    store.current = { ...emptyCharacter(), _id: 'other', updatedAt: c.updatedAt }
    await check(0, 0)
  } finally { disposePinia(pinia) }
})
