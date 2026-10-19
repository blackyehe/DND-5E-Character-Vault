import { describe, expect, it, vi } from 'vitest'
import { emptyCharacter } from '../../shared/character'
import { quickSheetOutput } from './character-output'
import { resolveWorkshopCharacter } from './workshop-library'

vi.mock('./workshop-library',()=>({resolveWorkshopCharacter:vi.fn()}))

describe('quick sheet output',()=>{
  it('includes saved features, resolved equipment and SRD spells without opening a pack',()=>{
    const character=emptyCharacter()
    character.spellcasting.known=['counterspell']
    character.features=[{name:'Saved class feature',description:'Already on the sheet.'}]
    character.equipment=[{name:'Sword Of Wounding Longsword',qty:1,weight:0,equipped:true,notes:'Imported item: check weight and special effects.'}]
    const quick=quickSheetOutput(character,true)
    expect(resolveWorkshopCharacter).not.toHaveBeenCalled()
    expect(quick.character.features[0]?.name).toBe('Saved class feature')
    expect(quick.character.equipment[0]?.weapon?.dice).toBe('1d8')
    expect(quick.character.equipment[0]?.description).toContain('wound the target')
    expect(quick.spells.counterspell?.name).toBe('Counterspell')
  })
})
