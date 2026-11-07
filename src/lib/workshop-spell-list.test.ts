import {describe,expect,it} from 'vitest'
import {queryWorkshopSpells,workshopSpellFields,workshopSpellRecords} from './workshop-spell-list'

const spells=[
 {index:'shield',name:'Shield',url:'',filterFacets:{level:['1'],school:['abjuration'],class:['wizard'],ritual:['no']}},
 {index:'imported-shield',name:'Shield',displayName:'Shield · North',sourcePack:'North',url:'',level:1,details:{':level':1,':school':':abjuration'}},
 {index:'spark',name:'Beacon spark',sourcePack:'North',url:'',level:0,details:{':level':0,':school':':evocation'}},
 {index:'lost',name:'Lost spell',sourcePack:'South',url:''},
]
describe('Workshop spell-library discovery',()=>{
 it('keeps every source version available beyond the old 60-match cutoff',()=>{
  const many=[...Array.from({length:70},(_,n)=>({index:'core-'+n,name:'SRD '+n,url:'',level:9})),...spells]
  const result=queryWorkshopSpells(workshopSpellRecords(many),'',{},[],'','level')
  expect(result).toHaveLength(74)
  expect(result[0]?.spell.index).toBe('spark')
  expect(result.some(r=>r.spell.index==='imported-shield')).toBe(true)
 })
 it('combines source, school, level and multiword search without merging versions',()=>{
  const rows=workshopSpellRecords(spells)
  expect(queryWorkshopSpells(rows,' shield NORTH ',{level:'1',source:'North',school:'abjuration'},[],'','name').map(r=>r.spell.index)).toEqual(['imported-shield'])
  expect(queryWorkshopSpells(rows,'shield',{},[],'','name').map(r=>r.spell.index)).toEqual(['shield','imported-shield'])
 })
 it('uses Compendium metadata and keeps unknown levels separate from cantrips',()=>{
  const rows=workshopSpellRecords(spells),level=workshopSpellFields(rows).find(field=>field.key==='level')!
  expect(level.options).toEqual([{value:'0',label:'Cantrip'},{value:'1',label:'Level 1'},{value:'__unknown',label:'Not recorded'}])
  expect(queryWorkshopSpells(rows,'',{level:'__unknown'},[],'','level').map(r=>r.spell.index)).toEqual(['lost'])
  expect(rows.find(r=>r.spell.index==='shield')?.level).toBe(1)
 })
 it('filters selected versions independently while leaving hidden and unresolved selections intact',()=>{
  const selected=['shield','imported-shield','original-unresolved'],before=[...selected],rows=workshopSpellRecords(spells)
  expect(queryWorkshopSpells(rows,'',{source:'North'},selected,'selected','level').map(r=>r.spell.index)).toEqual(['imported-shield'])
  expect(queryWorkshopSpells(rows,'',{},selected,'unselected','name').map(r=>r.spell.index)).toEqual(['spark','lost'])
  expect(selected).toEqual(before)
 })
 it('sorts by source and name without reordering the input catalog',()=>{
  const rows=workshopSpellRecords(spells),original=rows.map(r=>r.spell.index)
  expect(queryWorkshopSpells(rows,'',{},[],'','source').map(r=>r.spell.index)).toEqual(['spark','imported-shield','lost','shield'])
  expect(rows.map(r=>r.spell.index)).toEqual(original)
 })
})
