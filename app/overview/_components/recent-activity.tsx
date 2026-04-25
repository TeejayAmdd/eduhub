'use client'

import { SectionCard } from '@/_components/section-card'
import { EmptyState } from '@/_components/empty-state'
import { Button } from '@/components/ui/button'
import { Clock, User, BookOpen, CheckCircle2 } from 'lucide-react'

interface Activity {
  id: string
  type: 'assignment' | 'attendance' | 'exam' | 'announcement'
  title: string
  description: string
  user: string
  timestamp: string
  icon: React.ReactNode
}

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
          icon={Clock}
        />
      </SectionCard>
    )
  }

  return (
    <SectionCard title="Recent Activity">
      <div className="space-y-4">
        {activities.map((activity) => (
          <div
            key={activity.id}
            className="flex gap-4 pb-4 border-b border-border last:border-b-0 last:pb-0"
          >
            <div className="flex-shrink-0 mt-1">{activity.icon}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-sm">{activity.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {activity.description}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    by {activity.user} · {activity.timestamp}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  )
}
