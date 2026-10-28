import {afterAll,beforeAll,beforeEach,describe,expect,it,vi} from 'vitest'
import express,{type NextFunction,type Request,type Response} from 'express'
import type {Server} from 'node:http'

const state=vi.hoisted(()=>({etag:'"'+'a'.repeat(64)+'"',catalog:{classes:[],races:[],backgrounds:[],subraces:[],subclasses:[],feats:[],languages:[],spells:[]},read:vi.fn()}))
vi.mock('../lib/creation-catalog',()=>({creationCatalogResponse:async(owner:string,revision?:string)=>{
 state.read(owner,revision)
 return {etag:state.etag,...(revision?.replace(/^W\//,'')===state.etag?{}:{catalog:state.catalog})}
}}))
vi.mock('../middleware/auth',()=>({requireAuth:(req:Request,res:Response,next:NextFunction)=>{
 if(req.get('x-test-user')!=='owner')return res.status(401).json({error:'Unauthorized'})
 req.userId='owner';next()
}}))
import router from './content'
let server:Server,base:string
beforeAll(async()=>{
 const app=express();app.use('/api/content',router)
 server=await new Promise<Server>(resolve=>{const listener=app.listen(0,'127.0.0.1',()=>resolve(listener))})
 const address=server.address();if(!address||typeof address==='string')throw Error('Test listener unavailable')
 base=`http://127.0.0.1:${address.port}/api/content/creation-options`
})
afterAll(()=>new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve())))
beforeEach(()=>state.read.mockClear())
const get=(headers:Record<string,string>={})=>fetch(base,{headers:{'x-test-user':'owner',...headers}})
describe('creator revision transport',()=>{
 it('validates the application revision when no HTTP conditional header reaches Express',async()=>{
  const response=await get({'X-Creation-Revision':'W/'+state.etag})
  expect(response.status).toBe(304);expect(await response.text()).toBe('')
  expect(response.headers.get('ETag')).toBe(state.etag)
  expect(state.read).toHaveBeenCalledExactlyOnceWith('owner','W/'+state.etag)
 })
 it('still accepts older clients using the standard conditional header',async()=>{
  expect((await get({'If-None-Match':state.etag})).status).toBe(304)
  expect(state.read).toHaveBeenCalledExactlyOnceWith('owner',state.etag)
 })
 it('uses the application revision when an intermediary supplies a different HTTP tag',async()=>{
  expect((await get({'X-Creation-Revision':state.etag,'If-None-Match':'"'+'b'.repeat(64)+'"'})).status).toBe(304)
  expect(state.read).toHaveBeenCalledExactlyOnceWith('owner',state.etag)
 })
 it.each(['invalid','"'+'b'.repeat(64)+'"'])('returns the current catalogue for an invalid or stale revision',async revision=>{
  const response=await get({'X-Creation-Revision':revision})
  expect(response.status).toBe(200);expect(await response.json()).toEqual(state.catalog)
 })
 it('authenticates before using a browser revision',async()=>{
  expect((await get({'x-test-user':'','X-Creation-Revision':state.etag})).status).toBe(401)
  expect(state.read).not.toHaveBeenCalled()
 })
})
