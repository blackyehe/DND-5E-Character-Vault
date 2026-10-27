import { readFileSync,writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { convertFiveToolsRecord,type FiveToolsRecord } from '../shared/five-tools-monster'
const input=JSON.parse(readFileSync('.preview.local/5etools-resolved.json','utf8')) as {version:string;capturedAt:string;sources:Record<string,string>;records:FiveToolsRecord[]}
const snapshot='5etools-'+input.version+'-'+input.capturedAt.slice(0,10)
const references=input.records.map(r=>convertFiveToolsRecord(r,snapshot,input.sources[String(r.monster.source)]??String(r.monster.source)))
const payload={snapshot,capturedAt:input.capturedAt,origin:'https://5e.tools',sourceVersion:input.version,sources:input.sources,references}
const json=JSON.stringify(payload)
writeFileSync('server/data/5etools-monster-references.json',json+'\n')
console.log(JSON.stringify({snapshot,records:references.length,bytes:Buffer.byteLength(json),sha256:createHash('sha256').update(json).digest('hex'),withLore:references.filter(r=>r.extended.info?.text).length,withArt:references.filter(r=>r.extended.info?.images.length).length}))
