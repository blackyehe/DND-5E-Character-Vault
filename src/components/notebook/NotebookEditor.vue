<script setup lang="ts">
import {computed, nextTick, ref, useId, watch} from 'vue'
import type {NotebookLinkTarget} from '../../../shared/notebook-links'
import {activeNotebookLink, insertNotebookLink, notebookLinkMatches, notebookLinkSuggestions} from '../../../shared/notebook-links'
import type {NotebookSessionTarget} from '../../../shared/notebook-session-links'
import NotebookText from './NotebookText.vue'

const body = defineModel<string>({required: true})
const props = withDefaults(defineProps<{targets: NotebookLinkTarget[]; disabled?: boolean; loading?: boolean; linkError?: string; excludeId?: string; label?: string; maxlength?: number; rows?: number; sessions?: NotebookSessionTarget[]}>(), {label: 'Description', maxlength: 60000, rows: 10, sessions: () => []})
const emit = defineEmits<{retry: []}>()
const id = useId(), input = ref<HTMLTextAreaElement | null>(null)
const caret = ref(0), selectionEnd = ref(0), focused = ref(false), dismissed = ref(false), activeIndex = ref(0), help = ref(false), preview = ref(true)
const active = computed(() => activeNotebookLink(body.value, caret.value, selectionEnd.value))
const suggestions = computed(() => active.value ? notebookLinkSuggestions(active.value.value, props.targets, props.excludeId) : [])
const exact = computed(() => active.value ? notebookLinkMatches(active.value.value, props.targets) : [])
const menuOpen = computed(() => focused.value && !dismissed.value && !!active.value && !props.disabled)
const status = computed(() => props.loading ? 'Finding available notes…' : props.linkError ? props.linkError : exact.value.length === 1 ? `Linked to ${exact.value[0]!.title}.` : exact.value.length > 1 ? 'Several notes share this name. Choose one to link.' : suggestions.value.length ? 'Choose a note, or keep typing.' : 'No matching note. The text will stay unlinked.')

defineExpose({get textarea() {return input.value}})
function updateCaret(reset = false) {
  if (!input.value) return
  caret.value = input.value.selectionStart; selectionEnd.value = input.value.selectionEnd
  if (reset) dismissed.value = false
}
function onInput() {updateCaret(true)}
async function choose(entry: NotebookLinkTarget) {
  if (!active.value || props.disabled) return
  const result = insertNotebookLink(body.value, active.value, entry)
  if (result.body.length > props.maxlength) return
  body.value = result.body; dismissed.value = true
  await nextTick(); input.value?.focus({preventScroll: true}); input.value?.setSelectionRange(result.caret, result.caret); updateCaret()
}
function keydown(event: KeyboardEvent) {
  if (event.isComposing || !menuOpen.value) return
  if (event.key === 'Escape') {event.preventDefault(); event.stopPropagation(); dismissed.value = true; return}
  if (!suggestions.value.length || !['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key)) return
  event.preventDefault()
  if (event.key === 'Enter') {void choose(suggestions.value[activeIndex.value]!); return}
  activeIndex.value = (activeIndex.value + (event.key === 'ArrowDown' ? 1 : -1) + suggestions.value.length) % suggestions.value.length
  void nextTick(() => document.getElementById(id+'-option-'+activeIndex.value)?.scrollIntoView({block:'nearest',behavior:'instant'}))
}
async function format(marker: string, sample: string) {
  const el = input.value
  if (!el || props.disabled) return
  const start = el.selectionStart, end = el.selectionEnd, selected = body.value.slice(start, end) || sample
  const close = marker === '[[' ? ']]' : marker
  const value = body.value.slice(0, start) + marker + selected + close + body.value.slice(end)
  if (value.length > props.maxlength) return
  body.value = value
  await nextTick(); el.focus({preventScroll: true}); el.setSelectionRange(start + marker.length, start + marker.length + selected.length); updateCaret(true)
}
watch(() => [active.value?.start, active.value?.value, props.targets], () => {activeIndex.value = 0})
watch(() => props.disabled, value => {if (value) dismissed.value = true})
</script>

<template>
  <div class="notebook-live-editor" :class="{'notebook-editor-short':rows<=3}">
    <div class="notebook-format-bar" aria-label="Note formatting">
      <span :id="id+'-label'">{{label}}</span>
      <div class="notebook-format-actions">
        <button type="button" class="sheet-button sheet-small-button" :disabled="disabled" title="Bold: **text**" aria-label="Bold selection" @click="format('**','bold text')"><strong>B</strong></button>
        <button type="button" class="sheet-button sheet-small-button" :disabled="disabled" title="Italic: *text*" aria-label="Italic selection" @click="format('*','italic text')"><em>I</em></button>
        <button type="button" class="sheet-button sheet-small-button" :disabled="disabled" title="Highlight: ==text==" aria-label="Highlight selection" @click="format('==','highlighted text')">Highlight</button>
        <button type="button" class="sheet-button sheet-small-button" :disabled="disabled" title="Code: `text`" aria-label="Code selection" @click="format('`','code')">Code</button>
        <button type="button" class="sheet-button sheet-small-button" :disabled="disabled" title="Note link: [[name]]" aria-label="Link selection to a note" @click="format('[[','note name')">Link</button>
        <button type="button" class="sheet-button sheet-small-button" :aria-expanded="help" :aria-controls="id+'-help'" @click="help=!help">Syntax</button>
      </div>
    </div>
    <div v-if="help" :id="id+'-help'" class="notebook-syntax-help">
      <span><code>**bold**</code></span><span><code>*italic*</code></span><span><code>==highlight==</code></span><span><code>`code`</code></span><span><code>[[note|label]]</code></span><span><code>[label](https://…)</code></span><span><code># Heading</code></span><span><code>- List</code></span><span><code>1. List</code></span><span><code>&gt; Quote</code></span><span><code>```</code> on separate lines for code</span>
    </div>
    <textarea ref="input" v-model="body" :aria-labelledby="id+'-label'" :aria-describedby="id+'-hint'" :maxlength="maxlength" :rows="rows" :disabled="disabled" :aria-autocomplete="'list'" aria-haspopup="listbox" :aria-expanded="menuOpen" :aria-controls="menuOpen?id+'-options':undefined" :aria-activedescendant="menuOpen&&suggestions.length?id+'-option-'+activeIndex:undefined" placeholder="Write your notes. Try **bold**, ==highlight== or [[a note name]]." @input="onInput" @click="updateCaret(true)" @select="updateCaret()" @keyup="updateCaret()" @focus="focused=true;updateCaret()" @blur="focused=false" @keydown="keydown" />
    <div v-if="menuOpen" class="notebook-link-picker">
      <p class="sheet-small" role="status">{{status}}</p>
      <ul :id="id+'-options'" role="listbox" aria-label="Matching notes">
        <li v-for="(entry,index) in suggestions" :id="id+'-option-'+index" :key="entry.id" role="option" :aria-selected="index===activeIndex" @pointerdown.prevent @click="choose(entry)">
          <button type="button" tabindex="-1" @focus="focused=true" @click.stop="choose(entry)"><span>{{entry.title}}</span><small>{{[entry.codexType,entry.folder].filter(Boolean).join(' · ')}}<template v-if="exact.length>1"> · {{entry.id.slice(-6)}}</template></small></button>
        </li>
      </ul>
      <span v-if="suggestions.length" class="sheet-small">↑ ↓ to choose · Enter to link · Esc to dismiss</span>
    </div>
    <p :id="id+'-hint'" class="sheet-small notebook-editor-hint">Unique <code>[[note names]]</code> link automatically. Choose a suggestion to keep the link after a rename.<template v-if="linkError"> {{linkError}} <button type="button" class="notebook-inline-link" :disabled="loading" @click="emit('retry')">Retry links</button></template></p>
    <div class="notebook-live-preview">
      <button type="button" class="notebook-preview-toggle" :aria-expanded="preview" :aria-controls="id+'-preview'" @click="preview=!preview">{{preview?'Hide':'Show'}} live preview</button>
      <div v-if="preview" :id="id+'-preview'" role="region" :aria-label="label+' live preview'"><NotebookText :body="body" :links="targets" :sessions="sessions" :interactive="false" /></div>
    </div>
  </div>
</template>

<style scoped>
.notebook-live-editor{min-width:0;display:grid;gap:8px}
.notebook-format-bar,.notebook-format-actions{display:flex;align-items:center;gap:5px;flex-wrap:wrap}.notebook-format-bar{justify-content:space-between;gap:10px;font-size:13px}.notebook-format-actions .sheet-button{min-height:34px;min-width:34px}
.notebook-live-editor textarea{margin:0;display:block}.notebook-editor-hint{margin:0;line-height:1.6;color:var(--cb-muted)}
.notebook-live-editor.notebook-editor-short textarea{min-height:110px;max-height:240px}
.notebook-syntax-help{display:flex;gap:8px 16px;flex-wrap:wrap;padding:10px 0;font-size:13px;border-block:1px solid var(--cb-line)}
.notebook-link-picker{border:1px solid var(--cb-line);background:var(--cb-paper);padding:10px;min-width:0}.notebook-link-picker p{margin:0 0 5px}.notebook-link-picker ul{list-style:none;padding:0;margin:0 0 5px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:3px}.notebook-link-picker li{min-width:0}.notebook-link-picker button{display:block;width:100%;text-align:left;border:0;border-radius:2px;padding:8px;background:transparent;color:var(--cb-ink);font:inherit;min-height:44px;cursor:pointer;overflow-wrap:anywhere}.notebook-link-picker :is(button:hover,[aria-selected=true]>button){background:var(--cb-accent-soft)}.notebook-link-picker small{display:block;color:var(--cb-muted);font-size:11px;margin-top:3px}
.notebook-live-preview{border-top:1px solid var(--cb-line);padding-top:10px}.notebook-preview-toggle{background:none;border:0;padding:3px 0 10px;color:var(--cb-accent-text);text-decoration:underline;text-underline-offset:3px;font:inherit;font-size:13px;cursor:pointer;min-height:36px}.notebook-live-preview :deep(.notebook-prose){font-size:15px}.notebook-live-preview :deep(.notebook-prose>:last-child){margin-bottom:0}
.notebook-live-preview :deep(span.notebook-inline-link){cursor:default}
.notebook-live-editor :is(button,textarea):focus-visible{outline:2px solid var(--cb-accent-text);outline-offset:2px}
@container campaign-notebook (max-width:640px){.notebook-link-picker ul{grid-template-columns:minmax(0,1fr)}.notebook-format-actions .sheet-button{min-height:44px}.notebook-live-editor textarea{font-size:16px}}
</style>
