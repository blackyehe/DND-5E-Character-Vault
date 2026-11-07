import {beforeEach,expect,it,vi} from 'vitest'
import {localSrdRule} from './srd-snapshot'
const remote=vi.hoisted(()=>vi.fn())
vi.mock('./srd-client',()=>({readSrdRule:remote}))
const source=(spell='shield')=>JSON.stringify({':orcpub.entity/values':{':character-name':'Fixture hero'},':orcpub.entity/options':{':equipment':[{':orcpub.entity/key':':dagger'}],':spells-known':[{':orcpub.entity/key':':'+spell}]}})
beforeEach(()=>{remote.mockReset().mockResolvedValue(null)})
it('uses existing local 2014 spell/equipment rules without upstream requests',async()=>{
 const {previewDmvCharacter}=await import('./dmv-import'),before=JSON.stringify(localSrdRule('equipment/dagger')),p=await previewDmvCharacter(source(),' ',{},'https://www.dnd5eapi.co/api/2014')
 expect(remote).not.toHaveBeenCalled();expect(p.character.spellcasting.known).toContain('shield');expect(p.character.equipment[0]?.name).toBe('Dagger');expect(p.character.attacks[0]?.damageDice).toBe('1d4');expect(JSON.stringify(localSrdRule('equipment/dagger'))).toBe(before)
})
it('retains remote and custom-definition fallback when a rule is not in the snapshot',async()=>{
 const {previewDmvCharacter}=await import('./dmv-import'),p=await previewDmvCharacter(source('fixture-spell'),'',{spells:[{name:'Fixture Spell',contentKey:'fixture-spell',index:'homebrew-fixture',sourcePack:'Fixture'}]},'https://www.dnd5eapi.co/api/2014')
 expect(remote).toHaveBeenCalledExactlyOnceWith('https://www.dnd5eapi.co/api/2014','spells/fixture-spell');expect(p.character.spellcasting.known).toContain('homebrew-fixture')
})
it('respects an explicitly configured alternate rules service for known entries too',async()=>{
 remote.mockImplementation(async(_base,path)=>path==='equipment/dagger'?{index:'dagger',name:'Alternate dagger',weight:2}:path==='spells/shield'?{index:'alternate-shield',name:'Shield'}:null)
 const {previewDmvCharacter}=await import('./dmv-import'),p=await previewDmvCharacter(source(),'',{},'https://rules.fixture/api/2014')
 expect(remote).toHaveBeenCalledTimes(2);expect(p.character.equipment[0]?.name).toBe('Alternate dagger');expect(p.character.spellcasting.known).toContain('alternate-shield')
})
