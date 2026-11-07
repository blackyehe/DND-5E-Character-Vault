import {describe,expect,it} from 'vitest'
import {readingBenefits,readingBenefitGroups,readingProgression,readingResources} from './compendium-structured'

describe('Field guide rule presentation',()=>{
  it('groups explicit acquisition levels without changing spell levels, source order within a level, or saved input',()=>{
    const source=[{type:'spell',value:{key:'shield',level:1,ability:'con'}},{type:'spell',level:5,value:{key:'manifest',level:3}},{type:'spell',level:3,value:{key:'invisibility',level:2}},{type:'num-attacks',level:5,value:2},{type:'spell',level:3,value:{key:'shadow-spikes',level:2}}],before=JSON.stringify(source)
    const groups=readingBenefitGroups(readingBenefits(source,'benefits')!)
    expect(groups.map(g=>g.level)).toEqual([undefined,3,5])
    expect(groups[1]!.benefits.map(b=>b.spell)).toEqual(['invisibility','shadow-spikes'])
    expect(groups[0]!.benefits[0]!.details).toContainEqual({label:'Spell level',value:1})
    expect(groups[2]!.benefits.map(b=>b.value)).toEqual([undefined,2])
    expect(JSON.stringify(source)).toBe(before)
  })
  it('retains exceptional acquisition rules and zero levels rather than assigning a guessed level',()=>{
    const rows=readingBenefits([{type:'custom',level:'After initiation',value:'Unusual grant'},{type:'custom',level:0,value:0},{type:'custom',value:'Unknown'}],'level-modifiers')!
    const groups=readingBenefitGroups(rows)
    expect(groups.flatMap(g=>g.benefits)).toHaveLength(3)
    expect(groups.find(g=>g.level===0)?.benefits[0]?.value).toBe(0)
    expect(groups.find(g=>g.level==='After initiation')?.benefits[0]?.value).toBe('Unusual grant')
  })
  it('keeps recorded schedule breakpoints and distinguishes cumulative totals from gains',()=>{
    const totals=[{level:1,total:2},{level:3,total:4},{level:13,total:13}]
    expect(readingProgression(totals,'spells')).toEqual({heading:'Level',valueHeading:'Total known',rows:[{level:'1',value:2},{level:'3',value:4},{level:'13',value:13}]})
    expect(readingProgression({1:2,3:1},'spells-known')?.valueHeading).toBe('Gained')
  })
  it('formats exact resource formulas and recovery while preserving notes, extras, and zero values',()=>{
    const source=[{name:'Shadow points',level:1,basis:'ability',ability:'con',multiplier:2,base:-1,minimum:0,recovery:'long',unlimitedAt:14,notes:'A description with\nmultiple lines.',customRule:{cost:0}}],before=JSON.stringify(source)
    const resource=readingResources(source,'resources')![0]!
    expect(resource.name).toBe('Shadow points')
    expect(resource.notes).toBe(source[0]!.notes)
    expect(resource.fields).toContainEqual({label:'Maximum',value:'2 × Constitution modifier − 1 (minimum 0)'})
    expect(resource.fields).toContainEqual({label:'Recovery',value:'Long rest'})
    expect(resource.fields.find(f=>f.key==='unlimitedAt')).toMatchObject({label:'Unlimited from level',value:14})
    expect(resource.fields.find(f=>f.key==='customRule')?.value).toEqual({cost:0})
    expect(JSON.stringify(source)).toBe(before)
  })
  it('retains non-text notes and leaves unfamiliar resource shapes to the lossless generic reader',()=>{
    expect(readingResources([{name:'Legacy pool',notes:'Keep me'}],'resources')).toBeNull()
    expect(readingResources([{name:'Pool',basis:'fixed',base:3,multiplier:0,minimum:0,notes:{cost:2}}],'resources')![0]!.fields).toContainEqual({key:'notes',label:'Notes',value:{cost:2}})
    expect(readingResources([{name:'Pool',basis:'fixed',base:3,multiplier:0,minimum:0,notes:['Text',{cost:2}]}],'resources')![0]!.fields).toContainEqual({key:'notes',label:'Notes',value:['Text',{cost:2}]})
    expect(readingResources([{name:'Pool',basis:'ability',ability:{custom:2},base:3,multiplier:1,minimum:0}],'resources')).toBeNull()
    expect(readingResources([{name:'Pool',basis:'fixed',base:3,multiplier:0,minimum:0}],'unrelated')).toBeNull()
  })
})
