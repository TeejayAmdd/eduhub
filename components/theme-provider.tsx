'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark' | 'system'

interface ThemeContextValue {
  theme: Theme
  setTheme: (t: Theme) => void
  resolvedTheme: 'light' | 'dark'
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'system',
  setTheme: () => {},
  resolvedTheme: 'light',
})

// Props mirror next-themes so callers don't need to change
export function ThemeProvider({
  children,
  defaultTheme = 'system',
}: {
  children: React.ReactNode
  defaultTheme?: Theme
  attribute?: string
  enableSystem?: boolean
  disableTransitionOnChange?: boolean
}) {
  const [theme, setThemeState]     = useState<Theme>(defaultTheme)
  const [resolvedTheme, setResolved] = useState<'light' | 'dark'>('light')

  // Hydrate from localStorage once on mount
  useEffect(() => {
    const stored = (localStorage.getItem('theme') as Theme) || defaultTheme
    setThemeState(stored)
  }, [defaultTheme])

  // Apply theme class + listen for system preference changes
  useEffect(() => {
    const apply = (t: Theme) => {
      const dark =
        t === 'dark' ||
        (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
      document.documentElement.classList.toggle('dark', dark)
      setResolved(dark ? 'dark' : 'light')
    }

    apply(theme)

    if (theme === 'system') {
      const mq      = window.matchMedia('(prefers-color-scheme: dark)')
      const handler = () => apply('system')
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    }
  }, [theme])

  const setTheme = (t: Theme) => {
    setThemeState(t)
    localStorage.setItem('theme', t)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

// Drop-in replacement for next-themes' useTheme
export function useTheme() {
  return useContext(ThemeContext)
}
