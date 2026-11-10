import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {spawn,spawnSync} from 'node:child_process'
import {withTemporaryWorkspace} from '../../workspace-artifacts.mjs'

const root=process.cwd(),config=process.argv[2]?JSON.parse(fs.readFileSync(process.argv[2],'utf8')):{}
const evidence=path.join(root,config.evidence??'.local/character-option-review-20261109')
const prior=JSON.parse(fs.readFileSync(path.join(evidence,'live-manifest.json'),'utf8'))
const baseline=JSON.parse(fs.readFileSync(path.join(evidence,'baseline.json'),'utf8')).id
const runtime=config.runtime??['server/lib/character-review-statistics.ts','server/lib/option-authoring-library.ts','server/routes/compendium.ts','server/routes/option-workshop.ts','shared/definition-review.ts','src/components/compendium/CompendiumEntryEditor.vue','src/components/compendium/DefinitionChangeReview.vue','src/components/workshop/OptionWorkshop.vue']
const tests=config.tests??['server/lib/option-authoring-library.test.ts','server/routes/option-workshop.test.ts','server/routes/compendium.test.ts','shared/rule-benefits-audit.test.ts','src/components/compendium/DefinitionChangeReview.test.ts','src/components/workshop/OptionWorkshop.test.ts']
const hash=bytes=>createHash('sha1').update(bytes).digest('hex')
const write=(name,value)=>fs.writeFileSync(path.join(evidence,name+'.json'),JSON.stringify(value,null,2)+'\n')
await withTemporaryWorkspace('character-option-review-production',async directory=>{
 const source=path.join(directory,'source');fs.mkdirSync(source)
 const archive=spawnSync('git',['archive','a7bcf0197280079bcbfe6c2ec4b87c6108a9a2b5'],{cwd:root,maxBuffer:64*1024*1024});assert.equal(archive.status,0)
 const archivePath=path.join(directory,'baseline.tar');fs.writeFileSync(archivePath,archive.stdout)
 const extracted=spawnSync('tar',['-xf',archivePath,'-C',source],{cwd:root,encoding:'utf8'});assert.equal(extracted.status,0,extracted.stderr)
 for(const file of prior){
  const target=path.join(source,file.path)
  if(fs.existsSync(target)&&hash(fs.readFileSync(target))===file.uid)continue
  const selected=config.baselineFiles?path.join(root,config.baselineFiles,file.path):undefined
  const retained=selected&&fs.existsSync(selected)?selected:path.join(root,'.local/reader-spell-levels-20261104/source',file.path)
  let bytes=fs.existsSync(retained)?fs.readFileSync(retained):null
  const current=path.join(root,file.path);if((!bytes||hash(bytes)!==file.uid)&&fs.existsSync(current)){const candidate=fs.readFileSync(current);if(hash(candidate)===file.uid)bytes=candidate}
  if(!bytes||hash(bytes)!==file.uid){const git=spawnSync('git',['show',(config.checkpoint??'343f786')+':'+file.path],{cwd:root,maxBuffer:64*1024*1024});assert.equal(git.status,0,'Missing baseline: '+file.path);bytes=git.stdout;if(hash(bytes)!==file.uid)bytes=Buffer.from(bytes.toString('utf8').replace(/\r?\n/g,'\r\n'))}
  assert.equal(hash(bytes),file.uid,'Baseline mismatch: '+file.path);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes)
 }
 for(const file of [...runtime,...tests]){const target=path.join(source,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(root,file),target)}
 for(const file of [...(config.integrationRunner?[config.integrationRunner]:[]),...(config.validationSupport??[])]){const target=path.join(source,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(root,file),target)}
 const files=[...new Set([...prior.map(f=>f.path),...runtime,...tests])].map(file=>{const bytes=fs.readFileSync(path.join(source,file));return {path:file,uid:hash(bytes),size:bytes.length}})
 for(const manifest of ['package.json','server/package.json']){const a=JSON.parse(fs.readFileSync(path.join(source,manifest))),b=JSON.parse(fs.readFileSync(path.join(root,manifest)));assert.deepEqual(a.dependencies,b.dependencies);assert.deepEqual(a.devDependencies,b.devDependencies)}
 const links=[['node_modules','node_modules'],['server/node_modules','server/node_modules']];const created=[]
 const logs=[]
 async function run(name,cwd,args){const log=path.join(directory,name+'.log'),fd=fs.openSync(log,'w');try{const code=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,args,{cwd,windowsHide:true,stdio:['ignore',fd,fd],env:{...process.env,DND_WORKSPACE_ROOT:root}});child.once('error',reject);child.once('exit',resolve)});const output=fs.readFileSync(log,'utf8');logs.push({name,code,tail:output.slice(-1800)});assert.equal(code,0,name+' failed: '+output.slice(-1800));console.log(name+' passed')}finally{fs.closeSync(fd)}}
 try{
  for(const [from,to] of links){const target=path.join(source,to);fs.symlinkSync(path.join(root,from),target,'junction');created.push(target)}
  await run('tests',source,['node_modules/vitest/vitest.mjs','run','--maxWorkers=2','--no-fsModuleCache',...(config.testFiles??[])])
  if(config.integrationRunner)await run('database-integration',source,[config.integrationRunner])
  const types=await Promise.allSettled([run('frontend-types',source,['node_modules/vue-tsc/bin/vue-tsc.js','-b']),run('server-types',path.join(source,'server'),['node_modules/typescript/bin/tsc','--noEmit'])]);for(const result of types)if(result.status==='rejected')throw result.reason
  await run('production-build',source,['node_modules/vite/bin/vite.js','build'])
  if(config.postBuildRunner)await run('surface-colours',source,[path.join(root,config.postBuildRunner)])
  for(const file of files)assert.equal(hash(fs.readFileSync(path.join(source,file.path))),file.uid,'Source changed: '+file.path)
  write('candidate-manifest',files);write('validation',{passed:true,baseline,runtime,tests,files:files.length,logs,at:new Date().toISOString()});console.log(JSON.stringify({passed:true,files:files.length,changedRuntime:runtime.length}))
 }finally{for(const target of created.reverse())fs.unlinkSync(target)}
})
