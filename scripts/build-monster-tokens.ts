import { readFileSync,writeFileSync } from 'node:fs'
import { fiveToolsMonsterToken } from '../shared/monster-token'
const input=JSON.parse(readFileSync('.preview.local/5etools-resolved.json','utf8'))
const tokens=Object.fromEntries(input.records.flatMap(({monster}:any)=>{
  const token=fiveToolsMonsterToken(monster)
  return token?[[monster.source+':'+monster.name,token]]:[]
}))
const payload={snapshot:'5etools-'+input.version+'-'+input.capturedAt.slice(0,10),tokens}
writeFileSync('server/data/5etools-monster-tokens.json',JSON.stringify(payload)+'\n')
console.log(JSON.stringify({tokens:Object.keys(tokens).length,bytes:Buffer.byteLength(JSON.stringify(payload))}))
