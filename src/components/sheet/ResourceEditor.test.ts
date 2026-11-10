import {expect,it} from 'vitest'
import {createSSRApp,reactive,type Component} from 'vue'
import {renderToString} from 'vue/server-renderer'
import {emptyCharacter,type CharacterResource} from '../../../shared/character'
import {resourcesFor} from '../../../shared/character-resources'
import {restUpdate} from '../../../shared/character-rest'
import {newLinkedTracker} from '../../../shared/linked-trackers'
import ResourceEditor from './ResourceEditor.vue'

function hero(){
 const c=reactive({...emptyCharacter(),resources:[] as CharacterResource[],_id:'fixture',updatedAt:'2026-11-11'})
 c.meta.level=7;c.meta.klass='Wizard'
 c.features=[{name:'Zhaerin Contractor',origin:'feat',level:6,description:'Once per long rest when your hp is reduced to 0, regain 1 hp.'}]
 c.resources=resourcesFor(c);c.resources.find(r=>r.id.startsWith('auto:feat:'))!.used=1
 c.resources.push({id:'custom',name:'Unrelated pool',max:3,used:2,recovery:'manual'})
 return c
}
async function editor(c:ReturnType<typeof hero>){
 let bindings:any
 const original=ResourceEditor as any
 const component={...original,setup(p:unknown,ctx:unknown){return bindings=original.setup(p,ctx)}} as Component
 const html=await renderToString(createSSRApp(component,{character:c,onChange:(rows:CharacterResource[])=>{c.resources=rows}}))
 return {b:bindings,html}
}
it('makes inferred names, notes, maxima and recovery persist as character overrides without resetting spent uses',async()=>{
 const c=hero(),{b,html}=await editor(c),index=()=>b.resources.value.findIndex((r:CharacterResource)=>r.id.startsWith('auto:feat:'))
 expect(html).toContain('Edit tracker');expect(html).toContain('Remove tracker');expect(html).toContain('Inferred from the feat')
 b.change(index(),{used:0});expect(c.resources.find(r=>r.id.startsWith('auto:feat:'))!.automatic).toBe(true)
 b.change(index(),{used:1});b.mode(index(),'fixed');b.change(index(),{name:'Contractor rescue',max:3,recovery:'short',notes:'My rule'})
 const saved=JSON.parse(JSON.stringify(c)),row=resourcesFor(saved).find(r=>r.id.startsWith('auto:feat:'))!
 expect(row).toMatchObject({name:'Contractor rescue',max:3,used:1,recovery:'short',notes:'My rule',automatic:false})
 b.mode(index(),'automatic');expect(resourcesFor(c).find(r=>r.id===row.id)).toMatchObject({name:'Zhaerin Contractor · Uses',max:1,used:1,recovery:'long',automatic:true})
 b.change(index(),{name:'Direct rename'});expect(resourcesFor(c).find(r=>r.id===row.id)).toMatchObject({name:'Direct rename',automatic:false,used:1})
})
it('keeps removals through add/remove, reload, level changes and rests, with explicit restoration',async()=>{
 const c=hero(),features=JSON.stringify(c.features),{b}=await editor(c),id=c.resources.find(r=>r.id.startsWith('auto:feat:'))!.id
 b.remove(b.resources.value.findIndex((r:CharacterResource)=>r.id===id))
 expect(b.resources.value.some((r:CharacterResource)=>r.id===id)).toBe(false)
 expect(b.removedResources.value).toMatchObject([{id,max:0,used:0,automatic:false}])
 b.add();b.remove(b.resources.value.findIndex((r:CharacterResource)=>r.id==='custom'))
 expect(c.resources.some(r=>r.id===id)).toBe(true)
 c.meta.level=8;Object.assign(c,restUpdate(c,'long'))
 const reloaded=await editor(reactive(JSON.parse(JSON.stringify(c))))
 expect(reloaded.html).toContain('Removed automatic trackers');expect(reloaded.html).toContain('Restore tracker')
 expect(reloaded.b.resources.value.some((r:CharacterResource)=>r.id===id)).toBe(false)
 b.restore(id);expect(resourcesFor(c).find(r=>r.id===id)).toMatchObject({max:1,used:0,automatic:true})
 expect(JSON.stringify(c.features)).toBe(features)
})
it('keeps linked/class rules protected and does not restore a tracker whose grant is gone',async()=>{
 const c=hero(),{b}=await editor(c),id=c.resources.find(r=>r.id.startsWith('auto:feat:'))!.id
 c.resources.push({id:'class-rule',name:'Class pool',max:3,used:1,recovery:'short',ruleId:'rule'})
 const index=b.resources.value.findIndex((r:CharacterResource)=>r.id==='class-rule')
 b.change(index,{name:'Changed'});b.remove(index);expect(c.resources.find(r=>r.id==='class-rule')!.name).toBe('Class pool')
 c.equipment=[{_id:'focus',name:'Focus',qty:1,weight:0,notes:'',equipped:false,trackers:[newLinkedTracker()]}]
 const linkedIndex=b.resources.value.findIndex((r:CharacterResource)=>r.source?.kind==='item'),linked=b.resources.value[linkedIndex]
 b.change(linkedIndex,{max:99});b.remove(linkedIndex)
 expect(b.resources.value.find((r:CharacterResource)=>r.id===linked.id)).toMatchObject({max:1,source:{kind:'item'}})
 b.remove(b.resources.value.findIndex((r:CharacterResource)=>r.id===id));c.features=[]
 b.restore(id);expect(b.removedResources.value.some((r:CharacterResource)=>r.id===id)).toBe(true)
 expect((await editor(c)).html).toContain('The original granting feature is no longer active.')
})
