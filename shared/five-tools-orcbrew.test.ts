import { describe,it,expect } from 'vitest'
import { fiveToolsOrcbrewMonster } from './five-tools-orcbrew'
import { monsterStatblock } from './monster-statblock'
import { inspectOrcbrew } from '../server/lib/orcbrew'
import { writeEdn,monsterKeyword } from '../server/lib/workshop-pack'
import { monsterBrowseEntry } from '../server/lib/monster-browse'
import { groupMonsterEntries } from './monster-identity'
import { compendiumFacets } from './compendium-facets'

describe('5etools to portable monster entries',()=>{
  it('round-trips combat rules, conditional stats, lore, art, original data and searchable facets',()=>{
    const record={monster:{name:'Fixture',source:'XMM',size:['S','M'],type:{type:'aberration',tags:['shapechanger']},alignment:['L','E'],ac:[15,{ac:18,condition:'with a shield'}],hp:{average:60,formula:'8d8 + 24'},speed:{walk:30,fly:{number:40,condition:'(hover)'},canHover:true},str:12,dex:14,con:16,int:18,wis:16,cha:12,cr:{cr:'5',xpLair:2300},initiative:{proficiency:2},save:{wis:'+6'},skill:{perception:'+6'},resist:[{resist:['cold','fire'],note:'while in mist form'}],trait:[{name:'Shapechanger',entries:['Changes form.']}],action:[{name:'Strike',entries:['{@hit 5} to hit.']}],spellcasting:[{name:'Innate magic',will:['{@spell Fly|XPHB}']}],passive:16,languages:['Deep Speech'],futureUnsupported:{keep:'every field'}},legendaryGroup:{lairActions:['Lair rule.'],regionalEffects:['Regional rule.']},fluff:{entries:['Lore text.'],images:[{href:{type:'external',url:'https://example.com/art.webp'}}]}}
    const raw=fiveToolsOrcbrewMonster(record,'fixture-snapshot','Fixture Book','fixture')
    const source=writeEdn({':orcpub.dnd.e5/monsters':{':fixture':{...raw,':key':monsterKeyword('fixture'),':size':monsterKeyword('small')}}})
    const entry=inspectOrcbrew(source).entries.monsters[0]!,m=monsterStatblock(entry)
    expect(m.abilities).toEqual({str:12,dex:14,con:16,int:18,wis:16,cha:12})
    expect(m.hitPoints).toBe(60);expect(m.hitDice).toBe('8d8 + 24');expect(m.armorClass).toHaveLength(2)
    expect(m.resistances).toContain('cold; fire while in mist form');expect(m.extended?.initiative).toBe(8)
    expect(m.extended?.lairXp).toBe(2300);expect(m.extended?.info?.text).toBe('Lore text.')
    expect(JSON.parse(m.extended!.provenance!.original)).toEqual(record)
    for(const kind of ['traits','actions','lair-actions','regional-effects'])expect(m.sections.some(s=>s.kind===kind)).toBe(true)
    expect(m.sections.find(s=>s.kind==='traits')!.entries.map(r=>r.description).join(' ')).toContain('Fly [XPHB]')
    const thin=monsterBrowseEntry(entry)
    expect(thin.filterFacets).toEqual(compendiumFacets(entry,'monsters'))
    expect(JSON.stringify(thin)).not.toContain('futureUnsupported')
    expect(groupMonsterEntries([thin])[0]!.name).toBe('Fixture')
  })
  it('keeps same-name editions distinct and preserves formula HP without invented numbers',()=>{
    const raw=fiveToolsOrcbrewMonster({monster:{name:'Spirit',source:'TCE',size:['M'],type:'undead',hp:{special:'30 + 10 per spell level'},cr:'Unknown'},legendaryGroup:null,fluff:null},'fixture','Tasha','spirit')
    const m=monsterStatblock({name:'Spirit',details:raw})
    expect(m.hitPoints).toBeNull();expect(m.extended?.hpText).toBe('30 + 10 per spell level')
    expect(m.abilities.str).toBeNull();expect(m.proficiencyBonus).toBeNull()
  })
})
