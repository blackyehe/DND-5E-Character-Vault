import {expect,it} from 'vitest'
import {emptyCharacter,type Character} from './character'
import {newOptionDraft,restoreOptionDraft} from './option-workshop'
import {OPTION_KINDS,isFeatureOptionKind} from './option-kinds'
import {newOptionTracker,optionTrackerResources,optionTrackerProblems,reconcileLinkedTrackers} from './option-trackers'
import {resourcesFor} from './character-resources'
import {restUpdate} from './character-rest'
import {applyPlayUpdate} from '../server/lib/play-update'
import {playUpdate} from './rooms'

function setup(kind:typeof OPTION_KINDS[number]='feats'){
 const c:Character={...emptyCharacter(),_id:'hero',updatedAt:'2026-11-10T12:00:00.000Z'},draft=newOptionDraft(kind),tracker={...newOptionTracker(),max:4}
 draft.body.name='Linked option';draft.body.trackers=[tracker];c.meta.level=6
 const index=`option-${draft.id}`,entry={index,name:draft.body.name,optionId:draft.id,optionBuilder:draft.body}
 c.compendiumRules=[{kind,index,revision:1,before:entry,entry}]
 if(isFeatureOptionKind(kind))c.features=[{name:entry.name,description:'',origin:'feat',definition:{version:1,kind,index,grantConfirmed:true}}]
 else if(kind==='backgrounds'){c.meta.background=entry.name;c.meta.backgroundIndex=index}
 else if(kind==='subraces'){c.meta.subrace=entry.name;c.meta.subraceIndex=index}
 else c.proficiencies.languages=[entry.name]
 return {c,tracker,draft,definition:c.compendiumRules[0]!}
}
it.each(OPTION_KINDS)('derives owned %s pools and removes them when the grant is removed',kind=>{
 const {c}=setup(kind);expect(optionTrackerResources(c)).toMatchObject([{name:'Linked option · Uses',max:4,used:0}])
 c.features=[];c.meta.background='';c.meta.backgroundIndex=undefined;c.meta.subrace='';c.meta.subraceIndex=undefined;c.proficiencies.languages=[]
 expect(optionTrackerResources(c)).toEqual([]);expect(optionTrackerResources(c,true)).toEqual([])
})
it('preserves identity and overspent uses through labels, fingerprint and maximum changes; new pools start empty',()=>{
 const {c,tracker,definition}=setup(),id=optionTrackerResources(c)[0]!.id;definition.trackerUses={[tracker.id]:3}
 definition.index='new-fingerprint';definition.entry={...definition.entry,index:definition.index,name:'Renamed',aliases:[c.features[0]!.definition!.index],optionBuilder:{...definition.entry.optionBuilder as object,trackers:[newOptionTracker(),{...tracker,name:'Charges',max:2}]}}
 expect(optionTrackerResources(c)).toMatchObject([{used:0},{id,name:'Renamed · Charges',max:2,used:3}])
})
it('persists player counters on their definition, rejects forged or hidden spending, and recovers level-gated pools',()=>{
 const {c,tracker,definition}=setup();c.resources=resourcesFor(c);const id=optionTrackerResources(c)[0]!.id
 const after={...c,...applyPlayUpdate(c,{expectedUpdatedAt:c.updatedAt,resources:[{id,used:3}]})} as Character
 expect(after.compendiumRules![0]!.trackerUses).toEqual({[tracker.id]:3});expect(after.resources!.some(r=>r.id===id)).toBe(false);expect(definition.trackerUses).toBeUndefined()
 expect(()=>applyPlayUpdate(after,{expectedUpdatedAt:c.updatedAt,resources:[{id,used:5}]})).toThrow(/allowance/)
 expect(()=>applyPlayUpdate(after,{expectedUpdatedAt:c.updatedAt,resources:[{id:'linked:option:invented',used:1}]})).toThrow()
 after.resources=[];after.meta.level=1;(after.compendiumRules![0]!.entry.optionBuilder as typeof definition.entry.optionBuilder & {trackers:typeof tracker[]}).trackers[0]!.level=4
 expect(resourcesFor(after).filter(r=>r.source)).toEqual([]);expect(()=>applyPlayUpdate(after,{expectedUpdatedAt:c.updatedAt,resources:[{id,used:4}]})).toThrow(/not currently available/)
 const rested={...after,...applyPlayUpdate(after,playUpdate(after,{resources:restUpdate(after,'long').resources}))} as Character
 expect(rested.compendiumRules![0]!.trackerUses![tracker.id]).toBe(0)
})
it('prunes removed definitions, migrates older derived counters and never converts manual trackers',()=>{
 const {c,definition,tracker}=setup();c.resources=[{...optionTrackerResources(c)[0]!,used:2},{id:'manual',name:'Uses',max:1,used:1,recovery:'long'}]
 let result=reconcileLinkedTrackers(c);expect(result.compendiumRules![0]!.trackerUses).toEqual({[tracker.id]:2});expect(result.resources).toHaveLength(1)
 ;(definition.entry.optionBuilder as {trackers:unknown[]}).trackers=[];result=reconcileLinkedTrackers(c);expect(result.compendiumRules![0]!.trackerUses).toEqual({});expect(resourcesFor(result).filter(r=>r.source)).toEqual([]);expect(result.resources![0]!.id).toBe('manual')
})
it('replaces automatic feat guesses only for explicitly authored tracker lists and restores unfinished drafts',()=>{
 const {c,draft,definition,tracker}=setup();c.features[0]!.name='Lucky';c.features[0]!.description='You have 3 luck points. You regain them when you finish a long rest.';definition.entry.name='Lucky';definition.before.name='Lucky'
 delete draft.body.trackers;expect(resourcesFor(c).some(r=>r.id.startsWith('auto:feat:'))).toBe(true)
 draft.body.trackers=[];expect(resourcesFor(c).some(r=>r.id.startsWith('auto:feat:'))).toBe(false)
 draft.body.trackers=[{...tracker,name:'',max:0}];expect(restoreOptionDraft(draft).body.trackers).toEqual(draft.body.trackers);expect(optionTrackerProblems(draft.body.trackers)).not.toEqual([])
 expect(optionTrackerProblems([tracker,tracker])).not.toEqual([]);expect(optionTrackerProblems([{...tracker,level:21}])).not.toEqual([])
})
