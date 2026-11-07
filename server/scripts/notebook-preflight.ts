import mongoose from 'mongoose'
import {readFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {notebookPreflight} from '../lib/notebook-preflight'

export async function main(args=process.argv.slice(2)){
 if(args.some(a=>!/^--(?:room=[a-f\d]{24}|uri-file=.+|consistency)$/i.test(a)))throw Error('Use --room=OBJECTID, optional --uri-file=PRIVATE_PATH and --consistency. There is no apply mode.')
 const room=args.find(a=>a.startsWith('--room='))?.slice(7),file=args.find(a=>a.startsWith('--uri-file='))?.slice(11)
 const uri=file?readFileSync(file,'utf8').trim():process.env.MONGO_URI??process.env.MONGODB_URI
 if(!room||!uri||!/^mongodb(?:\+srv)?:\/\//.test(uri))throw Error('A private connection string and explicit room are required; no default database is used.')
 if(!/^mongodb(?:\+srv)?:\/\/[^/?#]+\/[^/?#]+(?:\?|$)/.test(uri))throw Error('An explicit database name is required in the private connection string.')
 const client=new mongoose.mongo.MongoClient(uri,{maxPoolSize:1,serverSelectionTimeoutMS:8000,connectTimeoutMS:8000,socketTimeoutMS:15000})
 try{await client.connect();console.log(JSON.stringify(await notebookPreflight(client.db(),room,args.includes('--consistency')),null,2))}finally{await client.close()}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(JSON.stringify({error:'Notebook read-only preflight did not complete.',name:error.name,code:error.codeName??error.code}));process.exitCode=1})
