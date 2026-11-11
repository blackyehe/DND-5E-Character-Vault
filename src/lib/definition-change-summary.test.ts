import {expect,it} from 'vitest'
import type {DefinitionReviewRow} from '../../shared/definition-review'
import {definitionChangeSummary,definitionReviewWarnings} from './definition-change-summary'
const row=(changes:DefinitionReviewRow['changes']):DefinitionReviewRow=>({id:'hero',name:'Volenta',updatedAt:'saved',reviewHash:'hash',alreadyReviewed:false,sourceConfirmation:true,warnings:[],changes})
it('names added item trackers with their actual activation and recovery without raw identity fields',()=>{
 const trackers=[{id:'one',name:'Devour',max:1,recovery:'long',activation:'equipped'}]
 const summary=definitionChangeSummary(row([{field:'resources',before:[],after:[{id:'linked',name:'Prison · Devour',max:1,recovery:'long',source:{trackerId:'one'}}]},{field:'equipment',before:[{_id:'item',name:'Prison'}],after:[{_id:'item',name:'Prison',trackers}]}]),'Prison')
 expect(summary).toEqual([{label:'Add Devour',detail:'1 use · Long rest · While equipped'}]);expect(JSON.stringify(summary)).not.toContain('linked')
})
it('distinguishes tracker removals, renamed pools and changed maxima',()=>{
 const summary=definitionChangeSummary(row([{field:'resources',before:[{id:'a',name:'Old',max:1,recovery:'long'},{id:'b',name:'Removed'}],after:[{id:'a',name:'New',max:3,recovery:'short'}]}]))
 expect(summary).toEqual([{label:'Rename Old to New',detail:'1 → 3 uses · Short rest'},{label:'Remove Removed'}])
})
it('ignores reordered source metadata but retains real equipment/defense and other changes',()=>{
 const summary=definitionChangeSummary(row([{field:'benefits and defenses',before:{effective:{spellAttack:3,spellDC:3},sources:['a','b']},after:{effective:{spellDC:3,spellAttack:3},sources:['b','a']}},{field:'equipment',before:[{_id:'item',name:'Focus',description:'Old'}],after:[{_id:'item',name:'Focus',description:'New'}]},{field:'meta',before:{},after:{}}]))
 expect(summary).toEqual([{label:'Update Focus rules'},{label:'Update character details'}])
 expect(definitionChangeSummary(row([{field:'benefits and defenses',before:{effective:{resistances:[]}},after:{effective:{resistances:['cold']}}}]))).toEqual([{label:'Update benefits and defenses'}])
})
it('keeps material warnings and provides a useful revision-only summary',()=>{
 const r=row([]);r.warnings=['Confirm this is the source intended for this character. Legacy records may use names.','Custom item values are kept when they differ from the source. Details.','Current HP exceeds the maximum.','Selection needs repair before applying.']
 expect(definitionReviewWarnings(r)).toEqual(['Current HP exceeds the maximum.','Selection needs repair before applying.']);expect(definitionChangeSummary(r)[0]!.label).toBe('Use the latest saved rules')
})
