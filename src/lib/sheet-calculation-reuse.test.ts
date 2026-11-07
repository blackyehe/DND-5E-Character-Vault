import {beforeEach,expect,it,vi} from 'vitest'
import {computed,reactive,ref} from 'vue'
import {emptyCharacter,type Character} from '../../shared/character'
import {characterBenefits} from '../../shared/rule-benefits'
import {combatAttacks,equipmentAttacks} from './equipment'
import {sheetSkillRows,weaponProficient} from './character-sheet'

vi.mock('../../shared/rule-benefits',async importOriginal=>{
 const actual=await importOriginal<typeof import('../../shared/rule-benefits')>()
 return {...actual,characterBenefits:vi.fn(actual.characterBenefits)}
})
beforeEach(()=>{vi.mocked(characterBenefits).mockClear()})
function hero():Character{
 const c={...emptyCharacter(),_id:'hero',updatedAt:'2026-11-01'}
 c.meta.level=5;c.abilities.str=16;c.abilities.wis=14
 c.proficiencies.weapons=['All martial weapons'];c.skills.perception='expert'
 c.equipment=[{name:'Longsword',qty:1,weight:3,equipped:true,notes:'',weapon:{dice:'1d8',damageType:'slashing',range:'Melee',category:'martial',finesse:false,ranged:false}},
  {name:'Carried sword',qty:1,weight:3,equipped:false,notes:'',weapon:{dice:'1d8',damageType:'slashing',range:'Melee',category:'martial',finesse:false,ranged:false}}]
 c.attacks=[{name:'Unarmed strike',ability:'str',range:'Melee',damageDice:'1',damageType:'bludgeoning',damageBonus:0,magicBonus:0,notes:'',proficient:true}]
 return c
}
it('builds the complete sorted skill list with current expertise using one rule evaluation',()=>{
 const rows=sheetSkillRows(hero())
 expect(rows).toHaveLength(18);expect(rows.map(r=>r.name)).toEqual(rows.map(r=>r.name).sort((a,b)=>a.localeCompare(b)))
 expect(rows.find(r=>r.key==='perception')).toMatchObject({ability:'wis',rank:'expert',modifier:8})
 expect(characterBenefits).toHaveBeenCalledTimes(1)
})
it('keeps reactive skill snapshots current after nested edits and a character switch',()=>{
 const current=ref(reactive(hero())),benefits=computed(()=>characterBenefits(current.value)),rows=computed(()=>sheetSkillRows(current.value,benefits.value))
 expect(rows.value.find(r=>r.key==='perception')?.modifier).toBe(8)
 current.value.abilities.wis=18
 expect(rows.value.find(r=>r.key==='perception')?.modifier).toBe(10)
 current.value.skills.perception='none'
 expect(rows.value.find(r=>r.key==='perception')).toMatchObject({rank:'none',modifier:4})
 current.value=hero()
 expect(rows.value.find(r=>r.key==='perception')).toMatchObject({rank:'expert',modifier:8})
})
it('shares rules across equipped and custom attacks without retaining them after an edit',()=>{
 const c=hero(),first=combatAttacks(c)
 expect(first.map(a=>a.name)).toEqual(['Longsword','Unarmed strike'])
 expect(first[0]).toMatchObject({proficient:true,toHit:6,damage:3})
 expect(characterBenefits).toHaveBeenCalledTimes(1)
 c.abilities.str=20;c.proficiencies.weapons=[]
 const next=combatAttacks(c)
 expect(next[0]).toMatchObject({proficient:false,toHit:5,damage:5})
 expect(next[1]).toMatchObject({proficient:true,toHit:8,damage:5})
 expect(characterBenefits).toHaveBeenCalledTimes(2)
})
it('does no rule work for empty attack lists or explicit proficiency overrides',()=>{
 const c=hero();c.equipment=[];c.attacks=[]
 expect(combatAttacks(c)).toEqual([])
 expect(equipmentAttacks(c,{name:'Rope',qty:1,weight:1,equipped:false,notes:''})).toEqual([])
 expect(weaponProficient(c,{name:'Custom',ability:'str',range:'',damageDice:'',damageType:'',damageBonus:0,magicBonus:0,notes:'',proficient:false})).toBe(false)
 expect(characterBenefits).not.toHaveBeenCalled()
})
