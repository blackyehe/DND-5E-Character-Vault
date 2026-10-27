import { beforeEach, describe, expect, it, vi } from 'vitest'
import { srd } from './srd'
import {
  loadAdvancementRules,
  preparedLimit,
  type AdvancementCatalog,
} from './level-up-rules'
import { emptyCharacter, type Character } from '../../shared/character'
import { newAdvancement, levelUpPlan } from '../../shared/level-up'
import { newWorkshopDraft } from '../../shared/homebrew-workshop'

vi.mock('./srd', () => ({
  srd: {
    class: vi.fn(),
    classLevels: vi.fn(),
    feature: vi.fn(),
    subclassLevels: vi.fn(),
    subclass: vi.fn(),
    spells: vi.fn(),
    classSpells: vi.fn(),
  },
}))
const catalog = (): AdvancementCatalog => ({
  classes: [],
  subclasses: [],
  feats: [],
  spells: [],
  rules: [],
})
const character = (klass = 'Fighter', level = 5): Character => ({
  ...emptyCharacter(),
  _id: 'test',
  updatedAt: '2026-10-22T00:00:00.000Z',
  meta: {
    ...emptyCharacter().meta,
    klass,
    level,
    classIndex: klass.toLowerCase(),
    subclass: 'Existing',
    subclassIndex: 'existing',
  },
})
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(srd.class).mockResolvedValue({
    index: 'class',
    name: 'Class',
    url: '',
    hit_die: 10,
    multi_classing: { proficiencies: [] },
    proficiencies: [],
    saving_throws: [],
    starting_equipment: [],
    subclasses: [{ index: 'life', name: 'Life', url: '' }],
  })
  vi.mocked(srd.subclassLevels).mockResolvedValue([])
  vi.mocked(srd.subclass).mockResolvedValue({
    index: 'existing',
    name: 'Existing',
    url: '',
    desc: [],
  })
  vi.mocked(srd.feature).mockImplementation(async (index) => ({
    index,
    name: index.replace(/-/g, ' '),
    url: '',
    desc: ['Feature rules.'],
  }))
  vi.mocked(srd.spells).mockResolvedValue([])
  vi.mocked(srd.classSpells).mockResolvedValue([])
})

describe('advancement rule coverage', () => {
  it('uses class ASI schedules, including Fighter 6 and Rogue 10, without treating cumulative API bonuses as a new grant', async () => {
    for (const [klass, level, asi] of [
      ['Fighter', 5, true],
      ['Rogue', 9, true],
      ['Wizard', 4, false],
    ] as const) {
      const c = character(klass, level)
      vi.mocked(srd.classLevels).mockResolvedValue([
        { level: level + 1, features: [], ability_score_bonuses: 2 } as never,
      ])
      expect(
        (await loadAdvancementRules(c, newAdvancement(c), catalog())).asi,
      ).toBe(asi)
    }
  })
  it('never substitutes SRD rules for an explicitly linked homebrew class with the same name', async () => {
    const c = character(),
      w = newWorkshopDraft()
    w.name = 'Fighter'
    w.hitDie = 12
    w.asiLevels = []
    const d = newAdvancement(c)
    d.classIndex = 'homebrew-fighter'
    const options = catalog()
    options.rules = [
      { index: d.classIndex, name: w.name, url: '', workshop: w },
    ]
    const r = await loadAdvancementRules(c, d, options)
    expect(r).toMatchObject({
      hitDie: 12,
      asi: false,
      source: 'Saved Workshop definition',
    })
    expect(srd.class).not.toHaveBeenCalled()
  })
  it('requires a new multiclass subclass instead of inheriting the first class subclass', async () => {
    const c = character()
    c.abilities.str = 16
    c.abilities.wis = 14
    vi.mocked(srd.classLevels).mockResolvedValue([{ level: 1, features: [] }])
    const d = newAdvancement(c)
    d.className = 'Cleric'
    d.classIndex = 'cleric'
    d.milestone = true
    const r = await loadAdvancementRules(c, d, catalog())
    expect(srd.subclassLevels).not.toHaveBeenCalled()
    expect(levelUpPlan(c, r, d).issues.class.join()).toContain(
      'Choose this class’s subclass',
    )
  })
  it('adds the new domain spells as always-prepared grants instead of requiring ordinary spells-known choices', async () => {
    const c = character('Cleric', 4)
    c.meta.subclassIndex = 'life'
    c.meta.subclass = 'Life'
    vi.mocked(srd.classLevels).mockResolvedValue([
      { level: 4, features: [], spellcasting: { cantrips_known: 4 } },
      {
        level: 5,
        features: [],
        spellcasting: {
          cantrips_known: 4,
          spell_slots_level_1: 4,
          spell_slots_level_2: 3,
          spell_slots_level_3: 2,
        },
      },
    ])
    vi.mocked(srd.subclass).mockResolvedValue({
      index: 'life',
      name: 'Life',
      url: '',
      desc: [],
      spells: [
        {
          prerequisites: [
            { type: 'level', index: 'cleric-5', name: 'Cleric 5' },
          ],
          spell: { index: 'revivify', name: 'Revivify', url: '' },
        },
      ],
    } as never)
    const d = newAdvancement(c),
      r = await loadAdvancementRules(c, d, catalog())
    expect(r.casting?.spells).toBe(0)
    expect(levelUpPlan(c, r, d).next.spellcasting.prepared).toContain(
      'revivify',
    )
  })
  it('separates Magical Secrets from normal Bard learning and permits other class lists', async () => {
    const c = character('Bard', 9)
    vi.mocked(srd.classLevels).mockResolvedValue([
      { level: 9, features: [], spellcasting: { spells_known: 12 } },
      {
        level: 10,
        features: [
          { index: 'magical-secrets', name: 'Magical Secrets', url: '' },
        ],
        spellcasting: { spells_known: 14, spell_slots_level_5: 2 },
      },
    ])
    vi.mocked(srd.spells).mockResolvedValue([
      { index: 'fireball', name: 'Fireball', url: '', level: 3 },
      { index: 'wish', name: 'Wish', url: '', level: 9 },
    ] as never)
    const r = await loadAdvancementRules(c, newAdvancement(c), catalog())
    expect(r.casting?.spells).toBe(0)
    expect(r.features.find((f) => f.id === 'magical-secrets')).toMatchObject({
      choose: 2,
      options: [{ id: 'fireball', spell: 'fireball' }],
    })
  })
  it('requires a level-six Mystic Arcanum choice while Pact Magic remains at spell rank five', async () => {
    const c = character('Warlock', 10)
    vi.mocked(srd.classLevels).mockResolvedValue([
      { level: 10, features: [], spellcasting: { spells_known: 10 } },
      {
        level: 11,
        features: [
          { index: 'arcanum', name: 'Mystic Arcanum (6th level)', url: '' },
        ],
        spellcasting: { spells_known: 11, spell_slots_level_5: 3 },
      },
    ])
    vi.mocked(srd.feature).mockResolvedValue({
      index: 'arcanum',
      name: 'Mystic Arcanum (6th level)',
      url: '',
      desc: ['Choose one sixth-level Warlock spell.'],
    })
    vi.mocked(srd.spells).mockResolvedValue([
      { index: 'mass-suggestion', name: 'Mass Suggestion', url: '', level: 6 },
      { index: 'heal', name: 'Heal', url: '', level: 6 },
    ] as never)
    vi.mocked(srd.classSpells).mockResolvedValue([
      { index: 'mass-suggestion', name: 'Mass Suggestion', url: '' },
    ])
    const d = newAdvancement(c),
      r = await loadAdvancementRules(c, d, catalog())
    expect(r.features[0]).toMatchObject({
      choose: 1,
      options: [{ id: 'mass-suggestion' }],
    })
    expect(r.casting?.maxSpellLevel).toBe(5)
    d.choices.arcanum = ['mass-suggestion']
    expect(levelUpPlan(c, r, d).next.spellcasting.known).toContain(
      'mass-suggestion',
    )
    expect(levelUpPlan(c, r, d).next.resources).toContainEqual(
      expect.objectContaining({ id: 'arcanum:6', max: 1, used: 0 }),
    )
  })
  it('honours custom preparation formulae rather than assuming full class level', async () => {
    const c = character('Sentinel', 5),
      w = newWorkshopDraft()
    w.name = 'Sentinel'
    w.magic.enabled = true
    w.magic.learning = 'prepared'
    w.magic.preparedLevel = 'half'
    w.magic.preparedBase = 2
    c.abilities.int = 16
    const d = newAdvancement(c)
    d.classIndex = 'sentinel'
    const options = catalog()
    options.rules = [{ index: 'sentinel', name: w.name, url: '', workshop: w }]
    const r = await loadAdvancementRules(c, d, options)
    expect(preparedLimit(c, r)).toBe(8)
  })
})
