import {beforeEach,expect,it,vi} from 'vitest'
const remote=vi.hoisted(()=>vi.fn())
vi.mock('./srd-client',()=>({readSrdRule:remote}))
const deferred=()=>{let resolve!:(value:any)=>void;const promise=new Promise<any>(r=>resolve=r);return{promise,resolve}}
const source=(levels:number)=>JSON.stringify({':orcpub.entity/values':{':character-name':'Fixture wizard'},':orcpub.entity/options':{':class':[{':orcpub.entity/key':':wizard',':orcpub.entity/options':{':levels':Array.from({length:levels},(_,i)=>({':orcpub.entity/key':':level-'+(i+1)}))}}],':equipment':[{':orcpub.entity/key':':rope'}]}})
function fixture(levels:number){const gear=deferred(),features=Array.from({length:levels},deferred);remote.mockImplementation(async(_base,path:string)=>{
 if(path==='classes/wizard')return{index:'wizard',name:'Wizard',hit_die:6}
 if(path==='equipment/rope')return gear.promise
 const n=Number(path.split('/').at(-1));if(path.startsWith('classes/wizard/levels/'))return{features:[{index:'feature-'+n}]}
 if(path.startsWith('features/feature-'))return features[Number(path.split('-').at(-1))-1]!.promise
 return null
 });return{gear,features}}
beforeEach(()=>{remote.mockReset()})
it('overlaps independent class rules with inventory while preserving feature order after out-of-order replies',async()=>{
 const f=fixture(3),{previewDmvCharacter}=await import('./dmv-import'),pending=previewDmvCharacter(source(3),'',{},'https://rules.fixture/api/2014')
 await vi.waitFor(()=>expect(remote.mock.calls.filter(c=>c[1].startsWith('features/feature-'))).toHaveLength(3))
 for(const i of [2,0,1])f.features[i]!.resolve({name:'Feature '+(i+1),desc:['Rules '+(i+1)]});f.gear.resolve(null)
 const result=await pending;expect(result.character.features.filter(f=>f.origin==='class').map(f=>f.name)).toEqual(['Feature 1','Feature 2','Feature 3'])
 expect(remote.mock.calls.filter(c=>c[1].startsWith('classes/wizard/levels/'))).toHaveLength(3)
})
it('caps eager class work at four workers and does not repeat reads consumed later',async()=>{
 const f=fixture(8),{previewDmvCharacter}=await import('./dmv-import'),pending=previewDmvCharacter(source(8),'',{},'https://rules.fixture/api/2014')
 await vi.waitFor(()=>expect(remote.mock.calls.filter(c=>c[1].startsWith('features/feature-'))).toHaveLength(4));expect(remote.mock.calls.some(c=>c[1]==='classes/wizard/levels/5')).toBe(false)
 for(let i=0;i<4;i++)f.features[i]!.resolve({name:'Feature '+(i+1),desc:[]})
 await vi.waitFor(()=>expect(remote.mock.calls.filter(c=>c[1].startsWith('features/feature-'))).toHaveLength(8));for(let i=4;i<8;i++)f.features[i]!.resolve({name:'Feature '+(i+1),desc:[]});f.gear.resolve(null)
 await pending;for(let n=1;n<=8;n++){expect(remote.mock.calls.filter(c=>c[1]==='classes/wizard/levels/'+n)).toHaveLength(1);expect(remote.mock.calls.filter(c=>c[1]==='features/feature-'+n)).toHaveLength(1)}
})
it('keeps failure warnings in consumption order even if eager failures arrive in reverse order',async()=>{
 const f=fixture(3),{previewDmvCharacter}=await import('./dmv-import'),pending=previewDmvCharacter(source(3),'',{},'https://rules.fixture/api/2014')
 await vi.waitFor(()=>expect(remote.mock.calls.filter(c=>c[1].startsWith('features/feature-'))).toHaveLength(3));for(const i of [2,1,0])f.features[i]!.resolve(Promise.reject(Error('Synthetic failure')));f.gear.resolve(null)
 const result=await pending;expect(result.warnings.filter(w=>w.startsWith('The rules entry features/')).map(w=>w.match(/feature-\d/)?.[0])).toEqual(['feature-1','feature-2','feature-3'])
})
