import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {fileURLToPath} from 'node:url'
import {withTemporaryWorkspace} from '../workspace-artifacts.mjs'
import {createServer} from 'vite'
import {createSSRApp,h} from 'vue'
import {renderToString} from 'vue/server-renderer'
import {chromium} from 'file:///C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),source=process.cwd()
const ext=path.resolve(root,'../owlbear-character-sheet'),evidence=path.join(root,'.local/sheet-surfaces-c-release-20261110')
const review=JSON.parse(fs.readFileSync(path.join(ext,'.local/sheet-surfaces-c-release-20261110/static-review.json'),'utf8'))
const css=directory=>fs.readdirSync(directory).filter(p=>p.endsWith('.css')).map(p=>fs.readFileSync(path.join(directory,p),'utf8')).join('\n').replace(/@font-face\s*\{[^}]*\}/g,'')
const websiteCSS=css(path.join(source,'dist/assets')),extensionCSS=css(path.join(review.output,'static/assets'))
const styleBytes=fs.readFileSync(path.join(source,'src/components/sheet/sheet-surfaces.css'))
assert.deepEqual(styleBytes,fs.readFileSync(path.join(ext,'src/sheet-surfaces.css')))
const server=await createServer({root:source,server:{middlewareMode:true,watch:{ignored:['**/*']}},logLevel:'error'})
const rows=[]
try{
 const appearance=(await server.ssrLoadModule('/src/composables/useBuilderAppearance.ts')).useBuilderAppearance()
 const Disclosure=(await server.ssrLoadModule('/src/components/sheet/SheetDisclosure.vue')).default
 const Spell=(await server.ssrLoadModule('/src/components/sheet/SpellbookEntry.vue')).default
 const disclosure=await renderToString(createSSRApp({render:()=>h(Disclosure,{title:'Tough',metadata:'Suggested'},{default:()=>h('p','Feature rules.')})}))
 let spell=await renderToString(createSSRApp({render:()=>h(Spell,{name:'Fixture spell',profile:{source:'Spellbook',ability:'INT',attack:8},spell:{level:1,school:{name:'Evocation'},desc:['Spell rules.'],casting_time:'1 action',range:'90 feet',duration:'Instantaneous',components:['V','S']}})}))
 const builtScope=websiteCSS.match(/\.spellbook-entry\[(data-v-[a-z0-9]+)\]/)?.[1]
 if(builtScope)spell=spell.replace(/data-v-[a-z0-9]+/g,builtScope)
 await withTemporaryWorkspace('sheet-colour-check',async directory=>{
  const context=await chromium.launchPersistentContext(path.join(directory,'profile'),{headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'})
  try{
   context.setDefaultTimeout(15000);await context.route('**/*',route=>route.abort())
   const page=await context.newPage()
   async function measure(kind,theme,layout,width,html,cssText){
    await page.setViewportSize({width,height:900});await page.setContent(`<style>${cssText}</style>${html}`)
    await page.locator('details').evaluateAll(nodes=>nodes.forEach(n=>n.open=true))
    const result=await page.evaluate(({kind})=>{
     const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d')
     const rgb=value=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=value;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data].slice(0,3)}
     const luminance=rgb=>rgb.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0)
     const ratio=(a,b)=>{a=luminance(a);b=luminance(b);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)}
     const selectors=kind==='website'?['.sheet-disclosure>summary','.sheet-disclosure-body','.spellbook-rule','.spellbook-body']:['.read-disclosure>summary','.read-disclosure>.read-disclosure-body','.spell-rule','.spell-rule>.read-disclosure-body']
     const result=selectors.map(selector=>{const element=document.querySelector(selector),style=getComputedStyle(element),background=rgb(style.backgroundColor),ink=rgb(style.color);return {selector,background,contrast:ratio(ink,background),overflow:element.scrollWidth-element.clientWidth}});const host=document.querySelector(kind==='website'?'.hero-sheet':'.connected-sheet'),hostStyle=getComputedStyle(host);for(const name of ['--sheet-trained-bg','--sheet-expert-bg']){const probe=document.createElement('div');probe.style.background=hostStyle.getPropertyValue(name);host.append(probe);const style=getComputedStyle(probe);result.push({selector:name,background:rgb(style.backgroundColor),contrast:ratio(rgb(style.color),rgb(style.backgroundColor)),overflow:0});probe.remove()}return result
    },{kind})
    assert.deepEqual(result[0].background,result[2].background,`${kind} header mismatch`);assert.deepEqual(result[1].background,result[3].background,`${kind} expanded mismatch`)
    for(const r of result){assert.ok(r.contrast>=4.5,`${kind} ${theme} contrast ${r.contrast}`);assert.ok(r.overflow<=1,`${kind} overflow ${r.selector}`)}
    rows.push({kind,theme,layout,width,minContrast:Math.min(...result.map(r=>r.contrast)),header:result[0].background,body:result[1].background})
   }
   for(const [theme,accent,customAccent] of [['obsidian','crimson'],['dark','ocean'],['parchment','forest'],['folio','violet'],['light','ember'],['dark','forest','#ffffff'],['parchment','forest','#000000'],['obsidian','crimson','#ffff00']])for(const layout of ['classic','folio'])for(const width of [390,1100]){
    Object.assign(appearance.appearance,{theme,accent,sheetLayout:layout,coverage:'immersive',customAccent:customAccent??''})
    const style=Object.entries(appearance.appearanceStyle.value).map(([k,v])=>`${k}:${v}`).join(';')
    await measure('website',theme,layout,width,`<div class="site-shell" data-theme="${theme}" data-sheet-layout="${layout}" data-sheet-density="compact" style="${style}"><section class="hero-sheet">${disclosure}${spell}</section></div>`,websiteCSS)
   }
   const scopes=[...new Set([...extensionCSS.matchAll(/\[(data-v-[a-z0-9]+)\]/g)].map(m=>m[1]))].join(' ')
   for(const layout of ['compact','folio'])for(const width of [390,1100]){
    const markup=`<div class="character-window" data-theme="website" data-layout="${layout}"><section class="connected-sheet"><details class="read-disclosure"><summary>Feature</summary><div class="read-disclosure-body">Feature rules.</div></details><details class="spell-rule"><summary>Spell</summary><div class="read-disclosure-body">Spell rules.</div></details></section></div>`.replace(/<(div|section|details|summary)\b/g,`<$1 ${scopes}`)
    await measure('owlbear','website',layout,width,markup,extensionCSS)
   }
  }finally{await context.close()}
 },{root})
 fs.writeFileSync(path.join(evidence,'colours.json'),JSON.stringify({passed:true,rows,at:new Date().toISOString()},null,2)+'\n')
 console.log(JSON.stringify({passed:true,scenarios:rows.length,minContrast:Math.min(...rows.map(r=>r.minContrast))}))
}finally{await server.close()}
