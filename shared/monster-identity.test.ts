import { describe,it,expect } from 'vitest'
import { canonicalMonsterSource,groupMonsterEntries,monsterIdentity,monsterSearchText } from './monster-identity'
const entry=(name:string,index=name,sourcePack='Monster Manual')=>({name,index,sourcePack})
describe('monster browse identity',()=>{
  it('groups source titles and acronyms without discarding any version',()=>{
    const entries=[entry('Duergar Soulblades'),entry('Duergar Soulblade - MTF'),entry("Duergar Soulblade (Mordenkainen’s Tome of Foes)")]
    const groups=groupMonsterEntries(entries)
    expect(groups).toHaveLength(1)
    expect(groups[0]?.name).toBe('Duergar Soulblade')
    expect(groups[0]?.versions).toHaveLength(3)
    expect(canonicalMonsterSource("Mordenkainen’s Tome of Foes")).toBe('MTF')
    expect(canonicalMonsterSource('MToF')).toBe('MTF')
    expect(canonicalMonsterSource('XMM')).not.toBe(canonicalMonsterSource('MM'))
  })
  it('keeps Vampire forms and UA history selectable, with published versions first',()=>{
    const entries=['Vampire - UA','Vampire, Vampire Form','Vampire, Bat Form','Vampire Spellcaster','Vampire Warrior','Vampire Spawn','Blood Drinker Vampire','Mind Drinker Vampire','Vampiric Mist'].map(n=>entry(n))
    const groups=groupMonsterEntries(entries),vampire=groups.find(g=>g.name==='Vampire')!
    expect(groups).toHaveLength(5)
    expect(vampire.versions).toHaveLength(5)
    expect(vampire.versions.at(-1)?.name).toBe('Vampire - UA')
  })
  it('never strips unreviewed roles, merges equal stats, or follows replacement edges',()=>{
    const names=['Aarakocra','Aarakocra Aeromancer','Duergar','Spy','Drow','Priest Acolyte','Mage','Teysa','Vampire (Homebrew Boss)','Vampire (UA custom rules)']
    expect(groupMonsterEntries(names.map(n=>({...entry(n),hp:20,cr:2})))).toHaveLength(names.length)
  })
  it('hides only exact raw source-label copies and retains changed prose and unsupported data',()=>{
    const raw={':name':'Duergar Soulblade',':key':':soulblade',':option-pack':'MTF',':traits':[{':name':'Attack',':description':'Full original rules.'}],':unmapped':{special:3}}
    const copies=[{...entry('Duergar Soulblade - MTF','a','MTF'),details:raw},{...entry("Duergar Soulblade - Mordenkainen’s Tome of Foes",'b',"Mordenkainen’s Tome of Foes"),details:{...raw,':key':':other',':name':'Duergar Soulblade - MTF',':option-pack':"Mordenkainen’s Tome of Foes"}}]
    const grouped=groupMonsterEntries(copies)[0]!
    expect(grouped.versions).toHaveLength(2)
    expect(grouped.choices).toHaveLength(1)
    expect(grouped.choices[0]?.copies).toHaveLength(2)
    expect(groupMonsterEntries([...copies,{...copies[0]!,index:'c',details:{...raw,':unmapped':{special:4}}}])[0]?.choices).toHaveLength(2)
    expect(groupMonsterEntries([...copies,{...copies[0]!,index:'c',details:{...raw,':traits':[{':name':'Attack',':description':'Different rules.'}]}}])[0]?.choices).toHaveLength(2)
    const forms=['Vampire, Vampire Form','Vampire, Bat Form'].map((name,i)=>({...entry(name,String(i)),details:{...raw,':name':name}}))
    expect(groupMonsterEntries(forms)[0]?.choices).toHaveLength(2)
  })
  it('recognizes reviewed spelling and explicit native family metadata in searches',()=>{
    expect(monsterSearchText(entry('Nyacaloth'))).toContain('nycaloth')
    const native={...entry('Custom form'),details:{':codex/monster':{extended:{family:'My Creature',variant:'Fire',aliases:['Flame beast'],sourceInfo:{id:'MTF',edition:'2014'}}}}}
    expect(monsterIdentity(native)).toMatchObject({name:'My Creature',variant:'Fire',source:'MTF',edition:'2014'})
    expect(monsterSearchText(native)).toContain('flame beast')
    expect(()=>monsterSearchText({...entry('Malformed metadata'),details:{':codex/extended':{family:12,aliases:44,sourceInfo:{id:5}}}})).not.toThrow()
  })
})
