import { describe, expect, it } from 'vitest'
import { emptyCharacter, type Character } from './character'
import {
  levelUpPlan,
  newAdvancement,
  targetClasses,
  type AdvancementRules,
} from './level-up'
import {
  newWorkshopDraft,
  newWorkshopFeature,
  newWorkshopResource,
} from './homebrew-workshop'
import { applyWorkshopRules } from './workshop-character'

function character(klass = 'Fighter', level = 5): Character {
  const c: Character = {
    ...emptyCharacter(),
    _id: 'test',
    updatedAt: '2026-10-22T00:00:00.000Z',
  }
  Object.assign(c.meta, {
    klass,
    level,
    subclass: 'Existing subclass',
    xp: 355000,
  })
  Object.assign(c.abilities, {
    str: 16,
    dex: 14,
    con: 15,
    int: 16,
    wis: 14,
    cha: 14,
  })
  Object.assign(c.combat, {
    hpMax: 40,
    hpCurrent: 23,
    hpTemp: 7,
    hitDiceTotal: level,
    hitDiceUsed: 2,
    deathSavesFailure: 1,
  })
  return c
}
function rules(
  c: Character,
  patch: Partial<AdvancementRules> = {},
): AdvancementRules {
  return {
    name: c.meta.klass,
    index: c.meta.klass.toLowerCase(),
    hitDie: 10,
    source: '2014 SRD',
    classLevel: c.meta.level + 1,
    subclassLevel: 3,
    subclasses: [],
    features: [],
    asi: false,
    warnings: [],
    ...patch,
  }
}

describe('guided advancement calculations', () => {
  it('repairs a legacy Hit Dice total from character level without recovering spent dice',()=>{
    const c=character();c.combat.hitDiceTotal=1
    const next=levelUpPlan(c,rules(c),newAdvancement(c)).next
    expect(next.combat.hitDiceTotal).toBe(6)
    expect(next.combat.hitDiceUsed).toBe(2)
  })
  it('requires review of existing level-based feats and racial rules before applying',()=>{
    const c=character(),d=newAdvancement(c),r=rules(c,{existingReviews:[{id:'racial-unlock',name:'Infernal Legacy',description:'A spell unlocks at level 5.'}]})
    expect(levelUpPlan(c,r,d).issues.features.join()).toContain('Infernal Legacy')
    d.reviewed['racial-unlock']=true
    expect(levelUpPlan(c,r,d).issues.features).toEqual([])
  })
  it('applies retroactive CON once, preserves wounds and all live play counters, and never mutates its baseline', () => {
    const c = character(),
      original = JSON.stringify(c),
      d = newAdvancement(c)
    d.asi = 'abilities'
    d.increases.con = 1
    d.increases.str = 1
    const plan = levelUpPlan(c, rules(c, { asi: true }), d)
    expect(plan.pending).toEqual([])
    expect(plan).toMatchObject({ hpGain: 9, retro: 5, hpDelta: 14 })
    expect(plan.next.combat).toMatchObject({
      hpMax: 54,
      hpCurrent: 23,
      hpTemp: 7,
      hitDiceTotal: 6,
      hitDiceUsed: 2,
      deathSavesFailure: 1,
    })
    expect(JSON.stringify(c)).toBe(original)
    expect(levelUpPlan(c, rules(c, { asi: true }), d).next.combat.hpMax).toBe(
      54,
    )
  })
  it('adds Tough retroactively when selected, then only per-level on later advancements', () => {
    const c = character(),
      d = newAdvancement(c)
    d.asi = 'feat'
    d.feat = { name: 'Tough', description: 'Two HP per character level.' }
    d.featReviewed = true
    const first = levelUpPlan(c, rules(c, { asi: true }), d)
    expect(first.hpDelta).toBe(20)
    const second = levelUpPlan(
      first.next,
      rules(first.next),
      newAdvancement(first.next),
    )
    expect(second.hpDelta).toBe(10)
  })
  it('never heals an unconscious character, even when increasing current HP was chosen', () => {
    const c = character()
    c.combat.hpCurrent = 0
    const d = newAdvancement(c)
    d.hpCurrent = 'increase'
    expect(levelUpPlan(c, rules(c), d).next.combat.hpCurrent).toBe(0)
  })
  it('validates entered rolls and uses a minimum of one HP before feature bonuses', () => {
    const c = character()
    c.abilities.con = 1
    const d = newAdvancement(c)
    d.hpMode = 'rolled'
    d.hpRoll = 1
    expect(levelUpPlan(c, rules(c), d).hpGain).toBe(1)
    d.hpRoll = 11
    expect(levelUpPlan(c, rules(c), d).issues.health.join()).toContain(
      'rolled result',
    )
  })
  it('treats the first multiclass level as a later character level for HP and preserves the first subclass', () => {
    const c = character()
    c.meta.classIndex = 'fighter'
    c.meta.subclassIndex = 'champion'
    const d = newAdvancement(c)
    d.className = 'Rogue'
    d.classIndex = 'rogue'
    const plan = levelUpPlan(
      c,
      rules(c, { name: 'Rogue', hitDie: 8, classLevel: 1 }),
      d,
    )
    expect(plan.hpGain).toBe(7)
    expect(targetClasses(c, d)[0]).toMatchObject({
      name: 'Fighter',
      level: 5,
      subclass: 'Existing subclass',
      subclassIndex: 'champion',
    })
    expect(plan.next.saves).toEqual(c.saves)
  })
  it('blocks unmet multiclass requirements, total-level mismatch, missing subclass, level 20 and unearned XP', () => {
    const c = character()
    c.abilities.int = 12
    const d = newAdvancement(c)
    d.className = 'Wizard'
    expect(
      levelUpPlan(c, rules(c, { name: 'Wizard' }), d).issues.class.join(),
    ).toContain('requirements')
    c.meta.classLevels = [{ name: 'Fighter', level: 3 }]
    expect(
      levelUpPlan(c, rules(c), newAdvancement(c)).issues.class.join(),
    ).toContain('per-class')
    delete c.meta.classLevels
    c.meta.subclass = ''
    expect(
      levelUpPlan(c, rules(c), newAdvancement(c)).issues.class.join(),
    ).toContain('subclass')
    c.meta.level = 20
    expect(
      levelUpPlan(c, rules(c), newAdvancement(c)).issues.class.join(),
    ).toContain('Level 20')
    c.meta.level = 5
    c.meta.xp = 0
    const milestone = newAdvancement(c)
    expect(levelUpPlan(c, rules(c), milestone).issues.class.join()).toContain(
      'milestone',
    )
    milestone.milestone = true
    expect(
      levelUpPlan(c, rules(c), milestone).issues.class.join(),
    ).not.toContain('milestone')
  })
  it('requires exactly two ASI points, enforces the cap, and rejects duplicate choices and unearned expertise', () => {
    const c = character(),
      d = newAdvancement(c),
      r = rules(c, { asi: true })
    d.asi = 'abilities'
    d.increases.str = 1
    expect(levelUpPlan(c, r, d).issues.training.join()).toContain('exactly two')
    c.abilities.str = 20
    d.increases.str = 2
    expect(levelUpPlan(c, r, d).issues.training.join()).toContain('above 20')
    r.asi = false
    r.features = [
      {
        id: 'expertise',
        name: 'Expertise',
        description: 'Choose proficiencies.',
        origin: 'class',
        level: 6,
        choose: 2,
        options: [
          {
            id: 'skill-stealth',
            name: 'Stealth',
            description: '',
            skill: 'stealth',
          },
        ],
      },
    ]
    d.choices.expertise = ['skill-stealth', 'skill-stealth']
    d.reviewed.expertise = true
    expect(levelUpPlan(c, r, d).issues.features.join()).toContain('different')
    expect(levelUpPlan(c, r, d).issues.features.join()).toContain('proficient')
  })
  it('preserves existing expertise when a feat grants additional skill training', () => {
    const c = character()
    c.skills.stealth = 'expert'
    const d = newAdvancement(c)
    d.skills.stealth = true
    expect(levelUpPlan(c, rules(c), d).next.skills.stealth).toBe('expert')
  })
})

describe('spell and resource advancement', () => {
  it('uses the single half-caster table when multiclassing with a noncaster', () => {
    const c = character('Paladin', 4)
    c.meta.classLevels = [
      { name: 'Paladin', level: 3, subclass: 'Oath' },
      { name: 'Fighter', level: 1 },
    ]
    const d = newAdvancement(c)
    d.className = 'Fighter'
    const next = levelUpPlan(
      c,
      rules(c, { name: 'Fighter', classLevel: 2 }),
      d,
    ).next
    expect(next.spellcasting.slots.l1?.max).toBe(3)
  })
  it('combines eligible Spellcasting levels, rounds half-caster contributions down, and preserves spent slots', () => {
    const c = character('Wizard / Paladin', 5)
    c.meta.classLevels = [
      { name: 'Wizard', level: 2, subclass: 'Evocation' },
      { name: 'Paladin', level: 3, subclass: 'Oath' },
    ]
    c.spellcasting.slots.l1 = { max: 4, used: 3 }
    const d = newAdvancement(c)
    d.className = 'Wizard'
    const plan = levelUpPlan(c, rules(c, { name: 'Wizard', classLevel: 3 }), d)
    expect(plan.next.spellcasting.slots).toMatchObject({
      l1: { max: 4, used: 3 },
      l2: { max: 3, used: 0 },
      l3: { max: 0 },
    })
  })
  it('does not merge Pact Magic into Spellcasting and carries spent uses when the same Pact pool gains a rank', () => {
    const c = character('Wizard / Warlock', 4)
    c.meta.classLevels = [
      { name: 'Wizard', level: 2, subclass: 'Evocation' },
      { name: 'Warlock', level: 2, subclass: 'Fiend' },
    ]
    const d = newAdvancement(c)
    d.className = 'Warlock'
    expect(
      levelUpPlan(c, rules(c, { name: 'Warlock' }), d).issues.magic.join(),
    ).toContain('separate slot pools')
    const pact = character('Warlock', 2)
    pact.spellcasting.slots.l1 = { max: 2, used: 1 }
    const next = levelUpPlan(
      pact,
      rules(pact, {
        casting: {
          ability: 'cha',
          learning: 'known',
          spells: 0,
          cantrips: 0,
          maxSpellLevel: 2,
          slots: { l2: 2 },
        },
      }),
      newAdvancement(pact),
    ).next
    expect(next.spellcasting.slots.l1?.used).toBe(0)
    expect(next.spellcasting.slots.l2).toMatchObject({
      max: 2,
      used: 1,
      recovery: 'short',
    })
  })
  it('validates new spells against class-level eligibility and retains preparations without a rest', () => {
    const c = character('Wizard', 4)
    c.spellcasting.known = ['shield']
    c.spellcasting.prepared = ['shield']
    const r = rules(c, {
      casting: {
        ability: 'int',
        learning: 'book',
        spells: 2,
        cantrips: 0,
        maxSpellLevel: 3,
        slots: { l1: 4, l2: 3, l3: 2 },
        eligible: [
          { id: 'fireball', level: 3 },
          { id: 'fly', level: 3 },
          { id: 'wish', level: 9 },
        ],
      },
    })
    const d = newAdvancement(c)
    d.spells = ['fireball', 'fly']
    d.magicReviewed = true
    expect(levelUpPlan(c, r, d).issues.magic).toEqual([])
    expect(levelUpPlan(c, r, d).next.spellcasting.prepared).toEqual(['shield'])
    d.spells[1] = 'wish'
    expect(levelUpPlan(c, r, d).issues.magic.join()).toContain('eligible new')
  })
  it('updates automatic pools while retaining uses and guards an invalid reduced maximum', () => {
    const c = character('Monk', 5)
    c.resources = [
      {
        id: 'auto:ki',
        name: 'Ki points',
        max: 5,
        used: 3,
        recovery: 'short',
        automatic: true,
      },
    ]
    const plan = levelUpPlan(c, rules(c), newAdvancement(c))
    expect(plan.next.resources?.find((r) => r.id === 'auto:ki')).toMatchObject({
      max: 6,
      used: 3,
    })
    c.resources[0]!.used = 9
    expect(
      levelUpPlan(c, rules(c), newAdvancement(c)).issues.features.join(),
    ).toContain('already-spent')
  })
  it('binds and saves homebrew choices by stable IDs, with class resource progression and no starting-save leakage', () => {
    const w = newWorkshopDraft()
    w.name = 'Sentinel'
    w.hitDie = 10
    w.savingThrows = ['str']
    w.subclassLevel = 10
    const f = newWorkshopFeature(true)
    Object.assign(f, {
      name: 'Focus',
      level: 6,
      description: 'Choose a focus.',
      options: ['Guard', 'Strike'],
    })
    const resource = newWorkshopResource()
    Object.assign(resource, { name: 'Focus points', level: 1, multiplier: 1 })
    w.features = [f]
    w.resources = [resource]
    const c = character('Sentinel', 5)
    const d = newAdvancement(c)
    d.classIndex = 'homebrew-sentinel'
    d.choices[`${w.id}:${f.id}`] = ['Guard']
    d.reviewed[`${w.id}:${f.id}`] = true
    const plan = levelUpPlan(
      c,
      rules(c, {
        workshop: w,
        bindings: [{ index: 'homebrew-sentinel', rule: w }],
        features: [
          {
            id: `${w.id}:${f.id}`,
            ruleId: w.id,
            featureId: f.id,
            name: f.name,
            description: f.description,
            level: 6,
            origin: 'class',
            choose: 1,
            options: f.options.map((name) => ({
              id: name,
              name,
              description: '',
            })),
          },
        ],
      }),
      d,
    )
    expect(plan.pending).toEqual([])
    expect(plan.next.homebrew?.choices[`${w.id}:${f.id}`]).toEqual(['Guard'])
    expect(plan.next.resources?.find((r) => r.ruleId === w.id)).toMatchObject({
      max: 6,
      used: 0,
    })
    c.meta.classLevels = [
      { name: 'Fighter', level: 3 },
      { name: 'Sentinel', level: 2 },
    ]
    c.homebrew = plan.next.homebrew
    expect(applyWorkshopRules(c).saves.str).toBe(false)
  })
})
