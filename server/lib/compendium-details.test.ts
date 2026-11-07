import {beforeEach,describe,expect,it,vi} from 'vitest'
const state=vi.hoisted(()=>({revision:'a',enrichment:'a',detail:vi.fn(),users:vi.fn(),preload:vi.fn(),catalogue:vi.fn(),admit:vi.fn()}))
vi.mock('./compendium-browse',()=>({browseRevision:async()=>state.revision,personalBrowseEntryAtRevision:state.detail,BrowseRevisionChanged:class extends Error{},preloadBrowseEntry:state.preload,cachedBrowseIndex:state.catalogue,rememberValidatedBrowseIndex:state.admit}))
vi.mock('../models/CustomContent',()=>({CustomContent:{find:(filter:unknown)=>{state.users(filter);const q={select:()=>q,sort:()=>q,lean:async()=>[{_id:'enrichment',updatedAt:state.enrichment}]};return q}}}))
import {compendiumDetail,compendiumDetailRevision,compendiumDetailBatch} from './compendium-details'
import {BrowseRevisionChanged} from './compendium-browse'
beforeEach(()=>{state.revision='a';state.enrichment='a';state.users.mockClear();state.detail.mockReset();state.detail.mockResolvedValue({index:'one',name:'Entry',url:'',desc:['Full rules']});state.preload.mockReset();state.catalogue.mockReset();state.catalogue.mockResolvedValue(null);state.admit.mockReset();state.preload.mockImplementation(async(_owner,_kind,index)=>({index,name:index,url:'',desc:['Complete rules']}))})
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
describe('bounded optional detail batch',()=>{
 it('shares a stable revision, retains full rules, and scopes every read to its owner',async()=>{
  const result=await compendiumDetailBatch('owner','spells',['one','two','three'],512*1024)
  expect(result).toMatchObject({owner:'owner',kind:'spells',skipped:[],entries:[{index:'one',entry:{desc:['Complete rules']}},{index:'two'},{index:'three'}]})
  expect(state.preload.mock.calls.every(([owner,kind,,revision])=>owner==='owner'&&kind==='spells'&&revision==='a')).toBe(true)
  expect(state.detail).not.toHaveBeenCalled();expect(state.catalogue).not.toHaveBeenCalled()
 })
 it('rejects oversized/duplicate requests and respects a smaller response budget',async()=>{
  for(const indexes of [[],['one','one'],['a','b','c','d'],['x'.repeat(257)]])await expect(compendiumDetailBatch('owner','spells',indexes,512*1024)).rejects.toThrow('Invalid')
  state.preload.mockImplementation(async(_o,_k,index)=>({index,name:index,url:'',desc:['x'.repeat(1500)]}))
  const result=await compendiumDetailBatch('owner','spells',['one','two'],2048)
  expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThanOrEqual(2048);expect(result?.entries).toHaveLength(1);expect(result?.skipped).toEqual(['two'])
 })
 it('skips unprepared, failed and oversized entries without hiding another valid entry',async()=>{
  state.preload.mockResolvedValueOnce(null).mockRejectedValueOnce(Error('Unavailable')).mockResolvedValueOnce({index:'three',name:'Huge',url:'',desc:['x'.repeat(256*1024)]})
  expect((await compendiumDetailBatch('owner','classes',['one','two','three'],512*1024))?.entries).toEqual([])
 })
 it('discards edits or monster enrichment racing a batch, without background retries',async()=>{
  state.preload.mockImplementationOnce(async()=>{state.revision='b';return {index:'one',name:'Old',url:''}})
  expect(await compendiumDetailBatch('owner','spells',['one'],512*1024)).toBeNull();expect(state.preload).toHaveBeenCalledTimes(1)
  state.preload.mockImplementationOnce(async()=>{state.enrichment='b';return {index:'one',name:'Old',url:''}})
  expect(await compendiumDetailBatch('owner','monsters',['one'],512*1024)).toBeNull()
 })
 it('stops after cancellation and uses only a cached locator for imported entries',async()=>{
  let stopped=false;state.catalogue.mockResolvedValue({records:[{entry:{index:'homebrew-one',name:'Locator'}}]})
  state.preload.mockImplementationOnce(async()=>{stopped=true;return {index:'homebrew-one',name:'Entry',url:''}})
  expect(await compendiumDetailBatch('owner','classes',['homebrew-one','two'],512*1024,()=>stopped)).toBeNull()
  expect(state.catalogue).toHaveBeenCalledWith('owner','classes','a');expect(state.preload).toHaveBeenCalledTimes(1);expect(state.preload.mock.calls[0]![4]).toMatchObject({name:'Locator'})
  expect(state.admit).not.toHaveBeenCalled()
 })
 it('reuses the normal index cache only after a stable imported batch',async()=>{
  const index={records:[{entry:{index:'homebrew-one',name:'Locator'}}]};state.catalogue.mockResolvedValue(index)
  expect(await compendiumDetailBatch('owner','classes',['homebrew-one'],512*1024)).not.toBeNull()
  expect(state.admit).toHaveBeenCalledWith('owner','classes','a',index)
  state.admit.mockClear();state.preload.mockImplementationOnce(async()=>{state.revision='changed';return null})
  expect(await compendiumDetailBatch('owner','classes',['homebrew-one'],512*1024)).toBeNull();expect(state.admit).not.toHaveBeenCalled()
 })
})
