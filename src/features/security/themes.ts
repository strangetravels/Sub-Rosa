export type ThemeId = 'rose' | 'slate' | 'forest' | 'ink' | 'paper'

export type ThemeDefinition = {
  id: ThemeId
  label: string
  description: string
  /** Accent used for theme-color meta / PWA chrome. */
  themeColor: string
  /** Swatch colors shown in the theme picker (bg, surface, accent). */
  preview: [string, string, string]
}

export const THEMES: ThemeDefinition[] = [
  {
    id: 'rose',
    label: 'Rose',
    description: 'Dark stone with rose accent (default)',
    themeColor: '#1c1917',
    preview: ['#1c1917', '#292524', '#e11d48'],
  },
  {
    id: 'slate',
    label: 'Slate',
    description: 'Cool blue-gray with sky accent',
    themeColor: '#0f172a',
    preview: ['#0f172a', '#1e293b', '#0ea5e9'],
  },
  {
    id: 'forest',
    label: 'Forest',
    description: 'Deep green with emerald accent',
    themeColor: '#052e16',
    preview: ['#052e16', '#14532d', '#10b981'],
  },
  {
    id: 'ink',
    label: 'Ink',
    description: 'Near-black with amber accent',
    themeColor: '#0a0a0a',
    preview: ['#0a0a0a', '#171717', '#f59e0b'],
  },
  {
    id: 'paper',
    label: 'Paper',
    description: 'Light surfaces with ink accent',
    themeColor: '#f5f5f4',
    preview: ['#f5f5f4', '#ffffff', '#0f172a'],
  },
]

export const DEFAULT_THEME_ID: ThemeId = 'rose'

export function isThemeId(value: string): value is ThemeId {
  return THEMES.some((t) => t.id === value)
}

export function getTheme(id: ThemeId): ThemeDefinition {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]
}

export function applyThemeToDocument(themeId: ThemeId): void {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = themeId
  const theme = getTheme(themeId)
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', theme.themeColor)
}
