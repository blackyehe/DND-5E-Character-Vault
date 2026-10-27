import { describe,it,expect } from 'vitest'
import { newMonsterDraft,newMonsterAction,compileMonster,monsterDraftIssues } from '../../shared/monster-workshop'
import { monsterStatblock } from '../../shared/monster-statblock'
import { monsterRuleText,monsterReferenceUrl,readMonsterExtensions } from '../../shared/monster-extensions'
import { completeMonster,validMonsterDraft,monsterActionSchema } from './monster-workshop-schema'
import { rawMonster } from './monster-pack'
import { placeMonsterEntry } from './workshop-pack'
import { inspectOrcbrew } from './orcbrew'
import { exportMonsterMarkdown,monsterExportFacts,monsterInfoExportLines } from '../../shared/monster-format'
import { compendiumFacets } from '../../shared/compendium-facets'

function fixture(){
  const d=newMonsterDraft();d.name='Aeromancer fixture';d.type='elemental';d.source='Monster Manual 2025';d.scores={str:10,dex:16,con:12,int:13,wis:17,cha:12};d.cr=4;d.armor.mode='custom';d.armor.base=16;d.hp.count=12;d.movement.walk=20;d.movement.fly=50
  d.extended={sourceInfo:{id:'XMM',edition:'2024',page:'fixture',url:'https://example.com/source'},aliases:['Wind mage'],family:'Aeromancer',variant:'Air',sizes:['Small','Medium'],initiative:7,initiativeScore:17,lairXp:7200,xpNote:'in its lair',habitat:'Mountain; Planar (Air)',treasure:'Individual; Implements',armorAlternatives:[{value:18,note:'with a shield'}],provenance:{format:'test fixture',original:'Unmapped source field and all original clauses.',notes:'Review this field.'}}
  const spell=newMonsterAction('actions');spell.name='Spellcasting';spell.mode='spellcasting';spell.spellcasting={ability:'wis',dc:13,attack:null,header:'No material components.',footer:'Retain all exceptions.',groups:[{label:'At will',spells:[{name:'Elementalism',source:'XPHB',edition:'2024'}]},{label:'1/day',spells:[{name:'Lightning Bolt',source:'XPHB',edition:'2024'}]}]}
  const reaction=newMonsterAction('reactions');reaction.name='Feather Fall';reaction.mode='spellcasting';reaction.spellcasting={...spell.spellcasting,groups:[{label:'1/day',spells:[{name:'Feather Fall',source:'XPHB',edition:'2024'}]}]}
  const staff=newMonsterAction();staff.name='Wind Staff';staff.mode='attack';staff.ability='dex';staff.attackType='Melee or Ranged Weapon Attack';staff.attackOverride=5;staff.reach='5 ft.';staff.range='120 ft.';staff.damage='1d8';staff.extraDamage='2d10 lightning damage'
  d.rules=[spell,reaction,staff];d.introductions['legendary-actions']='3 actions, or 4 while in its lair.'
  return d
}
function roundtrip(d:ReturnType<typeof fixture>){
  const validated=completeMonster(d),source=placeMonsterEntry(undefined,`codex-monster-${d.id}`,rawMonster(validated,1),d.id),entry=inspectOrcbrew(source).entries.monsters[0]!
  const raw=entry.details as Record<string,unknown>
  expect(validMonsterDraft(raw[':codex/monster'])).toEqual(d)
  if(d.extended?.sizes?.length)expect(compendiumFacets({...entry,sourcePack:d.source},'monsters').size).toEqual(d.extended.sizes.map(s=>s.toLowerCase()))
  return monsterStatblock({...entry,sourcePack:d.source})
}
describe('expanded monster persistence and presentation',()=>{
  it('retains separate lore, attribution and artwork citations through validation, packs, reader and portable exports',()=>{
    const d=fixture();d.extended!.info={text:'Mountain dwellers.\n\nWind Lore\nThey study {@spell Gust|XPHB}.',source:'Fixture book, page 10 [XMM]',images:[{url:'https://example.com/art.webp',title:'Mountain aeromancer',credit:'Fixture artist'}]}
    const m=roundtrip(d),md=exportMonsterMarkdown(m)
    expect(m.extended?.info).toEqual(d.extended!.info)
    for(const value of ['## Info','Wind Lore','Gust [XPHB]','Fixture book, page 10 [XMM]','Fixture artist','https://example.com/art.webp'])expect(md).toContain(value)
    expect(monsterInfoExportLines(m).join('\n')).toContain('Mountain aeromancer')
    expect(m.description).toBe(d.description)
    expect(monsterInfoExportLines(compileMonster(fixture()))).toEqual([])
    expect(validMonsterDraft({...d,extended:{info:{...d.extended!.info,text:'x'.repeat(100001)}}})).toBeNull()
  })
  it('keeps malformed imported info readable and only makes safe artwork references clickable',()=>{
    expect(readMonsterExtensions({info:{text:42,images:[null,{url:'javascript:alert(1)',credit:'Artist'}]}}).info).toEqual({text:'',source:'',images:[{url:'',title:'',credit:''},{url:'javascript:alert(1)',title:'',credit:'Artist'}]})
    expect(monsterReferenceUrl('https://example.com/art.webp')).toBe('https://example.com/art.webp')
    for(const url of ['javascript:alert(1)','data:text/html,test','/relative.webp','https://user:password@example.com/art'])expect(monsterReferenceUrl(url)).toBeUndefined()
  })
  it('preserves printed overrides, attack ranges, source-qualified spells and every extension through a real Orcbrew round trip',()=>{
    const d=fixture(),m=roundtrip(d)
    expect(m.extended).toEqual(d.extended)
    expect(m.hitPoints).toBe(66)
    expect(m.armorClass).toEqual(compileMonster(d).armorClass)
    expect(m.size).toBe('Small or Medium')
    expect(m.sections.find(s=>s.kind==='actions')?.entries[0]?.description).toContain('spell save DC 13')
    expect(m.sections.find(s=>s.kind==='actions')?.entries[0]?.description).not.toContain('DC 15')
    expect(m.sections.find(s=>s.kind==='reactions')?.entries[0]?.description).toContain('Feather Fall [XPHB; 2024]')
    const md=exportMonsterMarkdown(m)
    for(const value of ['+7 (17)','7,200 XP','Mountain; Planar (Air)','Individual; Implements','reach 5 ft. or range 120 ft.','3 actions, or 4 while in its lair.','XPHB; 2024'])expect(md).toContain(value)
    expect(md.split('\n').length).toBeGreaterThan(20)
  })
  it('preserves formula stats and missing CR instead of presenting fabricated defaults',()=>{
    const d=fixture();d.extended!.armorText='11 + the spell’s level';d.extended!.hpText='40 + 10 per spell level above 4th';d.extended!.unknown=['cr','str'];d.rules=d.rules.filter(r=>r.mode!=='attack')
    const m=roundtrip(d),md=exportMonsterMarkdown(m)
    expect(m.hitPoints).toBeNull();expect(m.challenge).toBeNull();expect(m.proficiencyBonus).toBeNull();expect(m.abilities.str).toBeNull()
    expect(m.missing).not.toContain('hit points');expect(md).toContain('40 + 10 per spell level above 4th');expect(md).toContain('11 + the spell’s level')
    expect(md).not.toContain('null (+0)')
    expect(monsterExportFacts(m).find(([k])=>k==='Proficiency Bonus')).toBeUndefined()
  })
  it('still accepts existing version-1 drafts and actions and rejects invalid additions',()=>{
    const old=newMonsterDraft();old.name='Old creature'
    expect(completeMonster(old)).toEqual(old)
    const key=`codex-monster-${old.id}`,legacy=inspectOrcbrew(placeMonsterEntry(undefined,key,rawMonster(old,1),old.id)).entries.monsters[0]!.details as Record<string,unknown>
    expect(legacy[':armor-class']).toBe(10);expect(legacy[':size']).toBe(':medium');expect(legacy[':challenge']).toBe(1)
    expect(monsterActionSchema.safeParse(newMonsterAction()).success).toBe(true)
    expect(monsterActionSchema.safeParse({...newMonsterAction(),mode:'spellcasting'}).success).toBe(false)
    expect(validMonsterDraft({...old,extended:{initiative:999}})).toBeNull()
    const invalid=fixture();invalid.rules[0]!.spellcasting!.groups[0]!.spells[0]!.name=''
    expect(monsterDraftIssues(invalid).some(i=>i.message.includes('spell lists'))).toBe(true)
    expect(()=>completeMonster(invalid)).toThrow()
  })
  it('does not calculate HP or AC from unknown ability scores',()=>{
    const d=newMonsterDraft();d.name='Incomplete source';d.extended={unknown:['con','dex']}
    const m=roundtrip(d)
    expect(m.hitPoints).toBeNull();expect(m.armorClass).toEqual([])
    expect(m.missing).toContain('armor class');expect(m.missing).toContain('hit points')
    d.hp.override=27;d.armor.mode='custom';d.armor.base=16
    const fixed=roundtrip(d)
    expect(fixed.hitPoints).toBe(27);expect(fixed.armorClass[0]?.value).toBe(16)
    expect(fixed.hitDice).toBe('')
  })
  it('decodes reference tags safely, retains source IDs and leaves unsupported syntax visible',()=>{
    expect(monsterRuleText('{@spell Feather Fall|XPHB} and {@condition prone|XPHB}')).toBe('Feather Fall [XPHB] and prone [XPHB]')
    expect(monsterRuleText('{@b {@damage 2d10}} and {@mystery data}')).toBe('2d10 and {@mystery data}')
    expect(monsterRuleText('{@h}{@damage 1d8}; {@recharge}')).toBe('Hit: 1d8; Recharge 6')
    expect(monsterRuleText('<script>alert(1)</script>')).toBe('<script>alert(1)</script>')
  })
})
