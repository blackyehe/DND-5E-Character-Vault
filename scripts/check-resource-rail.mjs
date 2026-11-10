import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {fileURLToPath} from 'node:url'
import {createServer} from 'vite'
import {createSSRApp,h,computed} from 'vue'
import {renderToString} from 'vue/server-renderer'
import {createPinia,disposePinia} from 'pinia'
import {withTemporaryWorkspace} from '../workspace-artifacts.mjs'
import {chromium} from 'file:///C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'

// Run after the frozen candidate build; all examples are synthetic and offline.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),source=process.cwd()
const evidence=path.join(root,'.local/resource-rail-20261111')
const css=fs.readdirSync(path.join(source,'dist/assets')).filter(p=>p.endsWith('.css')).map(p=>fs.readFileSync(path.join(source,'dist/assets',p),'utf8')).join('\n').replace(/@font-face\s*\{[^}]*\}/g,'')
const server=await createServer({root:source,server:{middlewareMode:true,watch:{ignored:['**/*']}},logLevel:'error'})
const pinia=createPinia(),rows=[]
try{
 const {useCharactersStore}=await server.ssrLoadModule('/src/stores/characters.ts')
 const {emptyCharacter}=await server.ssrLoadModule('/shared/character.ts')
 const {provideSheetLibrary}=await server.ssrLoadModule('/src/composables/useSheetLibrary.ts')
 const {useBuilderAppearance}=await server.ssrLoadModule('/src/composables/useBuilderAppearance.ts')
 const Trackers=(await server.ssrLoadModule('/src/components/sheet/CombatTrackers.vue')).default
 const store=useCharactersStore(pinia),appearance=useBuilderAppearance()
 const c={...emptyCharacter(),_id:'fixture',updatedAt:'2026-11-11'}
 c.meta.klass='Wizard';c.meta.level=7;c.spellcasting.known=['wall-of-fire'];delete c.spellcasting.slotRule
 c.spellcasting.slots={l1:{max:4,used:1,recovery:'long'},l2:{max:3,used:0,recovery:'long'},l3:{max:3,used:0,recovery:'long'},l4:{max:1,used:0,recovery:'long'}}
 c.resources=[{id:'fixture',name:'Zhaerin Contractor · A longer resource name',max:1,used:0,recovery:'long',notes:'A longer explanation remains visible and wraps inside this narrow resource card.'},{id:'manual',name:'Manual pool',max:2,used:1,recovery:'manual',notes:''}]
 store.current=c
 const render=variant=>renderToString(createSSRApp({setup(){provideSheetLibrary(computed(()=>store.current));return()=>h(Trackers,{variant})}}).use(pinia))
 const scope=css.match(/\.sheet-casting-stats\.sheet-casting-highlight\[(data-v-[a-z0-9]+)\]/)?.[1]
 assert.ok(scope,'Built tracker component scope')
 const rail=(await render('rail')).replace(/data-v-[a-z0-9]+/g,scope)
 const regular=(await render()).replace(/data-v-[a-z0-9]+/g,scope)
 await withTemporaryWorkspace('resource-rail-layout',async directory=>{
  const context=await chromium.launchPersistentContext(path.join(directory,'profile'),{headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'})
  try{
   await context.route('**/*',route=>route.abort());const page=await context.newPage()
   for(const theme of ['obsidian','folio'])for(const density of ['compact','comfortable'])for(const width of [252,288,390,1100]){
    const isRail=width<1100
    Object.assign(appearance.appearance,{theme,accent:'crimson',sheetLayout:isRail?'folio':'classic',coverage:'immersive',customAccent:''})
    const style=Object.entries(appearance.appearanceStyle.value).map(([k,v])=>`${k}:${v}`).join(';')
    await page.setViewportSize({width:Math.max(390,width),height:1100})
    await page.setContent(`<style>${css}</style><div class="site-shell" data-theme="${theme}" data-sheet-layout="${isRail?'folio':'classic'}" data-sheet-density="${density}" style="${style}"><section class="hero-sheet" style="width:${width}px;max-width:100%;margin:0">${isRail?rail:regular}</section></div>`)
    const result=await page.evaluate(()=>{
     const grid=document.querySelector('.sheet-tracker-grid'),cards=[...grid.querySelectorAll(':scope>.sheet-tracker-card')]
     const box=el=>{const b=el.getBoundingClientRect();return {top:b.top,bottom:b.bottom}}
     return {grid:getComputedStyle(grid).display,gap:parseFloat(getComputedStyle(grid).rowGap),padding:cards.map(el=>parseFloat(getComputedStyle(el).paddingLeft)),gaps:cards.slice(1).map((el,i)=>box(el).top-box(cards[i]).bottom),overflow:[...document.querySelectorAll('.sheet-trackers,.sheet-tracker-card,.sheet-slot-row')].map(el=>el.scrollWidth-el.clientWidth),stats:[...document.querySelectorAll('.sheet-casting-stats dd')].map(el=>({size:parseFloat(getComputedStyle(el).fontSize),top:el.getBoundingClientRect().top,alignment:getComputedStyle(el).textAlign})),slots:document.querySelectorAll('.sheet-slot-row').length}
    })
    assert.ok(result.overflow.every(n=>n<=1),`Overflow: ${JSON.stringify({theme,density,width,result})}`)
    if(isRail){assert.equal(result.grid,'grid');assert.ok(result.gap>=10);assert.ok(result.padding.every(n=>n>=12));assert.ok(result.gaps.every(n=>n>=9));assert.equal(result.slots,4);assert.equal(result.stats.length,2);assert.ok(result.stats.every(n=>n.size===26&&n.alignment==='left'));assert.ok(Math.abs(result.stats[0].top-result.stats[1].top)<1)}
    else{assert.equal(result.slots,0);assert.equal(result.stats.length,3)}
    rows.push({theme,density,width,...result})
    if(theme==='obsidian'&&density==='compact'&&width===288)await page.screenshot({path:path.join(evidence,'rail.png'),fullPage:true})
   }
  }finally{await context.close()}
 },{root})
 fs.writeFileSync(path.join(evidence,'layout.json'),JSON.stringify({passed:true,rows,at:new Date().toISOString()},null,2)+'\n')
 console.log(JSON.stringify({passed:true,scenarios:rows.length}))
}finally{disposePinia(pinia);await server.close()}
