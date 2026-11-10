import fs from 'node:fs'
import path from 'node:path'
import {build} from 'esbuild'
import {expect,it} from 'vitest'
import {parseBackgroundPack} from './background-pack-parser'
import {inspectOrcbrew,buildOrcbrewCatalog} from './orcbrew'
import {newSpellDraft} from '../../shared/spell-workshop'
import {spellRecord,spellKey} from './spell-workshop'
import {placeNativeEntry} from './workshop-pack'
it('preserves authored spell casting fields and scaling in the background parser',async()=>{
 const d=newSpellDraft();d.body.name='Worker spark';d.body.damage={'1':'1d6','5':'2d6'};d.body.attackType='ranged';d.body.classes=['wizard']
 const source=placeNativeEntry(undefined,'spells',spellKey(d.id),spellRecord(d,1,[]),d.id,':codex/spell'),parsed=await parseBackgroundPack(source,performance.now()+5000)
 expect(parsed.entries.spells[0]).toMatchObject({spellId:d.id,spellBuilder:{attackType:'ranged'},damage:{damage_at_character_level:{'5':'2d6'}}});expect(parsed).toEqual(JSON.parse(JSON.stringify(inspectOrcbrew(source))))
})
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
