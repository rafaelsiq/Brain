import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'
import { applyTheme, getStoredTheme, storeTheme, type ThemeMode } from '@/lib/theme'

type ThemeContextValue = {
  theme: ThemeMode
  setTheme: (mode: ThemeMode) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

async function syncNativeChrome(mode: ThemeMode) {
  if (!Capacitor.isNativePlatform()) return
  try {
    await StatusBar.setStyle({ style: mode === 'light' ? Style.Dark : Style.Light })
    await StatusBar.setBackgroundColor({
      color: mode === 'light' ? '#f7f8fa' : '#0e1114',
    })
  } catch {
    // unsupported platform surface
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const initial = getStoredTheme()
    applyTheme(initial)
    return initial
  })

  const setTheme = useCallback((mode: ThemeMode) => {
    storeTheme(mode)
    applyTheme(mode)
    setThemeState(mode)
    void syncNativeChrome(mode)
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }, [setTheme, theme])

  useEffect(() => {
    applyTheme(theme)
    void syncNativeChrome(theme)
  }, [theme])

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
