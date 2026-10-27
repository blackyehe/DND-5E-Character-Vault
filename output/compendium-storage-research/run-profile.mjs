// Local transpilation only; avoids invoking a development server or test runner.
import {registerHooks,createRequire} from 'node:module'
import {existsSync,readFileSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
const require=createRequire(import.meta.url)
const ts=require('../compendium-code-prefetch/review/node_modules/typescript/lib/typescript.js')
registerHooks({
  resolve(specifier,context,next){
    if(specifier.startsWith('.')&&context.parentURL){
      const url=new URL(specifier,context.parentURL)
      if(!existsSync(fileURLToPath(url))&&existsSync(fileURLToPath(url)+'.ts'))return next(url.href+'.ts',context)
    }
    return next(specifier,context)
  },
  load(url,context,next){
    if(url.startsWith('file:')&&url.endsWith('.ts'))return {format:'module',source:ts.transpileModule(readFileSync(fileURLToPath(url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText,shortCircuit:true}
    if(url.startsWith('file:')&&url.endsWith('.json'))return {format:'module',source:'export default '+readFileSync(fileURLToPath(url),'utf8'),shortCircuit:true}
    return next(url,context)
  },
})
await import('./profile-catalogue.ts')
