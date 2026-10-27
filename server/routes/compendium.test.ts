import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import express, { type Request, type Response, type NextFunction } from 'express'
import type { Server } from 'node:http'
import { emptyCharacter } from '../../shared/character'
import { EDITABLE_KINDS, cloneEntry, type EntryData } from '../../shared/compendium-editing'
import { newWorkshopDraft } from '../../shared/homebrew-workshop'
import {builderExample} from '../../shared/entry-builder-examples'
import {entryRuleDraft,entryMonsterDraft,entryItemDraft,entrySpellDraft,entryOptionDraft} from '../../shared/entry-builders'

const db=vi.hoisted(()=>{
  type Doc=Record<string,any>
  const content:Doc[]=[],characters:Doc[]=[],sources=new Map<string,EntryData>()
  let sequence=0
  const matches=(doc:Doc,filter:Doc)=>Object.entries(filter).every(([key,value])=>{
    const actual=key.split('.').reduce((o,k)=>o?.[k],doc)
    return actual instanceof Date||value instanceof Date?String(actual)===String(value):actual===value
  })
  const query=(load:()=>unknown)=>{const result={lean:async()=>load(),select:()=>result,sort:()=>result};return result}
  const model=(docs:Doc[])=>({
    find:(filter:Doc)=>query(()=>docs.filter(d=>matches(d,filter))),
    findOne:(filter:Doc)=>query(()=>docs.find(d=>matches(d,filter))??null),
    createIndexes:async()=>{},
    create:async(value:Doc)=>{
      if(docs.some(d=>d.userId===value.userId&&d.type===value.type&&d.sourceHash===value.sourceHash))throw Object.assign(new Error('Duplicate'),{code:11000})
      const doc={...value,_id:(++sequence).toString(16).padStart(24,'0'),updatedAt:new Date()};docs.push(doc);return doc
    },
    findOneAndUpdate:(filter:Doc,update:Doc)=>query(()=>{
      const doc=docs.find(d=>matches(d,filter));if(!doc)return null
      Object.assign(doc,update.$set,{updatedAt:new Date(Date.now()+1000)});return doc
    }),
  })
  return {content,characters,sources,contentModel:model(content),characterModel:model(characters)}
})
vi.mock('../models/CustomContent',()=>({CustomContent:db.contentModel}))
vi.mock('../models/Character',()=>({Character:db.characterModel}))
vi.mock('../lib/compendium-source',()=>({compendiumSource:async(user:string,kind:string,index:string)=>user==='owner'?db.sources.get(`${kind}:${index}`)??null:null}))
vi.mock('../lib/workshop-library',()=>({workshopLibrary:async()=>({rules:[],initial:{},catalog:Object.fromEntries(EDITABLE_KINDS.map(k=>[k,[]]))})}))
vi.mock('../lib/character-output',()=>({savedCharacterOutput:(value:unknown)=>value}))
vi.mock('../middleware/auth',()=>({requireAuth:(req:Request,res:Response,next:NextFunction)=>{const user=req.get('x-user');if(!user)return res.status(401).json({error:'Unauthorized'});req.userId=user;next()}}))
import router from './compendium'
let server:Server,base:string
beforeAll(async()=>{const app=express();app.use(express.json({limit:'4mb'}));app.use(router);server=await new Promise<Server>(resolve=>{const listener=app.listen(0,'127.0.0.1',()=>resolve(listener))});const address=server.address();if(!address||typeof address==='string')throw Error('No address');base=`http://127.0.0.1:${address.port}`})
afterAll(()=>new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve())))
beforeEach(()=>{db.content.length=0;db.characters.length=0;db.sources.clear();for(const kind of EDITABLE_KINDS)db.sources.set(`${kind}:example`,{index:'example',name:'Example',url:'',description:'Original rule',details:{':unknown':{nested:[0,false,'preserve me']}},aliases:['old-example']})})
async function request(path:string,method='GET',body?:unknown,user='owner'){return fetch(base+path,{method,headers:{'Content-Type':'application/json',connection:'close',...(user?{'x-user':user}:{})},body:body===undefined?undefined:JSON.stringify(body)}) as Promise<Omit<Awaited<ReturnType<typeof fetch>>,'json'>&{json:()=>Promise<any>}>}
async function state(kind='feats'){const response=await request(`/${kind}/example`);expect(response.status).toBe(200);return response.json()}
async function save(kind='feats',description='Revised rule'){const current=await state(kind);return request(`/${kind}/example`,'PUT',{expectedRevision:current.revision,expectedSourceHash:current.sourceHash,entry:{...current.entry,description}})}
function character(){const c={...emptyCharacter(),_id:'a'.repeat(24),userId:'owner',updatedAt:new Date('2026-10-23T00:00:00Z'),compendiumRules:undefined as unknown[]|undefined};c.meta.name='Test hero';c.features=[{name:'Example',description:'Original rule',origin:'feat',pinned:true}];c.combat.hpCurrent=4;c.combat.hpTemp=3;c.resources=[{id:'spent',name:'Uses',max:3,used:2,recovery:'long'}];return c}
describe('personal Compendium editions',()=>{
  it.each(EDITABLE_KINDS)('saves a prefilled %s builder twice and restores source without character writes',async kind=>{
    const source:EntryData={...builderExample(kind),index:'example'},entry=cloneEntry(source) as EntryData;db.sources.set(`${kind}:example`,source)
    const renamed='Updated example'
    if(['classes','subclasses','races','subraces'].includes(kind)){const d=entryRuleDraft(source,kind==='classes'?'class':kind==='subclasses'?'subclass':'race');d.name=renamed;entry.workshop=d}
    else if(kind==='monsters'){const d=entryMonsterDraft(source);d.name=renamed;entry.monsterDraft=d}
    else if(kind==='equipment'||kind==='magic-items'){const d=entryItemDraft(source,kind==='magic-items');d.name=renamed;entry.workshopItem=d}
    else if(kind==='spells'){const d=entrySpellDraft(source);d.name=renamed;d.school='illusion';entry.spellBuilder=d}
    else {const d=entryOptionDraft(source);d.name=renamed;entry.optionBuilder=d}
    const current=await state(kind),response=await request(`/${kind}/example`,'PUT',{entry,expectedRevision:0,expectedSourceHash:current.sourceHash});expect(response.status).toBe(200);const saved=await response.json();expect(saved.entry.name).toBe(renamed);expect(saved.entry.index).toBe('example');expect(saved.entry.details).toEqual(source.details)
    const again=await request(`/${kind}/example`,'PUT',{entry:saved.entry,expectedRevision:1,expectedSourceHash:current.sourceHash});expect(again.status).toBe(200);expect(db.characters).toHaveLength(0)
    const restored=await request(`/${kind}/example`,'PUT',{restore:true,expectedRevision:2,expectedSourceHash:current.sourceHash});expect(restored.status).toBe(200);expect((await restored.json()).entry).toEqual(source)
  })
  it.each(EDITABLE_KINDS)('saves and restores %s while retaining identity and unknown source fields',async kind=>{
    const source=cloneEntry(db.sources.get(`${kind}:example`))
    const saved=await save(kind);expect(saved.status).toBe(200);const edition=await saved.json();expect(edition.entry.description).toBe('Revised rule');expect(edition.entry.details).toEqual(source?.details);expect(edition.entry.aliases).toEqual(['old-example']);expect(db.sources.get(`${kind}:example`)).toEqual(source)
    const list=await(await request(`/${kind}`)).json();expect(list).toHaveLength(1)
    const restored=await request(`/${kind}/example`,'PUT',{expectedRevision:1,expectedSourceHash:edition.sourceHash,restore:true});expect(restored.status).toBe(200);expect((await restored.json()).entry).toEqual(source);expect(await(await request(`/${kind}`)).json()).toEqual([]);expect((await state(kind)).revision).toBe(2)
  })
  it('requires authentication and never exposes another account’s edition',async()=>{expect((await request('/feats/example','GET',undefined,'')).status).toBe(401);await save();expect((await request('/feats/example','GET',undefined,'stranger')).status).toBe(404);expect(await(await request('/feats','GET',undefined,'stranger')).json()).toEqual([])})
  it('rejects stale drafts and source replacement, retaining the winning edition',async()=>{const original=await state();await save();expect((await request('/feats/example','PUT',{expectedRevision:0,expectedSourceHash:original.sourceHash,entry:{...original.entry,description:'lost'}})).status).toBe(409);const latest=await state();db.sources.get('feats:example')!.description='New upstream';expect((await request('/feats/example','PUT',{expectedRevision:1,expectedSourceHash:latest.sourceHash,entry:latest.entry})).status).toBe(409);expect((await state()).sourceChanged).toBe(true)})
  it('rejects identity edits, invalid types, reserved keys, blank names and invalid native rules',async()=>{
    const current=await state();for(const changed of [{index:'other'},{aliases:[]},{description:123},{name:' '},{details:JSON.parse('{"constructor":{"x":true}}')}])expect((await request('/feats/example','PUT',{expectedRevision:0,expectedSourceHash:current.sourceHash,entry:{...current.entry,...changed}})).status).toBe(400)
    expect((await request('/not-a-category/example')).status).toBe(404)
    const draft=newWorkshopDraft();db.sources.get('classes:example')!.workshop=draft;const native=await state('classes');expect((await request('/classes/example','PUT',{expectedRevision:0,expectedSourceHash:native.sourceHash,entry:{...native.entry,workshop:{...draft,features:null}}})).status).toBe(400)
  })
  it('keeps restored revisions as tombstones so an old tab cannot recreate an overwritten save',async()=>{const first=await state();const saved=await(await save()).json();await request('/feats/example','PUT',{expectedRevision:1,expectedSourceHash:saved.sourceHash,restore:true});expect((await request('/feats/example','PUT',{expectedRevision:0,expectedSourceHash:first.sourceHash,entry:first.entry})).status).toBe(409)})
  it('uses native Workshop validation and keeps the Compendium reader fields in sync',async()=>{
    const draft=newWorkshopDraft();draft.name='Example';draft.skillCount=0;db.sources.get('classes:example')!.workshop=draft
    const current=await state('classes');const response=await request('/classes/example','PUT',{expectedRevision:0,expectedSourceHash:current.sourceHash,entry:{...current.entry,workshop:{...draft,name:'Revised class',description:'Native edited rules',hitDie:12}}})
    expect(response.status).toBe(200);const result=await response.json();expect(result.entry).toMatchObject({name:'Revised class',description:'Native edited rules',hit_die:12,workshop:{id:draft.id,name:'Revised class'}})
    const restored=await request('/classes/example','PUT',{expectedRevision:1,expectedSourceHash:result.sourceHash,restore:true});const restoredState=await restored.json();expect(restoredState.edited).toBe(false);expect(restoredState.entry).toEqual(current.source);expect(db.sources.get('classes:example')).toEqual(current.source)
  })
  it('rebuilds readable fields when retained Orcbrew rules are edited without changing the reference identity',async()=>{
    const source=db.sources.get('feats:example')!;source.homebrew=true;source.contentKey='example';source.details={':name':'Example',':description':'Original rule',':unknown':{zero:0,enabled:false}}
    const current=await state();const entry=cloneEntry(current.entry);entry.details[':description']='Edited raw source rule'
    const response=await request('/feats/example','PUT',{expectedRevision:0,expectedSourceHash:current.sourceHash,entry});expect(response.status).toBe(200);const result=await response.json();expect(result.entry.description).toBe('Edited raw source rule');expect(result.entry.index).toBe('example');expect(result.entry.aliases).toEqual(['old-example']);expect(result.entry.details[':unknown']).toEqual({zero:0,enabled:false});expect(source.description).toBe('Original rule')
  })
  it('keeps imported item reader statistics aligned with edited item mechanics',async()=>{
    const source=db.sources.get('equipment:example')!;source.workshopItem={name:'Example',qty:1,weight:2,equipped:false,notes:'',kind:'gear'};source.itemView={description:'Item rules',stats:[['Weight','2 lb']],filterItem:source.workshopItem}
    const current=await state('equipment'),entry=cloneEntry(current.entry);entry.workshopItem.weight=4
    const response=await request('/equipment/example','PUT',{expectedRevision:0,expectedSourceHash:current.sourceHash,entry});expect(response.status).toBe(200);const result=await response.json();expect(result.entry.itemView.stats).toContainEqual(['Weight','4 lb']);expect(result.entry.workshopItem.weight).toBe(4);expect((source.workshopItem as EntryData).weight).toBe(2)
  })
})
describe('review before character propagation',()=>{
  it('saves selected benefits in every category and enforces their typed values',async()=>{
    for(const kind of EDITABLE_KINDS){const current=await state(kind),body={expectedRevision:current.revision,expectedSourceHash:current.sourceHash,entry:{...current.entry,benefits:[{type:'damage-resistance',value:'necrotic',level:1}]}};const response=await request(`/${kind}/example`,'PUT',body);expect(response.status,kind).toBe(200);expect((await response.json()).entry.benefits).toEqual(body.entry.benefits)}
    const current=await state('feats');expect((await request('/feats/example','PUT',{expectedRevision:current.revision,expectedSourceHash:current.sourceHash,entry:{...current.entry,benefits:[{type:'damage-resistance',value:'invented',level:1}]}})).status).toBe(400)
  })
  it('shows mechanical benefit differences before a separate character approval',async()=>{
    const c=character();db.characters.push(c);const current=await state(),entry={...current.entry,benefits:[{type:'damage-resistance',value:'necrotic',level:1}]};expect((await request('/feats/example','PUT',{expectedRevision:0,expectedSourceHash:current.sourceHash,entry})).status).toBe(200);expect(c.compendiumRules).toBeUndefined();const review=await(await request('/feats/example/review')).json(),row=review.characters[0];expect(row.changes.find((v:EntryData)=>v.field==='benefits and defenses').after.effective.resistances).toEqual(['necrotic']);expect(c.compendiumRules).toBeUndefined();expect((await request(`/feats/example/review/${c._id}`,'POST',{expectedRevision:review.revision,expectedUpdatedAt:row.updatedAt,reviewHash:row.reviewHash,confirmedSource:true})).status).toBe(200);expect((c.compendiumRules?.[0] as EntryData)?.entry).toMatchObject({benefits:entry.benefits})
  })
  it('saving and reviewing are read-only for characters; apply updates one owned sheet and preserves play state',async()=>{
    const c=character();db.characters.push(c);const before=structuredClone(c);await save();expect(c).toEqual(before)
    const response=await request('/feats/example/review');expect(response.status).toBe(200);const review=await response.json(),row=review.characters[0];expect(row.changes.find((v:EntryData)=>v.field==='features').after[0].description).toBe('Revised rule');expect(c).toEqual(before)
    const payload={expectedRevision:review.revision,expectedUpdatedAt:row.updatedAt,reviewHash:row.reviewHash,confirmedSource:false}
    expect((await request(`/feats/example/review/${c._id}`,'POST',payload)).status).toBe(400)
    expect((await request(`/feats/example/review/${c._id}`,'POST',{...payload,confirmedSource:true},'stranger')).status).toBe(404)
    expect((await request(`/feats/example/review/${c._id}`,'POST',{...payload,confirmedSource:true})).status).toBe(200)
    expect(c.features[0]?.description).toBe('Revised rule');expect(c.features[0]?.pinned).toBe(true);expect(c.combat).toEqual(before.combat);expect(c.resources).toEqual(before.resources);expect(c.compendiumRules).toHaveLength(1)
    await save('feats','Next edition');expect(c.features[0]?.description).toBe('Revised rule')
    const next=await(await request('/feats/example/review')).json();expect(next.characters[0].changes.find((v:EntryData)=>v.field==='features').after[0].description).toBe('Next edition')
  })
  it('rejects a stale character, stale edition and changed review hash',async()=>{
    const c=character();db.characters.push(c);await save();const review=await(await request('/feats/example/review')).json(),row=review.characters[0],payload={expectedRevision:review.revision,expectedUpdatedAt:row.updatedAt,reviewHash:row.reviewHash,confirmedSource:true}
    expect((await request(`/feats/example/review/${c._id}`,'POST',{...payload,reviewHash:'0'.repeat(64)})).status).toBe(409)
    c.updatedAt=new Date('2026-10-23T01:00:00Z');expect((await request(`/feats/example/review/${c._id}`,'POST',payload)).status).toBe(409)
    await save('feats','Newer');expect((await request(`/feats/example/review/${c._id}`,'POST',{...payload,expectedUpdatedAt:c.updatedAt.toISOString()})).status).toBe(409)
  })
  it('offers no automatic overwrite for custom feature text',async()=>{const c=character();c.features[0]!.description='My custom rule';db.characters.push(c);await save();const review=await(await request('/feats/example/review')).json();expect(review.characters[0].changes).toEqual([]);expect(review.characters[0].warnings.join(' ')).toMatch(/manual review/)})
})
