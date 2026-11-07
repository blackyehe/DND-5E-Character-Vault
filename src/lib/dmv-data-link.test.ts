import {describe,expect,it} from 'vitest'
import {dmvDataLink} from './dmv-data-link'

describe('user-opened DMV character data',()=>{
  it.each([
    'https://www.dungeonmastersvault.com/pages/dnd/5e/characters/12345',
    ' http://dungeonmastersvault.com/dnd/5e/characters/12345/?tracking=removed#removed ',
    'https://DUNGEONMASTERSVAULT.COM/pages/dnd/5e/characters/12345',
  ])('opens only the canonical HTTPS public data page for %s',input=>{
    expect(dmvDataLink(input)).toBe('https://www.dungeonmastersvault.com/dnd/5e/characters/12345')
  })
  it.each([
    '', 'not a URL', 'javascript:alert(1)',
    'https://www.dungeonmastersvault.com.evil.example/pages/dnd/5e/characters/12345',
    'https://evil.example/pages/dnd/5e/characters/12345',
    'https://www.dungeonmastersvault.com@evil.example/pages/dnd/5e/characters/12345',
    'https://user:password@www.dungeonmastersvault.com/pages/dnd/5e/characters/12345',
    'https://www.dungeonmastersvault.com:8443/pages/dnd/5e/characters/12345',
    'ftp://www.dungeonmastersvault.com/pages/dnd/5e/characters/12345',
    'https://www.dungeonmastersvault.com/pages/dnd/5e/characters/123456789012345678901',
    'https://www.dungeonmastersvault.com/pages/dnd/5e/characters/12345/other',
    'https://www.dungeonmastersvault.com/pages/dnd/5e/characters/not-a-number',
    'https://www.dungeonmastersvault.com/pages/dnd/5e/characters/%31',
  ])('offers no external action for %s',input=>{expect(dmvDataLink(input)).toBeUndefined()})
})
