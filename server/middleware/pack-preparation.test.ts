import {afterAll,afterEach,beforeAll,beforeEach,expect,it,vi} from 'vitest'
import express from 'express'
import cookieParser from 'cookie-parser'
import jwt from 'jsonwebtoken'
import type {Server} from 'node:http'
const state=vi.hoisted(()=>({tasks:[] as Promise<unknown>[],deadline:undefined as Date|undefined,run:vi.fn(),wait:vi.fn()}))
vi.mock('../env',()=>({env:{COMPENDIUM_PACK_PREPARATION:'on',JWT_SECRET:'isolated-middleware-test-secret-20261101'}}))
vi.mock('../lib/pack-preparation',()=>({runPackPreparation:state.run}))
vi.mock('@vercel/functions',()=>({getDeadline:()=>state.deadline,waitUntil:(task:Promise<unknown>)=>{state.wait();state.tasks.push(task)}}))
import {env} from '../env'
import {requireAuth} from './auth'
import {packPreparation} from './pack-preparation'
let server:Server,url:string
const owner='a'.repeat(24),cookie=()=>`token=${jwt.sign({userId:owner},env.JWT_SECRET,{expiresIn:'5m'})}`
beforeAll(async()=>{
 const app=express();app.use(packPreparation,cookieParser(),requireAuth)
 app.use((req,res)=>{if(req.query.hang==='1')return;res.status(req.query.fail==='1'?500:200).json({ok:true})})
 server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));url='http://127.0.0.1:'+(server.address() as {port:number}).port
})
beforeEach(()=>{state.tasks=[];state.deadline=undefined;state.run.mockReset().mockResolvedValue(undefined);state.wait.mockReset();env.COMPENDIUM_PACK_PREPARATION='on'})
afterEach(async()=>{await Promise.all(state.tasks);vi.restoreAllMocks()})
afterAll(async()=>{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()))})
it.each(['/api/content/orcbrew-packs','/api/content/orcbrew-packs/id/replace','/api/workshop/publish','/api/workshop/options/publish','/api/workshop-trash/restore','/api/library-restore'])('wakes only the verified request owner after a successful mutation: %s',async path=>{
 const response=await fetch(url+path,{method:'POST',headers:{Cookie:cookie()},signal:AbortSignal.timeout(2000)});expect(response.status).toBe(200);await Promise.all(state.tasks)
 expect(state.run).toHaveBeenCalledWith(owner,expect.objectContaining({force:true,deadline:expect.any(Number)}))
})
it('does not wake from unauthenticated, failed, room or ordinary foreground reads',async()=>{
 expect((await fetch(url+'/api/content/orcbrew-packs',{method:'POST'})).status).toBe(401)
 await fetch(url+'/api/content/orcbrew-packs?fail=1',{method:'POST',headers:{Cookie:cookie()}})
 await fetch(url+'/api/rooms/room',{headers:{Cookie:cookie(),'X-Compendium-Idle':'1'}})
 await fetch(url+'/api/compendium-browse/classes/local-revision',{headers:{Cookie:cookie()}})
 await Promise.all(state.tasks);expect(state.run).not.toHaveBeenCalled()
})
it.each(['/api/content/orcbrew-packs/'+('a'.repeat(24))+'/summary','/api/content/orcbrew-packs/'+('B'.repeat(24))+'/summary/'])('does not launch full catalogue preparation for a derived-only report: %s',async path=>{
 const response=await fetch(url+path,{method:'POST',headers:{Cookie:cookie()}});expect(response.status).toBe(200)
 expect(state.wait).not.toHaveBeenCalled();expect(state.run).not.toHaveBeenCalled()
})
it('resumes persisted work from an explicit idle check',async()=>{
 await fetch(url+'/api/compendium-browse/classes/local-revision',{headers:{Cookie:cookie(),'X-Compendium-Idle':'1'}});await Promise.all(state.tasks)
 expect(state.run).toHaveBeenCalledWith(owner,expect.objectContaining({force:false}))
})
it('does not block the response on preparation completion',async()=>{
 let finish!:()=>void;state.run.mockImplementationOnce(()=>new Promise<void>(resolve=>{finish=resolve}))
 const response=await fetch(url+'/api/content/orcbrew-packs',{method:'POST',headers:{Cookie:cookie()},signal:AbortSignal.timeout(2000)});expect(response.status).toBe(200);expect(finish).toBeTypeOf('function');finish();await Promise.all(state.tasks)
})
it('skips disabled or spent invocations and preserves the request if lifecycle support fails',async()=>{
 env.COMPENDIUM_PACK_PREPARATION='off';await fetch(url+'/api/content/orcbrew-packs',{method:'POST',headers:{Cookie:cookie()}});expect(state.wait).not.toHaveBeenCalled()
 env.COMPENDIUM_PACK_PREPARATION='on';state.deadline=new Date(Date.now()+1000);await fetch(url+'/api/content/orcbrew-packs',{method:'POST',headers:{Cookie:cookie()}});await Promise.all(state.tasks);expect(state.run).not.toHaveBeenCalled()
 state.deadline=undefined;state.wait.mockImplementationOnce(()=>{throw Error('unavailable')});vi.spyOn(console,'warn').mockImplementation(()=>{})
 expect((await fetch(url+'/api/content/orcbrew-packs',{method:'POST',headers:{Cookie:cookie()}})).status).toBe(200);await Promise.all(state.tasks);expect(state.run).not.toHaveBeenCalled()
})
it('does not start work after an unfinished request disconnects',async()=>{
 const controller=new AbortController(),request=fetch(url+'/api/content/orcbrew-packs?hang=1',{method:'POST',headers:{Cookie:cookie()},signal:controller.signal}).catch(()=>{})
 await vi.waitFor(()=>expect(state.tasks.length).toBe(1));controller.abort();await request;await Promise.all(state.tasks);expect(state.run).not.toHaveBeenCalled()
})
