import {describe, expect, it} from 'vitest'
import {notebookEntryType, notebookIsEvent, notebookQuestStatus, notebookReading, notebookSearchText, notebookSectionForType, notebookSessionNumbers} from './notebook-codex'

describe('campaign codex metadata', () => {
  it('lists explicitly marked quests in Events without changing their category or legacy entries', () => {
    const quest={title:'Stolen books',section:'journal' as const,codexType:'quests',showInEvents:true}
    expect(notebookIsEvent(quest)).toBe(true)
    expect(notebookEntryType(quest)).toBe('quests')
    expect(notebookIsEvent({...quest,showInEvents:false})).toBe(false)
    expect(notebookIsEvent({codexType:'events'})).toBe(true)
    expect(notebookIsEvent({})).toBe(false)
    expect(notebookEntryType({...quest,codexType:'events'})).toBe('events')
    expect(notebookSectionForType('events')).toBe('journal')
  })
  it('requires explicit quest categorization and keeps old clients from losing a finished state', () => {
    expect(notebookEntryType({title:'Deal with Bill Clinton',section:'journal'})).toBe('people')
    expect(notebookEntryType({title:'Deal with Bill Clinton',section:'journal',codexType:'quests'})).toBe('quests')
    expect(notebookQuestStatus({codexType:'quests'})).toBe('active')
    expect(notebookQuestStatus({codexType:'quests',questStatus:'finished'})).toBe('finished')
    expect(notebookQuestStatus({codexType:'people',questStatus:'finished'})).toBe(null)
  })
  it('classifies legacy entries without changing their text and honors explicit categories', () => {
    expect(notebookEntryType({title:'Session 10 — Truuselar',section:'journal'})).toBe('sessions')
    expect(notebookEntryType({title:'Book',section:'story-items'})).toBe('objects')
    expect(notebookEntryType({title:'Crimson Dynasty — A három bölcs',section:'journal'})).toBe('factions')
    expect(notebookEntryType({title:'Wren',section:'journal'})).toBe('people')
    expect(notebookEntryType({title:'Session 1 tavern',section:'journal',codexType:'places'})).toBe('places')
    expect(notebookSectionForType('objects')).toBe('story-items')
    expect(notebookSectionForType('places')).toBe('journal')
  })
  it('reads source session lists and legacy paths without inventing an encounter', () => {
    expect(notebookSessionNumbers('## Források\n\n- 2., 4., 7. és 12. session.')).toEqual([2,4,7,12])
    expect(notebookSessionNumbers('## Leírás\n\n12. session mentioned in prose.\n\n## Session-forrás\n- **2. session — Sessions/Session 2.md:** arrived.\n- 7. session.')).toEqual([2,7])
    expect(notebookSessionNumbers('## Session-kapcsolat\n\nElső találkozás nincs megerősítve.\n\n## Forrás\n- The World/Wren.md')).toEqual([])
  })
  it('keeps all narrative, clues, DM notes and recovered letter content in its tabs', () => {
    const letter='## A levél\n\n```text\n## Session 20\n### Missing notes\nFerdinand és a Mester.\n```'
    const body=`## Session-kapcsolat\n\n- **9. session:** recovered.\n\n## Leírás\n\nBurnt journal.\n\n## Nyomok\n\nGood rolls revealed Percival.\n\n${letter}\n\n## Ismert kapcsolatok és kötődések\n\n- Melina: friend.\n\n## DM-megjegyzés\n\nHidden truth.\n\n## Forrás\n\n- Sessions/Session 9.md\n- Important Items/Burnt journal.md`
    const tabs=notebookReading(body)
    for (const value of ['Burnt journal.','Good rolls revealed Percival.',letter,'Hidden truth.']) expect(tabs.description).toContain(value)
    expect(tabs.relations).toContain('Melina: friend.')
    expect(tabs.encounters).toContain('recovered.')
    expect(tabs.encounters).toContain('- 9. session.')
    expect(tabs.encounters).not.toContain('.md')
    expect(notebookSessionNumbers(body)).toEqual([9])
    expect(body).toContain('Important Items/Burnt journal.md')
  })
  it('keeps standalone prose and tilde-fenced headings intact', () => {
    const body='Intro.\n\n~~~md\n## Forrás\n- private-looking example\n~~~\n\n## Leírás\n\nRest.'
    expect(notebookReading(body).description).toContain(body)
    expect(notebookReading(body).encounters).toBe('')
    expect(notebookReading('## Forrás\n- The World/Wren.md').encounters).toContain('nincs megerősítve')
  })
  it('matches Hungarian search text without accents', () => {
    expect(notebookSearchText('Ősi Elemek Könyvei')).toBe('osi elemek konyvei')
  })
  it('links source sessions only when one accessible session matches', () => {
    const body='## Session-kapcsolat\n\nArrived.\n\n## Források\n\n- 2., 4., 7. és 12. session.'
    const sessions=[{id:'two',sessions:[2]},{id:'four',sessions:[4]},{id:'seven-a',sessions:[7]},{id:'seven-b',sessions:[7]}]
    const reading=notebookReading(body,sessions)
    expect(reading.encounters).toContain('- [2. session](note:two).')
    expect(reading.encounters).toContain('- [4. session](note:four).')
    expect(reading.encounters).toContain('- 7. session.')
    expect(reading.encounters).toContain('- 12. session.')
    expect(reading.encounters).not.toContain('note:seven')
    expect(notebookReading(body).encounters).not.toContain('note:')
    expect(reading.encounters).toContain('Arrived.')
  })
})
