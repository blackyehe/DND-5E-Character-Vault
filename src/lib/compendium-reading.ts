import type { SrdLevel } from './srd'

export type RuleRecord = Record<string, unknown>
export interface ReadingField { label: string; value: unknown; key?: string }
export interface ReadingRule { name: string; text: string; level?: number; value?: unknown; reference?: { kind: 'trait'|'feature'; index: string } }
export interface ReadingDocument { text: string; facts: ReadingField[]; sections: ReadingField[]; rules: ReadingRule[] }
export const record = (value: unknown): RuleRecord => value && typeof value === 'object' && !Array.isArray(value) ? value as RuleRecord : {}
export const list = (value: unknown): unknown[] => Array.isArray(value) ? value : []
export const field = (value: unknown, key: string): unknown => record(value)[key] ?? record(value)[`:${key}`]
export const hasReadingValue = (value: unknown): boolean => value !== null && value !== undefined && value !== '' &&
  (Array.isArray(value) ? value.some(hasReadingValue) : typeof value === 'object' ? Object.values(record(value)).some(hasReadingValue) : true)
const labels: Record<string, string> = {
  str:'Strength',dex:'Dexterity',con:'Constitution',int:'Intelligence',wis:'Wisdom',cha:'Charisma',
  ac:'AC',gp:'GP',sp:'SP',cp:'CP',ep:'EP',pp:'PP',
  profs:'Proficiencies',props:'Additional traits',num:'Number of choices',choose:'Choose',
  'b-action':'Bonus action','skill-options':'Skill choices','skill-expertise-options':'Expertise choices',
  'weapon-prof':'Weapon proficiency','armor-prof':'Armour proficiency','tool-prof':'Tool proficiency',
  'ability-increases':'Ability score increases','level-modifiers':'Benefits by level',prereqs:'Prerequisites',
  'spells-known':'Spells gained at each level','cantrips-known':'Cantrips gained at each level',
  'level-factor':'Caster level divisor','known-mode':'Spell learning','spell-list-kw':'Spell list',
  'lizardfolk-ac':'Lizardfolk natural armour','resource-list':'Available options',
  'num-attacks':'Number of attacks','skill-prof':'Skill proficiency',save:'Saving throws',
  'level-selections':'Choices by level','starts-at':'Starts at level','spellcasting-level':'Spellcasting starts at level',
}
export function readingLabel(value: string): string {
  const key = value.replace(/^:/,'').split('/').pop()!.replace(/_/g,'-').replace(/\?$/,'')
  return Object.hasOwn(labels,key) ? labels[key]! : key.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/-/g,' ').trim().replace(/^./,c=>c.toUpperCase())
}
export function readingName(value: unknown): string {
  if (typeof value === 'string') return value.startsWith(':') ? readingLabel(value) : value
  const name=field(value,'name'),index=field(value,'index')
  return typeof name==='string'?name:typeof index==='string'?readingLabel(index):''
}
export function readingText(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (Array.isArray(value)) return value.filter(v=>typeof v==='string').join('\n\n').trim()
  return ''
}
const firstText = (...values: unknown[]) => values.map(readingText).find(Boolean) ?? ''
const metadata = new Set(['index','url','updated-at','key','option-pack','source','source-pack','source-packs','sources','content-key','aliases','legacy-key','display-name','disabled','disabled?','homebrew','definition-available','workshop','workshop-revision','id','version','edit-event','option-type','option-set-type','class-levels','subclass-levels'])
export function readingFields(value: unknown): ReadingField[] {
  return Object.entries(record(value)).filter(([key,child])=>{
    const plain=key.replace(/^:/,'').replace(/_/g,'-').replace(/([a-z])([A-Z])/g,'$1-$2').toLowerCase()
    return !metadata.has(plain)&&!plain.startsWith('codex/')&&!(typeof child==='string'&&/^\/api\//.test(child))&&hasReadingValue(child)
  }).map(([key,child])=>({key,label:readingLabel(key),value:child}))
}
const signed = (n: unknown) => `${Number(n)>0?'+':''}${n}`

/** Presentation only: never infer missing game rules or mutate saved definitions. */
export function compendiumReading(entry: RuleRecord, kind: string, levels: SrdLevel[] = []): ReadingDocument {
  const raw=record(entry.details),workshop=record(entry.workshop)
  const get=(key:string)=>entry[key]??field(raw,key)
  const result:ReadingDocument={text:firstText(workshop.description,entry.description,entry.desc,field(raw,'description'),field(raw,'help')),facts:[],sections:[],rules:[]}
  const canonical=(key:string)=>key.replace(/^:/,'').replace(/_/g,'-')
  const used=new Set<string>(['name','description','desc','help','traits','homebrew-traits','racial-traits','options','details'])
  const add=(label:string,value:unknown,fact=false,key?:string)=>{if(hasReadingValue(value))(fact?result.facts:result.sections).push({label,value,key})}
  const take=(key:string,label:string,fact=false,transform?:(value:unknown)=>unknown)=>{used.add(canonical(key));const value=get(key);add(label,transform?transform(value):value,fact,key)}
  if(kind==='classes'){
    used.add('homebrew-subclass-title')
    take('hit_die','Hit die',true,v=>typeof v==='number'?`d${v}`:undefined)
    take('saving_throws','Saving throws',true,v=>list(v).map(readingName).join(', '))
    take('subclass-title','Subclass type',true)
    take('subclass-level','Choose subclass at level',true)
    take('ability-increase-levels','Ability score improvement levels',true,v=>list(v).join(', '))
    take('proficiencies','Proficiencies')
    take('proficiency_choices','Proficiency choices')
    take('multi_classing','Multiclassing')
  }
  if(kind==='races'||kind==='subraces'){
    if(kind==='subraces')take('race','Parent race',true,readingName)
    if(kind==='subraces'&&entry.homebrew&&!field(raw,'size'))used.add('size')
    else take('size','Size',true,v=>typeof v==='string'?readingLabel(v):v)
    take('speed','Walking speed',true,v=>typeof v==='number'?`${v} ft.`:v)
    take('darkvision','Darkvision',true,v=>typeof v==='number'?`${v} ft.`:v)
    take('ability_bonuses','Ability bonuses',true,v=>list(v).filter(b=>Number(field(b,'bonus'))!==0).map(b=>`${readingName(field(b,'ability_score'))} ${signed(field(b,'bonus'))}`).join(', '))
    used.add('abilities')
    take('languages','Languages',true,v=>list(v).map(readingName).join(', '))
    take('age','Age');take('alignment','Alignment');take('size_description','Size & build');take('language_desc','Languages & script')
    take('subraces','Subraces')
  }
  if(kind==='subclasses'){
    take('class','Parent class',true,readingName);take('subclass_flavor','Subclass type',true)
  }
  if(kind==='languages'){
    take('type','Language type',true);take('script','Script',true);take('typical_speakers','Typical speakers',true,v=>list(v).join(', '))
  }
  take('prerequisites','Prerequisites')
  used.add('prereqs')
  take('starting_proficiencies','Proficiencies')
  take('starting_equipment','Starting equipment');take('starting_equipment_options','Equipment choices')
  take('equipment','Equipment');take('equipment-choices','Equipment choices');take('treasure','Starting currency')
  take('profs','Proficiencies & choices');take('language_options','Language choices')
  for(const key of ['personality_traits','ideals','bonds','flaws'])take(key,readingLabel(key))
  take('ability_increases','Ability score increases')

  const addRule=(value:unknown,defaultName:string,referenceKind?:'trait'|'feature',level?:number)=>{
    if(typeof value==='string'){result.rules.push({name:defaultName,text:readingName(value)});return}
    const row=record(value),name=readingName(row)||defaultName,text=firstText(field(row,'description'),field(row,'desc'),field(row,'help'))
    const index=field(row,'index'),acquired=field(row,'level')??level
    const rest=Object.fromEntries(Object.entries(row).filter(([key])=>!['name','description','desc','help','level'].includes(key.replace(/^:/,''))))
    result.rules.push({name,text,...(typeof acquired==='number'?{level:acquired}:{}),...(!text&&referenceKind&&typeof index==='string'?{reference:{kind:referenceKind,index}}:{}),...(!index&&readingFields(rest).length?{value:rest}:{})})
  }
  const traits=list(entry.homebrew_traits).length?list(entry.homebrew_traits):list(entry.traits).length?list(entry.traits):list(entry.racial_traits).length?list(entry.racial_traits):list(field(raw,'traits'))
  traits.forEach(value=>addRule(value,'Trait',kind==='races'||kind==='subraces'?'trait':undefined))
  if(hasReadingValue(entry.feature)){used.add('feature');addRule(entry.feature,'Background feature')}
  list(get('options')).forEach(value=>addRule(value,'Option'))
  if(levels.length){
    const seen=new Set<string>()
    for(const row of [...levels].sort((a,b)=>a.level-b.level))for(const feature of row.features??[]){const key=`${row.level}:${feature.index}`;if(!seen.has(key)){seen.add(key);addRule(feature,'Class feature','feature',row.level)}}
  }
  used.add('spellcasting')
  const casting=record(get('spellcasting')),info=list(casting.info)
  if(hasReadingValue(casting)){
    const ability=field(casting,'spellcasting_ability')??field(casting,'ability')
    add('Spellcasting ability',readingName(ability),true)
    const remaining=Object.fromEntries(Object.entries(casting).filter(([key])=>!['info','spellcasting_ability','ability'].includes(key.replace(/^:/,''))))
    add('Spellcasting',remaining)
    info.forEach(value=>addRule(value,'Spellcasting'))
  }
  if(hasReadingValue(workshop)){
    // These are the published Workshop fields, rather than an inferred ruleset.
    add('Published training',{Armour:workshop.armor,Weapons:workshop.weapons,Tools:workshop.tools})
    if(field(workshop.magic,'enabled')===true)add('Published spellcasting',Object.fromEntries(Object.entries(record(workshop.magic)).filter(([key])=>key!=='enabled')))
    add('Resource trackers',workshop.resources)
  }
  // Keep unusual imported rules readable too, while hiding file/editor identifiers.
  const extra=new Map<string,ReadingField>()
  for(const source of [raw,entry])for(const [key,value] of Object.entries(source))if(!used.has(canonical(key))){
    for(const row of readingFields({[key]:value}))extra.set(row.label,row)
  }
  for(const row of extra.values())add(row.label,row.value,false,row.key)
  return result
}
