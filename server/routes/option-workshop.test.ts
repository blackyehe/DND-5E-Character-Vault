import mongoose from 'mongoose'
import {afterAll,beforeAll,beforeEach,expect,it,vi} from 'vitest'
import express from 'express'
import type {Server} from 'node:http'
import {newOptionDraft,type OptionDraft} from '../../shared/option-workshop'
import {inspectOrcbrew,sourceHash} from '../lib/orcbrew'
import {nativeOption,optionRecord,optionKey} from '../lib/option-workshop'
import {placeOptionEntry} from '../lib/workshop-pack'
const mocks=vi.hoisted(()=>({library:vi.fn(),read:vi.fn(),write:vi.fn(),create:vi.fn()}))
vi.mock('../lib/option-authoring-library',()=>({optionAuthoringLibrary:mocks.library}))
vi.mock('../lib/pack-source',()=>({readPackDocuments:mocks.read}))
vi.mock('../models/CustomContent',()=>({CustomContent:{findOneAndUpdate:(...args:unknown[])=>({lean:()=>mocks.write(...args)}),find:()=>({setOptions(){return this},lean:async()=>[]}),createIndexes:async()=>{},create:async(values:any)=>{const rows=Array.isArray(values)?values:[values];return rows[0].type==='compendium-edit'?rows:[await mocks.create(rows[0])]}}}))
import router from './option-workshop'
let server:Server,base:string
const packId='a'.repeat(24),draft=newOptionDraft('feats');draft.body.name='Zhaerin Contractor'
const source=placeOptionEntry(undefined,'feats',optionKey(draft.id),optionRecord(draft,1,[]),draft.id),pack={id:packId,filename:'Blacky.orcbrew',includeDisabled:false,parsed:inspectOrcbrew(source)},entry=pack.parsed.entries.feats[0]!,hash=sourceHash(source)
const oldDraft={...nativeOption(entry)!,published:{revision:1,index:entry.index,packId,packHash:hash}},doc={_id:packId,userId:'owner',type:'orcbrew',updatedAt:new Date('2026-11-09'),data:{filename:pack.filename,source}}
beforeAll(async()=>{vi.spyOn(mongoose.connection,'transaction').mockImplementation(async(fn:any)=>fn({}));const app=express();app.use(express.json());app.use((req,res,next)=>{if(req.get('x-user')!=='owner')return res.sendStatus(401);req.userId='owner';next()});app.use(router);server=await new Promise<Server>(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s))});const address=server.address();if(!address||typeof address==='string')throw Error('No address');base=`http://127.0.0.1:${address.port}`})
afterAll(()=>new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve())))
beforeEach(()=>{vi.clearAllMocks();mocks.library.mockResolvedValue({lib:{packs:[pack],hashes:new Map([[packId,hash]]),warnings:[]},rows:[{pack,entry,draft:nativeOption(entry)}]});mocks.read.mockResolvedValue([doc]);mocks.write.mockResolvedValue({...doc,updatedAt:new Date()});mocks.create.mockResolvedValue({_id:packId})})
async function request(body:unknown){return fetch(base+'/publish',{method:'POST',headers:{'Content-Type':'application/json','x-user':'owner',connection:'close'},body:JSON.stringify(body)})}
function payload(){return {draft:{...oldDraft,benefits:[{type:'spell-attack-bonus',value:1},{type:'spell-dc-bonus',value:1}]},target:{packId,expectedHash:hash},expectedRevision:1}}
it('reads only the target pack source and returns its new hash without a post-save library rebuild',async()=>{
 const response=await request(payload());expect(response.status).toBe(200);const result=await response.json() as {draft:OptionDraft;pack:unknown};expect(mocks.read).toHaveBeenCalledExactlyOnceWith('owner',packId);expect(mocks.library).toHaveBeenCalledExactlyOnceWith('owner');expect(result.pack).toEqual({id:packId,filename:pack.filename,hash:result.draft.published!.packHash});expect(result.draft.published!.revision).toBe(2);expect(result.draft.benefits).toEqual(payload().draft.benefits)
 const [filter,update]=mocks.write.mock.calls[0]!;expect(filter).toMatchObject({_id:packId,userId:'owner',updatedAt:doc.updatedAt});const saved=inspectOrcbrew(update.$set.data.source);expect(nativeOption(saved.entries.feats[0]!)!.benefits).toEqual(payload().draft.benefits)
})
it('keeps using already-read source documents on the legacy path',async()=>{
 const library=await mocks.library();mocks.library.mockResolvedValue({...library,lib:{...library.lib,docs:[doc]}})
 expect((await request(payload())).status).toBe(200);expect(mocks.read).not.toHaveBeenCalled()
})
it.each(['hash','revision','missing','concurrent'])('rejects a %s source conflict without overwriting a pack',async condition=>{
 const body=payload();if(condition==='hash')body.target.expectedHash='b'.repeat(64)
 if(condition==='revision')body.expectedRevision=0
 if(condition==='missing')mocks.read.mockResolvedValue([])
 if(condition==='concurrent')mocks.write.mockResolvedValue(null)
 const response=await request(body);expect(response.status).toBe(condition==='missing'?404:409);if(condition!=='concurrent')expect(mocks.write).not.toHaveBeenCalled();expect(mocks.create).not.toHaveBeenCalled()
})
it('does not save a new copy of an existing option in another pack',async()=>{
 const body=payload();body.target.packId='b'.repeat(24);expect((await request(body)).status).toBe(409);expect(mocks.read).not.toHaveBeenCalled();expect(mocks.write).not.toHaveBeenCalled()
})
