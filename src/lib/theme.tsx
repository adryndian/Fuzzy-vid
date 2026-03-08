import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'

interface ThemeCtxType {
  isDark: boolean
  toggle: () => void
}

const ThemeCtx = createContext<ThemeCtxType>({ isDark: false, toggle: () => {} })

const lightVars = `
  --page-bg: linear-gradient(145deg, #f2f2f7 0%, #e5e5ea 50%, #f2f2f7 100%);
  --card-bg: rgba(255,255,255,0.75);
  --card-border: 0.5px solid rgba(255,255,255,0.9);
  --card-shadow: 0 4px 40px rgba(0,0,0,0.08), 0 0 0 0.5px rgba(255,255,255,0.5) inset;
  --text-primary: #1d1d1f;
  --text-secondary: rgba(60,60,67,0.6);
  --text-tertiary: rgba(60,60,67,0.3);
  --input-bg: rgba(118,118,128,0.1);
  --input-border: 1px solid rgba(118,118,128,0.2);
  --nav-bg: rgba(242,242,247,0.94);
  --nav-border: 0.5px solid rgba(0,0,0,0.1);
  --header-bg: rgba(242,242,247,0.92);
  --pill-inactive: rgba(118,118,128,0.12);
  --section-bg: rgba(118,118,128,0.07);
  --label-color: rgba(60,60,67,0.6);
`

const darkVars = `
  --page-bg: linear-gradient(145deg, #1c1c1e 0%, #2c2c2e 60%, #1c1c1e 100%);
  --card-bg: rgba(44,44,46,0.92);
  --card-border: 0.5px solid rgba(255,255,255,0.1);
  --card-shadow: 0 4px 40px rgba(0,0,0,0.45), 0 0 0 0.5px rgba(255,255,255,0.06) inset;
  --text-primary: #f2f2f7;
  --text-secondary: rgba(235,235,245,0.6);
  --text-tertiary: rgba(235,235,245,0.3);
  --input-bg: rgba(118,118,128,0.28);
  --input-border: 1px solid rgba(118,118,128,0.4);
  --nav-bg: rgba(22,22,24,0.97);
  --nav-border: 0.5px solid rgba(255,255,255,0.1);
  --header-bg: rgba(22,22,24,0.97);
  --pill-inactive: rgba(255,255,255,0.07);
  --section-bg: rgba(255,255,255,0.04);
  --label-color: rgba(235,235,245,0.5);
`

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

  useEffect(() => {
    document.documentElement.style.cssText = isDark ? darkVars : lightVars;
  }, [isDark])

  return <ThemeCtx.Provider value={{ isDark, toggle }}>{children}</ThemeCtx.Provider>
}

export const useTheme = () => useContext(ThemeCtx)

const CONSTANT_TOKENS = {
  pageBg: 'var(--page-bg)',
  cardBg: 'var(--card-bg)',
  cardBorder: 'var(--card-border)',
  cardShadow: 'var(--card-shadow)',
  textPrimary: 'var(--text-primary)',
  textSecondary: 'var(--text-secondary)',
  textTertiary: 'var(--text-tertiary)',
  inputBg: 'var(--input-bg)',
  inputBorder: 'var(--input-border)',
  navBg: 'var(--nav-bg)',
  navBorder: 'var(--nav-border)',
  headerBg: 'var(--header-bg)',
  pillInactive: 'var(--pill-inactive)',
  sectionBg: 'var(--section-bg)',
  labelColor: 'var(--label-color)',
}

// Theme token helper — now decoupled from render cycle using CSS variables
export function tk(_isDark: boolean) {
  return CONSTANT_TOKENS
}
