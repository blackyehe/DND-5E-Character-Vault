import {beforeEach,describe,expect,it,vi} from 'vitest'
import {Types,mongo} from 'mongoose'
import {encodePrepared} from './compendium-prepared-codec'

const state=vi.hoisted(()=>({manifests:[] as any[],objects:[] as any[],close:vi.fn()}))
vi.mock('../models/CompendiumComponent',()=>({
 CompendiumComponent:{find:()=>({select(){return this},setOptions(){return this},lean:async()=>state.manifests})},
 CompendiumComponentObject:{find:()=>({select(){return this},sort(){return this},setOptions(){return this},lean(){return this},cursor:()=>({async *[Symbol.asyncIterator](){yield* state.objects},close:state.close})})},
}))
import {componentContext,readComponentCatalogues,type PackMetadata} from './compendium-components'

const owner=new Types.ObjectId(),pack:PackMetadata={_id:new Types.ObjectId(),userId:owner,sourceHash:'a'.repeat(64),updatedAt:new Date('2026-10-27'),data:{filename:'test.orcbrew'}}
const entry={index:'homebrew-spells-example',name:'Example',contentKey:'example',source:'test',disabled:false,legacyKey:'example',details:{}}
beforeEach(()=>{
 state.close.mockClear()
 state.manifests=[{context:componentContext(pack),generation:'generation',counts:{spells:1},bytes:{spells:Buffer.byteLength(JSON.stringify([entry]))}}]
 state.objects=encodePrepared([entry],1024).map(chunk=>({...chunk,generation:'generation',kind:'spells',payload:new mongo.Binary(chunk.payload)}))
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
