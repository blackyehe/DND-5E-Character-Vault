import {readFile, writeFile} from 'node:fs/promises'

const review = JSON.parse(await readFile('backups/revalon-notebook-review-2026-10-22/proposals.json', 'utf8'))
const config = {
  R127: {type:'People',role:'Utazó bárd',sessions:[2,4,7,12],short:'Hold elf bárd, Melina legjobb barátja.',place:'Magellan',location:'Amdurun, a fesztiválon a csapattal.',symbol:'lute'},
  R128: {type:'People',role:'Tudáskereskedő',sessions:[2,4,7,8,10,11,12],short:'Mágikus tárgyakat vizsgál és tudással kereskedik.',place:'Magellan',location:'Amdurun, a fesztiválon a csapattal.',symbol:'staff'},
  R117: {type:'People',role:'A The Archanade kurátora',sessions:[2,4],short:'A magelláni múzeum vezetője és első számú kurátora.',place:'Magellan',location:'Nincs megerősítve.',symbol:'mask'},
  R113: {type:'People',role:'Informátor',sessions:[10,11],short:'Truuselar környékén gyűjt információkat.',place:'Truuselar',location:'Nincs megerősítve.',symbol:'feather'},
  R126: {type:'People',role:'Útitárs',sessions:[6,7,12],short:'A Vörös hegy száműzött egykori uralkodója.',place:'Roche-Noir',location:'A csapattal van, mások számára ismeretlen.',symbol:'sword'},
  R005: {type:'People',role:'Könyvtáros és kereskedő',sessions:[],short:'Könyvtárat és mágikus iratokkal foglalkozó üzletet vezet.',place:'Amdurun',location:'Nincs megerősítve.',symbol:'book'},
  R010: {type:'Objects',role:'Könyvgyűjtemény',sessions:[2,7,12],short:'Öt kötet a négy fő elemről és az Árnyakról.',place:'',location:'',symbol:'book'},
  R004: {type:'Objects',role:'Üzenő könyv',sessions:[10,11],short:'Cagliostro könyve a későbbi kapcsolattartáshoz.',place:'Truuselar',location:'Fade birtokában.',symbol:'book'}
}
const entries = Object.entries(config).map(([id,meta])=>{
  const p=review.proposals.find(p=>p.id===id)
  if(p?.publishStatus!=='saved-and-verified') throw new Error('Unverified sample: '+id)
  return {id,title:p.draft.title,body:p.draft.body.replace(/ — Sessions\/Session \d+\.md/g,'').replace(/Sessions\/Session (\d+)\.md/g,'$1. session'),audience:p.draft.audience,folder:p.folderPath??[],...meta}
})
const sessions = review.proposals.filter(p=>p.publishStatus==='saved-and-verified' && /^Session \d+/.test(p.draft.title)).map(p=>({id:p.id,title:p.draft.title,number:Number(p.draft.title.match(/^Session (\d+)/)[1]),body:p.draft.body.replace(/Sessions\/Session (\d+)\.md/g,'$1. session'),audience:p.draft.audience})).sort((a,b)=>a.number-b.number)
const template = await readFile('design/notebook/template.html','utf8')
await writeFile('design/notebook/index.html',template.replace('/*__DATA__*/', 'const ENTRIES='+JSON.stringify(entries)+';const SESSIONS='+JSON.stringify(sessions)+';'))
console.log('Built isolated notebook prototypes:',entries.length,'entries,',sessions.length,'session recaps')
