import { describe, expect, it } from 'vitest'
import type { HomebrewFeat } from './srd'
import { featFeatureRows, featNames, featVersions, sheetFeatFeatures } from './feat-references'

const feat = (index: string, description: string, sourcePack: string): HomebrewFeat => ({ index, name: 'Alert', url: '', homebrew: true, description, sourcePack, prerequisites: [], ability_increases: [] })
describe('feat references', () => {
  it('removes redundant legacy groups without changing pin action indices', () => {
    const features = [{ name: 'Feats', description: 'Alert' }, { name: 'Alert', description: 'Saved rules.', origin: 'feat' as const }, { name: 'Class feature', description: 'Rules.' }]
    expect(sheetFeatFeatures(features).map(f => [f.name, f.index])).toEqual([['Alert', 1], ['Class feature', 2]])
    expect(features[0]!.description).toBe('Alert')
  })
  it('keeps choice punctuation while splitting legacy feat lists', () => {
    expect(featNames('Alert, Resilient (Strength, Dexterity); Skilled [choose tools, skills]\n- Tough')).toEqual(['Alert', 'Resilient (Strength, Dexterity)', 'Skilled [choose tools, skills]', 'Tough'])
  })
  it('merges duplicate imports but preserves differing rules and prerequisites', () => {
    const entries = [feat('a', 'A rule.', 'Book A'), feat('b', 'A  rule.', 'Book B'), feat('c', 'Other rules.', 'Book C'), { ...feat('d', 'A rule.', 'Book D'), prerequisites: ['Level 4'] }]
    const versions = featVersions('ALERT', entries)
    expect(versions).toHaveLength(3)
    expect(versions[0]!.sources).toEqual(['Book A', 'Book B'])
    expect(versions[2]!.prerequisites).toEqual(['Level 4'])
  })
  it('uses a saved explanation when no library definition exists, never the aggregate list', () => {
    expect(featVersions('Alert', [], [{ name: 'Feats', description: 'Alert, Tough' }])).toEqual([])
    expect(featVersions('Alert', [], [{ name: 'Alert', description: 'Saved rules.' }])[0]?.description).toBe('Saved rules.')
  })
  it('matches imported display names and stable content keys', () => {
    const entry = { ...feat('a', 'Rules.', 'Book'), name: 'Source-specific label', displayName: 'Alert', contentKey: 'feats/keen-mind' }
    expect(featVersions('Alert', [entry])).toHaveLength(1)
    expect(featVersions('Keen Mind', [entry])).toHaveLength(1)
  })
  it('expands room lists without duplicate feats or changing saved feature indices', () => {
    const features = [{ name: 'Feats', description: 'Alert, Tough, Alert', pinned: true }, { name: 'Alert', description: 'Saved rules.', origin: 'feat' as const }, { name: 'Feats', description: 'Tough, Skilled' }]
    const before = JSON.stringify(features), rows = featFeatureRows(features)
    expect(rows.map(f => f.name)).toEqual(['Tough', 'Alert', 'Skilled'])
    expect(rows.map(f => f.index)).toEqual([0, 1, 2])
    expect(rows[0]!.pinned).toBe(true)
    expect(new Set(rows.map(f => f.key)).size).toBe(3)
    expect(JSON.stringify(features)).toBe(before)
  })
})
