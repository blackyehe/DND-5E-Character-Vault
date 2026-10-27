export interface MonsterToken { url:string; credit:string }
const object=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{}
const text=(v:unknown)=>typeof v==='string'?v:''
function safeUrl(value:string):string|undefined {
  try{const url=new URL(value);return ['http:','https:'].includes(url.protocol)&&!url.username&&!url.password?url.href:undefined}catch{return undefined}
}
export function readMonsterToken(value:unknown):MonsterToken|undefined {
  const raw=object(value),url=safeUrl(text(raw.url))
  return url?{url,credit:text(raw.credit)}:undefined
}

/** Follow 5etools' explicit-token precedence and ASCII filename convention.
 * Resolved generated forms may share their explicitly retained base token. */
export function fiveToolsMonsterToken(value:unknown):MonsterToken|undefined {
  const m=object(value),token=object(m.token),href=object(m.tokenHref)
  const tokenName=(name:string)=>name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/Æ/g,'AE').replace(/æ/g,'ae').replace(/"/g,'')
  const implicit=(source:string,name:string)=>source&&name?`https://5e.tools/img/bestiary/tokens/${encodeURIComponent(source)}/${encodeURIComponent(tokenName(name))}.webp`:''
  let url=text(m.tokenUrl)
  if(!url&&m.token)url=implicit(text(token.source),text(token.name))
  if(!url&&m.tokenHref)url=href.type==='internal'?'https://5e.tools/img/'+text(href.path).split('/').map(encodeURIComponent).join('/'):text(href.url)
  if(!url&&m.hasToken===true)url=implicit(text(m.source),text(m.name))
  if(!url&&m._versionBase_hasToken===true)url=implicit(text(m._versionBase_source),text(m._versionBase_name))
  return readMonsterToken({url,credit:text(m.tokenCredit)})
}
