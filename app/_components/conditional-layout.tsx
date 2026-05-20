'use client'

import { usePathname } from 'next/navigation'
import { AppShell } from './app-shell'

export function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  if (
    pathname === '/' ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/forgot-password')
  ) {
    return <>{children}</>
  }

  if (pathname.startsWith('/student/') || pathname === '/student') {
    return <>{children}</>
  }

  if (pathname.startsWith('/live')) {
    return <>{children}</>
  }

  return <AppShell>{children}</AppShell>
}
