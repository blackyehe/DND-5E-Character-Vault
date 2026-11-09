import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {spawn,spawnSync} from 'node:child_process'
import {withTemporaryWorkspace} from '../../workspace-artifacts.mjs'

// Validate the narrow patch against the archived production source, with no
// dependency copies, campaign data, credentials or retained source snapshots.
const root=process.cwd(),archiveRef='a7bcf0197280079bcbfe6c2ec4b87c6108a9a2b5'
const evidence=path.join(root,'.local/item-spell-benefits-release-20261109')
const baseline=JSON.parse(fs.readFileSync(path.join(evidence,'baseline.json'),'utf8')).id
const prior=JSON.parse(fs.readFileSync(path.join(evidence,'live-manifest.json'),'utf8'))
const runtime=['server/lib/compendium-character.ts','server/lib/inventory.ts','server/lib/item-benefits.ts','server/models/Character.ts','server/routes/characters.ts','server/routes/items.ts','shared/character.ts','shared/imported-items.ts','shared/rule-benefits.ts','src/components/sheet/ItemRules.vue']
const tests=['server/lib/compendium-character.test.ts','server/lib/item-benefits.test.ts','shared/imported-items.test.ts','shared/rule-benefits.test.ts','src/components/sheet/CombatTrackers.test.ts']
const hash=bytes=>createHash('sha1').update(bytes).digest('hex')
fs.mkdirSync(evidence,{recursive:true})
const write=(name,value)=>fs.writeFileSync(path.join(evidence,name+'.json'),JSON.stringify(value,null,2)+'\n')
await withTemporaryWorkspace('item-spell-benefits-production',async directory=>{
 const source=path.join(directory,'source');fs.mkdirSync(source)
 const archive=spawnSync('git',['archive',archiveRef],{cwd:root,maxBuffer:64*1024*1024})
 assert.equal(archive.status,0,'Could not read production archive')
 const archivePath=path.join(directory,'baseline.tar');fs.writeFileSync(archivePath,archive.stdout)
 const extracted=spawnSync('tar',['-xf',archivePath,'-C',source],{cwd:root,encoding:'utf8'});assert.equal(extracted.status,0,extracted.stderr)
 // Later published reader changes are preserved from their individually verified
 // retained release inputs; the current hosted SHA-1 tree is authoritative.
 for(const file of prior){
  const target=path.join(source,file.path)
  if(!fs.existsSync(target)||hash(fs.readFileSync(target))!==file.uid){
   const retained=path.join(root,'.local/reader-spell-levels-20261104/source',file.path)
   assert.equal(hash(fs.readFileSync(retained)),file.uid,'Baseline mismatch: '+file.path)
   fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(retained,target)
  }
  assert.equal(hash(fs.readFileSync(target)),file.uid,'Baseline mismatch: '+file.path)
 }
 for(const file of [...runtime,...tests]){const target=path.join(source,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(root,file),target)}
 const files=[...new Set([...prior.map(f=>f.path),...runtime,...tests])].map(file=>({path:file,uid:hash(fs.readFileSync(path.join(source,file)))}))
 for(const manifest of ['package.json','server/package.json']){
  const before=JSON.parse(fs.readFileSync(path.join(source,manifest))),installed=JSON.parse(fs.readFileSync(path.join(root,manifest)))
  assert.deepEqual(before.dependencies,installed.dependencies);assert.deepEqual(before.devDependencies,installed.devDependencies)
 }
 fs.symlinkSync(path.join(root,'node_modules'),path.join(source,'node_modules'),'junction')
 fs.symlinkSync(path.join(root,'server/node_modules'),path.join(source,'server/node_modules'),'junction')
 try {
 const logs=[]
 async function run(name,cwd,args){
  const log=path.join(directory,name+'.log'),fd=fs.openSync(log,'w')
  try{
   const code=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,args,{cwd,windowsHide:true,stdio:['ignore',fd,fd]});child.once('error',reject);child.once('exit',resolve)})
   const output=fs.readFileSync(log,'utf8');logs.push({name,code,tail:output.slice(-2200)})
   assert.equal(code,0,name+' failed: '+output.slice(-2200));console.log(name+' passed')
  }finally{fs.closeSync(fd)}
 }
 await run('tests',source,['node_modules/vitest/vitest.mjs','run','--maxWorkers=2','--no-fsModuleCache'])
 const types=await Promise.allSettled([run('frontend-types',source,['node_modules/vue-tsc/bin/vue-tsc.js','-b']),run('server-types',path.join(source,'server'),['node_modules/typescript/bin/tsc','--noEmit'])])
 for(const result of types)if(result.status==='rejected')throw result.reason
 await run('production-build',source,['node_modules/vite/bin/vite.js','build'])
 for(const file of files)assert.equal(hash(fs.readFileSync(path.join(source,file.path))),file.uid,'Validation changed source: '+file.path)
 write('candidate-manifest',files)
 write('validation',{passed:true,baseline,runtime,tests,files:files.length,logs,at:new Date().toISOString()})
 console.log(JSON.stringify({passed:true,files:files.length,changedRuntime:runtime.length}))
 } finally {
  fs.unlinkSync(path.join(source,'server/node_modules'))
  fs.unlinkSync(path.join(source,'node_modules'))
 }
})
