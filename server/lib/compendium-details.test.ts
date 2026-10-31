import {beforeEach,describe,expect,it,vi} from 'vitest'
const state=vi.hoisted(()=>({revision:'a',enrichment:'a',detail:vi.fn(),users:vi.fn()}))
vi.mock('./compendium-browse',()=>({browseRevision:async()=>state.revision,personalBrowseEntryAtRevision:state.detail,BrowseRevisionChanged:class extends Error{}}))
vi.mock('../models/CustomContent',()=>({CustomContent:{find:(filter:unknown)=>{state.users(filter);const q={select:()=>q,sort:()=>q,lean:async()=>[{_id:'enrichment',updatedAt:state.enrichment}]};return q}}}))
import {compendiumDetail,compendiumDetailRevision} from './compendium-details'
import {BrowseRevisionChanged} from './compendium-browse'
beforeEach(()=>{state.revision='a';state.enrichment='a';state.users.mockClear();state.detail.mockReset();state.detail.mockResolvedValue({index:'one',name:'Entry',url:'',desc:['Full rules']})})
describe('versioned personal entry details',()=>{
 it('includes enrichment changes for monsters without invalidating other category details',async()=>{
  const monster=await compendiumDetailRevision('owner','monsters'),spell=await compendiumDetailRevision('owner','spells')
  state.enrichment='b'
  expect((await compendiumDetailRevision('owner','monsters')).revision).not.toBe(monster.revision)
  expect((await compendiumDetailRevision('owner','spells')).revision).toBe(spell.revision)
  expect(state.users).toHaveBeenCalledWith({userId:'owner',type:'monster-enrichment',sourceHash:'active'})
 })
 it('retries an edit racing the detail read and stamps only the stable result',async()=>{
  state.detail.mockImplementationOnce(async()=>{state.revision='b';return {index:'one',name:'Old',url:''}})
  const result=await compendiumDetail('owner','spells','one')
  expect(result?.entry.name).toBe('Entry');expect(state.detail).toHaveBeenCalledTimes(2)
  expect(result).toMatchObject({owner:'owner',kind:'spells',index:'one',version:'compendium-details-1'})
  expect(state.detail).toHaveBeenNthCalledWith(1,'owner','spells','one','a')
  expect(state.detail).toHaveBeenNthCalledWith(2,'owner','spells','one','b')
 })
 it('restarts with the new revision when the source locator observes an index change',async()=>{
  state.detail.mockImplementationOnce(async()=>{state.revision='b';throw new BrowseRevisionChanged()})
  expect((await compendiumDetail('owner','spells','one'))?.entry.name).toBe('Entry')
  expect(state.detail).toHaveBeenNthCalledWith(2,'owner','spells','one','b')
 })
 it('does not stamp monster rules assembled across an enrichment change',async()=>{
  state.detail.mockImplementationOnce(async()=>{state.enrichment='b';return {index:'one',name:'Old',url:''}})
  expect((await compendiumDetail('owner','monsters','one'))?.entry.name).toBe('Entry')
  expect(state.detail).toHaveBeenCalledTimes(2)
 })
 it('preserves source failures instead of masking them as mutation retries',async()=>{
  state.detail.mockRejectedValue(new Error('Source unavailable'))
  await expect(compendiumDetail('owner','spells','one')).rejects.toThrow('Source unavailable')
  expect(state.detail).toHaveBeenCalledTimes(1)
 })
 it('never returns a deleted entry or one assembled during continuous mutations',async()=>{
  state.detail.mockResolvedValueOnce(null)
  expect(await compendiumDetail('owner','spells','deleted')).toBeNull()
  state.detail.mockImplementation(async()=>{state.revision+='x';return {index:'one',name:'Old',url:''}})
  await expect(compendiumDetail('owner','spells','one')).rejects.toThrow('changing')
 })
})
