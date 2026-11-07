import {afterAll,beforeAll,beforeEach,expect,it,vi} from 'vitest'
import express,{type NextFunction,type Request,type Response} from 'express'
import type {Server} from 'node:http'

const ids=vi.hoisted(()=>({room:'1'.repeat(24),hero:'2'.repeat(24),other:'3'.repeat(24),owner:'a'.repeat(24),player:'b'.repeat(24),outsider:'c'.repeat(24)}))
const db=vi.hoisted(()=>({room:vi.fn(),createRoom:vi.fn(),members:vi.fn(),characters:vi.fn(),memberProjection:vi.fn(),characterProjection:vi.fn(),sort:vi.fn()}))
vi.mock('../middleware/auth',()=>({requireAuth:(req:Request,res:Response,next:NextFunction)=>{req.userId=req.get('x-test-user');if(!req.userId)return res.status(401).json({error:'Unauthorized'});next()}}))
vi.mock('../models/Room',()=>({Room:{findOne:db.room,create:db.createRoom}}))
vi.mock('../models/User',()=>({User:{find:db.members}}))
vi.mock('../models/Character',()=>({Character:{find:db.characters}}))
vi.mock('../lib/workshop-library',()=>({workshopLibrary:vi.fn(),workshopRevision:vi.fn(),resolveWorkshopCharacter:vi.fn()}))
import router from './rooms'
import {NOTEBOOK_LISTING_VERSION} from '../lib/notebook-derived'

const room={_id:ids.room,name:'Table',ownerId:ids.owner,members:[ids.player],assignments:[{userId:ids.player,characterId:ids.hero}],joinToken:'private-token'}
const members=[{_id:ids.player,displayName:'Player',email:'player@example.test'}]
const characters=[{_id:ids.hero,meta:{name:'Hero'},updatedAt:'2026-11-02'}, {_id:ids.other,meta:{name:'Other'},updatedAt:'2026-11-02'}]
let server:Server,base:string
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>{resolve=r});return {promise,resolve}}
beforeAll(async()=>{const app=express();app.use(express.json());app.use('/rooms',router);server=await new Promise<Server>(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s))});base=`http://127.0.0.1:${(server.address() as {port:number}).port}/rooms/${ids.room}`})
afterAll(()=>new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve())))
beforeEach(()=>{
  vi.clearAllMocks()
  db.room.mockImplementation(async q=>q._id===ids.room&&q.$or.some((c:{ownerId?:string;members?:string})=>c.ownerId===ids.owner||c.members===ids.player)?room:null)
  db.members.mockImplementation(()=>({select:(fields:string)=>{db.memberProjection(fields);return {lean:async()=>members}}}))
  db.characters.mockImplementation(q=>({select:(fields:string)=>{db.characterProjection(fields);return {sort:(sort:unknown)=>{db.sort(sort);return {lean:async()=>characters.filter(c=>!q._id||q._id.$in.includes(c._id))}}}}}))
})
const get=(user:string|null=ids.owner)=>fetch(base,{headers:{connection:'close',...(user?{'x-test-user':user}:{})}})

it('finishes authorization before starting both independent reads, without awaiting members',async()=>{
  const access=deferred<typeof room>(),users=deferred<typeof members>(),heroes=deferred<typeof characters>()
  db.room.mockReturnValue(access.promise)
  db.members.mockReturnValue({select:()=>({lean:()=>users.promise})})
  db.characters.mockReturnValue({select:()=>({sort:()=>({lean:()=>heroes.promise})})})
  const response=get()
  await vi.waitFor(()=>expect(db.room).toHaveBeenCalledOnce())
  expect(db.members).not.toHaveBeenCalled();expect(db.characters).not.toHaveBeenCalled()
  access.resolve(room)
  await vi.waitFor(()=>{expect(db.members).toHaveBeenCalledOnce();expect(db.characters).toHaveBeenCalledOnce()})
  heroes.resolve(characters);users.resolve(members)
  expect((await response).status).toBe(200)
})
it.each(['dm','player'] as const)('preserves the exact %s detail contract, projections and assignment scope',async role=>{
  const dm=role==='dm',response=await get(dm?ids.owner:ids.player)
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({id:ids.room,name:'Table',role,memberCount:1,members:[{id:ids.player,displayName:'Player',...(dm?{email:'player@example.test'}:{})}],characters:(dm?characters:characters.slice(0,1)).map(c=>({...c,assignedTo:c._id===ids.hero?ids.player:null})),...(dm?{joinToken:'private-token'}:{})})
  expect(db.members).toHaveBeenCalledWith({_id:{$in:[ids.player]}})
  expect(db.characters).toHaveBeenCalledWith({userId:ids.owner,...(dm?{}:{_id:{$in:[ids.hero]}})})
  expect(db.memberProjection).toHaveBeenCalledWith('displayName email')
  expect(db.characterProjection).toHaveBeenCalledWith('meta.name meta.race meta.klass meta.level meta.subclass meta.background meta.portrait companionKind updatedAt')
  expect(db.sort).toHaveBeenCalledWith({'meta.name':1})
  expect(db.room).toHaveBeenCalledOnce();expect(db.members).toHaveBeenCalledOnce();expect(db.characters).toHaveBeenCalledOnce()
})
it('does not start private reads when authentication or access is lost',async()=>{
  expect((await get(null)).status).toBe(401)
  expect((await get(ids.outsider)).status).toBe(404)
  expect(db.members).not.toHaveBeenCalled();expect(db.characters).not.toHaveBeenCalled()
})
it('creates empty rooms ready without changing the creation response',async()=>{
  db.createRoom.mockResolvedValue({_id:ids.room})
  const response=await fetch(base.slice(0,-25),{method:'POST',headers:{'x-test-user':ids.owner,'content-type':'application/json'},body:JSON.stringify({name:'New table'})})
  expect(response.status).toBe(201);expect(await response.json()).toEqual({id:ids.room})
  expect(db.createRoom).toHaveBeenCalledWith(expect.objectContaining({ownerId:ids.owner,name:'New table',notebookListingVersion:NOTEBOOK_LISTING_VERSION}))
})
