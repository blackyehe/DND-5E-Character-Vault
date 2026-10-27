import {readFile} from 'node:fs/promises'
import {notebookTags,notebookTagOptions,notebookMatchesTags} from '../../shared/notebook-tags.ts'
import {notebookIsEvent} from '../../shared/notebook-codex.ts'

export const roomId = '000000000000000000000ca1'
export const characters = [{id:'000000000000000000000ca2',name:'Fade',assigned:true},{id:'000000000000000000000ca3',name:'Volenta',assigned:true}]
export const kinds = ['people','places','objects','factions','sessions','quests','events']
const questStatus=e=>e.codexType==='quests'?(e.questStatus==='finished'?'finished':'active'):null
const clone = value => structuredClone(value)
const fail = (status,message) => {throw Object.assign(new Error(message),{status})}
const fold = value => value.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase()
export function reading(body) {
  const groups={description:[],encounters:[],relations:[]}
  for(const block of body.split(/(?=^## )/m)) {
    const heading=block.split('\n')[0]??''
    groups[/^## (Session|Forrás)/i.test(heading)?'encounters':/^## (Ismert kapcsolatok|Kapcsolatok)/i.test(heading)?'relations':'description'].push(block)
  }
  return Object.fromEntries(Object.entries(groups).map(([key,blocks])=>[key,blocks.join('').trim()]))
}
export function sessionNumbers(body) {
  const source=reading(body).encounters
  return [...new Set([...source.matchAll(/\b(\d+)\.(?=\s*(?:session|[,és]))/gi)].map(m=>Number(m[1])))].sort((a,b)=>a-b)
}
export function normalizeSources(body) {
  const paths=[...body.matchAll(/Sessions\/Session (\d+)\.md/g)].map(m=>Number(m[1]))
  const numbers=[...new Set([...sessionNumbers(body),...paths])].sort((a,b)=>a-b)
  return body.split(/(?=^## )/m).map(block=>/^## Forrás/i.test(block)?`## Források\n\n${numbers.length?numbers.map(n=>`- ${n}. session.`).join('\n'):'- A találkozás sessionje nincs megerősítve.'}\n\n`:block).join('').trim()
}
const permits=(value,allowed)=>value.audience==='room'||value.audience==='characters'&&value.characterIds.some(id=>allowed.includes(id))
export function folderAllowed(id,folders,allowed) {
  const seen=new Set(); let section
  while(id){if(seen.has(id))return false;seen.add(id);const f=folders.find(f=>f.id===id);if(!f||f.deletedAt||!permits(f,allowed)||section&&f.section!==section)return false;section=f.section;id=f.parentId}
  return true
}
export async function loadSeed() {
  const review=JSON.parse(await readFile(new URL('../../backups/revalon-notebook-review-2026-10-22/proposals.json',import.meta.url),'utf8'))
  const approved=review.proposals.filter(p=>p.publishStatus==='saved-and-verified')
  const entries=approved.map(p=>({...clone(p.draft),id:p.savedEntry.id,revision:1,updatedAt:'2026-10-22T12:00:00.000Z',editedBy:'DM',deletedAt:null,
    body:normalizeSources(p.draft.body.replace(/ — Sessions\/Session \d+\.md/g,'')),codexType:/^Session \d+/.test(p.draft.title)?'sessions':p.draft.section==='story-items'?'objects':p.id==='R124'?'factions':'people'}))
  return {entries,folders:clone(review.folderOrganization.folders),characters:clone(characters)}
}
export function createNotebook(seed, resumed) {
  let state=clone(seed),sequence=4096
  const history=new Map()
  function record(entry,action){const values=history.get(entry.id)??[];values.unshift({revision:entry.revision,title:entry.title,body:entry.body,editedBy:entry.editedBy,savedAt:entry.updatedAt,action});history.set(entry.id,values)}
  const reset=()=>{state=clone(seed);history.clear();state.entries.forEach(e=>record(e,'Approved local copy'))}
  reset()
  // A development reload can preserve the user's local work; Reset still restores the approved seed.
  if(resumed){
    state={...clone(seed),entries:clone(resumed.entries),folders:clone(resumed.folders)}
    history.clear()
    for(const e of state.entries)history.set(e.id,clone(resumed.histories?.[e.id]??[]))
    sequence=Math.max(sequence,...state.entries.concat(state.folders).filter(e=>/^0{16}[a-f0-9]{8}$/i.test(e.id)).map(e=>parseInt(e.id.slice(-8),16)))
  }
  function handle(method,url,input={}) {
    const query=url.searchParams,preview=query.has('previewCharacter'),allowed=query.get('previewCharacter')==='all'?characters.map(c=>c.id):[query.get('previewCharacter')]
    const readable=e=>!preview||!e.deletedAt&&permits(e,allowed)&&(!e.folderId||folderAllowed(e.folderId,state.folders,allowed))
    const visible=state.entries.filter(readable)
    const clues=e=>e.codexType==='quests'?clone((e.questClues??[]).filter(c=>!preview||c.audience==='room')):[]
    const summary=e=>{const {body,relatedIds,coverImage,questClues,...rest}=e;return {...rest,showInEvents:notebookIsEvent(e),tags:notebookTags(e.tags??[]),sessions:sessionNumbers(body),questStatus:questStatus(e)}}
    const detail=e=>({...summary(e),body:e.body,coverImage:e.coverImage??'',questClues:clues(e),relatedIds:e.relatedIds.filter(id=>visible.some(v=>v.id===id&&!v.deletedAt)),reading:reading(e.body),connections:visible.filter(v=>!v.deletedAt&&v.id!==e.id&&(e.relatedIds.includes(v.id)||v.relatedIds.includes(e.id))).map(v=>({id:v.id,title:v.title,section:v.section,codexType:v.codexType,direction:e.relatedIds.includes(v.id)?'outgoing':'incoming'}))})
    const base=`/api/rooms/${roomId}/notebook`,tail=url.pathname.slice(base.length).split('/').filter(Boolean)
    if(preview&&method!=='GET')fail(403,'Player preview is read-only.')
    if(tail[0]==='reset'&&method==='POST'){reset();return {ok:true}}
    if(!tail.length&&method==='GET') {
      const deleted=query.get('deleted')==='true',section=query.get('section'),type=query.get('type'),search=fold(query.get('search')??''),folder=query.get('folder')??'all'
      const descendants=new Set([folder]);let changed=true;while(changed){changed=false;for(const f of state.folders)if(descendants.has(f.parentId)&&!descendants.has(f.id)){descendants.add(f.id);changed=true}}
      let entries=visible.filter(e=>!!e.deletedAt===deleted&&(!section||section==='all'||e.section===section))
      if(type&&kinds.includes(type))entries=entries.filter(e=>type==='events'?notebookIsEvent(e):e.codexType===type)
      if(query.has('questStatus')&&query.get('questStatus')!=='all')entries=entries.filter(e=>questStatus(e)===query.get('questStatus'))
      let tags=[];try{tags=JSON.parse(query.get('tags')??'[]');if(!Array.isArray(tags)||tags.length>20||tags.some(t=>typeof t!=='string'||!t.trim()||t.length>48||/[\p{Cc}\p{Cf}]/u.test(t)))throw Error()}catch{fail(400,'Choose valid tags.')}
      if(tags.length)entries=entries.filter(e=>notebookMatchesTags(e,tags))
      const counts=Object.fromEntries(kinds.map(k=>[k,visible.filter(e=>!e.deletedAt&&(k==='events'?notebookIsEvent(e):e.codexType===k)).length]))
      const questCounts=Object.fromEntries(['active','finished'].map(status=>[status,visible.filter(e=>!e.deletedAt&&questStatus(e)===status).length]))
      if(query.get('ids'))entries=entries.filter(e=>query.get('ids').split(',').includes(e.id))
      else if(type==='pinned')entries=[]
      if(search)entries=entries.filter(e=>fold(e.title+' '+e.body+' '+clues(e).map(c=>c.title+' '+c.body).join(' ')).includes(search))
      if(folder!=='all')entries=entries.filter(e=>folder==='unfiled'?!e.folderId:descendants.has(e.folderId))
      if(query.get('character'))entries=entries.filter(e=>e.relevantCharacterIds.includes(query.get('character')))
      entries.sort((a,b)=>a.codexType==='sessions'&&b.codexType==='sessions'?sessionNumbers(a.body)[0]-sessionNumbers(b.body)[0]:a.title.localeCompare(b.title,'hu'))
      const folders=state.folders.filter(f=>!preview||folderAllowed(f.id,state.folders,allowed)).map(f=>({...f,count:visible.filter(e=>!e.deletedAt&&e.folderId===f.id).length}))
      return {entries:entries.map(summary),folders,total:entries.length,entryCount:visible.filter(e=>!e.deletedAt).length,nextOffset:null,characters:clone(characters),role:preview?'player':'dm',readOnly:preview,counts,questCounts,tags:notebookTagOptions(visible.filter(e=>!!e.deletedAt===deleted)),sessionEntries:visible.filter(e=>!e.deletedAt&&e.codexType==='sessions').map(summary)}
    }
    const getEntry=()=>{const e=visible.find(e=>e.id===tail[1]);if(!e)fail(404,'Entry unavailable.');return e}
    const checkRevision=e=>{if(input.expectedRevision!==e.revision)fail(409,'The local copy changed. Review the latest version before saving.')}
    const stamp=e=>{e.revision++;e.updatedAt=new Date().toISOString();e.editedBy='Local DM'}
    function validDraft(d,entry) {
      if(!d||typeof d.title!=='string'||!d.title.trim()||d.title.length>120||typeof d.body!=='string'||d.body.length>60000)fail(400,'A title and description of up to 60,000 characters are required.')
      if(!['journal','story-items'].includes(d.section)||!['dm','room','characters'].includes(d.audience)||!kinds.includes(d.codexType??entry?.codexType))fail(400,'Choose a valid category and sharing setting.')
      for(const key of ['characterIds','relevantCharacterIds','relatedIds'])if(!Array.isArray(d[key]))fail(400,'Invalid entry settings.')
      const kind=d.codexType??entry?.codexType
      if(d.showInEvents!==undefined&&typeof d.showInEvents!=='boolean')fail(400,'Choose a valid Events listing.')
      const showInEvents=kind==='events'||(d.showInEvents??notebookIsEvent(entry??{}))
      if(d.tags!==undefined&&(!Array.isArray(d.tags)||d.tags.length>20||d.tags.some(t=>typeof t!=='string'||!t.trim()||t.length>48||/[\p{Cc}\p{Cf}]/u.test(t))))fail(400,'Choose valid tags.')
      const tags=notebookTags(d.tags??entry?.tags??[])
      if(entry?.codexType==='quests'&&kind!=='quests')fail(400,'Quests stay in Quests. Mark the quest finished when it is no longer active.')
      if(kind==='quests'&&(!['dm','room'].includes(d.audience)||d.characterIds.length||d.folderId!==null))fail(400,'Quests can be DM only or Whole room and cannot be placed in folders.')
      if(d.questStatus!=null&&(kind!=='quests'||!['active','finished'].includes(d.questStatus)))fail(400,'Choose a valid quest status.')
      if(d.questClues!==undefined&&(!Array.isArray(d.questClues)||d.questClues.length>50||d.questClues.some(c=>!c||typeof c.id!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(c.id)||typeof c.title!=='string'||!c.title.trim()||c.title.length>120||typeof c.body!=='string'||c.body.length>4000||!['dm','room',undefined].includes(c.audience)||!Array.isArray(c.sessions)||c.sessions.length>100||c.sessions.some(n=>!Number.isInteger(n)||n<1||n>10000))||new Set(d.questClues.map(c=>c.id)).size!==d.questClues.length))fail(400,'Choose valid clue details and session sources.')
      if(kind!=='quests'&&d.questClues?.length)fail(400,'Add gathered clues to a quest.')
      const questClues=kind==='quests'?clone(d.questClues??entry?.questClues??[]).map(c=>({...c,title:c.title.trim(),audience:c.audience??'dm',sessions:[...new Set(c.sessions)].sort((a,b)=>a-b)})):[]
      if(d.audience==='characters'&&!d.characterIds.some(id=>characters.some(c=>c.id===id)))fail(400,'Choose at least one character.')
      if(d.folderId){const f=state.folders.find(f=>f.id===d.folderId);if(!f||f.deletedAt||f.section!==d.section)fail(400,'Choose an active folder in this section.')}
      if(d.coverImage&&(typeof d.coverImage!=='string'||d.coverImage.length>250000||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(d.coverImage)))fail(400,'Choose a valid JPG, PNG or WebP cover image.')
      if(d.coverImage&&(d.codexType??entry?.codexType)!=='places')fail(400,'Cover images belong to place entries.')
      const coverImage=(d.codexType??entry?.codexType)==='places'?d.coverImage??entry?.coverImage??'':''
      return {...Object.fromEntries(['title','body','section','folderId','audience','characterIds','relevantCharacterIds','relatedIds','codexType'].map(k=>[k,clone(d[k]??entry?.[k])])),showInEvents,folderId:d.folderId,coverImage,questClues,tags,questStatus:kind==='quests'?d.questStatus??questStatus(entry??{codexType:kind})??'active':null}
    }
    if(tail[0]==='entries'&&tail[1]&&state.folders.some(f=>f.id===tail[1]))tail[0]='folders'
    if(tail[0]==='entries') {
      if(method==='POST'&&tail.length===1){const d=validDraft(input);const e={...d,id:(++sequence).toString(16).padStart(24,'0'),revision:1,updatedAt:new Date().toISOString(),editedBy:'Local DM',deletedAt:null};state.entries.push(e);record(e,'Created locally');return {id:e.id}}
      const e=getEntry()
      if(method==='GET'&&tail.length===2)return detail(e)
      if(method==='GET'&&tail[2]==='history')return {versions:preview?[]:clone(history.get(e.id)??[]),nextBefore:null}
      if(method==='PATCH'&&tail.length===2){checkRevision(e);if(e.deletedAt)fail(400,'Recover the entry first.');Object.assign(e,validDraft(input.draft,e));stamp(e);record(e,'Edited locally');return detail(e)}
      if(method==='POST'){
        checkRevision(e)
        if(tail[2]==='delete')e.deletedAt=new Date().toISOString()
        else if(tail[2]==='recover')e.deletedAt=null
        else if(tail[2]==='restore-version'){const v=history.get(e.id)?.find(v=>v.revision===input.revision);if(!v)fail(404,'Version unavailable.');e.title=v.title;e.body=v.body}
        else fail(404,'Unknown notebook action.')
        stamp(e);record(e,tail[2]);return detail(e)
      }
    }
    if(tail[0]==='folders') {
      const f=state.folders.find(f=>f.id===tail[1])
      if(tail.length>1&&!f)fail(404,'Folder unavailable.')
      if(tail.length>1)checkRevision(f)
      if(method==='POST'&&['delete','recover'].includes(tail[2])){f.deletedAt=tail[2]==='delete'?new Date().toISOString():null;f.revision++;return {ok:true}}
      if(method==='POST'||method==='PATCH'){
        const section=f?.section??input.section
        if(!['journal','story-items'].includes(section)||!input.title?.trim()||!['dm','room','characters'].includes(input.audience)||!Array.isArray(input.characterIds)||input.audience==='characters'&&!input.characterIds.length)fail(400,'Choose a title, section, and valid sharing setting.')
        let parent=input.parentId,seen=new Set(f?[f.id]:[])
        while(parent){if(seen.has(parent))fail(400,'Folders cannot contain themselves.');seen.add(parent);const p=state.folders.find(p=>p.id===parent);if(!p||p.deletedAt||p.section!==section)fail(400,'Choose an active parent in this section.');parent=p.parentId}
        const data={title:input.title.trim(),parentId:input.parentId??null,audience:input.audience,characterIds:clone(input.characterIds)}
        if(f){Object.assign(f,data);f.revision++;return {id:f.id}}
        const created={...data,id:(++sequence).toString(16).padStart(24,'0'),section,revision:1,deletedAt:null,count:0};state.folders.push(created);return {id:created.id}
      }
    }
    fail(404,'Local notebook route unavailable.')
  }
  return {handle}
}
