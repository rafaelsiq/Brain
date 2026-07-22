export type ThemeMode = 'light' | 'dark'

const STORAGE_KEY = 'brain.theme'

export function getStoredTheme(): ThemeMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === 'light' || raw === 'dark') return raw
  } catch {
    // ignore
  }
  return 'light'
}

export function storeTheme(mode: ThemeMode): void {
  localStorage.setItem(STORAGE_KEY, mode)
}

export function applyTheme(mode: ThemeMode): void {
  document.documentElement.dataset.theme = mode
  document.documentElement.style.colorScheme = mode
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    meta.setAttribute('content', mode === 'light' ? '#f7f8fa' : '#0e1114')
  }
}
