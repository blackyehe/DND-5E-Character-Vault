import {describe, expect, it} from 'vitest'
import {createSSRApp} from 'vue'
import {renderToString} from '@vue/server-renderer'
import NotebookText from './NotebookText.vue'
const render=(body:string,props:Record<string,unknown>={})=>renderToString(createSSRApp(NotebookText,{body,...props}))
describe('notebook reading and live feedback',()=>{
  it('renders the supported formatting with the same reader used by editing previews',async()=>{
    const html=await render('# Heading\n\n**bold** *italic* ==highlight== `code`\n\n- item\n\n1. first\n\n> quote\n\n```js\n[[literal]] <script>\n```')
    for(const tag of ['<h2>Heading</h2>','<strong>bold</strong>','<em>italic</em>','<mark>highlight</mark>','<code>code</code>','<ul>','<ol>','<blockquote>quote</blockquote>','[[literal]] &lt;script&gt;'])expect(html).toContain(tag)
  })
  it('shows unique matches as links, duplicates as unresolved, and preview links without navigation',async()=>{
    const links=[{id:'one',title:'City'},{id:'two',title:'Twin'},{id:'three',title:'Twin'}]
    const html=await render('[[ City.md#History|Home ]] [[Twin]] [[missing]] [[one]]',{links})
    expect((html.match(/<button/g)??[])).toHaveLength(2)
    expect(html).toContain('Several notes share this name')
    expect(html).toContain('No matching available note')
    expect(html).toContain('>City</button>')
    const preview=await render('[[City]] [map](https://example.com)',{links,interactive:false})
    expect(preview).not.toMatch(/<(button|a)\b/)
    expect((preview.match(/class="notebook-inline-link"/g)??[])).toHaveLength(2)
  })
  it('keeps executable HTML, unsafe URLs, and wiki-like code literal',async()=>{
    const html=await render('<img src=x onerror=alert(1)> [bad](javascript:alert) `[[City]]`',{links:[{id:'one',title:'City'}]})
    expect(html).not.toMatch(/<(img|script|a|button)\b/)
    expect(html).toContain('&lt;img')
    expect(html).toContain('<code>[[City]]</code>')
  })
})
