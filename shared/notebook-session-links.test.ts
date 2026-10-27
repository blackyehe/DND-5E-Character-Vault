import {describe,it,expect} from 'vitest'
import {notebookSessionReferences} from './notebook-session-links'
describe('encounter session references',()=>{
  const sessions=[{id:'two',sessions:[2]},{id:'four',sessions:[4]},{id:'ten',sessions:[10]},{id:'eleven',sessions:[11]},{id:'twelve',sessions:[12]}]
  it('links individual labels, lists, ranges and Session-number notation while retaining every character',()=>{
    for(const text of ['12. session: met Bill.','2., 4. és 12. session.','10–11. session: sent a message.','Session 12 is recorded.']){
      const parts=notebookSessionReferences(text,sessions)
      expect(parts.map(p=>p.text).join('')).toBe(text)
      expect(parts.filter(p=>p.number).every(p=>p.id)).toBe(true)
    }
    expect(notebookSessionReferences('10–11. session',sessions).filter(p=>p.id).map(p=>p.id)).toEqual(['ten','eleven'])
    expect(notebookSessionReferences('2., 4. és 12. session.',sessions).filter(p=>p.id).map(p=>p.id)).toEqual(['two','four','twelve'])
  })
  it('leaves missing or ambiguous sessions as text and never guesses a number',()=>{
    const text='3. session. 12. session. Session-kapcsolat. 100 gold.'
    const parts=notebookSessionReferences(text,[...sessions,{id:'duplicate',sessions:[12]}])
    expect(parts.map(p=>p.text).join('')).toBe(text)
    expect(parts.filter(p=>p.id)).toEqual([])
    expect(parts.filter(p=>p.number).map(p=>p.number)).toEqual([3,12])
  })
})
