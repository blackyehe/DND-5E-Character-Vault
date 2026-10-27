<script lang="ts">
import {computed, defineComponent, h, type VNodeChild, type PropType} from 'vue'
import {notebookSessionReferences, type NotebookSessionTarget} from '../../../shared/notebook-session-links'
import {notebookLinkResolver, notebookWikiLink} from '../../../shared/notebook-links'

// A deliberately small Markdown reader. All source text becomes Vue text nodes;
// HTML, embeds and executable URLs are never evaluated.
export default defineComponent({
  props: {body: {type: String, required: true}, links: {type: Array as PropType<{id: string; title: string}[]>, default: () => []}, sessions:{type:Array as PropType<NotebookSessionTarget[]>,default:()=>[]}, interactive:{type:Boolean,default:true}},
  emits: ['open'],
  setup(props, {emit}) {
    const resolveLink = computed(() => notebookLinkResolver(props.links))
    const noteLink = (id:string, label:string, title?:string) => props.interactive ? h('button', {type:'button',class:'notebook-inline-link',title,onClick:()=>emit('open',id)},label) : h('span',{class:'notebook-inline-link',title:title??`Linked to ${label}`},label)
    function inline(source: string): VNodeChild[] {
      const tokens = source.split(/(\[\[[^\]\n]+\]\]|\[[^\]\n]+\]\([^\s)]+\)|==[^=\n]+==|\*\*[^*\n]+\*\*|`[^`\n]+`|\*[^*\n]+\*)/g)
      return tokens.map(token => {
        if (token.startsWith('[[') && token.endsWith(']]')) {
          const value=token.slice(2,-2), {target,alias}=notebookWikiLink(value), matches=resolveLink.value(value)
          const label=alias??(matches.length===1?matches[0]!.title:target)
          return matches.length===1 ? noteLink(matches[0]!.id,label,`Open ${matches[0]!.title}`) : h('span',{class:'notebook-unresolved',title:matches.length?'Several notes share this name. Choose a link suggestion in Edit.':'No matching available note. Check the name or choose a suggestion in Edit.'},label)
        }
        const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
        if (link) {
          const target = props.links.find(item => link[2] === `note:${item.id}`)
          if (target) return noteLink(target.id,link[1]!)
          if (/^https?:\/\//i.test(link[2]!)) return props.interactive ? h('a', {href: link[2], target: '_blank', rel: 'noopener noreferrer', referrerpolicy: 'no-referrer'}, link[1]) : h('span',{class:'notebook-inline-link',title:link[2]},link[1])
          return h('span', {class: 'notebook-unresolved'}, link[1])
        }
        if (token.startsWith('==') && token.endsWith('==')) return h('mark', inline(token.slice(2, -2)))
        if (token.startsWith('**') && token.endsWith('**')) return h('strong', inline(token.slice(2, -2)))
        if (token.startsWith('`') && token.endsWith('`')) return h('code', token.slice(1, -1))
        if (token.startsWith('*') && token.endsWith('*')) return h('em', inline(token.slice(1, -1)))
        return props.sessions.length?notebookSessionReferences(token,props.sessions).map(part=>part.id?noteLink(part.id,part.text,`Open Session ${part.number}`):part.text):token
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
