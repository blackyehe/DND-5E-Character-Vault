import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {fileURLToPath} from 'node:url'
import {createServer} from 'vite'
import {withTemporaryWorkspace} from '../workspace-artifacts.mjs'
import {chromium} from 'file:///C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),source=process.cwd(),evidence=path.join(root,'.local/benefit-rows-party-spells-20261111')
const entry=`import {createApp,h} from 'vue';import {createPinia} from 'pinia';import {useAuthStore} from '/src/stores/auth.ts';import {useBuilderAppearance} from '/src/composables/useBuilderAppearance.ts';import {emptyCharacter} from '/shared/character.ts';
import '/src/style.css';import '/src/components/creation/builder.css';import '/src/components/creation/builder-theme.css';import '/src/site-theme.css';import '/src/assets/fonts/barlow/font-faces.css';import '/src/components/sheet/sheet.css';import '/src/components/sheet/sheet-details.css';import '/src/rooms.css';import '/src/compact-layout.css';import '/src/components/sheet/sheet-density.css';import '/src/components/sheet/sheet-folio.css';import '/src/components/sheet/sheet-refinements.css';import '/src/components/sheet/sheet-alignment.css';import '/src/components/sheet/sheet-surfaces.css';import '/src/components/party/party-dashboard.css';import PartyCombatKit from '/src/components/party/PartyCombatKit.vue';
const c=emptyCharacter();c._id='hero';c.meta.name='Fixture';c.meta.level=6;c.meta.race='Fixture race';c.abilities.cha=18;c.spellcasting.ability='cha';c.spellcasting.known=['Arcane Bolt','Flame'];c.spellcasting.prepared=['Flame'];c.equipment=[{name:'Focus',qty:1,weight:0,equipped:true,notes:'',benefits:[{type:'spell-attack-bonus',value:3},{type:'spell-dc-bonus',value:3}]}];c.compendiumRules=[{kind:'races',index:'race',revision:1,before:{name:'Fixture race'},entry:{name:'Fixture race',benefits:[{type:'damage-resistance',value:'cold'},{':type':':damage-resistance',':value':':cold',':level':1}]}}];
const spell=(name,extra)=>({name,index:name,url:'',level:1,school:{name:'Evocation'},casting_time:'1 action',range:'120 feet',duration:'Instantaneous',components:['V','S'],desc:['Full fixture rules.'],higher_level:['More damage at higher levels.'],...extra});window.fixture={character:c,spells:{'Arcane Bolt':spell('Arcane Bolt',{attack_type:'ranged'}),Flame:spell('Flame',{dc:{dc_type:{index:'dex'}}})},libraryRevision:'fixture'};
const pinia=createPinia();useAuthStore(pinia).user={id:'fixture-owner',email:'fixture@example.test',displayName:'Fixture'};const appearance=useBuilderAppearance();Object.assign(appearance.appearance,{theme:'obsidian',accent:'crimson',coverage:'immersive'});const app=createApp({render:()=>h('div',{class:'site-shell','data-theme':'obsidian',style:appearance.appearanceStyle.value},h('main',{class:'game-room hero-sheet',style:'max-width:1100px;padding:16px;margin:auto'},h(PartyCombatKit,{roomId:'room',characterId:'hero',version:'fixture'})))});app.use(pinia);app.mount('#app');`
const results=[]
await withTemporaryWorkspace('party-spell-browser',async directory=>{
 let server,context
 try{
  const plugin={name:'isolated-party-spells',resolveId(id){if(id==='/__party-fixture.js')return '\0party-fixture'},load(id){if(id==='\0party-fixture')return entry},configureServer(s){s.middlewares.use(async(req,res,next)=>{if(req.url?.split('?')[0]!=='/__party-fixture')return next();try{const html=await s.transformIndexHtml('/__party-fixture','<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="app"></div><script type="module" src="/__party-fixture.js"></script></body></html>');res.setHeader('Content-Type','text/html');res.end(html)}catch(e){next(e)}})}}
  server=await createServer({root:source,cacheDir:path.join(directory,'vite-cache'),server:{host:'127.0.0.1',port:0,watch:{ignored:['**/*']}},optimizeDeps:{noDiscovery:true,include:['vue','pinia']},plugins:[plugin],logLevel:'error'})
  await server.listen();const origin=`http://127.0.0.1:${server.httpServer.address().port}`
  context=await chromium.launchPersistentContext(path.join(directory,'profile'),{headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});context.setDefaultTimeout(20000)
  for(const width of [1100,390]){
   const page=await context.newPage();await page.setViewportSize({width,height:1000});const errors=[],unexpected=[],writes=[]
   page.on('pageerror',e=>errors.push(e.message))
   await page.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());if(url.origin!==origin)return route.abort();if(!url.pathname.startsWith('/api/'))return route.continue()
    if(request.method()!=='GET')writes.push(url.pathname)
    if(request.method()==='GET'&&url.pathname==='/api/rooms/room/characters/hero')return route.fulfill({contentType:'application/json',body:JSON.stringify(await page.evaluate(()=>window.fixture))})
    unexpected.push({method:request.method(),path:url.pathname});return route.fulfill({status:500,contentType:'application/json',body:'{"error":"Unexpected fixture request"}'})
   })
   await page.goto(origin+'/__party-fixture')
   await page.getByText('Combat reference',{exact:false}).first().click()
   const section=page.getByRole('region',{name:'Spells',exact:true});await section.getByText('1d20 +10',{exact:true}).waitFor({state:'visible'})
   assert.equal(await section.getByText('DEX save DC 18',{exact:true}).count(),1)
   const bolt=section.locator('details').filter({has:page.locator('summary strong',{hasText:'Arcane Bolt'})}),flame=section.locator('details').filter({has:page.locator('summary strong',{hasText:'Flame'})})
   await bolt.locator('summary').click();assert.equal(await flame.getAttribute('open'),null);await bolt.getByText('More damage at higher levels.').waitFor({state:'visible'})
   assert.equal(await bolt.locator('strong').filter({hasText:'Casting time:'}).count(),1)
   await page.getByText('Benefit sources',{exact:true}).click();assert.equal(await page.getByText('Damage resistance: Cold · Fixture race · Active',{exact:true}).count(),1)
   const geometry=await section.evaluate(el=>({background:getComputedStyle(el.querySelector('.spellbook-rule')).backgroundColor,overflow:el.scrollWidth>el.clientWidth+1,rows:[...el.querySelectorAll('.spellbook-rule')].map(row=>({width:row.getBoundingClientRect().width,overflow:row.scrollWidth>row.clientWidth+1}))}))
   assert.notEqual(geometry.background,'rgba(0, 0, 0, 0)');assert.equal(geometry.overflow,false);assert.ok(geometry.rows.every(r=>!r.overflow));assert.ok(Math.abs(geometry.rows[0].width-geometry.rows[1].width)<1)
   await page.screenshot({path:path.join(evidence,`party-spells-${width}.png`),fullPage:true});assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);assert.deepEqual(writes,[])
   results.push({width,passed:true,duplicateDefenses:0,writes:0,...geometry});await page.close()
  }
 }finally{await context?.close();await server?.close()}
},{root})
fs.writeFileSync(path.join(evidence,'ui.json'),JSON.stringify({passed:true,results,at:new Date().toISOString()},null,2)+'\n');console.log(JSON.stringify({passed:true,results}))
