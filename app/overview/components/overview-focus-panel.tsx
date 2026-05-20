'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ClipboardList, Clock, TrendingDown, CalendarCheck, CheckCircle2, Loader2 } from 'lucide-react'
import { SectionCard } from '@/app/_components/section-card'
import { analytics, schedule, type ScheduleEntry } from '@/lib/api'

interface DashStats {
  total_students: number
  classes_this_week: number
  pending_assignments: number
  attendance_rate: number
}

interface FocusItem {
  title: string
  detail: string
  accent: string
  icon: React.ReactNode
  href?: string
}

function toAmPm(t: string): string {
  const [hStr, mStr] = t.split(':')
  const h = parseInt(hStr, 10)
  const m = parseInt(mStr, 10)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

function findUpcoming(slots: ScheduleEntry[]): ScheduleEntry | null {
  const now = new Date()
  const nowMins = now.getHours() * 60 + now.getMinutes()
  return slots.find((s) => {
    const [h, m] = s.start_time.split(':').map(Number)
    return h * 60 + m >= nowMins
  }) ?? null
}

export function OverviewFocusPanel() {
  const router = useRouter()
  const [items, setItems] = useState<FocusItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      analytics.dashboard() as Promise<DashStats>,
      schedule.weekly() as Promise<ScheduleEntry[]>,
    ])
      .then(([stats, weeklySlots]) => {
        const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' })
        const todaySlots = weeklySlots
          .filter((s) => s.day_of_week === todayName)
          .sort((a, b) => a.start_time.localeCompare(b.start_time))

        const built: FocusItem[] = []

        // Pending submissions that need grading
        if (stats.pending_assignments > 0) {
          built.push({
            title: 'Submissions need grading',
            detail: `${stats.pending_assignments} assignment submission${stats.pending_assignments !== 1 ? 's' : ''} waiting for your review.`,
            accent: 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30',
            icon: <ClipboardList className="h-4 w-4 text-blue-600 dark:text-blue-400" />,
            href: '/class-preparation',
          })
        }

        // Today's classes — show the next upcoming one
        if (todaySlots.length > 0) {
          const next = findUpcoming(todaySlots)
          const timeLabel = next
            ? `Next up at ${toAmPm(next.start_time)}${next.room ? ` in ${next.room}` : ''}${next.class_name ? ` — ${next.class_name}` : ''}.`
            : 'All classes for today are done.'
          built.push({
            title: `${todaySlots.length} class${todaySlots.length !== 1 ? 'es' : ''} today`,
            detail: `${timeLabel} Go to Schedule to start a session.`,
            accent: 'border-violet-200 bg-violet-50 dark:border-violet-800 dark:bg-violet-950/30',
            icon: <Clock className="h-4 w-4 text-violet-600 dark:text-violet-400" />,
            href: '/schedule',
          })
        }

        // Low attendance warning
        if (stats.attendance_rate > 0 && stats.attendance_rate < 75) {
          built.push({
            title: 'Attendance is low',
            detail: `Overall rate is ${stats.attendance_rate}%. Consider following up with absent students.`,
            accent: 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30',
            icon: <TrendingDown className="h-4 w-4 text-amber-600 dark:text-amber-400" />,
            href: '/attendance',
          })
        }

        // Classes this week stat
        if (stats.classes_this_week > 0 && built.length < 2) {
          built.push({
            title: `${stats.classes_this_week} class${stats.classes_this_week !== 1 ? 'es' : ''} this week`,
            detail: `You have ${stats.classes_this_week} scheduled session${stats.classes_this_week !== 1 ? 's' : ''} this week across all courses.`,
            accent: 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30',
            icon: <CalendarCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />,
            href: '/schedule',
          })
        }

        // All clear
        if (built.length === 0) {
          built.push({
            title: 'All caught up!',
            detail: 'No pending submissions, no classes today, and attendance is on track.',
            accent: 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30',
            icon: <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />,
          })
        }

        setItems(built)
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <SectionCard
      title="Focus"
      subtitle="What needs your attention right now."
      contentClassName="pt-0"
    >
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.title}
              onClick={() => item.href && router.push(item.href)}
              className={`flex items-start gap-3 rounded-2xl border p-4 transition-colors ${item.accent} ${item.href ? 'cursor-pointer hover:brightness-95' : ''}`}
            >
              <div className="mt-0.5 shrink-0">{item.icon}</div>
              <div>
                <p className="text-sm font-medium">{item.title}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{item.detail}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  )
}
