import {describe,expect,it} from 'vitest'
import {declaredSpellLevels,groupedReadingSpells,spellReferences,type ReadingSpell} from './compendium-references'
const names=new Map<string,ReadingSpell>([['late',{index:'late',name:'Late spell',source:'North',level:3}],['cantrip',{index:'cantrip',name:'Cantrip',source:'SRD',level:0}],['ward-b',{index:'ward-b',name:'B Ward',source:'North',level:1}],['ward-a',{index:'ward-a',name:'A Ward',source:'South',level:1}]])
describe('shared reading spell groups',()=>{
 it('orders cantrips and numeric spell levels, then names, leaving unknown references last',()=>{
  const indexes=['late','unknown','ward-b','cantrip','ward-a'],before=[...indexes],groups=groupedReadingSpells(indexes,names)
  expect(groups.map(g=>g.level)).toEqual([0,1,3,-1]);expect(groups[1]?.spells.map(s=>s.index)).toEqual(['ward-a','ward-b']);expect(indexes).toEqual(before)
 })
 it('retains same-name source versions as independent references',()=>{
  const map=new Map(names);map.set('ward-b',{...map.get('ward-b')!,name:'Ward'});map.set('ward-a',{...map.get('ward-a')!,name:'Ward'})
  expect(groupedReadingSpells(['ward-b','ward-a'],map)[0]?.spells).toHaveLength(2)
 })
 it('uses declared spell levels for legacy maps when metadata is unavailable',()=>{
  const value={':3':[':late'],':0':[':cantrip'],':1':{':0':':ward-b',':1':':ward-a'}}
  const indexes=spellReferences(value,':spell-list')!,levels=declaredSpellLevels(value,':spell-list')
  expect(groupedReadingSpells(indexes,new Map(),levels).map(g=>g.level)).toEqual([0,1,3])
 })
 it('prefers the verified definition level and does not assign a level from conflicting source declarations',()=>{
  expect(groupedReadingSpells(['late'],names,{late:1})[0]?.level).toBe(3)
  expect(declaredSpellLevels({'1':['same'],'2':['same']},'spell-list')).toEqual({})
 })
 it('leaves schedules and legacy maps containing additional rules in the lossless fallback',()=>{
  expect(spellReferences([{level:1,total:2}],'spells')).toBeNull()
  expect(spellReferences({'1':{':0':':shield',restriction:'Only at night'}},':cleric-spells')).toBeNull()
  expect(spellReferences({'1':2},'cantrips-known')).toBeNull()
  expect(spellReferences({'3':['shield']},'known-spells')).toBeNull()
 })
})
