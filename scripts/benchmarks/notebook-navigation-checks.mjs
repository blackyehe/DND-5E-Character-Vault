// Real-Mongo permission/fallback checks against the retained synthetic fixture.
// Every probe is restored in finally; no database or seeded record is deleted.
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {mkdirSync,writeFileSync} from 'node:fs'
import {connectFixture,mongoose,ids,database} from '../fixtures/notebook-compendium.mjs'
const require=createRequire(new URL('../../server/package.json',import.meta.url)),express=require('express'),cookieParser=require('cookie-parser'),jwt=require('jsonwebtoken')
const db=await connectFixture(),{default:router}=await import('../../server/routes/notebook.ts')
const {env}=await import('../../server/env.ts')
const room=await db.collection('rooms').findOne({_id:ids.room}),character=await db.collection('characters').findOne({_id:ids.character}),entry=await db.collection('notebooks').findOne({roomId:ids.room,kind:'entry',audience:'characters',characterIds:ids.character,deletedAt:null}),hidden=await db.collection('notebooks').findOne({roomId:ids.room,kind:'entry',audience:'dm',deletedAt:null})
const hiddenTrash=await db.collection('notebooks').findOne({roomId:ids.room,kind:'entry',audience:'room',deletedAt:{$ne:null}})
assert.ok(room&&character&&entry&&hidden&&hiddenTrash,'Seed the retained fixture first')
const app=express();app.use(cookieParser());app.use('/rooms/:roomId/notebook',router);app.use((error,_req,res,_next)=>res.status(error.status??500).json({error:error.message}))
const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s))}),base=`http://127.0.0.1:${server.address().port}/rooms/${ids.room}/notebook`,checks={}
async function get(path,user=ids.player,status=200){const response=await fetch(base+path,{headers:{Cookie:`token=${jwt.sign({userId:String(user)},process.env.JWT_SECRET)}`}});assert.equal(response.status,status);return {body:await response.json(),scope:response.headers.get('X-Notebook-Scope'),version:response.headers.get('X-Notebook-Navigation')}}
async function matchesSplit(user=ids.player){const full=await get('?section=all',user),page=await get('?section=all&navigation=false',user),nav=await get('/navigation?section=all',user),initial=await get('/initial?section=all',user);assert.deepEqual({...nav.body,...page.body},full.body);assert.deepEqual({...initial.body.navigation,...initial.body.listing},full.body);assert.equal(initial.scope,nav.scope);assert.equal(initial.version,nav.version);assert.equal(nav.scope,page.scope);assert.equal(nav.version,page.version);return nav}
try{
  const initial=await matchesSplit()
  const dmInitial=await matchesSplit(ids.owner);checks.preparedContracts=true
  for(const version of [undefined,0]){
    if(version===undefined)await db.collection('rooms').updateOne({_id:ids.room},{$unset:{notebookListingVersion:1}})
    else await db.collection('rooms').updateOne({_id:ids.room},{$set:{notebookListingVersion:version}})
    for(const [user,expected]of [[ids.owner,dmInitial],[ids.player,initial]])assert.deepEqual(await matchesSplit(user),expected)
  }
  checks.missingAndOldMarkerFallback=true
  await db.collection('rooms').replaceOne({_id:ids.room},room)
  env.NOTEBOOK_DB_LISTING='off'
  for(const [user,expected]of [[ids.owner,dmInitial],[ids.player,initial]])assert.deepEqual(await matchesSplit(user),expected)
  checks.flagOffFallback=true;env.NOTEBOOK_DB_LISTING='on'
  // A multikey visibility index must count each entry once even when both of
  // its character IDs are accessible, and retain exact totals on every page.
  await db.collection('rooms').updateOne({_id:ids.room},{$set:{assignments:room.assignments.map(a=>({...a,userId:ids.player}))}})
  await db.collection('notebooks').updateOne({_id:entry._id},{$set:{characterIds:[ids.character,ids.foreignCharacter]}})
  for(const user of [ids.owner,ids.player]){
    env.NOTEBOOK_DB_LISTING='off'
    const expected=(await get('?section=all&navigation=false',user)).body
    env.NOTEBOOK_DB_LISTING='on'
    for(const offset of [0,60,Math.floor(expected.total/60)*60,expected.total,expected.total+60]){
      const page=(await get(`?section=all&navigation=false&offset=${offset}`,user)).body
      assert.deepEqual(Object.keys(page).sort(),['entries','nextOffset','total'])
      assert.equal(page.total,expected.total)
      assert.equal(page.entries.length,Math.max(0,Math.min(60,expected.total-offset)))
      assert.equal(page.nextOffset,offset+page.entries.length<expected.total?offset+page.entries.length:null)
      assert.equal(new Set(page.entries.map(row=>row.id)).size,page.entries.length)
      if(offset===0)assert.deepEqual(page,expected)
    }
  }
  checks.exactPagingAndMultikeyCount=true
  await db.collection('notebooks').replaceOne({_id:entry._id},entry)
  await db.collection('rooms').replaceOne({_id:ids.room},room)
  await db.collection('rooms').updateOne({_id:ids.room},{$set:{assignments:room.assignments.filter(a=>String(a.userId)!==String(ids.player))}})
  const revoked=await matchesSplit();assert.notEqual(revoked.scope,initial.scope);assert.deepEqual(revoked.body.characters,[]);assert.ok(revoked.body.entryCount<initial.body.entryCount);assert.ok(!revoked.body.sessionEntries.some(e=>e.id===String(entry._id)));checks.assignmentRevocation=true
  await db.collection('rooms').replaceOne({_id:ids.room},room)
  await db.collection('characters').updateOne({_id:ids.character},{$set:{userId:ids.other}})
  const ownership=await matchesSplit();assert.notEqual(ownership.scope,initial.scope);assert.deepEqual(ownership.body.characters,[]);checks.ownershipRevocation=true
  await db.collection('characters').replaceOne({_id:ids.character},character)
  await db.collection('rooms').updateOne({_id:ids.room},{$set:{members:room.members.filter(member=>String(member)!==String(ids.player))}})
  for(const path of ['/navigation?section=all','?section=all&navigation=false','?section=all','/link-targets','/initial?section=all'])await get(path,ids.player,404)
  checks.roomRevocation=true;await db.collection('rooms').replaceOne({_id:ids.room},room)
  await db.collection('notebooks').updateOne({_id:hidden._id},{$inc:{revision:1},$set:{updatedAt:new Date('2030-01-01')}})
  await db.collection('notebooks').updateOne({_id:hiddenTrash._id},{$inc:{revision:1},$set:{updatedAt:new Date('2030-01-02')}})
  const hiddenChange=await matchesSplit();assert.deepEqual(hiddenChange.body,initial.body);assert.equal(hiddenChange.version,initial.version);checks.hiddenCountsAndToken=true
  await db.collection('notebooks').replaceOne({_id:hidden._id},hidden)
  await db.collection('notebooks').replaceOne({_id:hiddenTrash._id},hiddenTrash)
  await db.collection('rooms').updateOne({_id:ids.room},{$unset:{notebookListingVersion:1}})
  await db.collection('notebooks').updateOne({_id:entry._id},{$unset:{listing:1}})
  for(const user of [ids.owner,ids.player]){const legacy=await matchesSplit(user);if(user===ids.player)assert.deepEqual(legacy.body,initial.body)}
  checks.unmigratedFallback=true
  mkdirSync('.local/notebook-navigation-20261102',{recursive:true})
  const result={scope:'Retained synthetic loopback fixture only',database,checks,fixtureRetained:true}
  writeFileSync('.local/notebook-navigation-20261102/permission-checks.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result))
}finally{
  env.NOTEBOOK_DB_LISTING='on'
  await db.collection('characters').replaceOne({_id:ids.character},character)
  for(const original of [entry,hidden,hiddenTrash])await db.collection('notebooks').replaceOne({_id:original._id},original)
  await db.collection('rooms').replaceOne({_id:ids.room},room)
  await new Promise(resolve=>server.close(resolve));await mongoose.disconnect()
}
