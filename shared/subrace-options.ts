import {ABILITY_KEYS,type AbilityKey} from './calc'
export interface SubraceOption {parentIndex:string;parentName:string;bonuses:Record<AbilityKey,number>;speed:number|null}
export function subraceOptionProblem(value:unknown,complete=true):string|undefined{
 if(!value||typeof value!=='object'||Array.isArray(value))return 'Choose a parent race and subrace adjustments.'
 const s=value as SubraceOption
 if(Object.keys(s).some(k=>!['parentIndex','parentName','bonuses','speed'].includes(k))||typeof s.parentIndex!=='string'||s.parentIndex.length>300||complete&&!s.parentIndex||typeof s.parentName!=='string'||s.parentName.length>300)return 'Choose an available parent race.'
 if(!s.bonuses||typeof s.bonuses!=='object'||Object.keys(s.bonuses).some(k=>!ABILITY_KEYS.includes(k as AbilityKey))||ABILITY_KEYS.some(k=>!Number.isInteger(s.bonuses[k])||s.bonuses[k]<-5||s.bonuses[k]>5))return 'Subrace ability adjustments must be whole numbers from −5 to 5.'
 if(s.speed!==null&&(!Number.isInteger(s.speed)||s.speed<0||s.speed>1000))return 'Use the parent speed or a whole speed from 0 to 1000.'
}
export function subraceMatchesRace(subrace:{index?:string;race?:unknown;optionBuilder?:unknown},race:{index:string;contentKey?:unknown;aliases?:unknown;name:string}):boolean{
 const native=(subrace.optionBuilder as {subrace?:SubraceOption}|undefined)?.subrace
 const parent=native?.parentIndex??(typeof subrace.race==='string'?subrace.race:(subrace.race as {index?:string}|undefined)?.index)
 return typeof parent==='string'&&[race.index,race.contentKey,...(Array.isArray(race.aliases)?race.aliases:[])].some(id=>typeof id==='string'&&id.replace(/^:/,'').replace(/^.*\//,'')===parent.replace(/^:/,'').replace(/^.*\//,''))
}
