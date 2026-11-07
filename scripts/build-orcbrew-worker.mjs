import {build} from '../server/node_modules/esbuild/lib/main.js'
await build({entryPoints:['server/lib/orcbrew-background-worker.ts'],outfile:'server/lib/orcbrew-background-worker.cjs',bundle:true,platform:'node',format:'cjs',target:'node22',legalComments:'none'})
