import {describe,expect,it} from 'vitest'
import {BROWSE_KINDS} from '../../shared/compendium-kinds'
import {compendiumReading,readingFields} from './compendium-reading'
import {readingBenefits} from './compendium-structured'
const raw={':spellcasting':{':ability':':int',':known-mode':':known',':spell-list':{'1':[':shield']},':spells-known':{'1':2},restriction:'Only under moonlight'},':level-modifiers':[{':type':':spell',':level':1,':value':{':key':':shield',':ability':':int',':level':1}}],':level-selections':[{':type':':additional-fighting-style',':level':3,':num':2}],':subclass-help':'A unique subclass explanation',':props':{':damage-resistance':{':fire':true},custom:'Retained source rule'}}
const benefits=[{type:'spell',level:3,value:{key:'shield',ability:'con',level:1}}]
const magic={enabled:true,ability:'con',progression:'full',spellList:['shield'],spells:[{level:1,total:2}]}
describe('current definitions in the shared Compendium reader',()=>{
 it.each(BROWSE_KINDS)('uses one authored spellcasting/benefit section for %s without changing the entry',kind=>{
  const entry={name:'Fixture',details:raw,workshop:{magic},benefits},before=JSON.stringify(entry),doc=compendiumReading(entry,kind)
  expect(doc.sections.filter(s=>s.label==='Spellcasting')).toHaveLength(1)
  expect(doc.sections.some(s=>s.label==='Published spellcasting'||s.label==='Benefits by level')).toBe(false)
  expect(doc.sections.filter(s=>s.label==='Benefits')).toHaveLength(1)
  expect(doc.facts.find(s=>s.label==='Spellcasting ability')?.value).toBe('Constitution')
  expect(doc.sections.find(s=>s.label==='Spellcasting')?.value).toMatchObject({spellList:['shield'],restriction:'Only under moonlight'})
  expect(doc.sections.find(s=>s.label==='Choices by level')).toBeTruthy()
  expect(doc.sections.find(s=>s.label==='Subclass help')?.value).toBe('A unique subclass explanation')
  expect(JSON.stringify(doc)).toContain('Retained source rule')
  expect(JSON.stringify(entry)).toBe(before)
 })
 it('respects explicitly removed casting and benefits without resurrecting old source grants',()=>{
  const doc=compendiumReading({details:raw,workshop:{magic:{enabled:false}},benefits:[]},'classes')
  expect(doc.sections.some(s=>['Spellcasting','Published spellcasting','Benefits','Benefits by level'].includes(s.label))).toBe(false)
  expect(JSON.stringify(doc)).not.toContain('damage-resistance')
  expect(doc.sections.find(s=>s.label==='Source spellcasting notes')?.value).toEqual({restriction:'Only under moonlight'})
 })
 it('retains original imported rules when there is no authored replacement',()=>{
  const doc=compendiumReading({details:raw},'subclasses')
  expect(doc.sections.find(s=>s.label==='Benefits by level')?.value).toEqual(raw[':level-modifiers'])
  expect(doc.sections.find(s=>s.label==='Spellcasting')?.value).toHaveProperty(':spell-list')
 })
 it('formats authored benefits with the same level, spell and ability structure as source benefits',()=>{
  expect(readingBenefits(benefits,'benefits')?.[0]).toMatchObject({title:'Spell: shield',spell:'shield',level:3,details:[{label:'Spell level',value:1},{label:'Casting ability',value:'Constitution'}]})
 })
 it('hides editor payloads and metadata across the generic reading fallback',()=>{
  expect(readingFields({name:'Visible',spellBuilder:{internal:true},optionBuilder:{internal:true},monsterDraft:{internal:true},filterFacets:{level:['1']},builderLevels:[1]})).toEqual([{key:'name',label:'Name',value:'Visible'}])
 })
})
