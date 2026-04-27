'use client'
import { EmptyState } from '@/app/_components/empty-state'
import { SectionCard } from '@/app/_components/section-card'
import { Badge } from '@/components/ui/badge'
import { Clock, User, BookOpen, CheckCircle2, Bell } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Activity {
  id: string
  type: 'assignment' | 'attendance' | 'exam' | 'announcement'
  title: string
  description: string
  user: string
  timestamp: string
  icon: React.ReactNode
}

const typeStyles = {
  assignment: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  attendance: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  exam: 'bg-violet-500/10 text-violet-700 dark:text-violet-400',
  announcement: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
} as const

export function RecentActivity() {
  const activities: Activity[] = [
    {
      id: '1',
      type: 'assignment',
      title: 'Math Assignment Submitted',
      description: 'Sarah submitted the calculus homework',
      user: 'Sarah Johnson',
      timestamp: '2 hours ago',
      icon: <BookOpen className="w-4 h-4 text-blue-500" />,
    },
    {
      id: '2',
      type: 'attendance',
      title: 'Attendance Marked',
      description: '28 out of 30 students present in Class 10A',
      user: 'System',
      timestamp: '4 hours ago',
      icon: <CheckCircle2 className="w-4 h-4 text-green-500" />,
    },
    {
      id: '3',
      type: 'exam',
      title: 'Exam Results Published',
      description: 'Biology midterm results are now available',
      user: 'Admin',
      timestamp: '1 day ago',
      icon: <Clock className="w-4 h-4 text-purple-500" />,
    },
    {
      id: '4',
      type: 'announcement',
      title: 'New Class Schedule',
      description: 'Updated schedule for next semester posted',
      user: 'Coordinator',
      timestamp: '2 days ago',
      icon: <User className="w-4 h-4 text-orange-500" />,
    },
  ]

  if (activities.length === 0) {
    return (
      <SectionCard title="Recent Activity">
        <EmptyState
          title="No recent activity"
          description="Activity updates will appear here"
          icon={<Clock className="w-4 h-4" />}
        />
      </SectionCard>
    )
  }

  return (
    <SectionCard
      title="Recent Activity"
      subtitle="The latest updates from classes, assignments, and alerts."
      contentClassName="pt-0"
    >
      <div className="space-y-3">
        {activities.map((activity) => (
          <div
            key={activity.id}
            className="flex gap-4 rounded-2xl border border-border bg-background p-4 shadow-sm"
          >
            <div
              className={cn(
                'flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl border',
                typeStyles[activity.type],
              )}
            >
              {activity.icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{activity.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {activity.description}
                  </p>
                </div>
                <Badge variant="outline" className="rounded-full text-[10px] uppercase tracking-wide">
                  {activity.type}
                </Badge>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                by {activity.user} · {activity.timestamp}
              </p>
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  )
}
