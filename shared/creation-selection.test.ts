import {expect,it} from 'vitest'
import {creationSelection} from './creation-selection'
import {subclassMatchesClass} from './subclass-identity'
import {subraceMatchesRace} from './subrace-options'
it('retains source identities while removing full rules, editor copies and traits',()=>{
 const full={index:'version-a',name:'Option',displayName:'Option · Book',contentKey:'option',sourcePack:'Book',aliases:['old'],description:'rules'.repeat(10000),details:{':help':'large'},workshop:{description:'large'},homebrew_traits:[{description:'large'}]}
 const row=creationSelection('classes',full);expect(row).toEqual({index:'version-a',name:'Option',url:'',selectionOnly:true,homebrew:true,displayName:'Option · Book',contentKey:'option',sourcePack:'Book',aliases:['old']});expect(JSON.stringify(row).length).toBeLessThan(300)
})
it('preserves imported and authored subclass and subrace parent matching',()=>{
 for(const full of [{index:'subclass',name:'Subclass',details:{':class':':wizard'}},{index:'subclass',name:'Subclass',workshop:{parentClass:'wizard'}}])expect(subclassMatchesClass(creationSelection('subclasses',full),{index:'wizard',name:'Wizard'})).toBe(true)
 for(const full of [{index:'subrace',name:'Subrace',race:{index:'elf'}},{index:'subrace',name:'Subrace',optionBuilder:{subrace:{parentIndex:'elf'}}}])expect(subraceMatchesRace(creationSelection('subraces',full),{index:'elf',name:'Elf'})).toBe(true)
})
it('retains spell level and class filters without downloading spell descriptions',()=>{
 expect(creationSelection('spells',{index:'spell',name:'Spell',level:2,classes:[{index:'wizard',name:'Wizard',url:'/url'}],desc:['large']})).toMatchObject({level:2,classes:[{index:'wizard',name:'Wizard',url:''}]})
})
