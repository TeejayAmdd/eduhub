'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser } from '@/lib/api'
import { StudentSidebar } from './student-sidebar'
import { StudentHeader } from './student-header'

interface StudentAppShellProps {
  children: React.ReactNode
}

export function StudentAppShell({ children }: StudentAppShellProps) {
  const router = useRouter()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    const user = getCurrentUser()
    if (!user) {
      router.replace('/login')
    } else if (user.role !== 'student') {
      router.replace('/class-preparation')
    } else {
      setAuthorized(true)
    }
  }, [router])

  if (!authorized) return null

  return (
    <div className="flex h-screen bg-background">
      <StudentSidebar
        isCollapsed={isCollapsed}
        isMobileOpen={isMobileOpen}
        onMobileOpenChange={setIsMobileOpen}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <StudentHeader
          onToggleSidebar={() => setIsCollapsed((prev) => !prev)}
          onOpenMobileSidebar={() => setIsMobileOpen(true)}
        />
        <main className="flex-1 overflow-y-auto flex flex-col">
          {children}
        </main>
      </div>
    </div>
  )
}
