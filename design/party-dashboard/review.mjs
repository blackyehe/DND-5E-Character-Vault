// Local preview-only checks. T3 snapshots timed out twice; use the established Edge fallback.
import {chromium} from 'file:///C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
import {mkdirSync,writeFileSync} from 'node:fs'
import assert from 'node:assert/strict'
const dir='.preview.local/party-directions',base='http://127.0.0.1:5190/'
mkdirSync(dir,{recursive:true})
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true})
const ctx=await browser.newContext({viewport:{width:1440,height:1100},reducedMotion:'reduce'}),p=await ctx.newPage(),errors=[],requests=[],checks=[]
p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>requests.push({url:r.url(),method:r.method()}))
async function geometry(){return p.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,offscreen:[...document.querySelectorAll('#app button,#app input,#app select')].filter(el=>el.getClientRects().length).filter(el=>{const r=el.getBoundingClientRect();return r.left<-.5||r.right>innerWidth+.5}).map(el=>el.textContent.slice(0,60))}))}
async function direction(id){await p.locator(`[data-action="layout"][data-id="${id}"]`).click();await p.locator('#app h1').waitFor()}
try{
 await p.goto(base);await p.evaluate(()=>document.fonts.ready)
 assert.deepEqual(await p.evaluate(()=>{const {people,save,skill}=partyPreview;const mira=people.find(p=>p.id==='mira'),toren=people.find(p=>p.id==='toren');return {dex:save(mira,'dex'),stealth:skill(mira,'stealth'),bardHistory:skill(toren,'history')}}),{dex:8,stealth:10,bardHistory:2})
 checks.push('Example modifiers include proficiency, expertise, active-item saves and Bard half proficiency')
 for(const layout of ['ledger','focus','finder','foldout']){
  await direction(layout)
  for(const width of [1440,1024,834,728,390,320]){
   await p.setViewportSize({width,height:1100});const g=await geometry();assert.ok(g.scrollWidth<=g.width,JSON.stringify({layout,...g}));assert.deepEqual(g.offscreen,[],layout+' '+width)
   if([1440,390].includes(width))await p.screenshot({path:`${dir}/${layout}-${width}.png`,fullPage:true})
  }
  if(layout==='focus'){
   await p.locator('#mobile-character').selectOption('lyra');assert.match(await p.locator('.reference-head').innerText(),/Lyra/)
   await p.locator('#mobile-character').selectOption('mira')
  }
  await p.setViewportSize({width:1440,height:1100})
  if(layout==='ledger'||layout==='foldout'){const expand=p.locator(`[data-action="expand"][data-id="mira"]`);if(await expand.getAttribute('aria-expanded')==='false')await expand.click()}
  assert.ok(await p.locator('#app').getByRole('heading',{name:'Skill proficiencies',exact:true}).isVisible())
  assert.ok(await p.locator('#app').getByRole('heading',{name:'Training & languages',exact:true}).isVisible())
  await p.locator('#party-search').fill('no such character');await p.getByRole('heading',{name:'No matching characters'}).waitFor();await p.getByRole('button',{name:'Clear search',exact:true}).click();assert.equal(await p.locator('#party-search').inputValue(),'')
  // Re-select Mira after an empty search can adjust the focused selection.
  if(layout==='focus'||layout==='finder')await p.locator(`[data-action="select"][data-id="mira"]`).click()
  if(layout==='ledger'||layout==='foldout'){const expand=p.locator(`[data-action="expand"][data-id="mira"]`);if(await expand.getAttribute('aria-expanded')==='false')await expand.click()}
  const combat=p.locator('.combat');await combat.locator('summary').click();assert.equal(await combat.getAttribute('open'),'')
  await p.locator('.combat [data-action="sheet"]').click();await p.getByRole('button',{name:'‹ Back to party',exact:true}).waitFor()
  assert.equal(await p.locator('.sheet-content h1').innerText(),'Mira Swiftfoot');assert.equal(await p.locator('.sheet-tabs [aria-pressed=true]').innerText(),'Combat')
  await p.getByRole('button',{name:'Collapse character list',exact:true}).click();assert.ok(await p.locator('.sheet-layout.collapsed').isVisible())
  await p.getByRole('button',{name:'Expand character list',exact:true}).click();await p.locator('[data-action="sheet-character"][data-id="lyra"]').click();assert.equal(await p.locator('.sheet-content h1').innerText(),'Lyra Emberglass')
  await p.getByRole('button',{name:'Proficiencies',exact:true}).click();assert.ok(await p.getByRole('heading',{name:'All skills',exact:true}).isVisible())
  await p.locator('[data-action="sheet-character"][data-id="mira"]').click();await p.getByRole('button',{name:'‹ Back to party',exact:true}).click()
  assert.equal(await p.locator('.combat').getAttribute('open'),'');assert.equal(await p.evaluate(()=>document.activeElement?.dataset.action),'sheet');assert.equal(await p.evaluate(()=>document.activeElement?.dataset.section),'combat')
  // Preview stress controls never change any saved characters.
  await p.locator('.preview-controls summary').click();await p.locator('#longNames').check();await p.locator('#largeText').check()
  for(const width of [1024,390,320]){await p.setViewportSize({width,height:1100});const g=await geometry();assert.ok(g.scrollWidth<=g.width,JSON.stringify({layout,large:true,...g}));assert.deepEqual(g.offscreen,[],layout+' large '+width)}
  await p.locator('#emptyParty').check();await p.getByRole('heading',{name:'Choose who is at the table'}).waitFor();await p.getByRole('button',{name:'Restore example party'}).click();assert.equal(await p.locator('#emptyParty').isChecked(),false)
  await p.locator('#longNames').uncheck();await p.locator('#largeText').uncheck();await p.locator('.preview-controls summary').click()
  checks.push(layout+': six viewport widths, long names/large text, empty states, training, combat disclosure, adjacent sheet and return focus')
 }
 await p.setViewportSize({width:1440,height:1100});await direction('finder');await p.locator('#check-select').selectOption('skill:stealth');assert.match(await p.locator('.rank-row').first().innerText(),/Mira/);await p.locator('#check-select').selectOption('save:con');assert.match(await p.locator('.rank-row').first().innerText(),/Aldric/)
 await direction('focus');await p.locator('[data-action="all-skills"]').click();assert.equal(await p.locator('.skill-list>div').count(),18);await p.locator('[data-action="all-skills"]').click();assert.equal(await p.locator('.skill-list>div').count(),5)
 await p.locator('[data-action="select"][data-id="lyra"]').focus();await p.keyboard.press('Enter');assert.match(await p.locator('.reference-head').innerText(),/Lyra/)
 checks.push('Check finder reorders by save/skill; full skill toggle and keyboard character selection')
 assert.equal(await p.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length),0)
 assert.deepEqual(errors,[]);assert.ok(requests.every(r=>r.method==='GET'&&new URL(r.url).host==='127.0.0.1:5190'))
 await direction('ledger');await p.screenshot({path:dir+'/ledger-refined.png',fullPage:true})
 writeFileSync(dir+'/results.json',JSON.stringify({checks,errors,requests},null,2));console.log(checks.join('\n'))
}catch(e){await p.screenshot({path:dir+'/failure.png',fullPage:true});throw e}finally{await browser.close()}
