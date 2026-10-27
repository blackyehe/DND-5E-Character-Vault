import {describe,it,expect} from 'vitest'
import {convertFiveToolsRecord,fiveToolsText,fiveToolsSpellcasting,type MonsterReference} from './five-tools-monster'
import {createMonsterReferenceMatcher} from './monster-reference-match'
import {enrichMonsterStatblock} from './monster-enrichment'
import {monsterStatblock} from './monster-statblock'
import {exportMonsterMarkdown} from './monster-format'
import {monsterRuleText} from './monster-extensions'
import snapshot from '../server/data/5etools-monster-references.json'

const refs=snapshot.references as unknown as MonsterReference[]
const match=createMonsterReferenceMatcher(refs,snapshot.sources)
describe('source-qualified monster enrichment',()=>{
  it('adds the resolved Aboleth lair, regional effects, lore and art without changing recorded stats',()=>{
    const reference=match({index:'aboleth',name:'Aboleth',sourcePack:'SRD 2014'}).reference!
    const original={index:'aboleth',name:'Aboleth',armor_class:17,hit_points:135,strength:21,dexterity:9,constitution:15,intelligence:18,wisdom:15,charisma:18,challenge_rating:10}
    const base=monsterStatblock(original),m=enrichMonsterStatblock(base,reference)
    expect(m.sections.find(s=>s.kind==='regional-effects')?.description).toContain('1 mile')
    expect(m.sections.find(s=>s.kind==='lair-actions')?.description).toContain('initiative count 20')
    expect(m.extended?.info?.text.length).toBeGreaterThan(100)
    expect(m.extended?.info?.images[0]?.url).toContain('/MM/Aboleth.webp')
    expect(m.hitPoints).toBe(135);expect(m.armorClass).toEqual(base.armorClass);expect(m.abilities).toEqual(base.abilities)
    const fromEntry=monsterStatblock({...original,monsterEnrichment:reference})
    expect(fromEntry.sections).toEqual(m.sections)
    expect(exportMonsterMarkdown(m)).toContain('Regional Effects')
  })
  it('never substitutes editions, unavailable UA, ambiguous forms or native homebrew',()=>{
    expect(match({index:'x',name:'Aboleth',sourcePack:'MM'}).reference?.source).toBe('MM')
    expect(match({index:'x',name:'Aboleth',sourcePack:'XMM'}).reference?.source).toBe('XMM')
    for(const entry of [{index:'x',name:'Aboleth',sourcePack:'Unknown Book'},{index:'x',name:'Faerie Dragon',sourcePack:'MM'},{index:'x',name:'Aboleth',sourcePack:'MM',details:{':codex/monster':{name:'Aboleth'}}},{index:'x',name:'Aberrant Spirit',sourcePack:'UA - Spells and Magic Tattoos'}])expect(match(entry).reference).toBeUndefined()
    const form=match({index:'x',name:'Vampire, Bat Form',sourcePack:'SRD 2014'})
    expect(form.mode).toBe('info-only');expect(form.reference?.name).toBe('Vampire')
    expect(match({index:'x',name:'Duergar Soulblades',sourcePack:"Mordenkainen's Tome of Foes"}).reference?.name).toBe('Duergar Soulblade')
  })
  it('retains custom rules, complete local prose, core stats and local lore; deduplicates repeated additions',()=>{
    const base=monsterStatblock({name:'Fixture',actions:[{name:'Bite',desc:'A complete local bite rule with additional custom effects.'},{name:'Custom Action',desc:'Retain this rule.'}]})
    base.extended={info:{text:'My own lore',source:'My book',images:[]}}
    const extra={...refs[0]!,sections:[{kind:'actions' as const,title:'Actions',description:'',entries:[{name:'Bite',description:'Short bite.',usage:''},{name:'New Action',description:'Source action.',usage:''}]}]}
    const once=enrichMonsterStatblock(base,extra),twice=enrichMonsterStatblock(once,extra)
    expect(once.sections[0]?.entries).toHaveLength(3);expect(twice.sections).toEqual(once.sections)
    expect(once.sections[0]?.entries[0]?.description).toContain('complete local bite')
    expect(once.extended?.info?.text).toBe('My own lore')
    expect(enrichMonsterStatblock(base,{...extra,mode:'info-only'}).sections).toEqual(base.sections)
  })
  it('preserves nested entry lists, tables, endings and spell usage',()=>{
    expect(fiveToolsText([{type:'entries',name:'Regional Influence',entries:['Introduction',{type:'list',items:[{type:'item',name:'Mists',entry:'Dense fog.'}]}]},{type:'table',caption:'Effects',colLabels:['d6','Result'],rows:[['1','Rain']]},'Effects end after 3 days.'])).toContain('Effects end after 3 days.')
    expect(fiveToolsText({type:'table',colLabels:['d6','Result'],rows:[['1','Rain']]})).toBe('d6 | Result\n1 | Rain')
    const spell=fiveToolsSpellcasting({name:'Spellcasting',headerEntries:['No material components.'],daily:{'1e':['{@spell Fly|PHB}']},spells:{'1':{slots:4,spells:['{@spell Shield|PHB}']}},footerEntries:['Exceptions remain.']})
    expect(spell).toContain('1/day each: Fly [PHB]');expect(spell).toContain('Level 1 (4 slots): Shield [PHB]');expect(spell).toContain('Exceptions remain.')
    const converted=convertFiveToolsRecord({monster:{name:'Fixture',source:'TEST',legendaryHeader:['Keep this exact introduction.'],legendary:[{name:'Strike',entries:['Attack.']}]},legendaryGroup:{regionalEffects:['Intro',{type:'list',items:['Effect']},'Ending.']},fluff:{entries:['Lore'],images:[{href:{type:'internal',path:'bestiary/TEST/Fixture.webp'},credit:'Artist'}]}},'test','Test Book')
    expect(converted.sections.find(s=>s.kind==='legendary-actions')?.description).toBe('Keep this exact introduction.')
    expect(converted.sections.find(s=>s.kind==='regional-effects')?.description).toContain('Ending.')
    expect(converted.extended.info?.images[0]?.credit).toBe('Artist')
    expect(monsterRuleText('{@actSaveFail} {@quickref difficult terrain||3}')).toBe('Failure: difficult terrain')
  })
  it('validates every converted reference has bounded content and source-qualified artwork',()=>{
    expect(refs).toHaveLength(4942)
    for(const ref of refs){expect(ref.name).toBeTruthy();expect(ref.source).toBeTruthy();expect(ref.url.startsWith('https://5e.tools/bestiary.html#')).toBe(true);expect(JSON.stringify(ref).length).toBeLessThan(1000000);for(const image of ref.extended.info?.images??[])expect(image.url).toMatch(/^https?:\/\//)}
  })
})
