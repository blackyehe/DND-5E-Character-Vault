import { readFileSync,writeFileSync,mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fiveToolsOrcbrewMonster } from '../shared/five-tools-orcbrew'
import { type FiveToolsRecord } from '../shared/five-tools-monster'
import { inspectOrcbrew,canonicalContent,sourceHash } from '../server/lib/orcbrew'
import { writeEdn,monsterKeyword } from '../server/lib/workshop-pack'
import { readEdn } from '../server/lib/edn'

const input=JSON.parse(readFileSync('.preview.local/5etools-resolved.json','utf8')) as {version:string;capturedAt:string;sources:Record<string,string>;records:FiveToolsRecord[]}
const backup=JSON.parse(readFileSync('backups/pre-monster-enrichment-2026-10-22.json','utf8'))
const pack=backup.content.find((p:{id:string})=>p.id==='6ad3f02d30d81a047bd314ca')
if(!pack)throw new Error('Book of Shadows backup not found')
const original=pack.data.source as string
if(createHash('sha256').update(original).digest('hex')!=='de8002722f5ae50362d649167c6e89bfa25f95a8fc9e7ec39d42ce8ee42a1b49')throw new Error('Base pack does not match the verified live export')
const root=readEdn(original) as Record<string,unknown>
if(root[':orcpub.dnd.e5/monsters'])throw new Error('The base pack already has monsters; review before replacing')
const snapshot=`5etools-${input.version}-${input.capturedAt.slice(0,10)}`,identities=new Set<string>(),entries:string[]=[],rows:Record<string,unknown>[]=[]
for(const record of [...input.records].sort((a,b)=>(String(a.monster.source)+':'+String(a.monster.name)).localeCompare(String(b.monster.source)+':'+String(b.monster.name),'en'))){
  const identity=JSON.stringify([record.monster.source,record.monster.name])
  if(identities.has(identity))throw new Error('Duplicate source/name identity: '+identity)
  identities.add(identity)
  const key='five-tools-'+createHash('sha256').update(identity).digest('hex').slice(0,24),raw=fiveToolsOrcbrewMonster(record,snapshot,input.sources[String(record.monster.source)]??String(record.monster.source),key)
  const encoded={...raw,':key':monsterKeyword(key),':size':monsterKeyword(raw[':size'])}
  entries.push(':'+key+' '+writeEdn(encoded))
  rows.push({key,name:record.monster.name,source:record.monster.source,lore:!!raw[':codex/extended'].info?.text,art:raw[':codex/extended'].info?.images.length??0})
}
const end=original.lastIndexOf('}'),source=original.slice(0,end)+'\n:orcpub.dnd.e5/monsters {\n'+entries.join('\n')+'\n}\n'+original.slice(end)
const before=inspectOrcbrew(original),after=inspectOrcbrew(source)
if(after.report.counts.monsters!==input.records.length||after.report.nonFiniteCount||after.report.duplicateCount)throw new Error('Monster count, finite number or duplicate validation failed')
for(const kind of Object.keys(before.entries) as (keyof typeof before.entries)[]){if(kind==='monsters')continue;if(canonicalContent(before.entries[kind])!==canonicalContent(after.entries[kind]))throw new Error('Original content changed: '+kind)}
const filename=pack.data.filename,output='output/book-of-shadows'
mkdirSync(output,{recursive:true});writeFileSync(output+'/'+filename,source);writeFileSync(output+'/original.orcbrew',original)
const manifest={snapshot,capturedAt:input.capturedAt,builtAt:new Date().toISOString(),packId:pack.id,filename,baseHash:sourceHash(original),sourceHash:sourceHash(source),bytes:Buffer.byteLength(source),counts:after.report.counts,originalEntries:before.report.entryCount,newMonsters:rows.length,lore:rows.filter(r=>r.lore).length,art:rows.filter(r=>Number(r.art)>0).length,entries:rows}
writeFileSync(output+'/manifest.json',JSON.stringify(manifest,null,2)+'\n')
console.log(JSON.stringify({...manifest,entries:undefined}))
