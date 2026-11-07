import {beforeEach,describe,expect,it,vi} from 'vitest'
import {browseIndex,browseRecord} from '../../shared/compendium-browse'
const state=vi.hoisted(()=>({revision:'a'.repeat(64),spells:'Original spell',items:'Original item'}))
vi.mock('./compendium-browse',()=>({compendiumBrowseIndex:async(_owner:string,kind:string)=>({revision:state.revision,index:browseIndex([browseRecord({index:kind,name:kind==='spells'?state.spells:state.items,url:''},kind as any)],kind as any)})}))
import {localCompendiumIdentity} from './local-compendium'
beforeEach(()=>{state.revision='a'.repeat(64);state.spells='Original spell';state.items='Original item'})
describe('content-aware category identity',()=>{
 it('keeps an untouched category digest when the library revision changes',async()=>{
  const spells=await localCompendiumIdentity('owner','spells'),items=await localCompendiumIdentity('owner','magic-items')
  state.revision='b'.repeat(64);state.items='New item'
  const nextSpells=await localCompendiumIdentity('owner','spells'),nextItems=await localCompendiumIdentity('owner','magic-items')
  expect(nextSpells.revision).not.toBe(spells.revision)
  expect(nextSpells.digest).toBe(spells.digest)
  expect(nextItems.digest).not.toBe(items.digest)
  expect(nextItems).toMatchObject({owner:'owner',kind:'magic-items',version:'local-compendium-1'})
 })
})
