export const BACKUP_FORMAT='codex-of-heroes-backup'
export const BACKUP_VERSION=2
export const BACKUP_FILE_BYTES=50*1024*1024
export const BACKUP_EXPANDED_BYTES=256*1024*1024
export interface BackupSummary {characters:number;content:number;rooms:number;notes:number;history:number;maps:number;cities:number;characterFolders:number}
export interface AccountBackup {format:typeof BACKUP_FORMAT;version:2;encoding:'gzip-base64';sha256:string;bytes:number;createdAt:string;summary:BackupSummary;payload:string;device?:Record<string,unknown>}
export interface BackupRestoreResult {characters:number;content:number;rooms?:number;notes?:number;history?:number;maps?:number;cities?:number;idMap?:Record<string,string>;playersMustRejoin?:boolean}

const textFields=new Set(['name','title','description','notes','backstory','source','sourceUrl','caption','featureDescription','featureName','script','equipment','relation','editedBy','action','help'])
/** Change identity references, never arbitrary prose, source files or image bytes. */
export function remapBackupReferences(value:unknown,ids:ReadonlyMap<string,string>,noteText=false,key=''):any{
  if(key==='$binary')return value
  if(Array.isArray(value))return value.map(v=>remapBackupReferences(v,ids,noteText,key))
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,remapBackupReferences(v,ids,noteText,k)]))
  if(typeof value!=='string'||textFields.has(key))return value
  if(key==='body')return noteText?remapNotebookLinks(value,ids):value
  if(ids.has(value))return ids.get(value)!
  return value.replace(/^(homebrew-|workshop-item-)([a-f0-9]{24})(?=-|$)/i,(original,prefix:string,id:string)=>ids.has(id)?prefix+ids.get(id):original)
}
export function remapNotebookLinks(body:string,ids:ReadonlyMap<string,string>){
  let fenced=false
  return body.split('\n').map(line=>{if(/^```/.test(line)){fenced=!fenced;return line}if(fenced)return line
    return line.split(/(`[^`]*`)/g).map(part=>part.startsWith('`')?part:part
      .replace(/(\[\[\s*)([a-f0-9]{24})(?=(?:\.md)?(?:#|\||\s*\]\]))/gi,(all,prefix:string,id:string)=>ids.has(id)?prefix+ids.get(id):all)
      .replace(/(\]\(note:)([a-f0-9]{24})(?=\))/gi,(all,prefix:string,id:string)=>ids.has(id)?prefix+ids.get(id):all)).join('')
  }).join('\n')
}
