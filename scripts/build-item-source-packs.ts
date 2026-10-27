import { readFileSync,writeFileSync,mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { gzipSync } from 'node:zlib'
import { inspectOrcbrew,sourceHash,canonicalContent,ORCBREW_KINDS } from '../server/lib/orcbrew'
import { readEdn,type EdnSpan } from '../server/lib/edn'
import { writeEdn,monsterKeyword } from '../server/lib/workshop-pack'
import { storedPackData } from '../server/lib/pack-storage'
import { type FiveToolsItemRecord } from '../shared/five-tools-item'

const input=JSON.parse(readFileSync('.preview.local/5etools-items-resolved.json','utf8')) as {version:string;total:number;records:FiveToolsItemRecord[];failures:unknown[];capturedAt:string}
if(input.failures.length||input.records.length!==input.total)throw Error('Incomplete source capture')
const monsters=JSON.parse(readFileSync('output/monster-source-packs/manifest.json','utf8'))
const bundle=readFileSync('output/portable-orcbrew-export/All homebrew.orcbrew','utf8'),spans=new WeakMap<object,EdnSpan>()
const root=readEdn(bundle,()=>{},spans) as Record<string,unknown>,rootFields=spans.get(root)!.fields!
const groups=new Map<string,FiveToolsItemRecord[]>(),identities=new Set<string>(),names:Record<string,string>={}
for(const record of input.records){const id=String(record.item.source),identity=JSON.stringify([id,record.item.name]);if(identities.has(identity))throw Error('Duplicate item identity '+identity);identities.add(identity);names[id]=record.sourceName;const group=groups.get(id)??[];group.push(record);groups.set(id,group)}
const out='output/item-source-packs',transfer='.preview.local/item-pack-transfer';mkdirSync(out,{recursive:true});mkdirSync(transfer,{recursive:true})
const sha=(s:string)=>createHash('sha256').update(s).digest('hex'),plans:Record<string,unknown>[]=[],allIndexes=new Set<string>()
const newSources:Record<string,string>={}
for(const [id,records] of [...groups].sort(([a],[b])=>a.localeCompare(b))){
  const existing=monsters.packs.find((p:{id:string})=>p.id===id),filename=existing?.filename??`${names[id]!.replace(/[<>:"/\\|?*\u0000-\u001f]/g,'-').replace(/[. ]+$/g,'')} [${id}].orcbrew`
  const span=rootFields[filename],original=span?bundle.slice(span.start,span.end):undefined
  if(existing&&!original)throw Error('Missing existing source pack '+id)
  const before=original?inspectOrcbrew(original):null
  if(before&&(before.entries.equipment.length||before.entries['magic-items'].length))throw Error('Items already exist in '+id+'; review before merging')
  const sections:Record<string,string[]>={equipment:[],'magic-items':[]}
  for(const record of records.sort((a,b)=>String(a.item.name).localeCompare(String(b.item.name),'en'))){
    const key='five-tools-item-'+sha(JSON.stringify([id,record.item.name])).slice(0,24),kind=record.mundane?'equipment':'magic-items'
    sections[kind]!.push(':'+key+' '+writeEdn({':name':String(record.item.name),':key':monsterKeyword(key),':option-pack':id,':disabled?':false,':codex/source-snapshot':`5etools-${input.version}-${input.capturedAt.slice(0,10)}`,':codex/item':record}))
  }
  const forms=Object.entries(sections).filter(([,v])=>v.length).map(([kind,forms])=>`:orcpub.dnd.e5/${kind} {\n${forms.join('\n')}\n}`).join('\n')
  const source=original?original.slice(0,-1)+'\n'+forms+'\n}':'{\n'+forms+'\n}\n'
  const parsed=inspectOrcbrew(source)
  if(parsed.report.duplicateCount||parsed.report.nonFiniteCount||parsed.report.warnings.length)throw Error('Invalid generated source '+id)
  if(before)for(const kind of ORCBREW_KINDS){if(kind==='equipment'||kind==='magic-items')continue;const signature=(e:{index:string;details?:unknown})=>e.index+'|'+canonicalContent(e.details);if(JSON.stringify(before.entries[kind].map(signature))!==JSON.stringify(parsed.entries[kind].map(signature)))throw Error('Changed original content '+id+'/'+kind)}
  const items=[...parsed.entries.equipment,...parsed.entries['magic-items']]
  if(items.length!==records.length)throw Error('Item coverage failed '+id)
  const originals=new Map(records.map(r=>[String(r.item.name),canonicalContent(r)]))
  for(const entry of items){if(allIndexes.has(entry.index)||entry.source!==id)throw Error('Duplicate/wrong item source');if(canonicalContent((entry.details as Record<string,unknown>)[':codex/item'])!==originals.get(entry.name))throw Error('Changed item record '+entry.name);allIndexes.add(entry.index)}
  storedPackData({filename,source})
  writeFileSync(`${out}/${filename}`,source)
  newSources[filename]=source
  const payload={filename,source:gzipSync(Buffer.from(source),{level:9}).toString('base64'),sourceEncoding:'gzip-base64',sourceBytes:Buffer.byteLength(source)}
  writeFileSync(`${transfer}/${id}.json`,JSON.stringify(existing?{pack:payload,expectedHash:sourceHash(original!)}:payload))
  plans.push({id,title:names[id],filename,existing:!!existing,expectedHash:original?sourceHash(original):undefined,beforeSha256:original?sha(original):undefined,sha256:sha(source),sourceHash:sourceHash(source),bytes:Buffer.byteLength(source),items:items.length,equipment:parsed.entries.equipment.length,magicItems:parsed.entries['magic-items'].length,monsters:parsed.entries.monsters.length,indexes:items.map(e=>e.index)})
}
if(allIndexes.size!==input.total)throw Error('Total coverage failed')
const combined='{\n'+[...Object.keys(root).map(filename=>JSON.stringify(filename)+' '+(newSources[filename]??bundle.slice(rootFields[filename]!.start,rootFields[filename]!.end))),...Object.keys(newSources).filter(f=>!rootFields[f]).map(filename=>JSON.stringify(filename)+' '+newSources[filename])].join('\n')+'\n}'
const summary={snapshot:`5etools-${input.version}-${input.capturedAt.slice(0,10)}`,builtAt:new Date().toISOString(),total:input.total,sourceCount:plans.length,reused:plans.filter(p=>p.existing).length,created:plans.filter(p=>!p.existing).length,combinedBytes:Buffer.byteLength(combined),combinedGzipBase64Bytes:gzipSync(combined,{level:9}).toString('base64').length,plans}
writeFileSync(`${out}/manifest.json`,JSON.stringify(summary,null,2));writeFileSync(`${transfer}/manifest.json`,JSON.stringify(summary));writeFileSync(`${out}/source-names.json`,JSON.stringify(names,null,2));writeFileSync(`${out}/All content with items.orcbrew`,combined)
console.log(JSON.stringify({...summary,plans:undefined}))
