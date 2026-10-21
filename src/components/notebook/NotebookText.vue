<script lang="ts">
import {defineComponent, h, type VNodeChild, type PropType} from 'vue'

// A deliberately small Markdown reader. All source text becomes Vue text nodes;
// HTML, embeds and executable URLs are never evaluated.
export default defineComponent({
  props: {body: {type: String, required: true}, links: {type: Array as PropType<{id: string; title: string}[]>, default: () => []}},
  emits: ['open'],
  setup(props, {emit}) {
    function inline(source: string): VNodeChild[] {
      const tokens = source.split(/(\[\[[^\]\n]+\]\]|\[[^\]\n]+\]\([^\s)]+\)|==[^=\n]+==|\*\*[^*\n]+\*\*|`[^`\n]+`|\*[^*\n]+\*)/g)
      return tokens.map(token => {
        if (token.startsWith('[[') && token.endsWith(']]')) {
          const [target = '', alias] = token.slice(2, -2).split('|'), title = target.split('#')[0]!.replace(/\.md$/i, '')
          const matches = props.links.filter(link => link.id === title || link.title.toLocaleLowerCase() === title.toLocaleLowerCase())
          return matches.length === 1 ? h('button', {type: 'button', class: 'notebook-inline-link', onClick: () => emit('open', matches[0]!.id)}, alias ?? title) : h('span', {class: 'notebook-unresolved', title: 'Connect this note in Edit to make the link available.'}, alias ?? title)
        }
        const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
        if (link) {
          const target = props.links.find(item => link[2] === `note:${item.id}`)
          if (target) return h('button', {type: 'button', class: 'notebook-inline-link', onClick: () => emit('open', target.id)}, link[1])
          if (/^https?:\/\//i.test(link[2]!)) return h('a', {href: link[2], target: '_blank', rel: 'noopener noreferrer', referrerpolicy: 'no-referrer'}, link[1])
          return h('span', {class: 'notebook-unresolved'}, link[1])
        }
        if (token.startsWith('==') && token.endsWith('==')) return h('mark', token.slice(2, -2))
        if (token.startsWith('**') && token.endsWith('**')) return h('strong', token.slice(2, -2))
        if (token.startsWith('`') && token.endsWith('`')) return h('code', token.slice(1, -1))
        if (token.startsWith('*') && token.endsWith('*')) return h('em', token.slice(1, -1))
        return token
      })
    }
    return () => {
      const blocks: VNodeChild[] = [], lines = props.body.replace(/\r\n?/g, '\n').split('\n')
      let paragraph: string[] = [], list: string[] = [], ordered = false, code: string[] | null = null
      const flush = () => {if (paragraph.length) {blocks.push(h('p', inline(paragraph.join('\n')))); paragraph = []} if (list.length) {blocks.push(h(ordered ? 'ol' : 'ul', list.map(item => h('li', inline(item))))); list = []}}
      for (const line of lines) {
        if (/^```/.test(line)) {flush(); if (code) {blocks.push(h('pre', h('code', code.join('\n')))); code = null} else code = []; continue}
        if (code) {code.push(line); continue}
        const heading = line.match(/^(#{1,6})\s+(.+)$/), bullet = line.match(/^\s*(?:([-*+])|\d+\.)\s+(.+)$/)
        if (!line.trim()) {flush(); continue}
        if (heading) {flush(); blocks.push(h(`h${Math.min(heading[1]!.length + 1, 6)}`, inline(heading[2]!))); continue}
        if (bullet) {if (paragraph.length || list.length && ordered !== !bullet[1]) flush(); ordered = !bullet[1]; list.push(bullet[2]!); continue}
        if (line.startsWith('> ')) {flush(); blocks.push(h('blockquote', inline(line.slice(2)))); continue}
        if (list.length) flush()
        paragraph.push(line)
      }
      flush(); if (code) blocks.push(h('pre', h('code', code.join('\n'))))
      return h('div', {class: 'notebook-prose'}, blocks.length ? blocks : h('p', {class: 'sheet-small'}, 'No description yet.'))
    }
  },
})
</script>
