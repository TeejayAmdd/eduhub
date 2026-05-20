'use client'

import { useEffect, useState } from 'react'
import { EmptyState } from '@/app/_components/empty-state'
import { SectionCard } from '@/app/_components/section-card'
import { Badge } from '@/components/ui/badge'
import { Clock, BookOpen, CheckCircle2, Bell } from 'lucide-react'
import { cn } from '@/lib/utils'
import { assignments, type Assignment } from '@/lib/api'

const typeStyles = {
  assignment: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  attendance: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  exam: 'bg-violet-500/10 text-violet-700 dark:text-violet-400',
  announcement: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
} as const

type ActivityType = keyof typeof typeStyles

interface Activity {
  id: string
  type: ActivityType
  title: string
  description: string
  timestamp: string
  icon: React.ReactNode
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function RecentActivity() {
  const [activities, setActivities] = useState<Activity[]>([])

  useEffect(() => {
    assignments.list().then((list: Assignment[]) => {
      const items: Activity[] = list.slice(0, 5).map((a) => ({
        id: String(a.id),
        type: 'assignment' as ActivityType,
        title: a.title,
        description: `Due ${new Date(a.due_date).toLocaleDateString()}`,
        timestamp: timeAgo(a.created_at),
        icon: <BookOpen className="w-4 h-4 text-blue-500" />,
      }))
      setActivities(items)
    }).catch(() => {})
  }, [])

  if (activities.length === 0) {
    return (
      <SectionCard title="Recent Activity" subtitle="The latest updates from classes, assignments, and alerts.">
        <EmptyState
          title="No recent activity"
          description="Activity will appear here once you create classes, assignments, and mark attendance."
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
                  <p className="mt-1 text-sm text-muted-foreground">{activity.description}</p>
                </div>
                <Badge variant="outline" className="rounded-full text-[10px] uppercase tracking-wide">
                  {activity.type}
                </Badge>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">{activity.timestamp}</p>
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  )
}
