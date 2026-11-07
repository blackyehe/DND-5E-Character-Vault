import fs from 'node:fs'
import path from 'node:path'

// Read-only. Accepts the existing cold-replay JSON format. Never emits entry
// payloads, credentials, source text, owner IDs, or raw database commands.
const files=process.argv.slice(2)
if(!files.length){console.error('Usage: node scripts/summarize-compendium-trace.mjs <trace.json> [...]');process.exitCode=1}
for(const file of files){
 try{
  const trace=JSON.parse(fs.readFileSync(file,'utf8'))
  if(!Array.isArray(trace.rows))throw Error('Expected a cold-replay trace with rows')
  const runs=trace.rows.flatMap(row=>{
   if(!Array.isArray(row.runs))throw Error('Expected runs for each category')
   return row.runs.map(run=>{
    if(!Number.isFinite(run.ms)||!Array.isArray(run.commands))throw Error('Expected duration and command list')
    const commands={}
    for(const command of run.commands){const name=String(command.command??'unknown');commands[name]=(commands[name]??0)+1}
    return {kind:row.kind,phase:run.phase,ms:Math.round(run.ms),databaseCommands:run.commands.length,cursorContinuations:commands.getMore??0,commands}
   })
  })
  console.log(JSON.stringify({file:path.basename(file),capturedAt:trace.at??null,artificialReplyDelayMs:trace.artificialReplyDelayMs??null,notice:'Recorded evidence only; not a fresh measurement of the current website. Cursor counts do not establish which optimization will help.',runs},null,2))
 }catch(error){console.error(path.basename(file)+': '+error.message);process.exitCode=1}
}
