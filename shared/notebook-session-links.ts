export interface NotebookSessionTarget {id:string; sessions:number[]}
export interface NotebookSessionReference {text:string; id?:string; number?:number}

/** Applied to plain inline text only; callers keep Markdown links and code intact. */
export function notebookSessionReferences(text: string, sessions: readonly NotebookSessionTarget[]): NotebookSessionReference[] {
  const result:NotebookSessionReference[]=[],pattern=/\bsession\s+(\d+)\b|\b(\d+(?:\.\s*,\s*\d+|\.\s*(?:és|and)\s+\d+|\s*[–—-]\s*\d+)*)\.\s*session\b/gi
  const target=(number:number)=>{const matches=sessions.filter(s=>s.sessions.includes(number));return matches.length===1?matches[0]!.id:undefined}
  let end=0
  for(const match of text.matchAll(pattern)){
    if(match.index!>end)result.push({text:text.slice(end,match.index)})
    if(match[1])result.push({text:match[0],id:target(Number(match[1])),number:Number(match[1])})
    else {
      let offset=0
      for(const number of match[0].matchAll(/\d+\.?/g)){
        if(number.index!>offset)result.push({text:match[0].slice(offset,number.index)})
        const last=number.index!+number[0].length>=match[2]!.length
        const stop=last?match[0].length:number.index!+number[0].length
        result.push({text:match[0].slice(number.index,stop),id:target(parseInt(number[0])),number:parseInt(number[0])})
        offset=stop
      }
      if(offset<match[0].length)result.push({text:match[0].slice(offset)})
    }
    end=match.index!+match[0].length
  }
  if(end<text.length)result.push({text:text.slice(end)})
  return result
}
