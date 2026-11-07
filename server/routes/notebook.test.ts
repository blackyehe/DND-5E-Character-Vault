import {afterAll,afterEach,beforeAll,beforeEach,describe,it,expect,vi} from 'vitest'
import express,{type Request,type Response,type NextFunction} from 'express'
import type {Server} from 'node:http'
import mongoose from 'mongoose'
const state=vi.hoisted(()=>({docs:[] as any[],versions:[] as any[],written:[] as any[],sequence:100,catalog:[] as {key:string;name:string}[],members:[] as string[],assignments:[] as {characterId:string;userId:string}[],owned:[] as string[],readyVersion:undefined as number|undefined,changes:{} as any}))
const ids=vi.hoisted(()=>({room:'1'.repeat(24),owner:'a'.repeat(24),player:'b'.repeat(24),other:'c'.repeat(24),fade:'2'.repeat(24),volenta:'3'.repeat(24),root:'4'.repeat(24),child:'5'.repeat(24),secret:'6'.repeat(24),publicNote:'7'.repeat(24),privateNote:'8'.repeat(24)}))
const valueAt=(o:any,key:string)=>key.split('.').reduce((v,k)=>v?.[k],o)
const eq=(a:any,b:any):boolean=>Array.isArray(a)?a.some(v=>eq(v,b)):a==null&&b==null||String(a)===String(b)
function matches(doc:any,query:any):boolean{return Object.entries(query).every(([key,condition]:[string,any])=>{
  if(key==='$and')return condition.every((q:any)=>matches(doc,q))
  if(key==='$or')return condition.some((q:any)=>matches(doc,q))
  const value=valueAt(doc,key)
  if(condition&&typeof condition==='object'&&!Array.isArray(condition)&&!condition._bsontype)return Object.entries(condition).every(([op,c]:[string,any])=>op==='$in'?c.some((v:any)=>eq(value,v)):op==='$nin'?!c.some((v:any)=>eq(value,v)):op==='$ne'?!eq(value,c):op==='$lt'?value<c:op==='$exists'?(value!==undefined)===c:op==='$regex'?new RegExp(c,condition.$options).test(value):op==='$options')
  return eq(value,condition)
})}
function query(read:()=>any){let skip=0,limit=Infinity,order:any;const q:any={session:()=>q,select:()=>q,collation:()=>q,comment:()=>q,sort:(v:any)=>{order=v;return q},skip:(v:number)=>{skip=v;return q},limit:(v:number)=>{limit=v;return q},lean:async()=>{const value=read();if(!Array.isArray(value))return value;const values=[...value];if(order?.revision)values.sort((a,b)=>(a.revision-b.revision)*order.revision);return values.slice(skip,skip+limit)},then:(resolve:any,reject:any)=>q.lean().then(resolve,reject)};return q}
vi.mock('../middleware/auth',()=>({requireAuth:(req:Request,res:Response,next:NextFunction)=>{req.userId=req.get('x-test-user');if(!req.userId)return res.status(401).json({error:'Unauthorized'});next()}}))
vi.mock('../middleware/request-limit',()=>({requestLimit:()=> (_req:Request,_res:Response,next:NextFunction)=>next()}))
vi.mock('../models/Room',()=>({Room:{findOne:(q:any)=>query(()=>q._id===ids.room&&q.$or.some((v:any)=>v.ownerId===ids.owner||state.members.includes(v.members))?{_id:ids.room,ownerId:ids.owner,members:state.members,assignments:state.assignments,notebookTagCatalog:state.catalog,notebookListingVersion:state.readyVersion,notebookChanges:state.changes}:null),findById:()=>query(()=>({notebookTagCatalog:state.catalog})),updateOne:async(q:any,u:any)=>{if(u.$inc){for(const [path,inc]of Object.entries(u.$inc)){const keys=path.split('.').slice(1),last=keys.pop()!;let target=state.changes;for(const key of keys)target=target[key]??=( {} );target[last]=(target[last]??0)+Number(inc)}return {matchedCount:1,modifiedCount:1}}if(q._id!==ids.room||q.ownerId!==ids.owner||state.catalog.length>=500||state.catalog.some(t=>t.key===q['notebookTagCatalog.key'].$ne))return {modifiedCount:0};state.catalog.push(u.$push.notebookTagCatalog);return {modifiedCount:1}}}}))
vi.mock('../models/Character',()=>({Character:{find:(q:any)=>query(()=>[{_id:ids.fade,userId:ids.owner,meta:{name:'Fade'}},{_id:ids.volenta,userId:ids.owner,meta:{name:'Volenta'}}].filter(c=>state.owned.includes(c._id)&&matches(c,q)))}}))
vi.mock('../models/User',()=>({User:{findById:()=>query(()=>({displayName:'Test DM'}))}}))
// Existing fixtures intentionally have no derived metadata: verify the legacy fallback.
vi.mock('../models/Notebook',()=>({Notebook:{aggregate:()=>({collation:()=>({option:async()=>[{unprepared:[{}]}]})}),init:async()=>{},find:(q:any)=>query(()=>state.docs.filter(d=>matches(d,q))),findOne:(q:any)=>query(()=>{const d=state.docs.find(d=>matches(d,q));return d?{...d}:null}),exists:(q:any)=>query(()=>state.docs.some(d=>matches(d,q))),countDocuments:(q:any)=>query(()=>state.docs.filter(d=>matches(d,q)).length),create:async(values:any[])=>values.map(v=>{const d={body:'',folderId:null,parentId:null,audience:'room',characterIds:[],relevantCharacterIds:[],relatedIds:[],revision:1,deletedAt:null,updatedAt:new Date(),...v,_id:(state.sequence++).toString(16).padStart(24,'0')};state.docs.push(d);state.written.push(d);return {toObject:()=>d,_id:d._id}}),findOneAndUpdate:(q:any,update:any)=>query(()=>{const d=state.docs.find(d=>matches(d,q));if(!d)return null;Object.assign(d,update.$set);state.written.push(d);d.revision+=update.$inc?.revision??0;return d})},NotebookRevision:{init:async()=>{},create:async(values:any[])=>state.versions.push(...values.map(v=>({...v,snapshot:structuredClone(v.snapshot),savedAt:new Date()}))),find:(q:any)=>query(()=>state.versions.filter(v=>matches(v,q))),findOne:(q:any)=>query(()=>state.versions.find(v=>matches(v,q))??null)}}))
import router from './notebook'
import {libraryContext,notebookScope} from '../lib/room-library-access'
import {Notebook} from '../models/Notebook'
import {Character} from '../models/Character'
import {Room} from '../models/Room'
import {NOTEBOOK_LISTING_VERSION, notebookDerived, notebookDerivedConsistent} from '../lib/notebook-derived'
import {env} from '../env'
let server:Server,base:string
type TestResponse = Omit<Awaited<ReturnType<typeof fetch>>,'json'> & {json():Promise<any>}
const request=(path='',user=ids.player,method='GET',body?:unknown)=>fetch(base+path,{method,headers:{'x-test-user':user,'Content-Type':'application/json',connection:'close'},...(body?{body:JSON.stringify(body)}:{})}) as Promise<TestResponse>
const record=(id:string,kind='entry',extra:any={})=>({_id:id,roomId:ids.room,kind,section:'journal',title:id,body:'text',folderId:null,parentId:null,audience:'room',characterIds:[],relevantCharacterIds:[],relatedIds:[],revision:1,deletedAt:null,updatedAt:new Date(),editedBy:'DM',...extra})
beforeAll(async()=>{vi.spyOn(mongoose.connection,'transaction').mockImplementation(async(fn:any)=>fn({}));const app=express();app.use(express.json());app.use('/rooms/:roomId/notebook',router);server=await new Promise<Server>(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s))});base='http://127.0.0.1:'+(server.address() as any).port+'/rooms/'+ids.room+'/notebook'})
afterAll(()=>new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve())))
afterEach(()=>{for(const doc of state.written)expect(notebookDerivedConsistent(doc)).toBe(true)})
beforeEach(()=>{env.NOTEBOOK_DB_ROOMS='*';state.readyVersion=undefined;state.changes={};state.docs=[record(ids.root,'folder',{title:'Country'}),record(ids.child,'folder',{parentId:ids.root,title:'City',audience:'characters',characterIds:[ids.fade]}),record(ids.secret,'folder',{title:'Secret NPC',audience:'dm'}),record(ids.publicNote,'entry',{title:'Shared clue',folderId:ids.child,relatedIds:[ids.privateNote]}),record(ids.privateNote,'entry',{title:'Secret truth',folderId:ids.secret,audience:'dm'})];state.versions=[];state.written=[];state.sequence=100;state.catalog=[];state.members=[ids.player,ids.other];state.assignments=[{characterId:ids.fade,userId:ids.player},{characterId:ids.volenta,userId:ids.other}];state.owned=[ids.fade,ids.volenta]})
describe('additive notebook navigation',()=>{
  it('refreshes navigation when an older writer advances source revision without counters or derived metadata',async()=>{
    state.readyVersion=NOTEBOOK_LISTING_VERSION
    for(const doc of state.docs)doc.listing=notebookDerived(doc)
    const before=await request('/navigation?section=all'),token=before.headers.get('x-notebook-navigation')
    const entry=state.docs.find(d=>d._id===ids.publicNote);entry.revision++;entry.title='Session 99';entry.body='## Session sources\n- 99. session.'
    const first=await request('/navigation?section=all'),second=await request('/navigation?section=all')
    expect(first.headers.get('x-notebook-navigation')).not.toBe(token)
    expect(second.headers.get('x-notebook-navigation')).toBe(first.headers.get('x-notebook-navigation'))
    expect((await first.json()).sessionEntries.some((e:any)=>e.id===entry._id&&e.sessions.includes(99))).toBe(true)
    expect(state.changes).toEqual({})
  })
  it.each([0,59,60,61,120,121])('preserves exact filtered totals and page boundaries for %i visible entries',async size=>{
    const original=env.NOTEBOOK_DB_LISTING
    try{
      for(const user of [ids.owner,ids.player]){
        state.docs=Array.from({length:size},(_,n)=>record((1000+n).toString(16).padStart(24,'0'),'entry',{title:`Person ${String(n).padStart(3,'0')}`,codexType:'people'}))
        state.docs.push(record('d'.repeat(24),'entry',{codexType:'people',deletedAt:new Date()}),record('e'.repeat(24),'entry',{codexType:'sessions'}))
        if(user===ids.player)state.docs.push(record('f'.repeat(24),'entry',{codexType:'people',audience:'dm'}),record('9'.repeat(24),'entry',{codexType:'people',audience:'characters',characterIds:[ids.volenta]}))
        for(const doc of state.docs)doc.listing=notebookDerived(doc)
        state.readyVersion=NOTEBOOK_LISTING_VERSION
        for(const offset of [0,60,120,180]){
          const path=`?section=all&type=people&offset=${offset}`
          env.NOTEBOOK_DB_LISTING='off';const old=await(await request(path,user)).json()
          env.NOTEBOOK_DB_LISTING='on';const response=await request(path+'&navigation=false',user),page=await response.json()
          expect(response.status).toBe(200)
          expect(page).toEqual({entries:old.entries,total:old.total,nextOffset:old.nextOffset})
          expect(page.total).toBe(size)
          expect(page.entries.map((e:any)=>e.id)).toEqual(state.docs.slice(0,size).slice(offset,offset+60).map(d=>d._id))
          expect(page.nextOffset).toBe(offset+60<size?offset+60:null)
        }
      }
    }finally{env.NOTEBOOK_DB_LISTING=original}
  })
  it('keeps the missing/old marker fallback identical to flag-off legacy responses for both roles',async()=>{
    const original=env.NOTEBOOK_DB_LISTING
    try{
      for(const user of [ids.owner,ids.player]){
        env.NOTEBOOK_DB_LISTING='off';state.readyVersion=NOTEBOOK_LISTING_VERSION
        const expected=await(await request('/initial?section=all',user)).json()
        for(const version of [undefined,NOTEBOOK_LISTING_VERSION-1]){
          env.NOTEBOOK_DB_LISTING='on';state.readyVersion=version
          expect(await(await request('/initial?section=all',user)).json()).toEqual(expected)
        }
      }
    }finally{env.NOTEBOOK_DB_LISTING=original}
  })
  it('maintains a ready room through writes and invalidates both audiences when sharing changes',async()=>{
    state.readyVersion=NOTEBOOK_LISTING_VERSION
    for(const doc of state.docs)doc.listing=notebookDerived(doc)
    const before=await request('/navigation?section=all')
    const response=await request('/entries/'+ids.publicNote+'/sharing',ids.owner,'PATCH',{expectedRevision:1,audience:'characters',characterIds:[ids.volenta]})
    expect(response.status).toBe(200)
    expect(state.changes).toMatchObject({dm:{all:1,journal:1},room:{all:1,journal:1},characters:{[ids.volenta]:{all:1,journal:1}}})
    expect(state.readyVersion).toBe(NOTEBOOK_LISTING_VERSION)
    expect(state.docs.every(notebookDerivedConsistent)).toBe(true)
    const after=await request('/navigation?section=all')
    expect(after.headers.get('x-notebook-navigation')).not.toBe(before.headers.get('x-notebook-navigation'))
    expect((await after.json()).entryCount).toBe((await before.json()).entryCount-1)
    const token=after.headers.get('x-notebook-navigation')
    expect((await request('/entries/'+ids.privateNote+'/tags',ids.owner,'PATCH',{expectedRevision:1,tags:['Secret']})).status).toBe(200)
    expect((await request('/navigation?section=all')).headers.get('x-notebook-navigation')).toBe(token)
  })
  it('keeps a ready room consistent across create, folder moves, edits, tags, restore, trash and recovery',async()=>{
    state.readyVersion=NOTEBOOK_LISTING_VERSION
    for(const doc of state.docs)doc.listing=notebookDerived(doc)
    const draft={title:'Session 17',body:'## Session sources\n- 17. session.',section:'journal',codexType:'sessions',folderId:null,audience:'room',characterIds:[],relevantCharacterIds:[],relatedIds:[]}
    const created=await request('/entries',ids.owner,'POST',draft)
    expect(created.status).toBe(201);const {id}=await created.json()
    const folder=await request('/folders',ids.owner,'POST',{title:'New folder',section:'journal'})
    expect(folder.status).toBe(201);const folderId=(await folder.json()).id
    expect((await request('/folders/'+folderId,ids.owner,'PATCH',{expectedRevision:1,title:'Renamed',parentId:ids.root})).status).toBe(200)
    expect((await request('/entries/'+id,ids.owner,'PATCH',{expectedRevision:1,draft:{...draft,title:'Session 23',body:'## Session sources\n- 23. session.',folderId}})).status).toBe(200)
    expect((await request('/entries/'+id+'/tags',ids.owner,'PATCH',{expectedRevision:2,tags:['Plot']})).status).toBe(200)
    expect((await request('/entries/'+id+'/restore-version',ids.owner,'POST',{expectedRevision:3,revision:1})).status).toBe(200)
    expect((await request('/entries/'+id+'/delete',ids.owner,'POST',{expectedRevision:4})).status).toBe(200)
    expect((await request('/entries/'+id+'/recover',ids.owner,'POST',{expectedRevision:5})).status).toBe(200)
    expect(state.docs.find(d=>d._id===id).listing).toMatchObject({sessions:[17],tagNames:['Plot']})
    expect(state.docs.every(notebookDerivedConsistent)).toBe(true);expect(state.readyVersion).toBe(NOTEBOOK_LISTING_VERSION)
  })
  it('shares initial-load context without changing either response or retaining authorization',async()=>{
    for(const user of [ids.owner,ids.player]){
      const roomRead=vi.spyOn(Room,'findOne'),characterRead=vi.spyOn(Character,'find'),folderRead=vi.spyOn(Notebook,'find')
      try{
        const initialResponse=await request('/initial?section=all&navigation=false',user),initial=await initialResponse.json()
        expect(initialResponse.status).toBe(200)
        expect(roomRead).toHaveBeenCalledOnce();expect(characterRead).toHaveBeenCalledOnce()
        expect(folderRead.mock.calls.filter(([filter])=>(filter as unknown as {kind?:string}|undefined)?.kind==='folder')).toHaveLength(1)
        const fullResponse=await request('?section=all',user),full=await fullResponse.json()
        expect({...initial.navigation,...initial.listing}).toEqual(full)
        expect(initialResponse.headers.get('x-notebook-scope')).toBe(fullResponse.headers.get('x-notebook-scope'))
        expect(initialResponse.headers.get('x-notebook-navigation')).toBe(fullResponse.headers.get('x-notebook-navigation'))
      }finally{roomRead.mockRestore();characterRead.mockRestore();folderRead.mockRestore()}
    }
    state.members=state.members.filter(id=>id!==ids.player)
    expect((await request('/initial?section=all')).status).toBe(404)
  })
  it('omits names and unused legacy sharing context on slim reads while keeping freshness headers',async()=>{
    const charFields:string[]=[],folderFields:string[]=[],roomFields:string[]=[],originalCharacters=Character.find,originalNotebook=Notebook.find,originalRoom=Room.findOne
    const roomSpy=vi.spyOn(Room,'findOne').mockImplementation(((...args:any[])=>{const q=(originalRoom as any)(...args),select=q.select.bind(q);q.select=(fields:string)=>{roomFields.push(fields);return select(fields)};return q}) as any)
    const characterSpy=vi.spyOn(Character,'find').mockImplementation(((...args:any[])=>{const q=(originalCharacters as any)(...args),select=q.select.bind(q);q.select=(fields:string)=>{charFields.push(fields);return select(fields)};return q}) as any)
    const folderSpy=vi.spyOn(Notebook,'find').mockImplementation(((...args:any[])=>{const q=(originalNotebook as any)(...args),select=q.select.bind(q);q.select=(fields:string)=>{if(args[0].kind==='folder')folderFields.push(fields);return select(fields)};return q}) as any)
    try{
      for(const user of [ids.owner,ids.player]){
        const slim=await request('?section=all&navigation=false',user),navigation=await request('/navigation?section=all',user)
        expect(slim.status).toBe(200)
        expect(slim.headers.get('x-notebook-scope')).toBe(navigation.headers.get('x-notebook-scope'))
        expect(slim.headers.get('x-notebook-navigation')).toBe(navigation.headers.get('x-notebook-navigation'))
      }
      expect(charFields).toEqual(['_id','meta.name','_id','meta.name'])
      expect(roomFields).toEqual(['ownerId members assignments notebookTagCatalog notebookListingVersion notebookChanges','ownerId members assignments notebookTagCatalog notebookListingVersion notebookChanges'])
      expect(folderFields).toEqual(['_id title section parentId deletedAt revision','_id title section parentId deletedAt audience characterIds revision','_id title section parentId deletedAt revision','_id title section parentId deletedAt audience characterIds revision'])
    }finally{characterSpy.mockRestore();folderSpy.mockRestore();roomSpy.mockRestore()}
  })
  it('keeps old-client defaults unchanged and reconstructs them from navigation plus a slim page',async()=>{
    state.catalog=[{key:'unused',name:'Unused'}]
    for(const user of [ids.owner,ids.player])for(const section of ['all','journal','story-items'])for(const deleted of ['false','true']){
      const path=`?section=${section}&deleted=${deleted}`
      const full=await(await request(path,user)).json(),explicit=await(await request(path+'&navigation=true',user)).json()
      expect(explicit).toEqual(full)
      expect(Object.keys(full).sort()).toEqual(['entries','total','nextOffset','entryCount','counts','questCounts','tags','sessionEntries','folders','characters','role','readOnly'].sort())
      const slim=await(await request(path+'&navigation=false',user)).json()
      expect(Object.keys(slim).sort()).toEqual(['entries','nextOffset','total'])
      const navResponse=await request(`/navigation${path}`,user),nav=await navResponse.json()
      expect({...nav,...slim}).toEqual(full)
      expect(navResponse.headers.get('cache-control')).toBe('private, no-store')
      expect(navResponse.headers.get('x-notebook-scope')).toBeTruthy()
      expect(navResponse.headers.get('x-notebook-navigation')).toBeTruthy()
    }
    expect((await request('?section=all&navigation=invalid')).status).toBe(400)
  })
  it('retains search, pinned, pagination and unmigrated-row behavior in slim listings',async()=>{
    for(const user of [ids.owner,ids.player])for(const query of ['section=all&search=Shared','section=all&type=pinned&ids='+ids.publicNote,'section=journal&offset=60','section=all&type=quests&questStatus=finished']){
      const full=await(await request('?'+query,user)).json(),slim=await(await request('?'+query+'&navigation=false',user)).json()
      expect(slim).toEqual({entries:full.entries,total:full.total,nextOffset:full.nextOffset})
    }
  })
  it('does not reveal hidden entries through counts, tags, sessions or change tokens',async()=>{
    const initial=await request('/navigation?section=all'),before=await initial.json(),token=initial.headers.get('x-notebook-navigation')
    state.docs.push(record('9'.repeat(24),'entry',{title:'Hidden session',audience:'characters',characterIds:[ids.volenta],codexType:'sessions',body:'## Session sources\n- 99. session.',tags:['Secret tag']}))
    state.docs.push(record('d'.repeat(24),'entry',{title:'Hidden trash',audience:'room',deletedAt:new Date(),tags:['Deleted secret']}))
    state.docs.find(d=>d._id===ids.privateNote).revision++
    state.docs.find(d=>d._id===ids.privateNote).updatedAt=new Date('2026-11-03')
    const response=await request('/navigation?section=all'),after=await response.json()
    expect(after).toEqual(before);expect(response.headers.get('x-notebook-navigation')).toBe(token)
    const oldClient=await(await request('?section=all')).json()
    expect(after.counts).toEqual(oldClient.counts);expect(after.questCounts).toEqual(oldClient.questCounts)
    expect(JSON.stringify(after)).not.toContain('Hidden session');expect(JSON.stringify(after)).not.toContain('Secret tag')
    expect((await(await request('/navigation?section=all',ids.owner)).json()).entryCount).toBeGreaterThan(after.entryCount)
  })
  it.each(['assignment','ownership'] as const)('recomputes player navigation immediately after character %s revocation',async revoked=>{
    const note=record('9'.repeat(24),'entry',{title:'Assigned secret',audience:'characters',characterIds:[ids.fade],codexType:'sessions',body:'## Session sources\n- 42. session.'})
    state.docs.push(note)
    const initial=await request('/navigation?section=all'),before=await initial.json()
    expect(before.sessionEntries.some((entry:any)=>entry.id===note._id)).toBe(true)
    if(revoked==='assignment')state.assignments=state.assignments.filter(a=>a.userId!==ids.player)
    else state.owned=state.owned.filter(id=>id!==ids.fade)
    const response=await request('/navigation?section=all'),after=await response.json()
    expect(response.headers.get('x-notebook-scope')).not.toBe(initial.headers.get('x-notebook-scope'))
    expect(after.characters).toEqual([]);expect(after.entryCount).toBe(before.entryCount-1)
    expect(after.sessionEntries.some((entry:any)=>entry.id===note._id)).toBe(false)
    const legacy=await(await request('?section=all')).json()
    expect(after.counts).toEqual(legacy.counts)
    expect((await(await request('?section=all&navigation=false')).json()).entries.some((entry:any)=>entry.id===note._id)).toBe(false)
  })
  it('denies all subsequent navigation and listing reads after room membership revocation',async()=>{
    expect((await request('/navigation?section=all')).status).toBe(200)
    state.members=state.members.filter(id=>id!==ids.player)
    for(const path of ['/navigation?section=all','?section=all&navigation=false','?section=all','/link-targets'])expect((await request(path)).status).toBe(404)
  })
})

describe('notebook access across nested folders',()=>{
  it('uses alphabetical mixed browsing, chronological Sessions, and the original search ordering',async()=>{
    state.docs.push(record('9'.repeat(24),'entry',{title:'Session 2',body:'## Session sources\n- 2. session.'}),record('d'.repeat(24),'entry',{title:'Session 10',body:'## Session sources\n- 10. session.'}))
    const sessionIds=new Set(['9'.repeat(24),'d'.repeat(24)])
    const order=async(path:string)=>(await(await request(path,ids.owner)).json()).entries.filter((e:any)=>sessionIds.has(e.id)).map((e:any)=>e.sessions[0])
    expect(await order('?section=all')).toEqual([10,2])
    expect(await order('?section=all&type=sessions')).toEqual([2,10])
    expect(await order('?section=all&search=Session')).toEqual([2,10])
  })
  it('offers a complete title-only link catalog across categories, respecting room, entry and preview access',async()=>{
    for(let n=0;n<72;n++)state.docs.push(record((n+500).toString(16).padStart(24,'0'),'entry',{title:'Object '+n,section:'story-items',codexType:'objects',body:'Private description not returned'}))
    state.docs.push(record('d'.repeat(24),'entry',{title:'Deleted',deletedAt:new Date()}))
    const list=await(await request('/link-targets')).json()
    expect(list.entries).toHaveLength(73)
    expect(list.entries.find((entry:any)=>entry.id===ids.publicNote)).toMatchObject({title:'Shared clue',folder:'City'})
    expect(JSON.stringify(list)).not.toContain('Private description')
    expect(list.entries.some((entry:any)=>[ids.privateNote,'d'.repeat(24)].includes(entry.id))).toBe(false)
    expect(Object.keys(list.entries[0]).sort()).toEqual(['codexType','folder','id','section','title'])
    expect((await(await request('/link-targets?previewCharacter='+ids.volenta,ids.owner)).json()).entries).toHaveLength(73)
    expect((await(await request('/link-targets',ids.owner)).json()).entries).toHaveLength(74)
    state.docs.find(entry=>entry._id===ids.root).deletedAt=new Date()
    expect((await(await request('/link-targets',ids.owner)).json()).entries.find((entry:any)=>entry.id===ids.publicNote)).toMatchObject({folder:''})
    expect((await request('/link-targets','f'.repeat(24))).status).toBe(404)
  })
  it('filters folder names, subtree counts, search, pinned IDs, direct reads, history, and connections',async()=>{
    const list=await(await request('?section=journal')).json();expect(list.folders.map((f:any)=>f.title)).toEqual(['City','Country','Secret NPC']);expect(list.entries.map((e:any)=>e.id)).toEqual([ids.publicNote]);expect(list.folders.find((f:any)=>f.id===ids.root).count).toBe(1)
    expect(list.folders.every((f:any)=>f.audience==='room'&&f.characterIds.length===0)).toBe(true)
    for(const suffix of ['&search=Secret','&ids='+ids.privateNote])expect((await(await request('?section=journal'+suffix)).json()).entries).toEqual([])
    for(const path of ['/entries/'+ids.privateNote,'/entries/'+ids.privateNote+'/history'])expect((await request(path)).status).toBe(404)
    expect((await(await request('?section=journal&folder='+ids.secret)).json()).entries).toEqual([])
    const detail=await(await request('/entries/'+ids.publicNote)).json();expect(detail.connections).toEqual([]);expect(detail.relatedIds).toEqual([])
    expect((await(await request('?section=journal&folder='+ids.root)).json()).entries).toHaveLength(1)
    expect((await(await request('?section=journal',ids.other)).json()).entries.map((e:any)=>e.id)).toEqual([ids.publicNote])
    expect((await(await request('?section=journal',ids.owner)).json()).folders).toHaveLength(3)
  })
  it('denies deleted note text, conditional reads, history and recovery to players and player preview',async()=>{
    const deleted='d'.repeat(24)
    state.docs.push(record(deleted,'entry',{title:'Deleted shared note',audience:'room',deletedAt:new Date()}))
    for(const [user,preview] of [[ids.player,''],[ids.owner,'?previewCharacter='+ids.fade]] as const){
      for(const suffix of ['',preview?'&knownRevision=1':'?knownRevision=1','/history']){
        const path=suffix==='/history'?'/entries/'+deleted+'/history'+preview:'/entries/'+deleted+preview+suffix
        expect((await request(path,user)).status).toBe(404)
      }
    }
    expect((await request('/entries/'+deleted+'/recover',ids.player,'POST',{expectedRevision:1})).status).toBe(404)
    expect((await request('/entries/'+deleted,ids.owner)).status).toBe(200)
    expect((await request('/entries/'+deleted+'/recover',ids.owner,'POST',{expectedRevision:1})).status).toBe(200)
    expect((await request('/entries/'+deleted,ids.player)).status).toBe(200)
  })
  it('ignores legacy folder privacy and keeps shared entries accessible after folder removal',async()=>{
    state.docs.find(d=>d._id===ids.root).audience='dm'
    expect((await request('/entries/'+ids.publicNote)).status).toBe(200)
    state.docs.find(d=>d._id===ids.root).audience='room';state.docs.find(d=>d._id===ids.root).deletedAt=new Date()
    expect((await request('/entries/'+ids.publicNote)).status).toBe(200)
    expect((await(await request('?section=journal&folder=unfiled')).json()).entries.map((e:any)=>e.id)).toContain(ids.publicNote)
    state.docs=state.docs.filter(d=>d._id!==ids.root)
    expect((await(await request('?section=journal')).json()).entries.map((e:any)=>e.id)).toEqual([ids.publicNote])
    expect((await(await request('/link-targets')).json()).entries.find((e:any)=>e.id===ids.publicNote)).toMatchObject({folder:''})
    expect((await request('/entries/'+ids.privateNote)).status).toBe(404)
  })
  it('filters history by each snapshot audience, independently of old folder placement',async()=>{
    const entry=state.docs.find(d=>d._id===ids.publicNote);entry.revision=3
    state.versions=[{roomId:ids.room,entryId:entry._id,revision:1,snapshot:{...entry,audience:'dm',folderId:ids.secret,body:'secret history'},savedAt:new Date(),editedBy:'DM'},{roomId:ids.room,entryId:entry._id,revision:2,snapshot:{...entry,folderId:ids.secret,body:'public history'},savedAt:new Date(),editedBy:'DM'}]
    const body=await(await request('/entries/'+entry._id+'/history')).json();expect(body.versions.map((v:any)=>v.body)).toEqual(['public history'])
  })
  it('creates room-wide folders and normalizes legacy client sharing fields',async()=>{
    const response=await request('/folders',ids.owner,'POST',{title:'Library',section:'journal',parentId:ids.child,audience:'characters',characterIds:[ids.fade]});expect(response.status).toBe(201)
    const id=(await response.json()).id;expect(state.docs.find(d=>d._id===id)).toMatchObject({parentId:ids.child,audience:'room',characterIds:[]})
    expect((await request('/folders',ids.owner,'POST',{title:'Library',section:'journal'})).status).toBe(201);expect(state.docs.at(-1).audience).toBe('room')
    expect((await request('/folders',ids.player,'POST',{title:'No',section:'journal'})).status).toBe(403)
  })
  it('rejects invalid parents and stale revisions while discarding obsolete sharing fields',async()=>{
    const patch=(body:any)=>request('/folders/'+ids.root,ids.owner,'PATCH',{expectedRevision:1,...body})
    for(const parentId of [ids.root,ids.child,'f'.repeat(24)])expect((await patch({parentId})).status).toBe(400)
    state.docs.push(record('9'.repeat(24),'folder',{section:'story-items'}));expect((await patch({parentId:'9'.repeat(24)})).status).toBe(400)
    expect((await patch({expectedRevision:99,title:'Changed'})).status).toBe(409)
    expect((await patch({audience:'dm'})).status).toBe(200)
    expect(state.docs.find(d=>d._id===ids.root)).toMatchObject({audience:'room',characterIds:[]})
    expect((await request('/entries/'+ids.publicNote)).status).toBe(200)
    expect(state.docs.find(d=>d._id===ids.publicNote).audience).toBe('room')
  })
  it('blocks player folder changes and mutations in preview',async()=>{
    expect((await request('/folders/'+ids.root,ids.player,'PATCH',{title:'Changed',expectedRevision:1})).status).toBe(403)
    const {title,body,section,audience,characterIds,relevantCharacterIds,relatedIds}=state.docs.find(d=>d._id===ids.publicNote)
    expect((await request('/entries/'+ids.publicNote,ids.player,'PATCH',{expectedRevision:1,draft:{title,body,section,audience,characterIds,relevantCharacterIds,relatedIds,folderId:null}})).status).toBe(403)
    expect((await request('/folders?previewCharacter='+ids.fade,ids.owner,'POST',{title:'No',section:'journal'})).status).toBe(403)
  })
  it('uses only entry sharing for metadata, connections, selected characters and map/city references',async()=>{
    const shared=state.docs.find(d=>d._id===ids.publicNote)
    shared.folderId=ids.secret;shared.tags=['Shared tag'];shared.codexType='places';shared.showInEvents=true
    const selectedId='9'.repeat(24)
    state.docs.push(record(selectedId,'entry',{title:'For Fade',folderId:ids.secret,audience:'characters',characterIds:[ids.fade],tags:['Selected tag']}))
    shared.relatedIds=[ids.privateNote,selectedId]
    for(const user of [ids.player,ids.other]){
      const list=await(await request('?section=all',user)).json()
      expect(list.folders.map((f:any)=>f.id)).toContain(ids.secret)
      expect(list.tags.map((t:any)=>t.name)).toContain('Shared tag')
      expect(list.counts.places).toBe(1);expect(list.counts.events).toBe(1)
      expect((await(await request('?section=all&folder='+ids.secret,user)).json()).entries.some((e:any)=>e.id===ids.publicNote)).toBe(true)
      expect((await request('/entries/'+ids.privateNote,user)).status).toBe(404)
      const ctx=await libraryContext(ids.room,user)
      const refs=await Notebook.find({roomId:ids.room,kind:'entry',deletedAt:null,...await notebookScope(ctx)}).lean()
      expect(refs.map(e=>String(e._id)).sort()).toEqual([ids.publicNote,...user===ids.player?[selectedId]:[]].sort())
    }
    expect((await request('/entries/'+selectedId,ids.other)).status).toBe(404)
    expect((await request('/entries/'+selectedId+'?previewCharacter='+ids.volenta,ids.owner)).status).toBe(404)
    const connections=await(await request('/entries/'+ids.publicNote)).json()
    expect(connections.connections.map((e:any)=>e.id)).toEqual([selectedId])
    expect((await(await request('/entries/'+ids.publicNote,ids.other)).json()).connections).toEqual([])
  })
  it('removes and recovers folders without altering their entries or player visibility',async()=>{
    const before=structuredClone(state.docs.filter(d=>d.kind==='entry'))
    expect((await request('/entries/'+ids.root+'/delete',ids.owner,'POST',{expectedRevision:1})).status).toBe(200)
    expect((await request('/entries/'+ids.publicNote,ids.other)).status).toBe(200)
    expect((await(await request('/link-targets')).json()).entries.some((e:any)=>e.id===ids.publicNote)).toBe(true)
    expect((await request('/entries/'+ids.root+'/recover',ids.owner,'POST',{expectedRevision:2})).status).toBe(200)
    expect(state.docs.filter(d=>d.kind==='entry')).toEqual(before)
  })
  it('lets players save accessible notes unfiled when their old folder is removed',async()=>{
    state.docs.find(d=>d._id===ids.root).deletedAt=new Date()
    const {title,body,section,audience,characterIds,relevantCharacterIds}=state.docs.find(d=>d._id===ids.publicNote)
    const draft={title,body:body+' updated',section,audience,characterIds,relevantCharacterIds,relatedIds:[],folderId:null}
    expect((await request('/entries/'+ids.publicNote,ids.player,'PATCH',{expectedRevision:1,draft})).status).toBe(200)
    expect(state.docs.find(d=>d._id===ids.publicNote)).toMatchObject({folderId:null,audience:'room',body:draft.body})
  })
})

describe('place galleries',()=>{
 const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aE1kAAAAASUVORK5CYII='
 const art={id:'00000000-0000-4000-8000-000000000001',image,title:'Across the river',caption:'The eastern gate at dusk.'}
 const draft=()=>({title:'City',body:'Description',section:'journal',codexType:'places',folderId:ids.child,audience:'room',characterIds:[],relevantCharacterIds:[],relatedIds:[],gallery:[art]})
 it('round-trips artwork only through accessible details and preserves old-client saves and text restores',async()=>{
  const created=await request('/entries',ids.owner,'POST',draft());expect(created.status).toBe(201);const id=(await created.json()).id
  expect((await(await request('/entries/'+id)).json()).gallery).toEqual([art])
  expect((await request('/entries/'+id,ids.other)).status).toBe(200)
  expect((await request('/entries/'+id+'?previewCharacter='+ids.volenta,ids.owner)).status).toBe(200)
  const list=await(await request('?section=all',ids.owner)).json();expect(list.entries.every((e:any)=>!('gallery' in e))).toBe(true)
  expect(JSON.stringify(await(await request('/link-targets',ids.owner)).json())).not.toContain('Across the river')
  expect(state.versions.at(-1).snapshot.gallery).toBeUndefined()
  const {gallery:_,...old}=draft()
  expect((await request('/entries/'+id,ids.owner,'PATCH',{expectedRevision:1,draft:{...old,body:'New text'}})).status).toBe(200)
  expect((await(await request('/entries/'+id,ids.owner)).json()).gallery).toEqual([art])
  expect((await request('/entries/'+id+'/restore-version',ids.owner,'POST',{expectedRevision:2,revision:1})).status).toBe(200)
  expect((await(await request('/entries/'+id)).json()).gallery).toEqual([art])
  expect((await request('/entries/'+id,ids.owner,'PATCH',{expectedRevision:3,draft:{...old,gallery:[]}})).status).toBe(200)
  expect((await(await request('/entries/'+id)).json()).gallery).toEqual([])
 })
 it('rejects stale gallery saves, duplicates, unsupported types, non-place galleries and too many images',async()=>{
  const id=(await(await request('/entries',ids.owner,'POST',draft())).json()).id
  expect((await request('/entries/'+id,ids.owner,'PATCH',{expectedRevision:99,draft:draft()})).status).toBe(409)
  for(const value of [{...draft(),gallery:[art,art]},{...draft(),codexType:'people'},{...draft(),gallery:[{...art,image:'https://example.com/image.png'}]},{...draft(),gallery:Array.from({length:7},(_,n)=>({...art,id:`00000000-0000-4000-8000-00000000000${n}`}))}])expect((await request('/entries',ids.owner,'POST',value)).status).toBe(400)
  expect((await request('/entries/'+id+'?previewCharacter='+ids.fade,ids.owner,'PATCH',{expectedRevision:1,draft:{...draft(),gallery:[]}})).status).toBe(403)
  expect((await(await request('/entries/'+id)).json()).gallery).toEqual([art])
 })
 it('checks access before returning revision-only polling and returns current data after a change',async()=>{
  const id=(await(await request('/entries',ids.owner,'POST',draft())).json()).id
  expect(await(await request('/entries/'+id+'?knownRevision=1')).json()).toEqual({unchanged:true,revision:1})
  expect((await request('/entries/'+id+'?knownRevision=1',ids.other)).status).toBe(200)
  const changed=state.docs.find(d=>d._id===id);changed.revision=2;changed.listing=notebookDerived(changed)
  expect((await(await request('/entries/'+id+'?knownRevision=1')).json()).gallery).toEqual([art])
  state.docs.find(d=>d._id===id).audience='dm'
  expect((await request('/entries/'+id+'?knownRevision=2')).status).toBe(404)
 })
})

describe('campaign codex',()=>{
  it('opens one quest from both categories and keeps updated clues, status and revision together',async()=>{
    const shared={id:'00000000-0000-4000-8000-000000000001',title:'Witness',body:'Initial evidence',sessions:[12],audience:'room'}
    const hidden={...shared,id:'00000000-0000-4000-8000-000000000002',title:'Private lead',body:'SecretCipher',audience:'dm'}
    const draft={title:'Stolen books',body:'Recover the books',section:'journal',codexType:'quests',showInEvents:true,folderId:null,audience:'room',characterIds:[],relevantCharacterIds:[],relatedIds:[ids.publicNote],questClues:[shared,hidden]}
    const created=await request('/entries',ids.owner,'POST',draft);expect(created.status).toBe(201);const id=(await created.json()).id
    for(const type of ['quests','events']){
      const list=await(await request('?section=all&type='+type)).json()
      expect(list.entries.map((e:any)=>e.id)).toEqual([id]);expect(list.entries[0]).toMatchObject({codexType:'quests',showInEvents:true,questStatus:'active'})
      expect(list.counts.quests).toBe(1);expect(list.counts.events).toBe(1);expect(list.entryCount).toBe(2)
      expect((await(await request('?section=all&type='+type+'&search=SecretCipher')).json()).entries).toEqual([])
    }
    const updated={...shared,body:'Updated testimony'}
    expect((await request('/entries/'+id,ids.owner,'PATCH',{expectedRevision:1,draft:{...draft,questClues:[updated,hidden],questStatus:'finished'}})).status).toBe(200)
    const events=await(await request('?section=all&type=events')).json();expect(events.entries[0]).toMatchObject({id,revision:2,questStatus:'finished'})
    const detail=await(await request('/entries/'+events.entries[0].id)).json();expect(detail.questClues).toEqual([updated]);expect(detail.connections.map((c:any)=>c.id)).toEqual([ids.publicNote])
    expect((await(await request('?section=all&type=quests&questStatus=finished')).json()).entries.map((e:any)=>e.id)).toEqual([id])
    expect(state.docs.filter(d=>d.title==='Stolen books')).toHaveLength(1)
    expect((await request('/entries/'+id,ids.player,'PATCH',{expectedRevision:2,draft})).status).toBe(403)
  })
  it('filters Events permissions before pagination and excludes private and deleted entries from counts',async()=>{
    for(let n=0;n<65;n++)state.docs.push(record((n+500).toString(16).padStart(24,'0'),'entry',{title:'Event '+String(n).padStart(2,'0'),codexType:'quests',showInEvents:true}))
    state.docs.push(record('d'.repeat(24),'entry',{title:'Private event',codexType:'events',audience:'dm'}),record('e'.repeat(24),'entry',{title:'Private event in a folder',codexType:'events',folderId:ids.secret,audience:'dm'}),record('f'.repeat(24),'entry',{title:'Deleted event',codexType:'events',deletedAt:new Date()}))
    const first=await(await request('?section=all&type=events')).json();expect(first.total).toBe(65);expect(first.entries).toHaveLength(60);expect(first.nextOffset).toBe(60);expect(first.counts.events).toBe(65)
    expect((await(await request('?section=all&type=events&offset=60')).json()).entries).toHaveLength(5)
    expect((await(await request('?section=all&type=events&previewCharacter='+ids.fade,ids.owner)).json()).counts.events).toBe(65)
    expect((await(await request('?section=all&type=events',ids.owner)).json()).counts.events).toBe(67)
    expect((await(await request('?section=all&type=events&deleted=true',ids.owner)).json()).entries.map((e:any)=>e.id)).toEqual(['f'.repeat(24)])
    for(const id of ['d'.repeat(24),'e'.repeat(24)])expect((await request('/entries/'+id)).status).toBe(404)
  })
  it('lets only the DM classify events and preserves the listing on legacy edits and text restoration',async()=>{
    const draft={title:'Recorded event',body:'Original text',section:'journal',codexType:'people',showInEvents:true,folderId:null,audience:'room',characterIds:[],relevantCharacterIds:[],relatedIds:[]}
    const created=await request('/entries',ids.owner,'POST',draft);const id=(await created.json()).id
    const {showInEvents:_,...legacy}=draft
    expect((await request('/entries/'+id,ids.player,'PATCH',{expectedRevision:1,draft:{...legacy,body:'Text edit'}})).status).toBe(200)
    expect((await(await request('/entries/'+id)).json()).showInEvents).toBe(true)
    expect((await request('/entries/'+id,ids.player,'PATCH',{expectedRevision:2,draft:{...draft,showInEvents:false}})).status).toBe(403)
    expect((await request('/entries',ids.player,'POST',draft)).status).toBe(403)
    expect((await request('/entries',ids.player,'POST',{...legacy,codexType:'events'})).status).toBe(403)
    expect((await request('/entries/'+id,ids.owner,'PATCH',{expectedRevision:2,draft:{...draft,showInEvents:false}})).status).toBe(200)
    expect((await request('/entries/'+id,ids.owner,'PATCH',{expectedRevision:2,draft})).status).toBe(409)
    expect((await request('/entries/'+id+'/restore-version',ids.owner,'POST',{expectedRevision:3,revision:1})).status).toBe(200)
    expect((await(await request('/entries/'+id)).json()).showInEvents).toBe(false)
    const event=await request('/entries',ids.owner,'POST',{...legacy,codexType:'events'});expect(event.status).toBe(201);const eventId=(await event.json()).id
    expect((await(await request('/entries/'+eventId)).json()).showInEvents).toBe(true)
    expect((await request('/entries/'+eventId,ids.player,'PATCH',{expectedRevision:1,draft:{...legacy,codexType:'people'}})).status).toBe(403)
    expect((await request('/entries',ids.owner,'POST',{...legacy,showInEvents:'yes'})).status).toBe(400)
    expect((await request('/entries?previewCharacter='+ids.fade,ids.owner,'POST',draft)).status).toBe(403)
  })
  it('filters tags before pagination and derives suggestions only from readable active entries',async()=>{
    for(let n=0;n<65;n++)state.docs.push(record((n+300).toString(16).padStart(24,'0'),'entry',{title:'Tagged '+String(n).padStart(2,'0'),tags:['Amdurun','Investigation']}))
    state.docs.push(record('d'.repeat(24),'entry',{title:'Private tags',audience:'dm',tags:['Hidden city']}),record('e'.repeat(24),'entry',{title:'Private tags in a folder',folderId:ids.secret,audience:'dm',tags:['Secret tag']}),record('f'.repeat(24),'entry',{title:'Deleted tags',deletedAt:new Date(),tags:['Old tag']}))
    const filter='?section=all&tags='+encodeURIComponent(JSON.stringify(['amdurun','Investigation']))
    const first=await(await request(filter)).json();expect(first.total).toBe(65);expect(first.entries).toHaveLength(60);expect(first.nextOffset).toBe(60)
    expect(first.entries.every((e:any)=>e.tags.includes('Amdurun'))).toBe(true)
    expect(first.tags).toEqual([{name:'Amdurun',count:65},{name:'Investigation',count:65}])
    expect((await(await request(filter+'&offset=60')).json()).entries).toHaveLength(5)
    expect((await(await request(filter+'&search=Tagged 64')).json()).entries).toHaveLength(1)
    expect((await(await request('?section=all&tags='+encodeURIComponent('["Hidden city"]'))).json()).total).toBe(0)
    expect((await(await request('?section=all&previewCharacter='+ids.fade,ids.owner)).json()).tags).toEqual(first.tags)
    expect((await(await request('?section=all',ids.owner)).json()).tags.map((t:any)=>t.name)).toContain('Hidden city')
    for(const bad of ['not-json','{}','[12]','["'+('x'.repeat(49))+'"]'])expect((await request('?section=all&tags='+encodeURIComponent(bad))).status).toBe(400)
  })
  it('allows DM custom tags and removal, preserves legacy clients and text restore, and blocks player tag changes',async()=>{
    const draft={title:'Tagged entry',body:'Known description',section:'journal',codexType:'people',folderId:null,audience:'room',characterIds:[],relevantCharacterIds:[],relatedIds:[],tags:[' Magellan ','MAGELLAN','Custom, tag']}
    const created=await request('/entries',ids.owner,'POST',draft);expect(created.status).toBe(201);const id=(await created.json()).id
    expect((await(await request('/entries/'+id)).json()).tags).toEqual(['Magellan','Custom, tag'])
    const {tags:_,...legacy}=draft
    expect((await request('/entries/'+id,ids.player,'PATCH',{expectedRevision:1,draft:{...legacy,body:'Player text edit'}})).status).toBe(200)
    expect((await(await request('/entries/'+id)).json()).tags).toEqual(['Magellan','Custom, tag'])
    expect((await request('/entries/'+id,ids.player,'PATCH',{expectedRevision:2,draft:{...legacy,tags:['Amdurun']}})).status).toBe(403)
    expect((await request('/entries',ids.player,'POST',draft)).status).toBe(403)
    expect((await request('/entries/'+id+'?previewCharacter='+ids.fade,ids.owner,'PATCH',{expectedRevision:2,draft})).status).toBe(403)
    expect((await request('/entries/'+id,ids.owner,'PATCH',{expectedRevision:2,draft:{...draft,tags:['Amdurun']}})).status).toBe(200)
    expect((await request('/entries/'+id,ids.owner,'PATCH',{expectedRevision:2,draft})).status).toBe(409)
    expect((await request('/entries/'+id+'/restore-version',ids.owner,'POST',{expectedRevision:3,revision:1})).status).toBe(200)
    expect((await(await request('/entries/'+id)).json()).tags).toEqual(['Amdurun'])
    expect((await request('/entries/'+id,ids.owner,'PATCH',{expectedRevision:4,draft:{...legacy,tags:[]}})).status).toBe(200)
    expect((await(await request('/entries/'+id)).json()).tags).toEqual([])
    for(const tags of [Array(21).fill('x'),[''],['x'.repeat(49)],['bad\u0000tag']])expect((await request('/entries',ids.owner,'POST',{...legacy,tags})).status).toBe(400)
  })
  it('reveals quest clues individually without leaking hidden text, IDs, search matches or history',async()=>{
    const hidden={id:'00000000-0000-4000-8000-000000000001',title:'Unrevealed test lead',body:'PrivateCipherword',sessions:[13,12,12],audience:'dm'}
    const shared={...hidden,id:'00000000-0000-4000-8000-000000000002',title:'Gathered evidence',body:'PublicClueword',audience:'room'}
    const draft={title:'Quest fixture',body:'Approved objective',section:'journal',codexType:'quests',folderId:null,audience:'room',characterIds:[],relevantCharacterIds:[],relatedIds:[],questClues:[hidden,shared]}
    const created=await request('/entries',ids.owner,'POST',draft);expect(created.status).toBe(201)
    const id=(await created.json()).id
    for(const user of [ids.player,ids.other]){
      const detail=await(await request('/entries/'+id,user)).json()
      expect(detail.questClues).toEqual([{...shared,sessions:[12,13]}])
      expect(JSON.stringify(detail)).not.toContain(hidden.id);expect(JSON.stringify(detail)).not.toContain(hidden.body)
      const list=await(await request('?section=all&type=quests',user)).json();expect(list.entries).toHaveLength(1);expect(list.entries[0].questClues).toBeUndefined()
      expect((await(await request('?section=all&search=PrivateCipherword',user)).json()).entries).toEqual([])
      expect((await(await request('?section=all&search=PublicClueword',user)).json()).entries.map((e:any)=>e.id)).toEqual([id])
    }
    expect((await(await request('/entries/'+id+'?previewCharacter='+ids.fade,ids.owner)).json()).questClues).toEqual([{...shared,sessions:[12,13]}])
    expect((await(await request('?section=all&search=PrivateCipherword',ids.owner)).json()).entries).toHaveLength(1)
    expect((await(await request('/entries/'+id,ids.owner)).json()).questClues).toHaveLength(2)
    expect(state.versions.at(-1).snapshot.questClues).toBeUndefined()
    expect((await request('/entries/'+id,ids.player,'PATCH',{expectedRevision:1,draft:{...draft,questClues:[]}})).status).toBe(403)
    expect((await request('/entries/'+id+'?previewCharacter='+ids.fade,ids.owner,'PATCH',{expectedRevision:1,draft})).status).toBe(403)
    const reveal={...draft,questClues:[{...hidden,audience:'room'},shared]}
    expect((await request('/entries/'+id,ids.owner,'PATCH',{expectedRevision:1,draft:reveal})).status).toBe(200)
    expect((await(await request('/entries/'+id)).json()).questClues).toHaveLength(2)
    expect((await request('/entries/'+id,ids.owner,'PATCH',{expectedRevision:1,draft})).status).toBe(409)
    expect((await request('/entries/'+id,ids.owner,'PATCH',{expectedRevision:2,draft})).status).toBe(200)
    // Old clients and status/text changes preserve clue contents and the latest sharing.
    const {questClues:_,...oldDraft}=draft
    expect((await request('/entries/'+id,ids.owner,'PATCH',{expectedRevision:3,draft:{...oldDraft,questStatus:'finished'}})).status).toBe(200)
    expect((await request('/entries/'+id+'/restore-version',ids.owner,'POST',{expectedRevision:4,revision:2})).status).toBe(200)
    expect((await(await request('/entries/'+id)).json()).questClues).toEqual([{...shared,sessions:[12,13]}])
    const history=await(await request('/entries/'+id+'/history')).json();expect(JSON.stringify(history)).not.toContain(hidden.body);expect(JSON.stringify(history)).not.toContain(hidden.id)
    expect((await request('/entries/'+id,ids.owner,'PATCH',{expectedRevision:5,draft:{...oldDraft,questClues:[]}})).status).toBe(200)
    expect((await(await request('/entries/'+id,ids.owner)).json()).questClues).toEqual([])
  })
  it('validates clue limits, sources and unique IDs and defaults new clues to DM only',async()=>{
    const clue={id:'00000000-0000-4000-8000-000000000001',title:'Test clue',body:'',sessions:[12]}
    const draft={title:'Quest fixture',body:'',section:'journal',codexType:'quests',folderId:null,audience:'room',characterIds:[],relevantCharacterIds:[],relatedIds:[]}
    const invalids=[[{...clue,sessions:[0]}],[{...clue,sessions:[1.5]}],[{...clue,sessions:[10001]}],[{...clue,sessions:Array(101).fill(12)}],[{...clue,audience:'characters'}],[{...clue,title:''}],[{...clue,id:'x'}],[{...clue,body:'x'.repeat(4001)}],[clue,clue],Array(51).fill(clue)]
    for(const questClues of invalids)expect((await request('/entries',ids.owner,'POST',{...draft,questClues})).status).toBe(400)
    expect((await request('/entries',ids.owner,'POST',{...draft,codexType:'people',questClues:[clue]})).status).toBe(400)
    const created=await request('/entries',ids.owner,'POST',{...draft,questClues:[clue]});expect(created.status).toBe(201)
    const id=(await created.json()).id
    expect((await(await request('/entries/'+id,ids.owner)).json()).questClues[0].audience).toBe('dm')
    expect((await(await request('/entries/'+id)).json()).questClues).toEqual([])
  })
  it('shares revealed quests with both players and prevents folder or selective sharing',async()=>{
    const draft={title:'Investigate the workshop',body:'Known objective.\n\n## Források\n- 12. session.',section:'journal',codexType:'quests',folderId:null,audience:'room',characterIds:[],relevantCharacterIds:[],relatedIds:[ids.privateNote],questStatus:'active'}
    for(const changes of [{audience:'characters',characterIds:[ids.fade]},{folderId:ids.secret},{folderId:ids.root},{questStatus:'unknown'}])expect((await request('/entries',ids.owner,'POST',{...draft,...changes})).status).toBe(400)
    const created=await request('/entries',ids.owner,'POST',draft);expect(created.status).toBe(201)
    const id=(await created.json()).id
    for(const user of [ids.player,ids.other]){
      const detail=await(await request('/entries/'+id,user)).json()
      expect(detail).toMatchObject({audience:'room',folderId:null,codexType:'quests',questStatus:'active'})
      expect(detail.connections).toEqual([])
      const list=await(await request('?section=all&type=quests&questStatus=active',user)).json()
      expect(list.entries.map((e:any)=>e.id)).toEqual([id]);expect(list.questCounts).toEqual({active:1,finished:0})
    }
    expect((await(await request('/entries/'+id,ids.owner)).json()).connections).toEqual([expect.objectContaining({title:'Secret truth'})])
  })
  it('prepares quests privately, reveals and hides them without leaking clues or navigation metadata',async()=>{
    const clue={id:'00000000-0000-4000-8000-000000000001',title:'Shared evidence',body:'CipherEvidence',sessions:[12],audience:'room'}
    const draft={title:'FutureQuestCipher',body:'Prepared objective',section:'journal',codexType:'quests',folderId:null,audience:'dm',characterIds:[],relevantCharacterIds:[],relatedIds:[ids.publicNote],questStatus:'active',tags:['FutureTagCipher'],questClues:[clue,{...clue,id:'00000000-0000-4000-8000-000000000002',title:'Private evidence',audience:'dm'}]}
    const created=await request('/entries',ids.owner,'POST',draft);expect(created.status).toBe(201)
    const id=(await created.json()).id
    async function hidden() {
      for(const user of [ids.player,ids.other]){
        for(const suffix of ['/entries/'+id,'/entries/'+id+'/history'])expect((await request(suffix,user)).status).toBe(404)
        for(const suffix of ['', '&search=FutureQuestCipher','&search=CipherEvidence','&ids='+id,'&tags='+encodeURIComponent('["FutureTagCipher"]')]){
          const list=await(await request('?section=all'+suffix,user)).json()
          expect(list.entries.some((e:any)=>e.id===id)).toBe(false)
          expect(list.tags.some((t:any)=>t.name==='FutureTagCipher')).toBe(false)
          expect(list.counts.quests).toBe(0);expect(list.questCounts).toEqual({active:0,finished:0})
        }
      }
      expect((await(await request('/entries/'+ids.publicNote)).json()).connections.some((e:any)=>e.id===id)).toBe(false)
      expect((await request('/entries/'+id+'?previewCharacter='+ids.fade,ids.owner)).status).toBe(404)
    }
    await hidden()
    expect((await request('/entries/'+id,ids.owner,'PATCH',{expectedRevision:1,draft:{...draft,audience:'room'}})).status).toBe(200)
    for(const user of [ids.player,ids.other]){
      const detail=await(await request('/entries/'+id,user)).json();expect(detail.questClues.map((c:any)=>c.title)).toEqual(['Shared evidence'])
      expect((await(await request('?section=all&type=quests',user)).json()).entries.map((e:any)=>e.id)).toEqual([id])
      expect((await request('/entries/'+id,user,'PATCH',{expectedRevision:2,draft})).status).toBe(403)
      const history=await(await request('/entries/'+id+'/history',user)).json();expect(history.versions.map((v:any)=>v.revision)).toEqual([2])
    }
    expect((await request('/entries/'+id+'?previewCharacter='+ids.fade,ids.owner,'PATCH',{expectedRevision:2,draft})).status).toBe(403)
    expect((await request('/entries/'+id,ids.owner,'PATCH',{expectedRevision:2,draft:{...draft,questStatus:'finished'}})).status).toBe(200)
    await hidden()
    expect((await request('/entries/'+id+'/restore-version',ids.owner,'POST',{expectedRevision:3,revision:2})).status).toBe(200)
    expect((await(await request('/entries/'+id,ids.owner)).json()).audience).toBe('dm')
    await hidden()
    expect((await request('/entries/'+id,ids.owner,'PATCH',{expectedRevision:3,draft:{...draft,audience:'room'}})).status).toBe(409)
  })
  it('reserves quest creation, edits, status, conversion and history actions for the DM',async()=>{
    const draft={title:'Workshop deal',body:'Known terms',section:'journal',codexType:'quests',folderId:null,audience:'room',characterIds:[],relevantCharacterIds:[],relatedIds:[]}
    expect((await request('/entries',ids.player,'POST',draft)).status).toBe(403)
    expect((await request('/entries/'+ids.publicNote,ids.player,'PATCH',{expectedRevision:1,draft})).status).toBe(403)
    const created=await request('/entries',ids.owner,'POST',draft),id=(await created.json()).id
    const update={expectedRevision:1,draft:{...draft,questStatus:'finished'}}
    expect((await request('/entries/'+id,ids.player,'PATCH',update)).status).toBe(403)
    for(const action of ['delete','restore-version'])expect((await request('/entries/'+id+'/'+action,ids.player,'POST',{expectedRevision:1,revision:1})).status).toBe(403)
    expect((await request('/entries/'+id+'?previewCharacter='+ids.fade,ids.owner,'PATCH',update)).status).toBe(403)
    expect((await request('/entries/'+id,ids.owner,'PATCH',{expectedRevision:1,draft:{...draft,codexType:'people'}})).status).toBe(400)
    expect((await request('/entries/'+id,ids.owner,'PATCH',update)).status).toBe(200)
    expect((await request('/entries/'+id,ids.owner,'PATCH',update)).status).toBe(409)
    // Old clients omit status; text edits and history restoration must preserve Finished.
    expect((await request('/entries/'+id,ids.owner,'PATCH',{expectedRevision:2,draft:{...draft,body:'Updated terms'}})).status).toBe(200)
    expect((await request('/entries/'+id+'/restore-version',ids.owner,'POST',{expectedRevision:3,revision:1})).status).toBe(200)
    expect((await(await request('/entries/'+id,ids.player)).json()).questStatus).toBe('finished')
    expect((await request('/entries/'+id,ids.owner,'PATCH',{expectedRevision:4,draft:{...draft,questStatus:'active'}})).status).toBe(200)
    expect((await(await request('?section=all&type=quests&questStatus=finished')).json()).entries).toEqual([])
    expect((await(await request('?section=all&type=quests')).json()).questCounts).toEqual({active:1,finished:0})
  })
  it('filters quest status before pagination, keeps finished quests visible and excludes inaccessible metadata',async()=>{
    for(let n=0;n<65;n++)state.docs.push(record((n+200).toString(16).padStart(24,'0'),'entry',{title:'Finished '+String(n).padStart(2,'0'),codexType:'quests',questStatus:'finished'}))
    state.docs.push(record('9'.repeat(24),'entry',{title:'Active quest',codexType:'quests'}),record('d'.repeat(24),'entry',{title:'Private draft',codexType:'quests',audience:'dm'}),record('e'.repeat(24),'entry',{title:'Deleted quest',codexType:'quests',deletedAt:new Date()}))
    const first=await(await request('?section=all&type=quests&questStatus=finished')).json()
    expect(first.total).toBe(65);expect(first.entries).toHaveLength(60);expect(first.nextOffset).toBe(60)
    expect(first.questCounts).toEqual({active:1,finished:65});expect(first.counts.quests).toBe(66)
    const second=await(await request('?section=all&type=quests&questStatus=finished&offset=60')).json()
    expect(second.entries).toHaveLength(5);expect(second.nextOffset).toBe(null)
    expect((await(await request('?section=all&type=quests&questStatus=active')).json()).entries.map((e:any)=>e.title)).toEqual(['Active quest'])
    expect((await(await request('?section=all&type=quests&questStatus=finished&search=Finished 64')).json()).entries).toHaveLength(1)
    expect((await request('?section=all&questStatus=unknown')).status).toBe(400)
  })
  it('stores place covers only on authorized details, preserves old clients and text-only restore, and supports removal',async()=>{
    const coverImage='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aE1kAAAAASUVORK5CYII='
    const draft={title:'City',body:'Description',section:'journal',codexType:'places',folderId:ids.child,audience:'room',characterIds:[],relevantCharacterIds:[],relatedIds:[],coverImage}
    const created=await request('/entries',ids.owner,'POST',draft)
    expect(created.status).toBe(201)
    const id=(await created.json()).id
    expect((await(await request('/entries/'+id)).json()).coverImage).toBe(coverImage)
    expect((await request('/entries/'+id,ids.other)).status).toBe(200)
    expect((await(await request('?section=all',ids.owner)).json()).entries.every((e:any)=>!('coverImage' in e))).toBe(true)
    expect((await request('/entries/'+id+'?previewCharacter='+ids.fade,ids.owner,'PATCH',{expectedRevision:1,draft:{...draft,coverImage:''}})).status).toBe(403)
    const {coverImage:_,...oldDraft}=draft
    expect((await request('/entries/'+id,ids.owner,'PATCH',{expectedRevision:1,draft:oldDraft})).status).toBe(200)
    expect((await(await request('/entries/'+id,ids.owner)).json()).coverImage).toBe(coverImage)
    expect(state.versions.at(-1).snapshot.coverImage).toBeUndefined()
    expect((await request('/entries/'+id,ids.owner,'PATCH',{expectedRevision:2,draft:{...draft,coverImage:''}})).status).toBe(200)
    expect((await request('/entries/'+id+'/restore-version',ids.owner,'POST',{expectedRevision:3,revision:1})).status).toBe(200)
    expect((await(await request('/entries/'+id,ids.owner)).json()).coverImage).toBe('')
    expect((await request('/entries',ids.owner,'POST',{...draft,codexType:'people'})).status).toBe(400)
    expect((await request('/entries',ids.owner,'POST',{...draft,coverImage:'data:image/svg+xml;base64,PHN2Zy8+'})).status).toBe(400)
  })
  it('returns categories for accessible place connections in both directions without exposing hidden links',async()=>{
    const city=state.docs.find(d=>d._id===ids.publicNote)
    city.codexType='places'
    city.relatedIds=[ids.privateNote,'d'.repeat(24)]
    state.docs.push(
      record('d'.repeat(24),'entry',{title:'Harbour',codexType:'places'}),
      record('e'.repeat(24),'entry',{title:'Captain',relatedIds:[city._id]}),
      record('f'.repeat(24),'entry',{title:'Secret plot',section:'story-items',audience:'dm',relatedIds:[city._id]}),
    )
    const place=await(await request('/entries/'+city._id)).json()
    expect(place.connections).toEqual(expect.arrayContaining([
      expect.objectContaining({title:'Harbour',codexType:'places',direction:'outgoing'}),
      expect.objectContaining({title:'Captain',codexType:'people',direction:'incoming'}),
    ]))
    expect(place.connections).toHaveLength(2)
    expect(place.relatedIds).toEqual(['d'.repeat(24)])
    const dmPlace=await(await request('/entries/'+city._id,ids.owner)).json()
    expect(dmPlace.connections).toHaveLength(4)
    expect(dmPlace.connections).toEqual(expect.arrayContaining([expect.objectContaining({title:'Secret plot',codexType:'objects'})]))
  })
  it('derives categories and session sources for old entries without persisting a migration',async()=>{
    state.docs.push(record('9'.repeat(24),'entry',{title:'Session 12 — Auction',body:'## Forrás\n- Sessions/Session 12.md',audience:'dm'}),record('d'.repeat(24),'entry',{title:'Book',section:'story-items',body:'## Session-forrás\n- 2., 7. és 12. session.'}))
    const before=structuredClone(state.docs)
    const list=await(await request('?section=all',ids.owner)).json()
    expect(list.counts).toEqual({people:2,places:0,objects:1,factions:0,sessions:1,quests:0,events:0})
    expect(list.sessionEntries).toMatchObject([{title:'Session 12 — Auction',sessions:[12]}])
    const book=(await(await request('?section=all&type=objects',ids.owner)).json()).entries
    expect(book).toMatchObject([{title:'Book',codexType:'objects',sessions:[2,7,12]}])
    expect(book[0]).not.toHaveProperty('body')
    expect(state.docs).toEqual(before)
  })
  it('filters names, categories, counts, source links and bookmarks by entry visibility',async()=>{
    state.docs.push(record('9'.repeat(24),'entry',{title:'Session 12 — Private',body:'## Forrás\n- 12. session.',audience:'dm'}),record('d'.repeat(24),'entry',{title:'Unseen place',codexType:'places',folderId:ids.secret,audience:'dm'}),record('e'.repeat(24),'entry',{title:'Shared book',section:'story-items'}))
    const list=await(await request('?section=all',ids.player)).json()
    expect(list.entries.map((e:any)=>e.title)).toEqual(['Shared book','Shared clue'])
    expect(list.counts).toEqual({people:1,places:0,objects:1,factions:0,sessions:0,quests:0,events:0})
    expect(list.sessionEntries).toEqual([])
    expect((await(await request('?section=all&type=places')).json()).entries).toEqual([])
    expect((await(await request('?section=all&type=pinned&ids='+ids.privateNote)).json()).entries).toEqual([])
    expect((await(await request('?section=all&type=pinned',ids.owner)).json()).entries).toEqual([])
    const preview=await(await request('?section=all&previewCharacter='+ids.fade,ids.owner)).json()
    expect(preview.counts).toEqual(list.counts)
    expect(preview.readOnly).toBe(true)
  })
  it('sorts sessions chronologically and paginates after category filtering',async()=>{
    for(let number=75;number>=1;number--)state.docs.push(record(number.toString(16).padStart(24,'0'),'entry',{title:`Session ${number}`,body:`## Session-forrás\n- ${number}. session.`}))
    const first=await(await request('?section=all&type=sessions',ids.owner)).json()
    expect(first.entries).toHaveLength(60)
    expect(first.total).toBe(75)
    expect(first.nextOffset).toBe(60)
    expect(first.entries.map((e:any)=>e.sessions[0])).toEqual(Array.from({length:60},(_,i)=>i+1))
    const second=await(await request('?section=all&type=sessions&offset=60',ids.owner)).json()
    expect(second.entries.map((e:any)=>e.sessions[0])).toEqual(Array.from({length:15},(_,i)=>i+61))
    expect(second.nextOffset).toBe(null)
  })
  it('keeps raw saved Markdown while presenting sources as session numbers',async()=>{
    const body='## Session-kapcsolat\n- 9. session.\n\n## A levél\n```text\n## Session 20\nActual letter\n```\n\n## Forrás\n- Sessions/Session 9.md\n- Items/Secret note.md'
    state.docs.find(d=>d._id===ids.publicNote).body=body
    const detail=await(await request('/entries/'+ids.publicNote)).json()
    expect(detail.body).toBe(body)
    expect(detail.reading.description).toContain('## Session 20\nActual letter')
    expect(detail.reading.encounters).not.toContain('.md')
    expect(detail.sessions).toEqual([9])
    expect((await(await request('?section=all&search=actual letter')).json()).entries).toHaveLength(1)
  })
  it('lets the DM save categories and move collections with revision and folder checks',async()=>{
    const note=state.docs.find(d=>d._id===ids.publicNote)
    const {title,body,audience,characterIds,relevantCharacterIds}=note
    const draft={title,body,audience,characterIds,relevantCharacterIds,relatedIds:[],folderId:null,section:'story-items',codexType:'objects'}
    expect((await request('/entries/'+note._id,ids.player,'PATCH',{expectedRevision:1,draft})).status).toBe(403)
    expect((await request('/entries/'+note._id,ids.owner,'PATCH',{expectedRevision:1,draft:{...draft,folderId:ids.child}})).status).toBe(400)
    expect((await request('/entries/'+note._id,ids.owner,'PATCH',{expectedRevision:1,draft:{...draft,codexType:'places'}})).status).toBe(400)
    expect((await request('/entries/'+note._id,ids.owner,'PATCH',{expectedRevision:1,draft})).status).toBe(200)
    expect(note).toMatchObject({section:'story-items',codexType:'objects',revision:2,audience:'room'})
    expect((await request('/entries/'+note._id,ids.owner,'PATCH',{expectedRevision:1,draft})).status).toBe(409)
    expect(state.versions).toHaveLength(1)
  })
  it('persists an explicit category on newly created entries and enforces player preview read-only',async()=>{
    const draft={title:'Amdurun',body:'Description',section:'journal',codexType:'places',folderId:null,audience:'dm',characterIds:[],relevantCharacterIds:[],relatedIds:[]}
    expect((await request('/entries?previewCharacter='+ids.fade,ids.owner,'POST',draft)).status).toBe(403)
    const created=await request('/entries',ids.owner,'POST',draft)
    expect(created.status).toBe(201)
    const saved=await(await request('/entries/'+(await created.json()).id,ids.owner)).json()
    expect(saved).toMatchObject({codexType:'places',title:'Amdurun',audience:'dm'})
  })
})


describe('notebook tag catalog',()=>{
  it('saves tags independently, preserves all entry fields, and records a revision',async()=>{
    const entry=state.docs.find(d=>d._id===ids.privateNote)
    entry.coverImage='existing-cover';entry.tags=['Old'];entry.questClues=[{id:'local',body:'Private evidence'}]
    const before=structuredClone(entry)
    const response=await request('/entries/'+entry._id+'/tags',ids.owner,'PATCH',{expectedRevision:1,tags:['  City  ','city','Plot lead']})
    expect(response.status).toBe(200);expect(await response.json()).toMatchObject({tags:['City','Plot lead'],revision:2,editedBy:'Test DM'})
    for(const key of Object.keys(before).filter(key=>!['tags','revision','editedBy','updatedAt'].includes(key)))expect(entry[key]).toEqual(before[key])
    expect(state.versions).toHaveLength(1);expect(state.versions[0]).toMatchObject({action:'Tags updated',snapshot:{body:before.body,tags:['City','Plot lead']}})
    expect((await request('/entries/'+entry._id+'/tags',ids.owner,'PATCH',{expectedRevision:1,tags:[]})).status).toBe(409)
    expect(entry.tags).toEqual(['City','Plot lead']);expect(state.versions).toHaveLength(1)
  })
  it('guards quick tag assignment with DM, room, preview, active-entry and strict value checks',async()=>{
    const suffix='/entries/'+ids.publicNote+'/tags',body={expectedRevision:1,tags:['Known']}
    expect((await request(suffix,ids.player,'PATCH',body)).status).toBe(403)
    expect((await request(suffix+'?previewCharacter='+ids.fade,ids.owner,'PATCH',body)).status).toBe(403)
    expect((await request(suffix,'f'.repeat(24),'PATCH',body)).status).toBe(404)
    expect((await request('/entries/'+ids.root+'/tags',ids.owner,'PATCH',body)).status).toBe(403)
    for(const change of [{body:'Overwrite'},{expectedRevision:0},{tags:Array.from({length:21},(_,i)=>'Tag '+i)},{tags:['x'.repeat(49)]},{tags:['bad\u0000tag']},{tags:['']}])expect((await request(suffix,ids.owner,'PATCH',{...body,...change})).status).toBe(400)
    state.docs.find(d=>d._id===ids.publicNote).deletedAt=new Date()
    expect((await request(suffix,ids.owner,'PATCH',body)).status).toBe(403)
    expect(state.versions).toHaveLength(0)
  })
  it('persists independent tags without changing entries and deduplicates simultaneous names',async()=>{
    const before=JSON.stringify(state.docs)
    const responses=await Promise.all([request('/tags',ids.owner,'POST',{name:'  Árny   lead  '}),request('/tags',ids.owner,'POST',{name:'ÁRNY lead'})])
    expect(responses.map(r=>r.status).sort()).toEqual([200,201])
    expect(state.catalog).toEqual([{key:'árny lead',name:'Árny lead'}])
    expect((await(await request('?section=all',ids.owner)).json()).tags).toEqual([{name:'Árny lead',count:0}])
    expect(JSON.stringify(state.docs)).toBe(before);expect(state.versions).toEqual([])
    state.docs.find(d=>d._id===ids.publicNote).tags=['ÁRNY lead']
    expect((await(await request('?section=all',ids.owner)).json()).tags).toEqual([{name:'ÁRNY lead',count:1}])
  })
  it('hides unused and private tags from players and preview and blocks their creation',async()=>{
    expect((await request('/tags',ids.owner,'POST',{name:'Future secret'})).status).toBe(201)
    state.docs.find(d=>d._id===ids.privateNote).tags=['Private plot']
    state.docs.find(d=>d._id===ids.publicNote).tags=['Known lead']
    for(const [user,suffix] of [[ids.player,''],[ids.owner,'&previewCharacter='+ids.fade]]){
      const list=await(await request('?section=all'+suffix,user)).json()
      expect(list.tags).toEqual([{name:'Known lead',count:1}])
    }
    expect((await request('/tags',ids.player,'POST',{name:'No'})).status).toBe(403)
    expect((await request('/tags?previewCharacter='+ids.fade,ids.owner,'POST',{name:'No'})).status).toBe(403)
    expect((await fetch(base+'/tags',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"name":"No"}'})).status).toBe(401)
    expect(state.catalog).toHaveLength(1)
  })
  it('validates names and bounds the catalog while allowing an existing name at capacity',async()=>{
    for(const name of ['', ' ', 'x'.repeat(49),'bad\u0000tag'])expect((await request('/tags',ids.owner,'POST',{name})).status).toBe(400)
    state.catalog=Array.from({length:500},(_,i)=>({key:'tag '+i,name:'Tag '+i}))
    expect((await request('/tags',ids.owner,'POST',{name:'Tag 501'})).status).toBe(409)
    expect((await request('/tags',ids.owner,'POST',{name:'TAG 1'})).status).toBe(200)
    expect(state.catalog).toHaveLength(500)
  })
})
