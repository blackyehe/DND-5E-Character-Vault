import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig,normalizePath,type Plugin,type ChunkMetadata } from 'vite'

/** Build-owned public file hints: no runtime manifest request or URL guessing. */
function requestedPageFiles():Plugin{
  const sources={character:'src/views/CharacterSheetView.vue',compendium:'src/views/CompendiumView.vue',creator:'src/views/CharacterCreationView.vue',workshop:'src/views/HomebrewWorkshopView.vue',rooms:'src/views/RoomsView.vue',room:'src/views/RoomView.vue',join:'src/views/RoomJoinView.vue',notebook:'src/components/notebook/CampaignNotebook.vue',maps:'src/components/maps/RoomMaps.vue'}
  return{name:'requested-page-files',apply:'build',transformIndexHtml:{order:'post',handler(_html,context){
    const bundle=context.bundle;if(!bundle)return
    const files:Record<string,string[]>={}
    for(const[key,source]of Object.entries(sources)){
      const entry=Object.values(bundle).find(chunk=>chunk.type==='chunk'&&normalizePath(chunk.facadeModuleId??'').endsWith('/'+source))
      if(!entry||entry.type!=='chunk')continue
      const found=new Set<string>()
      function collect(name:string){
        if(found.has('/'+name))return
        const chunk=bundle![name];if(!chunk||chunk.type!=='chunk')return
        found.add('/'+name)
        const metadata=(chunk as typeof chunk&{viteMetadata?:ChunkMetadata}).viteMetadata
        for(const css of metadata?.importedCss??[])found.add('/'+css)
        for(const dependency of chunk.imports)collect(dependency)
      }
      collect(entry.fileName);files[key]=[...found]
    }
    return[{tag:'script',attrs:{id:'requested-page-files',type:'application/json'},children:JSON.stringify(files).replace(/</g,'\\u003c'),injectTo:'head'}]
  }}}
}

export default defineConfig({
  plugins: [vue(), tailwindcss(),requestedPageFiles()],
  server: {
    proxy: {
      '/api/2014': 'http://localhost:3000',
      '/api': 'http://localhost:4000',
    },
  },
})
