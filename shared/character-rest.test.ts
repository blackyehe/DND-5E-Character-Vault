import {expect,it} from 'vitest'
import {emptyCharacter,type Character} from './character'
import {restUpdate} from './character-rest'
import {playUpdate} from './rooms'
import {applyPlayUpdate,playUpdateSchema} from '../server/lib/play-update'
import {resolveCharacterProgression} from './character-progression'
function hero():Character{
 const c={...emptyCharacter(),_id:'hero',updatedAt:'2026-11-09T12:00:00.000Z'}
 c.combat.hpCurrent=3;c.combat.hitDiceUsed=2;c.spellcasting.known=['light'];c.spellcasting.prepared=['light'];c.spellcasting.activeEffects=['light']
 c.spellcasting.slots={l1:{max:4,used:3,recovery:'long'},l2:{max:2,used:1,recovery:'short'}}
 c.resources=[{id:'short',name:'Short',max:3,used:2,recovery:'short'},{id:'long',name:'Long',max:4,used:3,recovery:'long'},{id:'manual',name:'Manual',max:5,used:4,recovery:'manual'},{id:'unlimited',name:'Unlimited',max:1,used:1,unlimited:true,recovery:'long'}]
 return c
}
it('recovers only short-rest slots and resources on a short rest',()=>{
 const patch=restUpdate(hero(),'short');expect(patch.spellcasting.slots).toMatchObject({l1:{max:4,used:3},l2:{max:2,used:0}});expect(patch.resources.map(r=>r.used)).toEqual([0,3,4,1])
})
it('recovers short/long trackers while preserving manual uses, unlimited uses, spell choices, HP and hit dice',()=>{
 const c=hero(),saved=JSON.stringify(c),patch=restUpdate(c,'long');expect(patch.resources.map(r=>r.used)).toEqual([0,0,4,1]);expect(patch.spellcasting.slots).toMatchObject({l1:{used:0},l2:{used:0}})
 expect(patch.spellcasting.known).toEqual(['light']);expect(patch.spellcasting.prepared).toEqual(['light']);expect(patch.spellcasting.activeEffects).toEqual(['light']);expect(Object.keys(patch).sort()).toEqual(['resources','spellcasting']);expect(JSON.stringify(c)).toBe(saved)
})
it('keeps legacy warlock and ordinary slot recovery defaults',()=>{
 const c=hero();c.spellcasting.slots={l1:{max:2,used:1}};c.meta.klass='Wizard';expect(restUpdate(c,'short').spellcasting.slots.l1?.used).toBe(1);c.meta.klass='Warlock';expect(restUpdate(c,'short').spellcasting.slots.l1?.used).toBe(0)
})
it('passes the existing player play-state boundary without submitting maxima or permanent changes',()=>{
 const c=resolveCharacterProgression(hero()),update=playUpdate(c,restUpdate(c,'long')),parsed=playUpdateSchema.parse(update),set=applyPlayUpdate(c,parsed)
 expect(update.resources).toEqual([{id:'short',used:0},{id:'long',used:0}]);expect(update.slots).toEqual([{key:'l1',used:0},{key:'l2',used:0}]);expect(update.combat).toBeUndefined();expect(set.resources).toMatchObject([{max:3,used:0},{max:4,used:0},{used:4},{unlimited:true,used:1}])
})
