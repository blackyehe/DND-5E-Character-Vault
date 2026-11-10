import {afterAll,beforeAll,beforeEach,describe,expect,it,vi} from 'vitest'
import mongoose from 'mongoose'
import express,{type Request,type Response,type NextFunction} from 'express'
import type {Server} from 'node:http'
import {env} from '../env'
import {CustomContent} from '../models/CustomContent'
import {Character} from '../models/Character'
import {Room} from '../models/Room'
import {newOptionDraft} from '../../shared/option-workshop'
import {newSpellDraft} from '../../shared/spell-workshop'
import {newWorkshopDraft,newWorkshopResource} from '../../shared/homebrew-workshop'
import {emptyCharacter,type EquipmentItem} from '../../shared/character'
import {benefitSpellAttack,benefitSpellDC} from '../../shared/rule-benefits'
import {definitionIdentity,editIdentity,saveNativeDefinition} from '../lib/definition-editions'
import {workshopLibrary,resolveWorkshopCharacter} from '../lib/workshop-library'
import {reviewedCharacter} from '../lib/compendium-character'
import {captureSelectedDefinitions} from '../lib/selected-options'
import {newOptionTracker} from '../../shared/option-trackers'
import {newLinkedTracker} from '../../shared/linked-trackers'
import {resourcesFor} from '../../shared/character-resources'
import {restUpdate} from '../../shared/character-rest'
import {playUpdate} from '../../shared/rooms'

vi.mock('../middleware/auth',()=>({requireAuth:(req:Request,res:Response,next:NextFunction)=>{req.userId=req.get('x-user');return req.userId?next():res.sendStatus(401)}}))
import compendium from './compendium'
import workshop from './workshop'
import items from './items'
import rooms from './rooms'
import characters from './characters'
let server:Server,base:string,owner:string
async function request(path:string,method='GET',body?:unknown,user=owner){const response=await fetch(base+path,{method,headers:{'content-type':'application/json','x-user':user,connection:'close'},body:body===undefined?undefined:JSON.stringify(body)});return {status:response.status,body:await response.json() as any}}
async function saveEdition(kind:string,index:string,change:(entry:any)=>void){const response=await request(`/compendium/${kind}/${index}`);expect(response.status,JSON.stringify(response.body)).toBe(200);const state=response.body;const entry=structuredClone(state.entry);change(entry);return request(`/compendium/${kind}/${index}`,'PUT',{expectedRevision:state.revision,expectedSourceHash:state.sourceHash,entry})}
async function publish(kind:'options'|'spells',draft:any){return request(`/workshop/${kind}/publish`,'POST',{draft,target:draft.published?{packId:draft.published.packId,expectedHash:draft.published.packHash}:{filename:`${draft.id}.orcbrew`},expectedRevision:draft.published?.revision??0})}
async function apply(kind:string,index:string,id:string){const review=(await request(`/compendium/${kind}/${index}/review`)).body,row=review.characters.find((r:any)=>r.id===id);expect(row).toBeDefined();return request(`/compendium/${kind}/${index}/review/${id}`,'POST',{expectedRevision:review.revision,expectedUpdatedAt:row.updatedAt,reviewHash:row.reviewHash,confirmedSource:true})}
const bonuses=(n:number)=>[{type:'spell-attack-bonus',value:n},{type:'spell-dc-bonus',value:n}]
describe.skipIf(process.env.DEFINITION_CONSISTENCY_TESTS!=='1')('shared definition saves with real MongoDB transactions',()=>{
 beforeAll(async()=>{
  expect(env.MONGO_URI).toMatch(/^mongodb:\/\/127\.0\.0\.1:\d+\/definition_consistency_tests_[a-f0-9]+\?replicaSet=definitions$/);expect(Boolean(process.env.VERCEL)).toBe(false)
  await mongoose.connect(env.MONGO_URI,{autoCreate:false,autoIndex:false})
  await CustomContent.createCollection();await CustomContent.createIndexes();await Character.createCollection();await Character.createIndexes();await Room.createCollection();await Room.createIndexes()
  const app=express();app.use(express.json({limit:'4mb'}));app.use('/compendium',compendium);app.use('/workshop',workshop);app.use('/items',items);app.use('/rooms',rooms);app.use('/characters',characters);app.use((error:Error,_req:Request,res:Response,_next:NextFunction)=>res.status(500).json({error:error.message,stack:error.stack}))
  server=await new Promise(resolve=>{const listening=app.listen(0,'127.0.0.1',()=>resolve(listening))});const address=server.address();if(!address||typeof address==='string')throw Error('No fixture address');base=`http://127.0.0.1:${address.port}`
 })
 beforeEach(()=>{owner=String(new mongoose.Types.ObjectId())})
 afterAll(async()=>{try{if(server)await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));if(mongoose.connection.readyState===1&&mongoose.connection.host==='127.0.0.1'&&/^definition_consistency_tests_[a-f0-9]+$/.test(mongoose.connection.name))await mongoose.connection.dropDatabase()}finally{await mongoose.disconnect()}})
 it.each(['options','spells'] as const)('opens Compendium edits in %s, rejects an old tab and keeps explicit removal through another fingerprint',async kind=>{
  const draft=kind==='options'?newOptionDraft('feats'):newSpellDraft();draft.body.name='Shared definition'
  const first=await publish(kind,draft);expect(first.status,JSON.stringify(first.body)).toBe(200);const saved=first.body.draft,index=saved.published.index,category=kind==='options'?'feats':'spells'
  expect((await saveEdition(category,index,entry=>{entry.benefits=bonuses(1)})).status).toBe(200)
  expect((await publish(kind,saved)).status).toBe(409)
  const opened=(await request('/workshop/'+kind)).body[kind][0];expect(opened.benefits).toEqual(bonuses(1));expect(opened.published.definitionRevision).toBe(2)
  opened.benefits=[];opened.body.name='Renamed shared definition'
  const second=await publish(kind,opened);expect(second.status).toBe(200);expect(second.body.draft.published.index).not.toBe(index)
  const state=(await request(`/compendium/${category}/${second.body.draft.published.index}`)).body;expect(state.entry.benefits).toEqual([]);expect(state.entry.name).toBe(opened.body.name);expect(state.revision).toBe(3)
  expect(await CustomContent.countDocuments({userId:owner,type:'compendium-edit'})).toBe(1)
  const other=await request('/workshop/'+kind,'GET',undefined,String(new mongoose.Types.ObjectId()));expect(other.body[kind]).toEqual([])
 })
 it('adopts a legacy personal edition across native aliases without creating a second edition',async()=>{
  const draft=newOptionDraft('feats');draft.body.name='Legacy source';const first=(await publish('options',draft)).body.draft,index=first.published.index
  await CustomContent.updateOne({userId:owner,type:'compendium-edit'},{$set:{sourceHash:editIdentity('feats',index),'data.changes':{benefits:bonuses(2)}}})
  const opened=(await request('/workshop/options')).body.options[0];expect(opened.benefits).toEqual(bonuses(2));const saved=await publish('options',opened);expect(saved.status).toBe(200)
  const state=(await request(`/compendium/feats/${saved.body.draft.published.index}`)).body,doc=await CustomContent.findOne({userId:owner,type:'compendium-edit'}).lean();expect(doc!.sourceHash).toBe(definitionIdentity('feats',state.index,state.source));expect(state.entry.benefits).toEqual(bonuses(2))
 })
 it('allows only one of two edits made from the same version to commit',async()=>{
  const draft=newOptionDraft('feats');draft.body.name='Concurrent source';const first=(await publish('options',draft)).body.draft,index=first.published.index
  const state=(await request(`/compendium/feats/${index}`)).body
  const bodies=[1,2].map(n=>({expectedRevision:state.revision,expectedSourceHash:state.sourceHash,entry:{...state.entry,benefits:bonuses(n)}}))
  const results=await Promise.all(bodies.map(body=>request(`/compendium/feats/${index}`,'PUT',body)));expect(results.map(r=>r.status).sort()).toEqual([200,409]);expect(await CustomContent.countDocuments({userId:owner,type:'compendium-edit'})).toBe(1)
 })
 it('rolls back the source write when the edition cannot be saved',async()=>{
  const record=await CustomContent.create({userId:owner,type:'item',data:{name:'Original'}}),source={index:`workshop-item-${record._id}`,name:'Original'}
  const write=vi.spyOn(CustomContent,'create').mockRejectedValueOnce(new Error('forced edition failure'))
  try{await expect(saveNativeDefinition(owner,'equipment',source,{...source,name:'Lost'},0,{...source,name:'Lost'},async session=>CustomContent.findOneAndUpdate({_id:record._id},{$set:{'data.name':'Lost'}},{session,new:true}).lean())).rejects.toThrow('forced edition failure')}finally{write.mockRestore()}
  expect((await CustomContent.findById(record._id).lean())!.data.name).toBe('Original')
 })
 it('rejects one of simultaneous Compendium and Workshop saves without losing either editor’s winning fields',async()=>{
  const draft=newOptionDraft('feats');draft.body.name='Editor race';const saved=(await publish('options',draft)).body.draft,index=saved.published.index,state=(await request(`/compendium/feats/${index}`)).body
  saved.benefits=bonuses(2)
  const result=await Promise.all([publish('options',saved),request(`/compendium/feats/${index}`,'PUT',{expectedRevision:state.revision,expectedSourceHash:state.sourceHash,entry:{...state.entry,benefits:bonuses(1)}})])
  expect(result.map(r=>r.status).sort()).toEqual([200,409]);const opened=(await request('/workshop/options')).body.options[0];expect(opened.benefits).toEqual(bonuses(result[0].status===200?2:1))
 })
 it('captures the current Compendium edition on acquisition and keeps it when an unrelated character field changes',async()=>{
  const draft=newOptionDraft('feats');draft.body.name='Acquired source';const saved=(await publish('options',draft)).body.draft,index=saved.published.index
  expect((await saveEdition('feats',index,entry=>entry.benefits=bonuses(2))).status).toBe(200)
  const c={...emptyCharacter(),_id:String(new mongoose.Types.ObjectId()),updatedAt:new Date().toISOString()};c.features=[{name:draft.body.name,description:'',origin:'feat',definition:{version:1,kind:'feats',index}}]
  const library=await workshopLibrary(owner),selected=await captureSelectedDefinitions(owner,c,library);expect(selected.compendiumRules![0]!.entry.benefits).toEqual(bonuses(2));const char=await Character.create({...selected,userId:owner})
  expect((await request('/compendium/pending/'+char._id)).body).toEqual([])
  expect((await saveEdition('feats',index,entry=>entry.benefits=bonuses(4))).status).toBe(200)
  const unchanged=await captureSelectedDefinitions(owner,{...selected,personality:{...selected.personality,notes:'Changed notes'}},library,selected);expect(unchanged.compendiumRules![0]!.entry.benefits).toEqual(bonuses(2))
  await CustomContent.deleteOne({_id:saved.published.packId,userId:owner});expect((await request('/compendium/pending/'+char._id)).body).toContainEqual({kind:'feats',index,name:draft.body.name,missing:true})
 })
 it('keeps Volenta-style feat bonuses pinned, previews +12/DC20 and removes them without resetting play state',async()=>{
  const draft=newOptionDraft('feats');draft.body.name='Zhaerin Contractor';const first=(await publish('options',draft)).body.draft,index=first.published.index
  const state=(await request(`/compendium/feats/${index}`)).body,c=emptyCharacter();c.meta.name='Volenta fixture';c.meta.level=6;c.meta.klass='Wizard';c.abilities.int=20;c.spellcasting.ability='int';c.spellcasting.slots={l1:{max:4,used:2}};c.combat.hpCurrent=4;c.combat.hpTemp=3;c.resources=[{id:'spent',name:'Uses',max:3,used:2,recovery:'long'}]
  c.features=[{name:draft.body.name,description:'',origin:'feat',definition:{version:1,kind:'feats',index}}];c.compendiumRules=[{kind:'feats',index,revision:state.revision,before:state.source,entry:state.entry}]
  c.equipment=[{name:'Prison fixture',kind:'accessory',qty:1,weight:1,equipped:true,attuned:false,notes:'Keep',benefits:bonuses(3)}]
  const char=await Character.create({...c,userId:owner}),id=String(char._id),play=JSON.stringify({combat:char.combat,resources:char.resources,spellcasting:char.spellcasting,equipment:char.equipment})
  first.benefits=bonuses(1);const second=await publish('options',first);expect(second.status).toBe(200);const next=second.body.draft.published.index
  let current=await Character.findById(id).lean();expect(benefitSpellAttack(current as any)).toBe(11);expect(benefitSpellDC(current as any)).toBe(19)
  const pending=await request('/compendium/pending/'+id);expect(pending.status).toBe(200);expect(pending.body).toContainEqual({kind:'feats',index:next,name:draft.body.name})
  const preview=(await request(`/compendium/feats/${next}/review`)).body;expect(preview.characters[0].statistics).toEqual([{label:'Spell attack',before:'+11',after:'+12'},{label:'Spell save DC',before:'19',after:'20'}])
  expect((await apply('feats',next,id)).status).toBe(200);current=await Character.findById(id).lean();expect(benefitSpellAttack(current as any)).toBe(12);expect(current!.compendiumRules).toHaveLength(1)
  expect(JSON.stringify({combat:current!.combat,resources:current!.resources,spellcasting:current!.spellcasting,equipment:current!.equipment})).toBe(play)
  expect((await request('/compendium/pending/'+id)).body).toEqual([])
  expect((await saveEdition('feats',next,entry=>entry.benefits=[])).status).toBe(200);expect((await apply('feats',next,id)).status).toBe(200);current=await Character.findById(id).lean();expect(benefitSpellAttack(current as any)).toBe(11);expect(benefitSpellDC(current as any)).toBe(19)
 })
 it('shares item name, description and benefits, rejects stale saves and keeps character copies until review',async()=>{
  const item:EquipmentItem={name:'Prison fixture',kind:'accessory',magical:true,qty:1,weight:1,equipped:false,attuned:false,notes:'',benefits:bonuses(3)}
  const created=await request('/items','POST',{requestId:crypto.randomUUID(),item});expect(created.status).toBe(201);const id=created.body.id,index=`workshop-item-${id}`
  const c=emptyCharacter();c.meta.name='Item holder';c.meta.level=6;c.abilities.int=20;c.spellcasting.ability='int';c.equipment=[{...item,templateId:id,qty:2,equipped:true,notes:'Personal note'}];const char=await Character.create({...c,userId:owner})
  expect((await saveEdition('magic-items',index,entry=>{entry.workshopItem.description='Shared rules';entry.workshopItem.name='Shared prison';entry.benefits=bonuses(4)})).status).toBe(200)
  const opened=(await request('/items')).body[0];expect(opened.item.name).toBe('Shared prison');expect(opened.item.description).toBe('Shared rules');expect(opened.item.benefits).toEqual(bonuses(4))
  expect((await request('/items/'+id,'PUT',{item,requestId:crypto.randomUUID(),expectedRevision:0,expectedDefinitionRevision:0})).status).toBe(409)
  const saved=await request('/items/'+id,'PUT',{item:{...opened.item,benefits:[]},requestId:crypto.randomUUID(),expectedRevision:opened.revision,expectedDefinitionRevision:opened.definitionRevision});expect(saved.status).toBe(200)
  expect((await Character.findById(char._id).lean())!.equipment[0]!.benefits).toEqual(bonuses(3))
  expect((await apply('magic-items',index,String(char._id))).status).toBe(200);const after=(await Character.findById(char._id).lean())!.equipment[0]!;expect(after.benefits).toEqual([]);expect(after.name).toBe('Shared prison');expect(after.description).toBe('Shared rules');expect(after.qty).toBe(2);expect(after.equipped).toBe(true);expect(after.notes).toBe('Personal note')
 })
 it('shares native class edits and keeps its saved resource binding on the approved revision',async()=>{
  const draft=newWorkshopDraft('class');draft.name='Bound mage';draft.skillCount=0;draft.resources=[{...newWorkshopResource(),name:'Arcane uses',base:3,multiplier:0}]
  const first=await request('/workshop/publish','POST',{draft,target:{filename:'class.orcbrew'},expectedRevision:0});expect(first.status,JSON.stringify(first.body)).toBe(200);const saved=first.body.draft,index=saved.published.index
  const c=emptyCharacter();c.meta.name='Class holder';c.meta.klass=draft.name;c.meta.classIndex=index;c.meta.level=3
  const lib=await workshopLibrary(owner),bound=reviewedCharacter({...c,_id:String(new mongoose.Types.ObjectId()),updatedAt:new Date().toISOString()},lib.rules,lib.initial);bound.resources![0]!.used=2;const char=await Character.create({...bound,userId:owner})
  expect((await saveEdition('classes',index,entry=>{entry.workshop.description='Shared class rules';entry.workshop.resources[0].base=5})).status).toBe(200)
  expect((await request('/workshop/publish','POST',{draft:saved,target:{packId:saved.published.packId,expectedHash:saved.published.packHash},expectedRevision:1})).status).toBe(409)
  const startup=(await request('/workshop/initial')).body,entry=startup.classes[0];expect(entry.workshop.description).toBe('Shared class rules');expect(entry.workshop.resources[0].base).toBe(5)
  const edited={...entry.workshop,definitionRevision:entry.definitionRevision,imported:{index:entry.index,contentKey:entry.contentKey,sources:entry.sourcePacks},published:{...saved.published,definitionRevision:entry.definitionRevision}}
  const second=await request('/workshop/publish','POST',{draft:edited,target:{packId:saved.published.packId,expectedHash:saved.published.packHash},expectedRevision:1});expect(second.status).toBe(200)
  const raw=await Character.findById(char._id).lean(),resolved=await resolveWorkshopCharacter(raw,owner);expect(resolved.resources![0]!.max).toBe(3);expect(resolved.resources![0]!.used).toBe(2)
  expect((await apply('classes',second.body.draft.published.index,String(char._id))).status).toBe(200);const after=await Character.findById(char._id).lean();expect(after!.resources[0]!.max).toBe(5);expect(after!.resources[0]!.used).toBe(2)
 })
 it('exposes pending names only through current ownership or an active room assignment; players cannot apply editions',async()=>{
  const draft=newOptionDraft('feats');draft.body.name='Assigned source';const saved=(await publish('options',draft)).body.draft,index=saved.published.index,state=(await request(`/compendium/feats/${index}`)).body
  const c=emptyCharacter();c.meta.name='Assigned hero';c.features=[{name:draft.body.name,description:'',origin:'feat',definition:{version:1,kind:'feats',index}}];c.compendiumRules=[{kind:'feats',index,revision:state.revision,before:state.source,entry:state.entry}]
  const char=await Character.create({...c,userId:owner}),player=String(new mongoose.Types.ObjectId()),outsider=String(new mongoose.Types.ObjectId()),room=await Room.create({ownerId:owner,name:'Fixture',members:[player,outsider],assignments:[{characterId:char._id,userId:player}],joinToken:crypto.randomUUID()})
  expect((await saveEdition('feats',index,entry=>entry.benefits=bonuses(1))).status).toBe(200)
  const path=`/rooms/${room._id}/characters/${char._id}/rule-updates`,before=JSON.stringify(await Character.findById(char._id).lean())
  expect((await request(path,'GET',undefined,player)).body).toEqual([{kind:'feats',index,name:draft.body.name}]);expect((await request(path,'GET',undefined,outsider)).status).toBe(404)
  expect((await request('/compendium/pending/'+char._id,'GET',undefined,player)).status).toBe(404)
  expect((await request(`/compendium/feats/${index}/review/${char._id}`,'POST',{expectedRevision:2,expectedUpdatedAt:char.updatedAt.toISOString(),reviewHash:'a'.repeat(64),confirmedSource:true},player)).status).toBe(404)
  expect(JSON.stringify(await Character.findById(char._id).lean())).toBe(before)
  await Room.updateOne({_id:room._id},{$set:{assignments:[]}});expect((await request(path,'GET',undefined,player)).status).toBe(404)
 })
 it('delivers item trackers immediately, persists owner/player spending and follows reviewed renames, additions and removals',async()=>{
  const charge={...newLinkedTracker(),name:'Charges',max:4},item:EquipmentItem={name:'Linked wand',qty:1,weight:1,notes:'',equipped:false,kind:'accessory',magical:true,trackers:[charge]}
  const template=await request('/items','POST',{requestId:crypto.randomUUID(),item});expect(template.status).toBe(201);const templateId=template.body.id,index=`workshop-item-${templateId}`
  const c=emptyCharacter();c.meta.name='Tracker holder';const char=await Character.create({...c,userId:owner}),id=String(char._id)
  const delivered=await request(`/characters/${id}/items`,'POST',{requestId:crypto.randomUUID(),item:{...item,templateId}});expect(delivered.status,JSON.stringify(delivered.body)).toBe(201)
  let sheet=delivered.body.character,resource=sheet.resources.find((r:any)=>r.source);expect(resource).toMatchObject({name:'Linked wand · Charges',max:4,used:0})
  const spent=await request('/characters/'+id,'PATCH',{expectedUpdatedAt:sheet.updatedAt,resources:sheet.resources.map((r:any)=>r.id===resource.id?{...r,used:2}:r)});expect(spent.status,JSON.stringify(spent.body)).toBe(200);sheet=spent.body;expect(sheet.resources.find((r:any)=>r.id===resource.id).used).toBe(2)
  let raw=await Character.findById(id).lean();expect(raw!.equipment[0]!.trackerUses?.[charge.id]).toBe(2);expect(raw!.resources?.some(r=>r.id===resource.id)).toBe(false)
  const player=String(new mongoose.Types.ObjectId()),room=await Room.create({ownerId:owner,name:'Tracker room',joinToken:crypto.randomUUID(),members:[player],assignments:[{userId:player,characterId:id}]})
  const playerSpent=await request(`/rooms/${room._id}/characters/${id}/play`,'PATCH',{expectedUpdatedAt:sheet.updatedAt,resources:[{id:resource.id,used:3}]},player);expect(playerSpent.status,JSON.stringify(playerSpent.body)).toBe(200);sheet=playerSpent.body
  expect((await request(`/rooms/${room._id}/characters/${id}/play`,'PATCH',{expectedUpdatedAt:sheet.updatedAt,resources:[{id:resource.id,used:3,max:999}]},player)).status).toBe(400)
  expect((await apply('magic-items',index,id)).status).toBe(200)
  const opened=(await request('/items')).body[0],second={...newLinkedTracker(),name:'Daily spell'};opened.item.name='Renamed wand';opened.item.trackers=[{...charge,name:'Arcane charges',max:2},second]
  const saved=await request('/items/'+templateId,'PUT',{requestId:crypto.randomUUID(),item:opened.item,expectedRevision:opened.revision,expectedDefinitionRevision:opened.definitionRevision});expect(saved.status).toBe(200)
  expect((await request('/characters/'+id)).body.resources.find((r:any)=>r.id===resource.id).name).toBe('Linked wand · Charges')
  const fresh=await request(`/characters/${id}/items`,'POST',{requestId:crypto.randomUUID(),item:{...item,templateId}});expect(fresh.status).toBe(201)
  const freshItem=fresh.body.character.equipment[1],freshTrackers=fresh.body.character.resources.filter((r:any)=>r.source?.itemId===freshItem._id)
  expect(freshTrackers).toMatchObject([{name:'Renamed wand · Arcane charges',used:0},{name:'Renamed wand · Daily spell',used:0}]);expect(fresh.body.character.resources.find((r:any)=>r.id===resource.id).name).toBe('Linked wand · Charges')
  expect((await request('/characters/'+id,'PATCH',{expectedUpdatedAt:fresh.body.character.updatedAt,equipment:fresh.body.character.equipment.slice(0,1)})).status).toBe(200)
  const preview=(await request(`/compendium/magic-items/${index}/review`)).body;expect(preview.characters[0].changes.some((change:any)=>change.field==='resources')).toBe(true)
  const beforeRace=(await request('/characters/'+id)).body,spentDuringReview=await request(`/rooms/${room._id}/characters/${id}/play`,'PATCH',{expectedUpdatedAt:beforeRace.updatedAt,resources:[{id:resource.id,used:4}]},player);expect(spentDuringReview.status).toBe(200)
  const staleRow=preview.characters[0];expect((await request(`/compendium/magic-items/${index}/review/${id}`,'POST',{expectedRevision:preview.revision,expectedUpdatedAt:staleRow.updatedAt,reviewHash:staleRow.reviewHash,confirmedSource:true})).status).toBe(409)
  expect((await apply('magic-items',index,id)).status).toBe(200);sheet=(await request('/characters/'+id)).body;const linked=sheet.resources.filter((r:any)=>r.source);expect(linked).toMatchObject([{id:resource.id,name:'Renamed wand · Arcane charges',max:2,used:4},{name:'Renamed wand · Daily spell',used:0}])
  expect((await saveEdition('magic-items',index,entry=>{entry.workshopItem.trackers=[second]})).status).toBe(200);expect((await apply('magic-items',index,id)).status).toBe(200);raw=await Character.findById(id).lean();expect(raw!.equipment[0]!.trackerUses).not.toHaveProperty(charge.id);sheet=(await request('/characters/'+id)).body;expect(sheet.resources.filter((r:any)=>r.source)).toHaveLength(1)
  const removed=await request('/characters/'+id,'PATCH',{expectedUpdatedAt:sheet.updatedAt,equipment:[]});expect(removed.status).toBe(200);expect(removed.body.resources.filter((r:any)=>r.source)).toEqual([]);raw=await Character.findById(id).lean();expect(raw!.resources?.some(r=>r.id.startsWith('linked:'))).toBe(false)
 })
 it('retains uses through equipment toggles, rests while hidden and new inventory copies',async()=>{
  const charge={...newLinkedTracker(),max:3,activation:'equipped' as const},item:EquipmentItem={name:'Resting focus',kind:'accessory',qty:1,weight:1,notes:'',equipped:true,trackers:[charge]}
  const c=emptyCharacter();c.meta.name='Rest holder';const char=await Character.create({...c,userId:owner}),id=String(char._id),delivered=await request(`/characters/${id}/items`,'POST',{requestId:crypto.randomUUID(),item});expect(delivered.status).toBe(201)
  let sheet=delivered.body.character,r=sheet.resources.find((r:any)=>r.source);sheet=(await request('/characters/'+id,'PATCH',{expectedUpdatedAt:sheet.updatedAt,resources:sheet.resources.map((row:any)=>row.id===r.id?{...row,used:2}:row)})).body
  sheet=(await request('/characters/'+id,'PATCH',{expectedUpdatedAt:sheet.updatedAt,equipment:sheet.equipment.map((i:any)=>({...i,equipped:false}))})).body;expect(sheet.resources.filter((r:any)=>r.source)).toEqual([]);expect(sheet.equipment[0].trackerUses[charge.id]).toBe(2)
  sheet=(await request('/characters/'+id,'PATCH',{...restUpdate(sheet,'long'),expectedUpdatedAt:sheet.updatedAt})).body;expect(sheet.equipment[0].trackerUses[charge.id]).toBe(0)
  sheet=(await request('/characters/'+id,'PATCH',{expectedUpdatedAt:sheet.updatedAt,equipment:sheet.equipment.map((i:any)=>({...i,equipped:true}))})).body;expect(resourcesFor(sheet).find(row=>row.source)?.used).toBe(0)
  const second=await request(`/characters/${id}/items`,'POST',{requestId:crypto.randomUUID(),item});expect(second.status).toBe(201);const copies=second.body.character.resources.filter((r:any)=>r.source);expect(copies).toHaveLength(2);expect(new Set(copies.map((r:any)=>r.id)).size).toBe(2)
  const player=String(new mongoose.Types.ObjectId()),room=await Room.create({ownerId:owner,name:'Rest player',joinToken:crypto.randomUUID(),members:[player],assignments:[{userId:player,characterId:id}]})
  sheet=second.body.character;sheet=(await request(`/rooms/${room._id}/characters/${id}/play`,'PATCH',playUpdate(sheet,{equipment:sheet.equipment.map((i:any)=>({...i,equipped:false}))}),player)).body
  const rested=await request(`/rooms/${room._id}/characters/${id}/play`,'PATCH',playUpdate(sheet,restUpdate(sheet,'long')),player);expect(rested.status,JSON.stringify(rested.body)).toBe(200)
 })
 it('delivers option trackers on acquisition and preserves counters across both editors and grant removal',async()=>{
  const draft=newOptionDraft('feats'),tracker={...newOptionTracker(),max:4};draft.body.name='Linked feat';draft.body.trackers=[tracker]
  const first=await publish('options',draft);expect(first.status,JSON.stringify(first.body)).toBe(200);const index=first.body.draft.published.index
  const c=emptyCharacter();c.meta.name='Option tracker holder';const char=await Character.create({...c,userId:owner}),id=String(char._id)
  const granted=await request('/characters/'+id,'PATCH',{expectedUpdatedAt:char.updatedAt.toISOString(),features:[{name:draft.body.name,description:'',origin:'feat',definition:{version:1,kind:'feats',index}}]});expect(granted.status,JSON.stringify(granted.body)).toBe(200)
  let sheet=granted.body;const resource=sheet.resources.find((r:any)=>r.source?.kind==='option');expect(resource).toMatchObject({name:'Linked feat \u00b7 Uses',max:4,used:0})
  const spent=await request('/characters/'+id,'PATCH',{expectedUpdatedAt:sheet.updatedAt,resources:sheet.resources.map((r:any)=>r.id===resource.id?{...r,used:2}:r)});expect(spent.status,JSON.stringify(spent.body)).toBe(200);sheet=spent.body
  let raw=await Character.findById(id).lean();expect(raw!.compendiumRules![0]!.trackerUses).toEqual({[tracker.id]:2});expect(raw!.resources.some(r=>r.id===resource.id)).toBe(false)
  const player=String(new mongoose.Types.ObjectId()),room=await Room.create({ownerId:owner,name:'Option room',joinToken:crypto.randomUUID(),members:[player],assignments:[{userId:player,characterId:id}]})
  const path=`/rooms/${room._id}/characters/${id}/play`,playerSpent=await request(path,'PATCH',{expectedUpdatedAt:sheet.updatedAt,resources:[{id:resource.id,used:3}]},player);expect(playerSpent.status,JSON.stringify(playerSpent.body)).toBe(200);sheet=playerSpent.body
  expect((await request(path,'PATCH',{expectedUpdatedAt:sheet.updatedAt,resources:[{id:resource.id,used:3,max:999}]},player)).status).toBe(400)
  const second={...newOptionTracker(),name:'Second pool',recovery:'short' as const}
  expect((await saveEdition('feats',index,entry=>{entry.optionBuilder.trackers=[{...tracker,name:'Arcane uses',max:2},second]})).status).toBe(200)
  const opened=(await request('/workshop/options')).body.options[0];expect(opened.body.trackers).toHaveLength(2);opened.body.name='Renamed linked feat'
  const saved=await publish('options',opened);expect(saved.status,JSON.stringify(saved.body)).toBe(200);const next=saved.body.draft.published.index;expect(next).not.toBe(index)
  expect((await request('/characters/'+id)).body.resources.find((r:any)=>r.id===resource.id).name).toBe('Linked feat \u00b7 Uses')
  const preview=(await request(`/compendium/feats/${next}/review`)).body,row=preview.characters.find((r:any)=>r.id===id);expect(row.changes.some((r:any)=>r.field==='resources')).toBe(true)
  const concurrent=await request(path,'PATCH',{expectedUpdatedAt:sheet.updatedAt,resources:[{id:resource.id,used:4}]},player);expect(concurrent.status,JSON.stringify(concurrent.body)).toBe(200)
  expect((await request(`/compendium/feats/${next}/review/${id}`,'POST',{expectedRevision:preview.revision,expectedUpdatedAt:row.updatedAt,reviewHash:row.reviewHash,confirmedSource:true})).status).toBe(409)
  expect((await apply('feats',next,id)).status).toBe(200);sheet=(await request('/characters/'+id)).body
  expect(sheet.resources.filter((r:any)=>r.source?.kind==='option')).toMatchObject([{id:resource.id,name:'Renamed linked feat \u00b7 Arcane uses',max:2,used:4},{name:'Renamed linked feat \u00b7 Second pool',used:0}])
  const rested=await request(path,'PATCH',playUpdate(sheet,restUpdate(sheet,'long')),player);expect(rested.status,JSON.stringify(rested.body)).toBe(200);sheet=rested.body;expect(sheet.resources.find((r:any)=>r.id===resource.id).used).toBe(0)
  expect((await saveEdition('feats',next,entry=>{entry.optionBuilder.trackers=[second]})).status).toBe(200);expect((await apply('feats',next,id)).status).toBe(200)
  raw=await Character.findById(id).lean();expect(raw!.compendiumRules![0]!.trackerUses).not.toHaveProperty(tracker.id)
  sheet=(await request('/characters/'+id)).body;const removed=await request('/characters/'+id,'PATCH',{expectedUpdatedAt:sheet.updatedAt,features:[]});expect(removed.status,JSON.stringify(removed.body)).toBe(200);expect(removed.body.resources.filter((r:any)=>r.source?.kind==='option')).toEqual([])
  raw=await Character.findById(id).lean();expect(raw!.compendiumRules!.filter((d:any)=>d.kind==='feats')).toEqual([])
 })

 it('includes explicit spell classes in the owned advancement catalog without downloading full rules',async()=>{
  const draft=newSpellDraft();draft.body.name='Wizard source fixture';draft.body.classes=['wizard'];draft.body.level=2;draft.body.description='Rules stay in the definition endpoint.'
  const saved=await publish('spells',draft);expect(saved.status,JSON.stringify(saved.body)).toBe(200)
  const c=emptyCharacter();c.meta.name='Advancement fixture';const character=await Character.create({...c,userId:owner}),path='/characters/'+character._id+'/advancement-options'
  const response=await request(path);expect(response.status,JSON.stringify(response.body)).toBe(200);const spell=response.body.spells.find((s:any)=>s.index===saved.body.draft.published.index)
  expect(spell).toMatchObject({level:2,classes:[{index:'wizard',name:'Wizard'}],definitionAvailable:true});expect(spell).not.toHaveProperty('desc');expect(spell).not.toHaveProperty('spellBuilder')
  expect((await request(path,'GET',undefined,String(new mongoose.Types.ObjectId()))).status).toBe(404)
 })

})
