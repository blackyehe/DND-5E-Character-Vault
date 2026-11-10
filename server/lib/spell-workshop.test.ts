import {expect,it} from 'vitest'
import {newSpellDraft,restoreSpellDraft} from '../../shared/spell-workshop'
import {validatedSpell,spellRecord,spellKey,nativeSpell} from './spell-workshop'
import {placeNativeEntry} from './workshop-pack'
import {inspectOrcbrew,buildOrcbrewCatalog} from './orcbrew'
import {archiveDefinition,restoreDefinition} from './workshop-trash'
function authored(){const d=newSpellDraft();Object.assign(d.body,{name:'Arcane Spark',description:'First paragraph.\n\nSecond paragraph.',higherLevel:'More sparks.',school:'evocation',castingTime:'1 bonus action',range:'90 feet',duration:'1 minute',concentration:true,ritual:true,components:['V','S','M'],material:'A crystal',attackType:'ranged',saveAbility:'dex',saveSuccess:'half',damageType:'lightning',damage:{'1':'1d8','5':'2d8'},healing:{'1':'1d4'},areaType:'sphere',areaSize:10,classes:['wizard']});d.benefits=[{type:'ac-bonus',value:1,level:1}];return d}
function pack(d:ReturnType<typeof authored>){return placeNativeEntry(undefined,'spells',spellKey(d.id),spellRecord(d,1,[]),d.id,':codex/spell')}
it('round-trips the existing spell builder fields, effects and character-level cantrip scaling through a pack',()=>{
 const d=validatedSpell(authored()),source=pack(d),entry=inspectOrcbrew(source).entries.spells[0]!
 expect(nativeSpell(entry)).toMatchObject(d);expect(restoreSpellDraft(d)).toEqual(d)
 expect(entry).toMatchObject({name:d.body.name,spellId:d.id,spellRevision:1,desc:['First paragraph.','Second paragraph.'],higher_level:['More sparks.'],concentration:true,ritual:true,material:'A crystal',casting_time:'1 bonus action',range:'90 feet',attack_type:'ranged',dc:{dc_type:{index:'dex'},dc_success:'half'},damage:{damage_type:{index:'lightning'},damage_at_character_level:{'5':'2d8'}},heal_at_slot_level:{'1':'1d4'},area_of_effect:{type:'sphere',size:10},classes:[{index:'wizard'}],benefits:d.benefits})
 d.body.level=2;expect(inspectOrcbrew(pack(d)).entries.spells[0]!.damage).toMatchObject({damage_at_slot_level:d.body.damage})
})
it('replaces only its saved entry and keeps previous references, unrelated EDN and an explicit benefit removal',()=>{
 const d=authored(),source=pack(d),first=inspectOrcbrew(source).entries.spells[0]!,original=source.replace(/}\s*$/,':unrelated [1 2 3]\n}\n')+'; Keep this comment\n'
 d.body.name='Renamed spark';d.benefits=[]
 const updated=placeNativeEntry(original,'spells',spellKey(d.id),spellRecord(d,2,[first.index],first),d.id,':codex/spell'),parsed=inspectOrcbrew(updated)
 expect(updated).toContain('; Keep this comment');expect(updated).toContain(':unrelated [1 2 3]');expect(parsed.entries.spells).toHaveLength(1)
 const catalog=buildOrcbrewCatalog([{id:'pack',filename:'Spells.orcbrew',parsed}]);expect(catalog.spells[0]!.aliases).toContain(first.index);expect(catalog.spells[0]!.spellId).toBe(d.id);expect(nativeSpell(parsed.entries.spells[0]!)!.benefits).toEqual([])
 const archived=archiveDefinition(updated,'spell',parsed.entries.spells[0]!);expect(inspectOrcbrew(archived.source).entries.spells).toEqual([]);expect(inspectOrcbrew(restoreDefinition(archived.source,archived.parts)).entries.spells[0]!.name).toBe('Renamed spark')
})
it('rejects invalid builder values and benefits while retaining incomplete device drafts',()=>{
 expect(restoreSpellDraft(newSpellDraft()).body.name).toBe('')
 const d=authored();d.body.level=10;expect(()=>validatedSpell(d)).toThrow();d.body.level=0;d.benefits=[{type:'spell-attack-bonus',value:100}];expect(()=>validatedSpell(d)).toThrow(/Benefit/)
 expect(()=>restoreSpellDraft({...newSpellDraft(),body:{name:'Broken'}})).toThrow()
})
