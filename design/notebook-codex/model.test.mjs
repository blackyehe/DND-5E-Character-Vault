import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createNotebook,roomId,characters,reading,sessionNumbers,normalizeSources} from './model.mjs'

const folder=(id,parentId=null,audience='dm')=>({id,title:id,parentId,audience,characterIds:[],section:'journal',revision:1,deletedAt:null,count:0})
const entry=(id,extra={})=>({id,title:id,body:'## Leírás\n\nDescription.\n\n## Session-kapcsolat\n\n- **2. session:** encounter.\n\n## Források\n\n- 2., 4., 7. és 12. session.',section:'journal',folderId:null,audience:'dm',characterIds:[],relevantCharacterIds:[],relatedIds:[],codexType:'people',revision:1,updatedAt:'2026-10-22',editedBy:'DM',deletedAt:null,...extra})
const make=()=>createNotebook({folders:[folder('private'),folder('child','private','room')],entries:[entry('hidden'),entry('shared',{audience:'room',relatedIds:['hidden']}),entry('blocked',{audience:'room',folderId:'child'})]})
const request=(n,method,tail='',body={},query='')=>n.handle(method,new URL(`http://local/api/rooms/${roomId}/notebook${tail}?${query}`),body)

test('Events and Quests open the same entry and its latest shared clues',()=>{
 const clue={id:'00000000-0000-4000-8000-000000000001',title:'Witness',body:'First testimony',sessions:[12],audience:'room'}
 const draft=entry('quest',{codexType:'quests',showInEvents:true,audience:'room',questClues:[clue]})
 const n=createNotebook({folders:[],entries:[]}),{id}=request(n,'POST','/entries',draft),q='previewCharacter='+characters[0].id
 for(const type of ['events','quests'])assert.deepEqual(request(n,'GET','',{},q+'&type='+type).entries.map(e=>e.id),[id])
 const updated={...clue,body:'Updated testimony'}
 request(n,'PATCH','/entries/'+id,{expectedRevision:1,draft:{...draft,questClues:[updated],questStatus:'finished'}})
 const event=request(n,'GET','',{},q+'&type=events').entries[0]
 assert.equal(event.questStatus,'finished');assert.deepEqual(request(n,'GET','/entries/'+event.id,{},q).questClues,[updated])
 const {showInEvents:_,...legacy}=draft;request(n,'PATCH','/entries/'+id,{expectedRevision:2,draft:legacy})
 assert.equal(request(n,'GET','',{},q).counts.events,1);assert.equal(request(n,'GET','',{},q).entryCount,1)
})

test('custom tag filters match all selected tags and keep private tag suggestions hidden',()=>{
 const n=createNotebook({folders:[],entries:[entry('one',{audience:'room',tags:['Amdurun','Investigation']}),entry('two',{audience:'room',tags:['Magellan']}),entry('secret',{tags:['Hidden city']})]})
 const q='previewCharacter='+characters[0].id
 assert.deepEqual(request(n,'GET','',{},q).tags,[{name:'Amdurun',count:1},{name:'Investigation',count:1},{name:'Magellan',count:1}])
 assert.deepEqual(request(n,'GET','',{},q+'&tags='+encodeURIComponent('["amdurun","Investigation"]')).entries.map(e=>e.id),['one'])
 const draft=entry('one',{audience:'room',tags:[' Custom, tag ','CUSTOM, TAG']})
 request(n,'PATCH','/entries/one',{expectedRevision:1,draft})
 assert.deepEqual(request(n,'GET','/entries/one').tags,['Custom, tag'])
 const {tags:_,...legacy}=draft;request(n,'PATCH','/entries/one',{expectedRevision:2,draft:legacy})
 request(n,'POST','/entries/one/restore-version',{expectedRevision:3,revision:1})
 assert.deepEqual(request(n,'GET','/entries/one').tags,['Custom, tag'])
})

test('quest clues default private, reveal individually and survive old-client edits and text restoration',()=>{
 const clue={id:'00000000-0000-4000-8000-000000000001',title:'Test evidence',body:'HiddenCipher',sessions:[12]}
 const draft=entry('quest',{title:'Test quest',codexType:'quests',audience:'room',questClues:[clue]})
 const n=createNotebook({folders:[],entries:[]}),{id}=request(n,'POST','/entries',draft),q='previewCharacter='+characters[0].id
 assert.deepEqual(request(n,'GET',`/entries/${id}`,{},q).questClues,[])
 assert.equal(request(n,'GET','',{},q+'&search=HiddenCipher').total,0)
 assert.equal(request(n,'GET','',{},'search=HiddenCipher').total,1)
 assert.equal('questClues' in request(n,'GET','').entries[0],false)
 assert.equal(request(n,'GET',`/entries/${id}`).questClues[0].audience,'dm')
 request(n,'PATCH',`/entries/${id}`,{expectedRevision:1,draft:{...draft,questClues:[{...clue,audience:'room'}]}})
 assert.equal(request(n,'GET',`/entries/${id}`,{},q).questClues.length,1)
 const {questClues:_,...oldDraft}=draft
 request(n,'PATCH',`/entries/${id}`,{expectedRevision:2,draft:{...oldDraft,questStatus:'finished'}})
 request(n,'POST',`/entries/${id}/restore-version`,{expectedRevision:3,revision:1})
 assert.equal(request(n,'GET',`/entries/${id}`,{},q).questClues.length,1)
 assert.equal(request(n,'GET',`/entries/${id}`).questStatus,'finished')
 request(n,'PATCH',`/entries/${id}`,{expectedRevision:4,draft:{...draft,questClues:[{...clue,audience:'dm'}]}})
 assert.deepEqual(request(n,'GET',`/entries/${id}`,{},q).questClues,[])
 assert.throws(()=>request(n,'PATCH',`/entries/${id}`,{expectedRevision:4,draft}),{status:409})
})

test('revealed quests have active/finished filters and preserve status when restoring text',()=>{
 const n=createNotebook({folders:[folder('private')],entries:[entry('secret')]})
 const draft=entry('quest',{title:'Workshop deal',codexType:'quests',audience:'room',questStatus:'active',relatedIds:['secret']})
 for(const extra of [{audience:'characters',characterIds:[characters[0].id]},{folderId:'private'},{characterIds:[characters[0].id]},{questStatus:'unknown'}])assert.throws(()=>request(n,'POST','/entries',{...draft,...extra}),{status:400})
 const {id}=request(n,'POST','/entries',draft),q='previewCharacter='+characters[0].id
 assert.equal(request(n,'GET',`/entries/${id}`,{},q).audience,'room')
 assert.deepEqual(request(n,'GET',`/entries/${id}`,{},q).connections,[])
 assert.equal(request(n,'GET','',{},'type=quests&questStatus=active').total,1)
 request(n,'PATCH',`/entries/${id}`,{expectedRevision:1,draft:{...draft,questStatus:'finished'}})
 request(n,'POST',`/entries/${id}/restore-version`,{expectedRevision:2,revision:1})
 assert.equal(request(n,'GET',`/entries/${id}`).questStatus,'finished')
 assert.equal(request(n,'GET','',{},'type=quests&questStatus=finished').total,1)
 assert.deepEqual(request(n,'GET','',{},q).questCounts,{active:0,finished:1})
 assert.throws(()=>request(n,'PATCH',`/entries/${id}`,{expectedRevision:3,draft:{...draft,codexType:'people',questStatus:null}}),{status:400})
 assert.throws(()=>request(n,'PATCH',`/entries/${id}`,{expectedRevision:3,draft},q),{status:403})
})

test('private quest preparation hides the quest and all clues until reveal and again after hiding',()=>{
 const n=createNotebook({folders:[],entries:[]}),q='previewCharacter='+characters[0].id
 const clue={id:'00000000-0000-4000-8000-000000000001',title:'Public clue',body:'evidence',sessions:[12],audience:'room'}
 const draft=entry('quest',{codexType:'quests',audience:'dm',tags:['Future'],questClues:[clue]})
 const {id}=request(n,'POST','/entries',draft)
 assert.equal(request(n,'GET','',{},q).total,0);assert.deepEqual(request(n,'GET','',{},q).tags,[])
 assert.throws(()=>request(n,'GET',`/entries/${id}`,{},q),{status:404})
 request(n,'PATCH',`/entries/${id}`,{expectedRevision:1,draft:{...draft,audience:'room'}})
 assert.equal(request(n,'GET',`/entries/${id}`,{},q).questClues.length,1)
 request(n,'PATCH',`/entries/${id}`,{expectedRevision:2,draft})
 request(n,'POST',`/entries/${id}/restore-version`,{expectedRevision:3,revision:2})
 assert.equal(request(n,'GET',`/entries/${id}`).audience,'dm')
 assert.throws(()=>request(n,'GET',`/entries/${id}/history`,{},q),{status:404})
})

test('development reload preserves local entries and history without colliding with the next creation',()=>{
 const saved=entry('000000000000000000001005',{title:'User place',codexType:'places'})
 const n=createNotebook({folders:[],entries:[entry('approved')]},{folders:[],entries:[saved],histories:{[saved.id]:[{revision:1,title:'User place',body:'Original'}]}})
 assert.equal(request(n,'GET',`/entries/${saved.id}`).title,'User place')
 assert.equal(request(n,'GET',`/entries/${saved.id}/history`).versions[0].body,'Original')
 assert.equal(request(n,'POST','/entries',entry('new')).id,'000000000000000000001006')
 request(n,'POST','/reset');assert.equal(request(n,'GET').entries[0].id,'approved')
})

test('place images persist through old-client updates, stay out of lists and support removal',()=>{
 const coverImage='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aE1kAAAAASUVORK5CYII='
 const n=createNotebook({folders:[],entries:[]}),draft=entry('city',{codexType:'places',coverImage})
 const {id}=request(n,'POST','/entries',draft)
 assert.equal(request(n,'GET',`/entries/${id}`).coverImage,coverImage)
 assert.equal('coverImage' in request(n,'GET').entries[0],false)
 const {coverImage:_,...legacy}=draft
 request(n,'PATCH',`/entries/${id}`,{expectedRevision:1,draft:legacy})
 assert.equal(request(n,'GET',`/entries/${id}`).coverImage,coverImage)
 request(n,'PATCH',`/entries/${id}`,{expectedRevision:2,draft:{...draft,coverImage:''}})
 assert.equal(request(n,'GET',`/entries/${id}`).coverImage,'')
})

test('place connections carry categories for incoming and outgoing links while respecting access',()=>{
 const n=createNotebook({folders:[],entries:[entry('city',{audience:'room',codexType:'places',relatedIds:['harbour','hidden']}),entry('harbour',{audience:'room',codexType:'places'}),entry('captain',{audience:'room',relatedIds:['city']}),entry('hidden',{codexType:'objects'})]})
 const place=request(n,'GET','/entries/city',{},'previewCharacter='+characters[0].id)
 assert.deepEqual(place.connections.map(e=>[e.id,e.codexType,e.direction]),[['harbour','places','outgoing'],['captain','people','incoming']])
})
test('player index, counts, folders, detail and history exclude private information',()=>{
 const n=make(),q='previewCharacter='+characters[0].id,index=request(n,'GET','',{},q)
 assert.deepEqual(index.entries.map(e=>e.id),['shared']);assert.equal(index.counts.people,1);assert.deepEqual(index.folders,[])
 const detail=request(n,'GET','/entries/shared',{},q);assert.deepEqual(detail.relatedIds,[]);assert.deepEqual(detail.connections,[])
 assert.deepEqual(request(n,'GET','/entries/shared/history',{},q).versions,[])
 assert.throws(()=>request(n,'GET','/entries/hidden',{},q),{status:404})
 assert.throws(()=>request(n,'POST','/entries',entry('new'),q),{status:403})
})
test('whole-entry and ancestor sharing both apply; deleted parents hide descendants',()=>{
 const n=make(),q='previewCharacter='+characters[0].id
 request(n,'PATCH','/folders/private',{expectedRevision:1,title:'private',parentId:null,audience:'room',characterIds:[]})
 assert.equal(request(n,'GET','',{},q).total,2)
 request(n,'POST','/folders/private/delete',{expectedRevision:2});assert.equal(request(n,'GET','',{},q).total,1)
 request(n,'POST','/folders/private/recover',{expectedRevision:3});assert.equal(request(n,'GET','',{},q).total,2)
 assert.throws(()=>request(n,'PATCH','/folders/private',{expectedRevision:4,title:'cycle',parentId:'child',audience:'room',characterIds:[]}),{status:400})
})
test('create, conflict protection, edit, restore text, trash, recover and reset remain local',()=>{
 const n=make(),draft=entry('new',{title:'Local creation',relatedIds:['shared']})
 const {id}=request(n,'POST','/entries',draft)
 request(n,'PATCH',`/entries/${id}`,{expectedRevision:1,draft:{...draft,title:'Updated',body:'Changed',audience:'room'}})
 assert.throws(()=>request(n,'PATCH',`/entries/${id}`,{expectedRevision:1,draft}),{status:409})
 request(n,'POST',`/entries/${id}/restore-version`,{expectedRevision:2,revision:1})
 const restored=request(n,'GET',`/entries/${id}`);assert.equal(restored.title,'Local creation');assert.equal(restored.audience,'room');assert.deepEqual(restored.relatedIds,['shared'])
 request(n,'POST',`/entries/${id}/delete`,{expectedRevision:3});assert.equal(request(n,'GET','',{},'deleted=true').total,1)
 request(n,'POST',`/entries/${id}/recover`,{expectedRevision:4});assert.equal(request(n,'GET','',{},'deleted=true').total,0)
 request(n,'POST','/reset');assert.equal(request(n,'GET').total,3)
})
test('selected-character sharing and relevance are independent',()=>{
 const n=createNotebook({folders:[],entries:[entry('selective',{audience:'characters',characterIds:[characters[0].id],relevantCharacterIds:[characters[1].id]})]})
 assert.equal(request(n,'GET','',{},'previewCharacter='+characters[0].id).total,1)
 assert.equal(request(n,'GET','',{},'previewCharacter='+characters[1].id).total,0)
 assert.equal(request(n,'GET','',{},'character='+characters[1].id).total,1)
})
test('reading tabs retain every approved section and session parsing does not guess',()=>{
 const body=entry('x').body+'\n\n## Ismert kapcsolatok és kötődések\n\n- Another person.\n\n## A levél\n\nActual letter, intact.'
 const parts=reading(body);assert.match(parts.description,/Actual letter, intact/);assert.match(parts.relations,/Another person/);assert.match(parts.encounters,/encounter/)
 for(const section of body.split(/(?=^## )/m).filter(Boolean))assert.ok(Object.values(parts).some(part=>part.includes(section.trim())))
 assert.deepEqual(sessionNumbers(body),[2,4,7,12]);assert.deepEqual(sessionNumbers('## Session-kapcsolat\n\nElső találkozás nincs megerősítve.'),[])
})
test('source display uses session numbers and retains letter and encounter prose',()=>{
 const body='## Leírás\n\nLetter text.\n\n## Session-kapcsolat\n\n- **9. session:** recovered text.\n\n## Forrás\n\n- Sessions/Session 9.md\n- The World/Secret NPC.md'
 const normalized=normalizeSources(body)
 assert.match(normalized,/Letter text/);assert.match(normalized,/recovered text/);assert.match(normalized,/## Források\n\n- 9\. session\./);assert.doesNotMatch(normalized,/\.md/)
 assert.match(normalizeSources('## Leírás\n\nWren.\n\n## Forrás\n- The World/Wren.md'),/nincs megerősítve/)
})
