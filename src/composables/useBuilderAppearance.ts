import { computed, reactive, ref, watch } from 'vue'

export type BuilderTheme = 'parchment' | 'dark' | 'light' | 'obsidian'
export type BuilderAccent = 'forest' | 'violet' | 'ocean' | 'ember' | 'crimson'
export type BuilderTextSize = 'comfortable' | 'large'
const defaults = { theme: 'obsidian' as BuilderTheme, accent: 'crimson' as BuilderAccent, textSize: 'comfortable' as BuilderTextSize, coverage: 'immersive' as 'subtle' | 'immersive', customAccent: '' }
const settings = reactive({ ...defaults })
const appearanceOpen = ref(false)
const storageKey = 'codex:builder-appearance:v1'
let initialized = false
const accents = { forest: '#46765c', violet: '#8664b3', ocean: '#367e9d', ember: '#b46447', crimson: '#be3449' }
const palettes = {
  parchment: { canvas: '#efeee7', paper: '#faf9f4', field: '#fffefa', soft: '#e9ede2', line: '#d6ddcd', ink: '#2c3c32', muted: '#65755f', header: '#1d352c', summary: '#243e32' },
  light: { canvas: '#edf1f4', paper: '#ffffff', field: '#ffffff', soft: '#f0f4f6', line: '#d2dce1', ink: '#25343e', muted: '#596d79', header: '#233740', summary: '#233740' },
  dark: { canvas: '#12191d', paper: '#1c262c', field: '#182126', soft: '#243138', line: '#3a4a52', ink: '#e8eee9', muted: '#b1c2bf', header: '#10191e', summary: '#172328' },
  obsidian: { canvas: '#08090b', paper: '#141518', field: '#0d0e11', soft: '#202125', line: '#3b3c43', ink: '#f1edef', muted: '#c1b9be', header: '#08090b', summary: '#101114' },
}
const rgb = (color: string) => [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16))
function mix(a: string, b: string, amount: number) {
  const to = rgb(b)
  return '#' + rgb(a).map((channel, i) => Math.round(channel * (1 - amount) + to[i]! * amount).toString(16).padStart(2, '0')).join('')
}
function luminance(color: string) {
  const values = rgb(color).map((channel) => { const value = channel / 255; return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4 })
  return values[0]! * .2126 + values[1]! * .7152 + values[2]! * .0722
}
function contrast(a: string, b: string) { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05) }
function readable(color: string, surface: string, target: string) {
  let result = color
  for (let step = 0; step <= 20 && contrast(result, surface) < 4.5; step++) result = mix(color, target, step / 20)
  return result
}
const appearanceStyle = computed<Record<string, string>>(() => {
  const base = palettes[settings.theme]
  const accent = settings.customAccent || accents[settings.accent]
  const dark = settings.theme === 'dark' || settings.theme === 'obsidian'
  const immersive = settings.coverage === 'immersive'
  const colors = { ...base }
  if (immersive) {
    for (const key of ['canvas', 'paper', 'field', 'soft', 'line', 'header', 'summary'] as const) colors[key] = mix(base[key], accent, key === 'line' ? .3 : key === 'soft' ? .14 : key === 'header' || key === 'summary' ? .10 : .035)
  }
  colors.muted = readable(base.muted, colors.soft, dark ? '#ffffff' : '#111111')
  const onAccent = contrast('#ffffff', accent) >= contrast('#111111', accent) ? '#ffffff' : '#111111'
  const accentSoft = mix(colors.paper, accent, dark ? .24 : .13)
  const accentText = readable(readable(accent, colors.paper, dark ? '#ffffff' : '#111111'), accentSoft, dark ? '#ffffff' : '#111111')
  const selectSurface = mix(colors.field, colors.ink, dark ? .10 : .035)
  return {
    ...Object.fromEntries(Object.entries(colors).map(([key, color]) => [`--cb-${key}`, color])),
    '--cb-summary-ink': '#f6f1f3', '--cb-summary-muted': '#d0c6cc', '--cb-summary-line': mix(colors.summary, '#ffffff', .24),
    '--cb-accent-solid': accent, '--cb-accent-hover': mix(accent, onAccent === '#ffffff' ? '#000000' : '#ffffff', .16),
    '--cb-accent-text': accentText, '--cb-accent-soft': accentSoft,
    '--cb-accent-mark': readable(dark ? mix(accent, '#ffffff', .45) : mix(accent, '#ffffff', .55), colors.summary, '#ffffff'),
    '--cb-on-accent': onAccent, '--cb-gold': accentText, '--cb-text-scale': settings.textSize === 'large' ? '1.14' : '1',
    '--cb-select': selectSurface, '--cb-select-ink': readable(colors.ink, selectSurface, dark ? '#ffffff' : '#111111'),
    '--cb-select-line': mix(colors.line, colors.ink, .26),
    '--site-danger': dark ? '#ffb2b9' : '#a12235', '--site-success': dark ? '#a8d7b5' : '#2e6c43',
    'color-scheme': dark ? 'dark' : 'light',
  }
})

export function useBuilderAppearance() {
  if (!initialized) {
    initialized = true
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) ?? '{}')
      if (stored && typeof stored === 'object') {
        if (['parchment', 'dark', 'light', 'obsidian'].includes(stored.theme)) settings.theme = stored.theme
        if (Object.keys(accents).includes(stored.accent)) settings.accent = stored.accent
        if (['comfortable', 'large'].includes(stored.textSize)) settings.textSize = stored.textSize
        if (['subtle', 'immersive'].includes(stored.coverage)) settings.coverage = stored.coverage
        if (typeof stored.customAccent === 'string' && /^#[0-9a-f]{6}$/i.test(stored.customAccent)) settings.customAccent = stored.customAccent
      }
    } catch { /* Appearance must never prevent opening a character. */ }
    watch(settings, () => { try { localStorage.setItem(storageKey, JSON.stringify(settings)) } catch { /* Keep this session usable without storage. */ } }, { deep: true })
  }
  return { appearance: settings, appearanceStyle, appearanceOpen, accentColor: computed(() => settings.customAccent || accents[settings.accent]), resetAppearance: () => Object.assign(settings, defaults) }
}
