import { describe, it, expect, vi, beforeEach } from 'vitest'
import { newWorkshopDraft } from '../../shared/homebrew-workshop'
import { EDITABLE_KINDS } from '../../shared/compendium-editing'
const fixture=vi.hoisted(()=>({entries:Object.fromEntries(['spells','equipment','magic-items','classes','subclasses','races','subraces','monsters','backgrounds','feats','invocations','boons','selections','languages','other'].map(kind=>[kind,[]])) as Record<string,any[]>,item:null as any,read:vi.fn()}))
vi.mock('./compendium-browse',()=>({browseEntrySource:async(user:string,kind:string,index:string)=>user==='owner'?fixture.entries[kind]?.find(e=>e.index===index)??null:null}))
vi.mock('../models/CustomContent',()=>({CustomContent:{findOne:(filter:Record<string,unknown>)=>({lean:async()=>filter.userId==='owner'?fixture.item:null})}}))
vi.mock('../env',()=>({env:{SRD_API_URL:'https://fixture.invalid'}}))
vi.mock('./srd-client',()=>({readSrdRule:fixture.read}))
vi.mock('./monster-enrichment',()=>({enrichedMonsterEntries:async(_user:string,entries:unknown)=>entries,enrichedStandardMonster:(entry:unknown)=>entry}))
import { compendiumSource } from './compendium-source'
beforeEach(()=>{for(const kind of EDITABLE_KINDS)fixture.entries[kind]=[];fixture.item=null;fixture.read.mockReset()})
describe('editable source resolution',()=>{
  it('returns full native rules with their Workshop editor data and preserved raw source',async()=>{
    const draft=newWorkshopDraft();draft.name='Native class';draft.skillCount=0
    fixture.entries.classes=[{index:'homebrew-classes-test',name:draft.name,contentKey:'native-class',aliases:[],workshop:draft,details:{':codex/workshop':draft,':unknown':{zero:0,enabled:false}}}]
    const entry=await compendiumSource('owner','classes','homebrew-classes-test')
    expect(entry?.workshop).toMatchObject({id:draft.id,name:draft.name});expect(entry?.details).toHaveProperty(':unknown',{zero:0,enabled:false})
    expect(await compendiumSource('stranger','classes','homebrew-classes-test')).toBeNull()
  })
  it('reads standard spell data locally and keeps it available without an upstream request',async()=>{const entry=await compendiumSource('owner','spells','acid-arrow');expect(entry?.name).toBe('Acid Arrow');expect(Array.isArray(entry?.desc)).toBe(true);expect(fixture.read).not.toHaveBeenCalled()})
  it('validates standard reference paths before making an upstream request',async()=>{expect(await compendiumSource('owner','classes','bad.path')).toBeNull();expect(fixture.read).not.toHaveBeenCalled();fixture.read.mockResolvedValue({index:'wizard',name:'Wizard'});expect(await compendiumSource('owner','classes','wizard')).toMatchObject({name:'Wizard'});expect(fixture.read).toHaveBeenCalledWith('https://fixture.invalid','classes/wizard',{interactive:true})})
  it('keeps personal item lookups account-scoped and category-correct',async()=>{
    fixture.item={_id:'a'.repeat(24),data:{name:'Personal item',qty:1,weight:2,equipped:false,notes:'',kind:'gear',magical:false}}
    expect(await compendiumSource('owner','equipment',`workshop-item-${'a'.repeat(24)}`)).toMatchObject({name:'Personal item',workshopItem:{name:'Personal item'}})
    expect(await compendiumSource('stranger','equipment',`workshop-item-${'a'.repeat(24)}`)).toBeNull()
    expect(await compendiumSource('owner','magic-items',`workshop-item-${'a'.repeat(24)}`)).toBeNull()
  })
})
