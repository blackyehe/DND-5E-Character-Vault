import {BACKUP_FILE_BYTES,remapBackupReferences,type BackupRestoreResult} from '../../shared/account-backup'

const arrays={optionDrafts:'codex:option-workshop:v1:',monsterDrafts:'codex:monster-workshop:v1:',workshopDrafts:'codex:homebrew-workshop:v1:',deletedDrafts:'codex:workshop-trash:v1:'} as const
const fields=new Set([...Object.keys(arrays),'characterDraft','appearance'])
export function validateBackupDevice(value:unknown):Record<string,any>{
  if(value===undefined)return{}
  if(!value||typeof value!=='object'||Array.isArray(value)||JSON.stringify(value).length>1024*1024)throw Error('The device drafts in this backup are invalid or exceed 1 MiB.')
  const device=value as Record<string,unknown>
  for(const [key,v]of Object.entries(device))if(fields.has(key)){
    if(key in arrays){if(!Array.isArray(v)||v.length>500||v.some(d=>!d||typeof d!=='object'||Array.isArray(d)||typeof(d.localId??d.id)!=='string'))throw Error('The backup contains an invalid draft list.')}
    else if(v!==null&&(!v||typeof v!=='object'||Array.isArray(v)))throw Error('The backup contains invalid device settings.')
  }
  return Object.fromEntries(Object.entries(device).filter(([key])=>fields.has(key)))
}
export function captureBackupDevice(owner:string){
  const device:Record<string,unknown>={}
  for(const [field,prefix]of Object.entries(arrays))device[field]=JSON.parse(localStorage.getItem(prefix+owner)??'[]')
  device.characterDraft=JSON.parse(localStorage.getItem('codex:character-builder:v1:'+owner)??'null')
  device.appearance=JSON.parse(localStorage.getItem('codex:builder-appearance:v1')??'null')
  return validateBackupDevice(device)
}
export function backupDownloadSize(value:unknown){if(new Blob([JSON.stringify(value)]).size>BACKUP_FILE_BYTES)throw Error('The complete backup exceeds the 50 MiB restore limit. No partial backup was downloaded.')}
/** Existing local work wins. A failed device write never undoes a completed server restore. */
export function restoreBackupDevice(device:Record<string,any>,owner:string,result:BackupRestoreResult){
  const ids=new Map(Object.entries(result.idMap??{}));let saved=0,kept=0
  for(const [field,prefix]of Object.entries(arrays)){
    if(!device[field]?.length)continue
    const key=prefix+owner,existing=JSON.parse(localStorage.getItem(key)??'[]');if(!Array.isArray(existing))throw Error('Existing device drafts could not be read; they were preserved.')
    const seen=new Set(existing.map((d:any)=>d.localId??d.id)),incoming=remapBackupReferences(device[field],ids) as any[]
    const add=incoming.filter(d=>{if(seen.has(d.localId??d.id)){kept++;return false}seen.add(d.localId??d.id);return true})
    if(field==='deletedDrafts')for(const d of add){const scope=Object.values(arrays).find(p=>String(d.storageKey).startsWith(p)&&p!=='codex:workshop-trash:v1:');if(!scope)throw Error('A deleted draft has an invalid storage location.');d.storageKey=scope+owner}
    if(add.length){localStorage.setItem(key,JSON.stringify([...existing,...add]));saved+=add.length}
  }
  for(const [field,key]of [['characterDraft','codex:character-builder:v1:'+owner],['appearance','codex:builder-appearance:v1']] as const){if(!device[field])continue;const before=localStorage.getItem(key);if(before&&before!=='null'){kept++;continue}localStorage.setItem(key,JSON.stringify(remapBackupReferences(device[field],ids)));saved++}
  return{saved,kept}
}
