import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

interface ThemeCtxType {
  isDark: boolean
  toggle: () => void
}

const ThemeCtx = createContext<ThemeCtxType>({ isDark: false, toggle: () => {} })

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(() => {
    try { return localStorage.getItem('fuzzy_theme') === 'dark' } catch { return false }
  })
  const toggle = useCallback(() => {
    setIsDark(v => {
      const next = !v
      try { localStorage.setItem('fuzzy_theme', next ? 'dark' : 'light') } catch { /* ignore */ }
      return next
    })
  }, [])
  return <ThemeCtx.Provider value={{ isDark, toggle }}>{children}</ThemeCtx.Provider>
}

export const useTheme = () => useContext(ThemeCtx)

// Theme token helper — call once per render with isDark
export function tk(isDark: boolean) {
  return {
    pageBg: isDark
      ? 'linear-gradient(145deg, #1c1c1e 0%, #2c2c2e 60%, #1c1c1e 100%)'
      : 'linear-gradient(145deg, #f2f2f7 0%, #e5e5ea 50%, #f2f2f7 100%)',
    cardBg: isDark ? 'rgba(44,44,46,0.92)' : 'rgba(255,255,255,0.75)',
    cardBorder: isDark ? '0.5px solid rgba(255,255,255,0.1)' : '0.5px solid rgba(255,255,255,0.9)',
    cardShadow: isDark
      ? '0 4px 40px rgba(0,0,0,0.45), 0 0 0 0.5px rgba(255,255,255,0.06) inset'
      : '0 4px 40px rgba(0,0,0,0.08), 0 0 0 0.5px rgba(255,255,255,0.5) inset',
    textPrimary: isDark ? '#f2f2f7' : '#1d1d1f',
    textSecondary: isDark ? 'rgba(235,235,245,0.6)' : 'rgba(60,60,67,0.6)',
    textTertiary: isDark ? 'rgba(235,235,245,0.3)' : 'rgba(60,60,67,0.3)',
    inputBg: isDark ? 'rgba(118,118,128,0.28)' : 'rgba(118,118,128,0.1)',
    inputBorder: isDark ? '1px solid rgba(118,118,128,0.4)' : '1px solid rgba(118,118,128,0.2)',
    navBg: isDark ? 'rgba(22,22,24,0.97)' : 'rgba(242,242,247,0.94)',
    navBorder: isDark ? '0.5px solid rgba(255,255,255,0.1)' : '0.5px solid rgba(0,0,0,0.1)',
    headerBg: isDark ? 'rgba(22,22,24,0.97)' : 'rgba(242,242,247,0.92)',
    pillInactive: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(118,118,128,0.12)',
    sectionBg: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(118,118,128,0.07)',
    labelColor: isDark ? 'rgba(235,235,245,0.5)' : 'rgba(60,60,67,0.6)',
  }
}
