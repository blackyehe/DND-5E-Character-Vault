import {createServer as createHttpServer} from 'node:http'
import {fileURLToPath} from 'node:url'
import {readFile} from 'node:fs/promises'
import {createServer as createViteServer} from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import {createNotebook,loadSeed,roomId,characters} from './model.mjs'

process.chdir(fileURLToPath(new URL('../..',import.meta.url)))
const resumed=process.env.CODEX_PREVIEW_STATE_FILE?JSON.parse(await readFile(process.env.CODEX_PREVIEW_STATE_FILE,'utf8')):undefined
const notebook=createNotebook(await loadSeed(),resumed)
const port=Number(process.env.CODEX_PREVIEW_PORT??5182)
const vite=await createViteServer({configFile:false,plugins:[{
  name:'local-notebook-banner',enforce:'pre',transform(code,id){if(id.endsWith('/src/views/RoomView.vue'))return code.replace('<CampaignNotebook v-if=', '<CampaignNotebook local-preview v-if=')},
},vue(),tailwindcss()],server:{middlewareMode:true,hmr:false,ws:false},appType:'spa'})
const {emptyCharacter}=await vite.ssrLoadModule('/shared/character.ts')
const sheets=characters.map(c=>{const value=emptyCharacter();value._id=c.id;value.meta.name=c.name;value.assignedTo='local-player-'+c.id;return value})
const room={id:roomId,name:'Revalon Kampány · local preview',role:'dm',members:characters.map(c=>({id:'local-player-'+c.id,displayName:c.name+' · preview player',role:'player'})),characters:sheets,joinToken:null}
const server=createHttpServer(async(req,res)=>{
  const url=new URL(req.url,`http://localhost:${port}`)
  if(!url.pathname.startsWith('/api/'))return vite.middlewares(req,res,()=>{res.statusCode=404;res.end()})
  res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store')
  try{
    // No external API proxy, database, or production credentials are used.
    let body='';for await(const chunk of req){body+=chunk;if(body.length>400000)throw Object.assign(new Error('Local request too large.'),{status:413})}
    const input=body?JSON.parse(body):{}
    let result
    if(url.pathname.startsWith(`/api/rooms/${roomId}/notebook`)){
      await new Promise(r=>setTimeout(r,url.pathname.includes('/entries/')?180:60))
      result=notebook.handle(req.method,url,input)
    }else{
      if(req.method!=='GET')throw Object.assign(new Error('Only the local notebook supports changes in this preview.'),{status:405})
      const path=url.pathname
      if(path==='/api/auth/me')result={id:'local-codex-dm',email:'local@example.test',displayName:'DM · local preview'}
      else if(path==='/api/rooms')result=[{id:roomId,name:room.name,role:'dm',memberCount:2}]
      else if(path===`/api/rooms/${roomId}`)result=room
      else if(path==='/api/characters')result=[]
      else if(path.endsWith('/references'))result={spells:[],feats:[],races:[],classes:[],subclasses:[],backgrounds:[]}
      else if(path==='/api/character-library')result={folders:[],placements:[],revision:0}
      else if(path===`/api/rooms/${roomId}/party`)result={characters:sheets,generatedAt:new Date().toISOString()}
      else throw Object.assign(new Error('This local preview focuses on the campaign notebook.'),{status:404})
    }
    res.end(JSON.stringify(result))
  }catch(error){res.statusCode=error.status??500;res.end(JSON.stringify({error:error.message}))}
})
server.listen(port,'127.0.0.1',()=>console.log(`Codex local preview: http://localhost:${port}/rooms/${roomId}?section=notebook`))
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await vite.close();server.close();process.exit()})
