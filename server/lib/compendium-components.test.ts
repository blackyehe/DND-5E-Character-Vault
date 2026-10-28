import {beforeEach,describe,expect,it,vi} from 'vitest'
import {Types,mongo} from 'mongoose'
import {encodePrepared} from './compendium-prepared-codec'

const state=vi.hoisted(()=>({manifests:[] as any[],objects:[] as any[],close:vi.fn(),aggregate:vi.fn()}))
vi.mock('../models/CompendiumComponent',()=>({
 CompendiumComponent:{find:()=>({select(){return this},setOptions(){return this},lean:async()=>state.manifests})},
 CompendiumComponentObject:{collection:{name:'componentobjects'},
  find:()=>({select(){return this},sort(){return this},setOptions(){return this},lean(){return this},cursor:()=>({async *[Symbol.asyncIterator](){yield* state.objects},close:state.close})}),
  aggregate:(pipeline:unknown)=>{state.aggregate(pipeline);return {option(){return this},cursor:()=>({async *[Symbol.asyncIterator](){yield* state.objects},close:state.close})}},
 },
}))
import {componentContext,readComponentCatalogues,type PackMetadata} from './compendium-components'

const owner=new Types.ObjectId(),pack:PackMetadata={_id:new Types.ObjectId(),userId:owner,sourceHash:'a'.repeat(64),updatedAt:new Date('2026-10-27'),data:{filename:'test.orcbrew'}}
const entry={index:'homebrew-spells-example',name:'Example',contentKey:'example',source:'test',disabled:false,legacyKey:'example',details:{}}
beforeEach(()=>{
 state.close.mockClear()
 state.aggregate.mockClear()
 state.manifests=[{context:componentContext(pack),generation:'generation',counts:{spells:1},bytes:{spells:Buffer.byteLength(JSON.stringify([entry]))}}]
 state.objects=encodePrepared([entry],1024).map(chunk=>({...chunk,generation:'generation',kind:'spells',payload:new mongo.Binary(chunk.payload)}))
})

describe('verified empty catalogue summaries',()=>{
 function emptyLibrary(){
  const packs=Array.from({length:32},()=>({...pack,_id:new Types.ObjectId()}))
  state.manifests=packs.map((p,i)=>({context:componentContext(p),generation:'generation-'+i,counts:{spells:0},bytes:{spells:2}}))
  state.objects=[{kind:'spells',emptyGenerations:state.manifests.map(m=>m.generation)}]
  return packs
 }
 it('expands complete proofs and scopes both aggregation scans to the owner',async()=>{
  const packs=emptyLibrary(),result=await readComponentCatalogues(String(owner),'spells',packs,false)
  expect(result?.length).toBe(32);expect(result?.every(p=>p.parsed.entries.spells.length===0)).toBe(true)
  const pipeline=state.aggregate.mock.calls[0]![0]
  expect(pipeline[0].$match.userId).toEqual(owner)
  expect(pipeline[3].$unionWith.pipeline[0].$match.userId).toEqual(owner)
  expect(state.close).toHaveBeenCalledOnce()
 })
 it('does not infer a missing empty object from its manifest',async()=>{
  const packs=emptyLibrary();state.objects[0].emptyGenerations.pop()
  expect(await readComponentCatalogues(String(owner),'spells',packs,false)).toBeNull()
  expect(state.close).toHaveBeenCalledOnce()
 })
 it('rejects an extra raw chunk beside a verified empty object',async()=>{
  const packs=emptyLibrary(),chunk=encodePrepared([],2)[0]!
  state.objects.push({...chunk,part:1,parts:2,generation:'generation-0',kind:'spells'})
  expect(await readComponentCatalogues(String(owner),'spells',packs,false)).toBeNull()
 })
 it('still verifies raw corrupt chunks returned alongside summaries',async()=>{
  const packs=emptyLibrary();state.objects[0].emptyGenerations.shift()
  state.objects.push({...encodePrepared([],2)[0]!,payload:Buffer.from('corrupt'),generation:'generation-0',kind:'spells'})
  expect(await readComponentCatalogues(String(owner),'spells',packs,false)).toBeNull()
 })
 it('uses the original scan when grouped generation strings exceed the budget',async()=>{
  const packs=emptyLibrary(),chunk=encodePrepared([],2)[0]!
  state.manifests.forEach((m,i)=>{m.generation=String(i)+'x'.repeat(17000)})
  state.objects=state.manifests.map(m=>({...chunk,generation:m.generation,kind:'spells'}))
  expect((await readComponentCatalogues(String(owner),'spells',packs,false))?.length).toBe(32)
  expect(state.aggregate).not.toHaveBeenCalled()
 })
})
describe('lean prepared component catalogue reads',()=>{
 it('accepts real BSON Binary payloads and returns the verified entries',async()=>{
  expect(typeof state.objects[0].payload.length).toBe('function')
  const result=await readComponentCatalogues(String(owner),'spells',[pack],false)
  expect(result?.[0]?.parsed.entries.spells).toEqual([entry]);expect(state.close).toHaveBeenCalledOnce()
 })
 it('continues to accept hydrated Buffer payloads',async()=>{
  state.objects=state.objects.map(o=>({...o,payload:Buffer.from(o.payload.buffer.subarray(0,o.payload.position))}))
  expect((await readComponentCatalogues(String(owner),['spells'],[pack],false))?.[0]?.parsed.entries.spells).toEqual([entry])
 })
 it('rejects invalid Binary bounds and closes the cursor',async()=>{
  state.objects[0].payload.position=state.objects[0].payload.buffer.byteLength+1
  expect(await readComponentCatalogues(String(owner),'spells',[pack],false)).toBeNull()
  expect(state.close).toHaveBeenCalledOnce()
 })
})
