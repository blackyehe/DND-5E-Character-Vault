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

// Actual components and production CSS, synthetic data and no network requests.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),source=process.cwd(),evidence=path.join(root,'.local/entry-widths-20261111')
const css=fs.readdirSync(path.join(source,'dist/assets')).filter(f=>f.endsWith('.css')).map(f=>fs.readFileSync(path.join(source,'dist/assets',f),'utf8')).join('\n').replace(/@font-face\s*\{[^}]*\}/g,'')
const server=await createServer({root:source,server:{middlewareMode:true,watch:{ignored:['**/*']}},logLevel:'error'}),pinia=createPinia(),rows=[]
try{
 const load=async p=>(await server.ssrLoadModule(p)).default
 const Spell=await load('/src/components/sheet/SpellbookEntry.vue'),Group=await load('/src/components/sheet/SheetListGroup.vue'),Disclosure=await load('/src/components/sheet/SheetDisclosure.vue'),Equipment=await load('/src/components/sheet/EquipmentSpellsTab.vue')
 const appearance=(await server.ssrLoadModule('/src/composables/useBuilderAppearance.ts')).useBuilderAppearance()
 const {useCharactersStore}=await server.ssrLoadModule('/src/stores/characters.ts'),{emptyCharacter}=await server.ssrLoadModule('/shared/character.ts'),{provideSheetLibrary}=await server.ssrLoadModule('/src/composables/useSheetLibrary.ts')
 const store=useCharactersStore(pinia),c={...emptyCharacter(),_id:'fixture',updatedAt:'2026-11-11'}
 c.meta.name='Width fixture';c.meta.klass='Wizard';c.meta.level=7
 c.equipment=[{name:'Cloak of Elvenkind',kind:'accessory',magical:true,category:'Wondrous Items',qty:1,weight:0,equipped:true,requiresAttunement:true,attuned:false,notes:'',description:'Full item rules remain in this disclosure.'},{name:'Zhaerin Prison',kind:'accessory',magical:true,category:'Wondrous Items',qty:1,weight:0,equipped:true,notes:'',description:'Full item rules.'},{name:'Rope',qty:1,weight:1,equipped:false,notes:''},{name:'GP',kind:'treasure',qty:550,weight:0,equipped:false,notes:''},{name:'Lucky Knots',kind:'treasure',qty:1,weight:0,equipped:false,notes:''}]
 store.current=c
 const spell=(name,action,fixture)=>h(Spell,{name,'data-fixture':fixture,spell:{index:name,name,level:4,school:{name:'Evocation'},desc:Array.from({length:6},()=>`${name}: full rules wrap inside the existing disclosure.`),casting_time:'1 action',range:'120 feet',duration:'1 minute',components:['V','S']},profile:{source:'Spellbook',ability:'INT',...(name==='Fire Bolt'?{attack:12}:{note:'No attack or save'})}},action?{actions:()=>h(action==='At will'?'span':'button',{class:'sheet-small'},action)}:undefined)
 const group=(title,children)=>h(Group,{title,count:children.length,groupKey:'fixture:'+title,plain:true,class:'sheet-spell-level'},{default:()=>children})
 const spellScope=css.match(/\.spellbook-entry\[(data-v-[a-z0-9]+)\]/)?.[1],equipmentScope=css.match(/\.sheet-inventory-controls\[(data-v-[a-z0-9]+)\]/)?.[1]
 assert.ok(spellScope);assert.ok(equipmentScope)
 const render=async node=>(await renderToString(createSSRApp({render:()=>node}))).replace(/data-v-[a-z0-9]+/g,spellScope)
 const granted=await render(group('Granted spells',[spell('Friends',null,'granted'),spell('Charm Person',null,'granted')]))
 const left=await render(h('div',{class:'sheet-independent-column','data-stack':'left'},[group('Cantrips',[spell('Fire Bolt','At will','left-first'),spell('Message','At will','left-after')]),group('Level 1 spells',[spell('Comprehend Languages','Prepared','left-later')])]))
 const right=await render(h('div',{class:'sheet-independent-column','data-stack':'right'},[group('Level 4 spells',[spell('Wall of Fire','Prepared','right-first'),spell('Elemental Bane','Prepare','right-after')])]))
 const features=await render(h('section',{class:'sheet-panel'},[h(Disclosure,{title:'A feature with one action'},{default:()=>h('p','Full feature rules.'),actions:()=>h('button','Pin')}),h(Disclosure,{title:'A feature with three actions'},{default:()=>h('p','Full feature rules.'),actions:()=>[h('button','Unpin'),h('button','↑'),h('button','↓')]})]))
 const inventories={}
 for(const role of ['owner','player']){
  store.roomContext=role==='owner'?null:{roomId:'fixture-room',role:'player',preview:true}
  inventories[role]=(await renderToString(createSSRApp({setup(){provideSheetLibrary(computed(()=>store.current));return()=>h(Equipment)}}).use(pinia))).replace(/data-v-[a-z0-9]+/g,equipmentScope)
 }
 await withTemporaryWorkspace('entry-widths-layout',async directory=>{
  const context=await chromium.launchPersistentContext(path.join(directory,'profile'),{headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'})
  try{
   await context.route('**/*',route=>route.abort());const page=await context.newPage()
   for(const layout of ['classic','folio'])for(const density of ['compact','comfortable'])for(const [viewport,width] of [[390,390],[1100,500],[1100,1100],[1440,1380]])for(const role of ['owner','player']){
    Object.assign(appearance.appearance,{theme:'obsidian',accent:'crimson',sheetLayout:layout,coverage:'immersive',customAccent:''})
    const style=Object.entries(appearance.appearanceStyle.value).map(([k,v])=>`${k}:${v}`).join(';'),columns=viewport>=(layout==='folio'?900:1051)?2:1
    await page.setViewportSize({width:viewport,height:1000})
    const stacks=columns===2?left+right:`<div class="sheet-independent-column">${left}${right}</div>`
    await page.setContent(`<style>${css}</style><div class="site-shell" data-theme="obsidian" data-sheet-layout="${layout}" data-sheet-density="${density}" style="${style}"><main class="hero-sheet" style="width:${width}px;max-width:100%;margin:0"><div class="sheet-tab-content"><section class="sheet-panel sheet-spellbook">${granted}<div class="sheet-spell-grid" data-columns="${columns}">${stacks}</div></section>${features}${inventories[role]}</div></main></div>`)
    const result=await page.evaluate(()=>{
     const widths=selector=>[...document.querySelectorAll(selector)].map(el=>el.getBoundingClientRect().width)
     return {spellWidths:widths('.spellbook-rule'),itemWidths:widths('.sheet-inventory-description>details'),featureWidths:widths('.sheet-disclosure'),columns:getComputedStyle(document.querySelector('.sheet-spell-grid')).gridTemplateColumns.split(' ').length,overflow:[...document.querySelectorAll('.spellbook-entry,.sheet-inventory-row,.sheet-disclosure-row')].map(el=>el.scrollWidth-el.clientWidth),removeButtons:document.querySelectorAll('button[aria-label^="Remove "]').length}
    })
    const label=JSON.stringify({layout,density,viewport,width,role,result})
    for(const field of ['spellWidths','itemWidths','featureWidths'])assert.ok(Math.max(...result[field])-Math.min(...result[field])<=1.1,'Unequal '+field+': '+label)
    assert.ok(result.overflow.every(n=>n<=1),'Overflow: '+label)
    assert.equal(result.removeButtons>0,role==='owner')
    const top=fixture=>page.locator(`[data-fixture="${fixture}"]`).evaluate(el=>el.getBoundingClientRect().top)
    const before=await top('left-after'),rightBefore=await top('right-first')
    await page.locator('[data-fixture="right-first"]>details>summary').click()
    assert.equal(await top('left-after'),before,'Opening right moved left: '+label)
    await page.locator('[data-fixture="right-first"]>details>summary').click()
    await page.locator('[data-fixture="left-first"]>details>summary').click()
    assert.ok(await top('left-after')>before,'Left rules did not expand')
    if(result.columns===2)assert.equal(await top('right-first'),rightBefore,'Opening left moved right: '+label)
    rows.push({layout,density,viewport,width,role,...result})
    if(layout==='folio'&&density==='compact'&&role==='owner'&&viewport===1440)await page.screenshot({path:path.join(evidence,'widths.png'),fullPage:true})
   }
  }finally{await context.close()}
 },{root})
 fs.writeFileSync(path.join(evidence,'layout.json'),JSON.stringify({passed:true,rows,at:new Date().toISOString()},null,2)+'\n')
 console.log(JSON.stringify({passed:true,scenarios:rows.length,independentExpansion:true}))
}finally{disposePinia(pinia);await server.close()}
