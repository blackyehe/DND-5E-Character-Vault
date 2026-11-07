import fs from 'node:fs'
import path from 'node:path'
import {build} from 'esbuild'
import {expect,it} from 'vitest'
import {parseBackgroundPack} from './background-pack-parser'
import {inspectOrcbrew,buildOrcbrewCatalog} from './orcbrew'
it('uses the canonical parser and preserves complete catalogue values across the worker boundary',async()=>{
 const source='{:orcpub.dnd.e5/classes {:oracle {:name "Oracle" :description "Complete rules \\u00e9" :traits [{:name "Choice" :description "Original"}]}} :orcpub.dnd.e5/languages {:a {:name "Language" :speakers #{"First" "Second"}}}}'
 const original=inspectOrcbrew(source),parsed=await parseBackgroundPack(source,performance.now()+5000)
 expect(parsed).toEqual(JSON.parse(JSON.stringify(original)))
 const pack={id:'a'.repeat(24),filename:'worker.orcbrew'}
 expect(JSON.stringify(buildOrcbrewCatalog([{...pack,parsed}]))).toBe(JSON.stringify(buildOrcbrewCatalog([{...pack,parsed:original}])))
})
it('keeps invalid source failures private and bounds source/deadline eligibility',async()=>{
 await expect(parseBackgroundPack('{unclosed-private-value',performance.now()+5000)).rejects.toThrow('Background pack parsing unavailable')
 await expect(parseBackgroundPack('x'.repeat(16*1024*1024+1),performance.now()+5000)).rejects.toThrow('source exceeds')
 await expect(parseBackgroundPack('{}',performance.now()+10)).rejects.toThrow('deadline')
})
it('keeps the generated worker in sync with its source and canonical parser dependencies',async()=>{
 const result=await build({absWorkingDir:process.cwd(),entryPoints:['server/lib/orcbrew-background-worker.ts'],outfile:'server/lib/orcbrew-background-worker.cjs',bundle:true,platform:'node',format:'cjs',target:'node22',legalComments:'none',write:false})
 expect(fs.readFileSync(path.resolve('server/lib/orcbrew-background-worker.cjs'),'utf8').replaceAll('\r\n','\n')).toBe(result.outputFiles[0]!.text.replaceAll('\r\n','\n'))
})
