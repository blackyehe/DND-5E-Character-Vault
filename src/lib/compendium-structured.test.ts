import { describe, expect, it } from 'vitest'
import { compendiumReading, readingFields, readingLabel } from './compendium-reading'
import { readingBenefits, readingProgression } from './compendium-structured'

// These shapes occur in the imported Blood Magic and Revenant Shadow definitions.
const modifiers=[
  {':type':':damage-resistance',':value':':necrotic'},
  {':type':':damage-resistance',':value':':poison'},
  {':type':':num-attacks',':level':5,':value':2},
  {':type':':num-attacks',':level':11,':value':3},
  {':type':':spell',':level':3,':value':{':key':':life-leech',':level':2,':ability':':orcpub.dnd.e5.character/cha'}},
]
describe('imported Compendium rule presentation',()=>{
  it('retains source context through the document and recursive fields',()=>{
    const doc=compendiumReading({details:{':level-modifiers':modifiers}},'subclasses')
    expect(doc.sections[0]?.key).toBe(':level-modifiers')
    expect(readingFields({':spells-known':{'1':2}})[0]?.key).toBe(':spells-known')
  })
  it('renders the screenshot benefits without inventing an acquisition level',()=>{
    const before=JSON.stringify(modifiers)
    const rows=readingBenefits(modifiers,':level-modifiers')!
    expect(rows.map(x=>[x.title,x.level,x.value])).toEqual([
      ['Damage resistance',undefined,':necrotic'],['Damage resistance',undefined,':poison'],
      ['Number of attacks',5,2],['Number of attacks',11,3],['Spell: Life leech',3,undefined],
    ])
    expect(rows[4]?.details).toEqual([{label:'Spell level',value:2},{label:'Casting ability',value:'Charisma'}])
    expect(JSON.stringify(modifiers)).toBe(before)
  })
  it('keeps unknown benefit types, nested rules, zero, false, and spell usage restrictions',()=>{
    const rows=readingBenefits([{type:':new-benefit',value:0,level:0,optional:false,rules:{text:'Unusual rule'}},
      {type:':spell',value:{key:':light',level:0,ability:':wis',uses:0,ritual:false,restriction:'Only at night'},condition:'While awake'}],'level-modifiers')!
    expect(rows[0]).toMatchObject({title:'New benefit',value:0,level:0})
    expect(rows[0]?.details.map(x=>x.value)).toEqual([false,{text:'Unusual rule'}])
    expect(rows[1]?.details.map(x=>[x.label,x.value])).toEqual([
      ['Spell level',0],['Casting ability','Wisdom'],['Uses',0],['Ritual',false],['Restriction','Only at night'],['Condition','While awake'],
    ])
    expect(readingBenefits([{type:':spell',value:{key:':light',ability:{name:'Wisdom',index:'wis'}}}],'level-modifiers')?.[0]?.details[0]?.value).toEqual({name:'Wisdom',index:'wis'})
  })
  it('keeps choices and valueless movement benefits readable',()=>{
    expect(readingBenefits([{':type':':additional-fighting-style',':num':2,':level':3}],':level-selections')?.[0]).toMatchObject({title:'Additional fighting style',level:3,details:[{label:'Number of choices',value:2}]})
    expect(readingBenefits([{type:':flying-speed-equals-walking-speed',level:17}],'level-modifiers')?.[0]?.title).toBe('Flying speed equals walking speed')
    expect(readingBenefits(modifiers,'unrelated')).toBeNull()
    expect(readingBenefits([...modifiers,{help:'Unknown layout'}],'level-modifiers')).toBeNull()
  })
  it('distinguishes spells gained from published totals and spell levels',()=>{
    expect(readingProgression({'1':2,'7':1},':spells-known')).toEqual({heading:'Level',valueHeading:'Gained',rows:[{level:'1',value:2},{level:'7',value:1}]})
    expect(readingProgression([{level:1,total:2},{level:7,total:3}],'cantrips')?.valueHeading).toBe('Total known')
    expect(readingProgression({'0':[':light'],'1':[':shield']},':spell-list')).toEqual({heading:'Spell level',valueHeading:'Spells',rows:[{level:'Cantrips',value:[':light']},{level:'1',value:[':shield']}]})
    expect(readingProgression({'0':false,'3':0},'cantrips-known')?.rows.map(x=>x.value)).toEqual([false,0])
    expect(readingProgression({'1':{'0':':bane','1':':false-life'}},':cleric-spells')?.rows).toEqual([{level:'1',value:[':bane',':false-life']}])
    expect(readingProgression({'1':{'0':':bane',restriction:'Only at night'}},':cleric-spells')?.rows[0]?.value).toEqual({'0':':bane',restriction:'Only at night'})
  })
  it('leaves ambiguous maps and schedules with additional rules to the lossless fallback',()=>{
    expect(readingProgression({'1':2},'unrelated')).toBeNull()
    expect(readingProgression({'1':2,note:'Special condition'},'spells-known')).toBeNull()
    expect(readingProgression([{level:1,total:2,restriction:'At night'}],'spells')).toBeNull()
    expect(readingLabel('constructor')).toBe('Constructor')
  })
})
