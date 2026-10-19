/** Read spell levels in ascending order, with unresolved definitions at the end. */
export function spellLevelGroups<T extends {name:string;level?:number}>(spells:T[]) {
  const rank=(spell:T)=>{
    const level=spell.level
    return typeof level==='number'&&Number.isInteger(level)&&level>=0&&level<=9?level:-1
  }
  return [...Array.from({length:10},(_,level)=>level),-1].map(level=>({
    level,
    title:level===-1?'Level unavailable · review in Edit':level===0?'Cantrips':`Level ${level} spells`,
    spells:spells.filter(spell=>rank(spell)===level).sort((a,b)=>a.name.localeCompare(b.name)),
  })).filter(group=>group.spells.length)
}
