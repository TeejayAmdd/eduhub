'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3,
  BookOpen,
  Calendar,
  CheckSquare,
  FileText,
  MessageSquare,
  Settings,
  Users,
  Home,
  ClipboardList,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navigationItems = [
  { name: 'Overview', href: '/overview', icon: Home },
  { name: 'Class Preparation', href: '/class-preparation', icon: BookOpen },
  { name: 'Attendance', href: '/attendance', icon: Users },
  { name: 'Exams', href: '/exams', icon: CheckSquare },
  { name: 'Assignment Management', href: '/assignments', icon: FileText },
  { name: 'Schedule', href: '/schedule', icon: Calendar },
  { name: 'Students', href: '/students', icon: Users },
  { name: 'Messages', href: '/messages', icon: MessageSquare },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Reports', href: '/reports', icon: ClipboardList },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-64 border-r border-border bg-sidebar text-sidebar-foreground">
      <div className="flex flex-col h-screen">
        {/* Logo/Brand */}
        <div className="px-6 py-8 border-b border-sidebar-border">
          <h1 className="text-xl font-semibold">EduHub</h1>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-2">
            {navigationItems.map((item) => {
              const isActive = pathname === item.href
              const Icon = item.icon

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.name}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      </div>
    </aside>
  )
}
