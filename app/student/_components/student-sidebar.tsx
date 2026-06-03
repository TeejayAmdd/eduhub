'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ArrowLeftRight,
  BarChart3,
  Bell,
  BookOpen,
  Calculator,
  Calendar,
  CheckSquare,
  FileText,
  Home,
  MessageSquare,
  PenSquare,
  Settings,
  Users,
  BookMarked,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const navigationItems = [
  { name: 'Overview', href: '/student/overview', icon: Home },
  { name: 'My Courses', href: '/student/courses', icon: BookOpen },
  { name: 'My Assignments', href: '/student/assignments', icon: FileText },
  { name: 'Attendance', href: '/student/attendance', icon: Users },
  { name: 'Schedule', href: '/student/schedule', icon: Calendar },
  { name: 'Grades & Exams', href: '/student/grades', icon: CheckSquare },
  { name: 'Quizzes & Tests', href: '/student/quizzes', icon: PenSquare },
  { name: 'CGPA Simulator', href: '/student/cgpa-simulator', icon: Calculator },
  { name: 'Doc Converter', href: '/student/converter', icon: ArrowLeftRight },
  { name: 'AI Study Assistant', href: '/student/ai-assistant', icon: Sparkles },
  { name: 'Study Hub', href: '/student/hub', icon: BookMarked },
  { name: 'Messages', href: '/student/messages', icon: MessageSquare },
  { name: 'Notifications', href: '/student/notifications', icon: Bell },
  { name: 'Analytics', href: '/student/analytics', icon: BarChart3 },
  { name: 'Settings', href: '/student/settings', icon: Settings },
]

interface StudentSidebarProps {
  isCollapsed: boolean
  isMobileOpen: boolean
  onMobileOpenChange: (open: boolean) => void
}

export function StudentSidebar({ isCollapsed, isMobileOpen, onMobileOpenChange }: StudentSidebarProps) {
  const pathname = usePathname()

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Fills the Dynamic Island / notch area with sidebar colour */}
      <div className="shrink-0 bg-sidebar" style={{ height: 'env(safe-area-inset-top, 0px)' }} />
      <div className={cn('border-b border-sidebar-border py-6', isCollapsed ? 'px-3' : 'px-6')}>
        <div className={cn('flex items-center gap-2.5', isCollapsed && 'justify-center')}>
          <img src="/cortex-icon.svg" alt="Cortex" className="h-8 w-8 shrink-0 rounded-lg dark:block hidden" />
          <img src="/cortex-icon-light.svg" alt="Cortex" className="h-8 w-8 shrink-0 rounded-lg dark:hidden block" />
          <div className={cn(isCollapsed && 'sr-only')}>
            <h1 className="text-lg font-bold leading-tight">Cortex</h1>
            <p className="text-[10px] text-sidebar-foreground/60 leading-none mt-0.5">Student Portal</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-4 py-4">
        <ul className="space-y-2">
          {navigationItems.map((item) => {
            const isActive = pathname === item.href
            const Icon = item.icon

            const linkClasses = cn(
              'flex items-center rounded-md text-sm font-medium transition-colors',
              isCollapsed ? 'justify-center px-2 py-2' : 'gap-3 px-3 py-2',
              isActive
                ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
            )

            const linkNode = (
              <Link
                href={item.href}
                className={linkClasses}
                onClick={() => onMobileOpenChange(false)}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className={cn(isCollapsed && 'sr-only')}>{item.name}</span>
              </Link>
            )

            return (
              <li key={item.href}>
                {isCollapsed ? (
                  <Tooltip>
                    <TooltipTrigger asChild>{linkNode}</TooltipTrigger>
                    <TooltipContent side="right" sideOffset={8}>
                      {item.name}
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  linkNode
                )}
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )

  return (
    <>
      <aside
        className={cn(
          'hidden h-[100dvh] border-r border-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 md:block',
          isCollapsed ? 'w-20' : 'w-64',
        )}
      >
        {sidebarContent}
      </aside>

      <Sheet open={isMobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetContent
          side="left"
          className="w-72 border-r border-sidebar-border bg-sidebar p-0 text-sidebar-foreground sm:max-w-none"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation Menu</SheetTitle>
            <SheetDescription>Mobile navigation for student pages.</SheetDescription>
          </SheetHeader>
          {sidebarContent}
        </SheetContent>
      </Sheet>
    </>
  )
}
