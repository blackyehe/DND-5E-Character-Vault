import {afterAll,beforeAll,describe,it,expect,vi} from 'vitest'
import express from 'express'
import type {Server} from 'node:http'
import {browseIndex,browseRecord,type BrowsePage} from '../../shared/compendium-browse'
const fixture=vi.hoisted(()=>({load:vi.fn(),detail:vi.fn()}))
vi.mock('../middleware/auth',()=>({requireAuth:(req:any,res:any,next:any)=>{if(!req.headers['x-test-user'])return res.status(401).json({error:'Sign in'});req.userId=req.headers['x-test-user'];next()}}))
vi.mock('../lib/compendium-browse',()=>({compendiumBrowseIndex:fixture.load,personalBrowseEntry:fixture.detail}))
import router from './compendium-browse'
let server:Server,base:string
beforeAll(async()=>{
  const app=express();app.use(router)
  server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve))
  base=`http://127.0.0.1:${(server.address() as {port:number}).port}`
  fixture.load.mockResolvedValue({revision:'r',index:browseIndex(Array.from({length:60},(_,i)=>browseRecord({index:String(i),name:`Spell ${String(i).padStart(2,'0')}`,url:''},'spells')),'spells')})
  fixture.detail.mockImplementation(async(user:string,_kind:string,index:string)=>user==='owner'&&index==='exists'?{index,name:'Owned entry',desc:['Full rules']}:null)
})
afterAll(()=>new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve())))
describe('authenticated Compendium browse HTTP contract',()=>{
  it('requires authentication and rejects malformed category/page/filter inputs',async()=>{
    expect((await fetch(`${base}/spells`)).status).toBe(401)
    for(const path of ['/unknown','/spells?page=0','/spells?facets=%7Bbad','/spells?items=%7B%22weapon%22%3A%5B%22sword%22%5D%7D'])expect((await fetch(base+path,{headers:{'x-test-user':'owner'}})).status).toBe(path==='/unknown'?404:400)
  })
  it('returns 25 results and preserves global counts/search',async()=>{
    const headers={'x-test-user':'owner'}
    const page=await(await fetch(`${base}/spells?page=2`,{headers})).json() as BrowsePage
    expect(page).toMatchObject({page:2,pageSize:25,total:60,pages:3});expect(page.entries).toHaveLength(25)
    const searched=await(await fetch(`${base}/spells?q=Spell%2059`,{headers})).json() as BrowsePage
    expect(searched.entries.map((e:any)=>e.index)).toEqual(['59'])
    expect(fixture.load).toHaveBeenCalledWith('owner','spells')
  })
  it('keeps full details lazy and scoped to the authenticated account',async()=>{
    const response=await fetch(`${base}/spells/exists`,{headers:{'x-test-user':'owner'}})
    expect(await response.json()).toHaveProperty('desc',['Full rules'])
    expect((await fetch(`${base}/spells/exists`,{headers:{'x-test-user':'stranger'}})).status).toBe(404)
  })
})
