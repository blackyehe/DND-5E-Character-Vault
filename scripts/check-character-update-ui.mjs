import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {fileURLToPath} from 'node:url'
import {withTemporaryWorkspace} from '../workspace-artifacts.mjs'
import {chromium} from 'file:///C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),source=process.cwd(),evidence=path.join(root,'.local/character-updates-20261111')
const entry=`import {createApp,h} from 'vue';import {createPinia} from 'pinia';import {useAuthStore} from '/src/stores/auth.ts';import {useBuilderAppearance} from '/src/composables/useBuilderAppearance.ts';
import '/src/style.css';import '/src/components/creation/builder.css';import '/src/components/creation/builder-theme.css';import '/src/site-theme.css';import '/src/compact-layout.css';import '/src/components/sheet/sheet-density.css';import '/src/components/sheet/sheet-folio.css';import '/src/components/sheet/sheet-refinements.css';import '/src/components/sheet/sheet-alignment.css';import '/src/components/sheet/sheet-surfaces.css';
import ItemWorkshop from '/src/components/items/ItemWorkshop.vue';const pinia=createPinia();useAuthStore(pinia).user={id:'fixture-owner',email:'fixture@example.test',displayName:'Fixture'};const appearance=useBuilderAppearance();Object.assign(appearance.appearance,{theme:'obsidian',accent:'crimson',coverage:'immersive'});const app=createApp({render:()=>h('div',{class:'site-shell','data-theme':'obsidian',style:appearance.appearanceStyle.value},h(ItemWorkshop))});app.use(pinia);app.directive('stable-loading',{});app.mount('#app');`
const itemId='a'.repeat(24),characterId='b'.repeat(24),reviewHash='c'.repeat(64)
const results=[]
await withTemporaryWorkspace('character-update-browser',async directory=>{
 let server,context
 try{
  const fixturePlugin={name:'isolated-update-fixture',resolveId(id){if(id==='/__update-fixture.js')return '\0update-fixture'},load(id){if(id==='\0update-fixture')return entry},configureServer(s){s.middlewares.use(async(req,res,next)=>{if(req.url?.split('?')[0]!=='/__update-fixture')return next();try{const html=await s.transformIndexHtml('/__update-fixture','<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="app"></div><script type="module" src="/__update-fixture.js"></script></body></html>');res.setHeader('Content-Type','text/html');res.end(html)}catch(e){next(e)}})}}
  server=await createServer({root:source,cacheDir:path.join(directory,'vite-cache'),server:{host:'127.0.0.1',port:0,watch:{ignored:['**/*']}},optimizeDeps:{noDiscovery:true,include:['vue','pinia']},plugins:[fixturePlugin],logLevel:'error'})
  await server.listen();const address=server.httpServer.address(),origin=`http://127.0.0.1:${address.port}`
  context=await chromium.launchPersistentContext(path.join(directory,'profile'),{headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'})
  context.setDefaultTimeout(20000)
  for(const width of [1100,390]){
   const page=await context.newPage();await page.setViewportSize({width,height:950});const errors=[],trace=[],unexpected=[]
   page.on('pageerror',e=>errors.push(e.message))
   let item={name:'Zhaerin Prison',kind:'accessory',magical:true,qty:1,weight:0,equipped:false,notes:'',description:'Fixture necklace',templateId:itemId,templateRevision:1,benefits:[{type:'spell-attack-bonus',value:3},{type:'spell-dc-bonus',value:3}]},revision=2,approved=false
   const review=()=>({revision,characters:[{id:characterId,name:'Volenta',updatedAt:'2026-11-11T00:00:00.000Z',reviewHash,alreadyReviewed:approved,sourceConfirmation:true,blocked:false,warnings:['Custom item values are kept when they differ from the source. Quantity, equipped state, attunement and personal notes stay as saved.','Confirm this is the source intended for this character.'],statistics:[{label:'Spell attack',before:'+12',after:'+12'},{label:'Spell save DC',before:'20',after:'20'}],changes:[{field:'resources',before:[],after:(item.trackers??[]).map(t=>({id:'linked:'+t.id,name:item.name+' · '+t.name,max:t.max,recovery:t.recovery,source:{kind:'item',trackerId:t.id}}))},{field:'equipment',before:[{_id:'copy',name:item.name}],after:[{_id:'copy',name:item.name,trackers:item.trackers}]}]}]})
   await page.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url())
    if(url.origin!==origin)return route.abort()
    if(!url.pathname.startsWith('/api/'))return route.continue()
    const method=request.method(),body=request.postDataJSON();trace.push({method,path:url.pathname,...(body?{body}:{})})
    let data,status=200
    if(method==='GET'&&url.pathname==='/api/items')data=[{id:itemId,item,definitionRevision:revision}]
    else if(method==='GET'&&url.pathname==='/api/characters')data=[{_id:characterId,meta:{name:'Volenta'}}]
    else if(method==='PUT'&&url.pathname==='/api/items/'+itemId){assert.equal(body.expectedRevision,item.templateRevision);assert.equal(body.expectedDefinitionRevision,revision);item={...body.item,templateId:itemId,templateRevision:item.templateRevision+1};revision++;data={id:itemId,item,definitionRevision:revision,message:'Saved fixture item'}}
    else if(method==='GET'&&url.pathname===`/api/compendium/magic-items/workshop-item-${itemId}/review`)data=review()
    else if(method==='POST'&&url.pathname===`/api/compendium/magic-items/workshop-item-${itemId}/review/${characterId}`){assert.deepEqual(body,{expectedRevision:revision,expectedUpdatedAt:'2026-11-11T00:00:00.000Z',reviewHash,confirmedSource:true});approved=true;data={message:'Fixture applied'}}
    else if(method==='GET'&&url.pathname.startsWith('/api/2014/'))data={count:0,results:[]}
    else if(method==='GET'&&url.pathname.startsWith('/api/content/homebrew/'))data=[]
    else{unexpected.push({method,path:url.pathname});status=500;data={error:'Unexpected fixture request'}}
    await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)})
   })
   await page.goto(origin+'/__update-fixture')
   try{await page.locator('.hw-content-card').filter({hasText:'Zhaerin Prison'}).click()}catch(error){throw Error(JSON.stringify({message:error.message,errors,unexpected,trace,body:(await page.locator('body').innerText()).slice(0,1000)}))}
   const dialog=page.locator('dialog.item-composer');await dialog.waitFor({state:'visible'})
   await dialog.locator('summary').filter({hasText:'Linked trackers'}).click()
   await dialog.getByRole('button',{name:'+ Add tracker',exact:true}).click()
   await dialog.getByLabel('Tracker name',{exact:true}).nth(0).fill('Banishment to the Shadowfell')
   await dialog.getByRole('button',{name:'+ Add tracker',exact:true}).click()
   await dialog.getByLabel('Tracker name',{exact:true}).nth(1).fill('Spell Devourer')
   const availability=dialog.locator('select:has(option[value="equipped"])');assert.equal(await availability.count(),2)
   for(const select of await availability.all())await select.selectOption('equipped')
   assert.equal(await dialog.getByRole('button',{name:'Update existing characters',exact:true}).isDisabled(),true)
   await dialog.getByRole('button',{name:'Save changes',exact:true}).click()
   await dialog.getByRole('button',{name:'Update existing characters',exact:true}).waitFor({state:'visible'})
   await page.waitForFunction(()=>!document.querySelector('dialog .item-composer-body>footer button:last-of-type')?.disabled)
   assert.equal(await dialog.isVisible(),true)
   assert.ok(trace.find(r=>r.method==='PUT').body.item.trackers.every(t=>t.activation==='equipped'))
   await dialog.getByRole('button',{name:'Update existing characters',exact:true}).click()
   const preview=dialog.locator('.definition-review');await preview.getByRole('button',{name:'Update Volenta',exact:true}).waitFor({state:'visible'})
   await page.waitForFunction(()=>{const name=document.querySelector('.definition-review-name'),body=document.querySelector('.item-composer-body');if(!name||!body)return false;const a=name.getBoundingClientRect(),b=body.getBoundingClientRect();return a.top>=b.top-1&&a.bottom<=b.bottom})
   const summary=await preview.locator('.definition-review-summary').innerText();assert.ok(summary.includes('Add Banishment to the Shadowfell'),summary);assert.ok(summary.includes('Add Spell Devourer'),summary);assert.ok(summary.includes('While equipped'),summary)
   assert.equal(await preview.getByRole('checkbox').count(),0);assert.equal(await page.getByRole('button',{name:'Find affected characters'}).count(),0)
   assert.equal(await preview.evaluate(el=>el.scrollWidth>el.clientWidth),false)
   await page.screenshot({path:path.join(evidence,`inline-${width}.png`),fullPage:true})
   await preview.getByRole('button',{name:'Update Volenta',exact:true}).click()
   await preview.getByText('Updated Volenta.',{exact:true}).waitFor({state:'visible'})
   assert.equal(trace.filter(r=>r.method==='POST').length,1);assert.equal(approved,true)
   // A later edit must invalidate the preview and save with the returned revisions.
   await dialog.getByRole('button',{name:'Close character update preview'}).click()
   await dialog.getByLabel('Item name',{exact:true}).fill('Zhaerin Prison revised')
   assert.equal(await dialog.getByRole('button',{name:'Update existing characters',exact:true}).isDisabled(),true)
   await dialog.getByRole('button',{name:'Save changes',exact:true}).click()
   await page.waitForFunction(()=>!document.querySelector('dialog .item-composer-body>footer button:last-of-type')?.disabled)
   assert.equal(trace.filter(r=>r.method==='PUT').length,2);assert.equal(item.templateRevision,3);assert.equal(revision,4)
   assert.deepEqual(unexpected,[]);assert.deepEqual(errors,[])
   results.push({width,passed:true,saves:2,reviewReads:trace.filter(r=>r.path.endsWith('/review')).length,confirmations:1,realCampaignWrites:0})
   await page.close()
  }
 }finally{await context?.close();await server?.close()}
},{root})
fs.writeFileSync(path.join(evidence,'ui.json'),JSON.stringify({passed:true,results,at:new Date().toISOString()},null,2)+'\n');console.log(JSON.stringify({passed:true,results}))
