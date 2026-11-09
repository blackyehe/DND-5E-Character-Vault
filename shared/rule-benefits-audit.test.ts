import {expect,it} from 'vitest'
import {emptyCharacter,type Character} from './character'
import {BENEFIT_TYPES,characterBenefits,grantedBenefitSpells,benefitSpellAttack,benefitSpellDC} from './rule-benefits'
import {sheetAC,sheetInitiative,sheetSave,sheetSkill,sheetProficiencies,attackValues} from '../src/lib/character-sheet'

type Audit={type:string;value?:unknown;read:(c:Character)=>unknown;expected:unknown}
const audit:Audit[]=[
 {type:'damage-resistance',value:'fire',read:c=>characterBenefits(c).resistances,expected:['fire']},
 {type:'damage-immunity',value:'cold',read:c=>characterBenefits(c).immunities,expected:['cold']},
 {type:'damage-vulnerability',value:'radiant',read:c=>characterBenefits(c).vulnerabilities,expected:['radiant']},
 {type:'condition-immunity',value:'poisoned',read:c=>characterBenefits(c).conditionImmunities,expected:['poisoned']},
 {type:'saving-throw-advantage',value:'charmed',read:c=>characterBenefits(c).saveAdvantage,expected:['charmed']},
 {type:'skill-prof',value:'stealth',read:c=>sheetSkill(c,'stealth'),expected:3},
 {type:'skill-expertise',value:'stealth',read:c=>sheetSkill(c,'stealth'),expected:6},
 {type:'saving-throw-prof',value:'cha',read:c=>sheetSave(c,'cha'),expected:3},
 {type:'armor-prof',value:'heavy',read:c=>sheetProficiencies(c).armor,expected:['Heavy armor']},
 {type:'weapon-prof',value:'martial',read:c=>sheetProficiencies(c).weapons,expected:['All martial weapons']},
 {type:'tool-prof',value:"Thieves' tools",read:c=>sheetProficiencies(c).tools,expected:["Thieves' tools"]},
 {type:'language',value:'Elvish',read:c=>sheetProficiencies(c).languages,expected:['Elvish']},
 {type:'num-attacks',value:2,read:c=>characterBenefits(c).attacks,expected:2},
 {type:'walking-speed',value:40,read:c=>characterBenefits(c).speed,expected:40},
 {type:'flying-speed',value:60,read:c=>characterBenefits(c).fly,expected:60},
 {type:'flying-speed-equals-walking-speed',read:c=>characterBenefits(c).fly,expected:30},
 {type:'swimming-speed',value:30,read:c=>characterBenefits(c).swim,expected:30},
 {type:'climbing-speed',value:20,read:c=>characterBenefits(c).climb,expected:20},
 {type:'burrowing-speed',value:10,read:c=>characterBenefits(c).burrow,expected:10},
 {type:'darkvision',value:120,read:c=>characterBenefits(c).darkvision,expected:120},
 {type:'blindsight',value:30,read:c=>characterBenefits(c).blindsight,expected:30},
 {type:'truesight',value:60,read:c=>characterBenefits(c).truesight,expected:60},
 {type:'ac-bonus',value:1,read:c=>sheetAC(c),expected:11},
 {type:'saving-throw-bonus',value:1,read:c=>sheetSave(c,'cha'),expected:1},
 {type:'initiative-bonus',value:2,read:c=>sheetInitiative(c),expected:2},
 {type:'attack-bonus',value:1,read:c=>attackValues(c,{name:'Test',ability:'str',damageDice:'1d6',damageBonus:0,magicBonus:0,damageType:'fire',range:'Melee',notes:'',proficient:true}).toHit,expected:4},
 {type:'damage-bonus',value:2,read:c=>attackValues(c,{name:'Test',ability:'str',damageDice:'1d6',damageBonus:0,magicBonus:0,damageType:'fire',range:'Melee',notes:''}).text,expected:'1d6+2'},
 {type:'spell-attack-bonus',value:1,read:benefitSpellAttack,expected:9},
 {type:'spell-dc-bonus',value:1,read:benefitSpellDC,expected:17},
 {type:'spell',value:{key:'light',ability:'cha',level:0},read:c=>grantedBenefitSpells(c).map(s=>s.index),expected:['light']},
]
it('covers every benefit type offered by the builder',()=>expect(audit.map(a=>a.type).sort()).toEqual(Object.keys(BENEFIT_TYPES).sort()))
it.each(audit)('updates and removes $type without accumulating or altering saved play state',({type,value,read,expected})=>{
 const c:Character={...emptyCharacter(),_id:'hero',updatedAt:'now'};c.meta.level=6;c.abilities.int=20;c.spellcasting.ability='int';c.skills={};c.saves={str:false,dex:false,con:false,int:false,wis:false,cha:false};c.proficiencies={armor:[],weapons:[],tools:[],languages:[]}
 c.combat.hpCurrent=4;c.resources=[{id:'spent',name:'Uses',max:4,used:3,recovery:'long'}];c.spellcasting.slots={l1:{max:4,used:2}};c.features=[{name:'Source feat',description:'',origin:'feat',definition:{version:1,kind:'feats',index:'source'}}]
 const original=JSON.stringify(c),baseline=read(c),source={name:'Source feat',index:'source',benefits:[] as unknown[]}
 c.compendiumRules=[{kind:'feats',index:'source',revision:1,before:source,entry:{...source,benefits:[{type,value,level:1}]}}]
 const saved=JSON.stringify(c);expect(read(c)).toEqual(expected);expect(read(c)).toEqual(expected);expect(JSON.stringify(c)).toBe(saved)
 c.compendiumRules[0]!.entry.benefits=[];expect(read(c)).toEqual(baseline)
 c.compendiumRules=undefined;expect(JSON.stringify(c)).toBe(original)
})
