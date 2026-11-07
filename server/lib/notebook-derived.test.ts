import {describe, expect, it} from 'vitest'
import {notebookChanges, notebookDerived, notebookDerivedConsistent} from './notebook-derived'

describe('notebook listing metadata', () => {
  const source = {revision: 1, section: 'journal', title: 'Session 12', body: '## Session sources\n- 12. session.', tags: ['  City ', 'CITY', 'Árvíz']}
  it('preserves legacy category/session/tag semantics without retaining prose or clues', () => {
    const listing = notebookDerived(source)
    expect(listing).toMatchObject({type: 'sessions', sessions: [12], firstSession: 12, tagNames: ['City', 'Árvíz'], tagKeys: ['city', 'árvíz']})
    expect(notebookDerived({...source, body: ''}).firstSession).toBeGreaterThan(10000)
    expect(notebookDerived({...source, section: 'story-items'}).type).toBe('objects')
    expect(notebookDerived({...source, title: 'Old Dynasty'}).type).toBe('factions')
    expect(notebookDerived({...source, codexType: 'quests', showInEvents: true}).questStatus).toBe('active')
    expect(listing).not.toHaveProperty('body')
    expect(listing).not.toHaveProperty('questClues')
    expect(listing).not.toHaveProperty('excerpt')
  })
  it('recomputes from merged query updates, including text-only history restore', () => {
    const stored = {...source, audience: 'dm', listing: notebookDerived(source)}
    const patch = notebookChanges(stored, {title: 'A person', body: '## Session sources\n- 3. session.'})
    expect(patch.listing).toMatchObject({type: 'people', sessions: [3], firstSession: 3})
    expect(notebookDerivedConsistent({...stored, ...patch, revision: 2})).toBe(true)
    expect(notebookDerivedConsistent({...stored, revision: 2})).toBe(false)
    expect(notebookDerivedConsistent({...stored, body: 'changed'})).toBe(false)
    expect(notebookDerivedConsistent({...stored, listing: undefined})).toBe(false)
    expect(stored.listing.sessions).toEqual([12])
    expect(patch).not.toHaveProperty('audience')
    expect(notebookChanges(stored, {tags: ['New']}).listing.tagKeys).toEqual(['new'])
    expect(notebookChanges(stored, {audience: 'room'}).listing).toEqual({...stored.listing, sourceRevision: 2})
  })
})
