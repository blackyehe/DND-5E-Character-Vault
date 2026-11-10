import fs from 'node:fs'
import path from 'node:path'
import net from 'node:net'
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {randomBytes} from 'node:crypto'
import mongoose from '../server/node_modules/mongoose/index.js'
import {withTemporaryWorkspace} from '../workspace-artifacts.mjs'

const evidence=process.env.DND_EVIDENCE_DIR??process.argv[2]??'.local/definition-consistency-20261110'
fs.mkdirSync(evidence,{recursive:true})
const port=await new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const address=s.address();s.close(()=>resolve(address.port))})})
await withTemporaryWorkspace('def-db',async directory=>{
 const db=path.join(directory,'db');fs.mkdirSync(db)
 const processLog=fs.openSync(path.join(directory,'mongo.log'),'w')
 const child=spawn('C:/Program Files/MongoDB/Server/8.3/bin/mongod.exe',['--bind_ip','127.0.0.1','--port',String(port),'--dbpath',db,'--replSet','definitions','--oplogSize','32','--wiredTigerCacheSizeGB','0.25'],{windowsHide:true,stdio:['ignore',processLog,processLog]})
 const stopped=new Promise(resolve=>child.once('exit',resolve)),uri=`mongodb://127.0.0.1:${port}`
 let client
 try{
  const deadline=Date.now()+30000
  while(Date.now()<deadline){try{client=await mongoose.mongo.MongoClient.connect(uri,{directConnection:true,serverSelectionTimeoutMS:300});break}catch{await new Promise(resolve=>setTimeout(resolve,150))}}
  assert.ok(client,'Local test database did not start: '+fs.readFileSync(path.join(directory,'mongo.log'),'utf8').slice(-1500))
  await client.db('admin').command({replSetInitiate:{_id:'definitions',members:[{_id:0,host:`127.0.0.1:${port}`}]}})
  while(Date.now()<deadline){if((await client.db('admin').command({hello:1})).isWritablePrimary)break;await new Promise(resolve=>setTimeout(resolve,150))}
  assert.equal((await client.db('admin').command({hello:1})).isWritablePrimary,true);await client.close();client=undefined
  const log=path.join(directory,'tests.log'),fd=fs.openSync(log,'w')
  let status
  try{status=await new Promise((resolve,reject)=>{const test=spawn(process.execPath,['node_modules/vitest/vitest.mjs','run','server/routes/definition-consistency.integration.test.ts','--maxWorkers=2','--no-fsModuleCache','--reporter=verbose'],{cwd:process.cwd(),windowsHide:true,stdio:['ignore',fd,fd],env:{...process.env,VERCEL:'',DEFINITION_CONSISTENCY_TESTS:'1',COMPENDIUM_READER:'legacy',COMPENDIUM_PREPARED_USERS:'',MONGO_URI:`${uri}/definition_consistency_tests_${randomBytes(6).toString('hex')}?replicaSet=definitions`}});test.once('error',reject);test.once('exit',resolve)})}finally{fs.closeSync(fd)}
  const output=fs.readFileSync(log,'utf8');console.log(output.slice(-2500))
  fs.writeFileSync(path.join(evidence,'integration-results.json'),JSON.stringify({passed:status===0,at:new Date().toISOString(),tail:output.slice(-14000)},null,2)+'\n')
  assert.equal(status,0,'Definition consistency integration tests failed')
 }finally{await client?.close();if(child.exitCode===null)child.kill();await stopped;fs.closeSync(processLog)}
},{root:process.env.DND_WORKSPACE_ROOT??process.cwd()})
