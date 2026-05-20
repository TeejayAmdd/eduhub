'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Menu, PanelLeft, LogOut, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { GlobalSearch } from '@/app/_components/global-search'
import { NotificationDropdown } from '@/app/_components/notification-dropdown'
import { getCurrentUser } from '@/lib/api'

interface StudentHeaderProps {
  onToggleSidebar: () => void
  onOpenMobileSidebar: () => void
}

export function StudentHeader({ onToggleSidebar, onOpenMobileSidebar }: StudentHeaderProps) {
  const router = useRouter()
  const [userName, setUserName] = useState('Student')
  const [initials, setInitials] = useState('ST')

  useEffect(() => {
    const decoded = getCurrentUser()
    if (decoded && (decoded as { name?: string }).name) {
      const name = (decoded as { name?: string }).name!
      setUserName(name)
      const parts = name.split(' ')
      setInitials(parts.map((p) => p[0]).join('').slice(0, 2).toUpperCase())
    }
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('role')
    localStorage.removeItem('userId')
    router.push('/login')
  }

  return (
    <header className="border-b border-border bg-card">
      <div className="flex items-center justify-between px-4 sm:px-6 py-3">
        {/* Left — sidebar toggles + search */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden shrink-0"
            onClick={onOpenMobileSidebar}
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="hidden md:inline-flex shrink-0"
            onClick={onToggleSidebar}
            aria-label="Toggle sidebar"
          >
            <PanelLeft className="w-5 h-5" />
          </Button>

          <GlobalSearch placeholder="Search courses, assignments, exams…" />
        </div>

        {/* Right — notifications + user */}
        <div className="flex items-center gap-2 ml-3 shrink-0">
          <NotificationDropdown />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2 px-2 h-9">
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                </Avatar>
                <span className="hidden sm:block text-sm font-medium max-w-[120px] truncate">
                  {userName}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground hidden sm:block" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => router.push('/student/settings')}>
                Profile & Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                <LogOut className="w-4 h-4 mr-2" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
