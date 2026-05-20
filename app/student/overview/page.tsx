'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertCircle, ArrowRight, BarChart3, BookOpen, CalendarCheck,
  CalendarDays, CheckCircle2, ClipboardList, Clock, FileText, TrendingUp,
  Sparkles, GraduationCap, Calendar,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SectionCard } from '@/app/_components/section-card'
import { PageContainer } from '@/app/_components/page-container'
import { cn } from '@/lib/utils'
import {
  analytics, assignments, schedule, getCurrentUser,
  type Assignment, type StudentAnalytics, type ScheduleEntry,
} from '@/lib/api'

// ── Helpers ───────────────────────────────────────────────────────────────────

function toAmPm(t: string): string {
  const [hStr, mStr] = t.split(':')
  const h = parseInt(hStr, 10)
  const m = parseInt(mStr, 10)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

function findNextSlot(slots: ScheduleEntry[], now: Date): ScheduleEntry | null {
  const nowMins = now.getHours() * 60 + now.getMinutes()
  return slots.find((s) => {
    const [h, m] = s.start_time.split(':').map(Number)
    return h * 60 + m >= nowMins
  }) ?? null
}

function daysFromNow(dateStr: string): number {
  const diff = new Date(dateStr).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)
  return Math.ceil(diff / 86400000)
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function StudentOverviewPage() {
  const router = useRouter()
  const [now, setNow]               = useState(new Date())
  const [userName, setUserName]     = useState('there')
  const [studentData, setStudentData] = useState<StudentAnalytics | null>(null)
  const [todaySlots, setTodaySlots] = useState<ScheduleEntry[]>([])
  const [pending, setPending]       = useState<Assignment[]>([])

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const user = getCurrentUser()
    if (user && (user as { name?: string }).name) {
      setUserName((user as { name?: string }).name!.split(' ')[0])
    }
  }, [])

  useEffect(() => {
    analytics.student().then(setStudentData).catch(() => {})

    schedule.weekly().then((entries) => {
      const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' })
      setTodaySlots(
        entries
          .filter((e) => e.day_of_week === todayName)
          .sort((a, b) => a.start_time.localeCompare(b.start_time))
      )
    }).catch(() => {})

    assignments.list().then((list) => {
      setPending(
        list
          .filter((a) => !a.submitted && new Date(a.due_date) >= new Date())
          .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
      )
    }).catch(() => {})
  }, [])

  // Derived — recomputed every second
  const nextSlot       = findNextSlot(todaySlots, now)
  const nextClassTime  = nextSlot ? toAmPm(nextSlot.start_time) : null
  const nextClassName  = nextSlot?.class_name ?? null
  const attendanceRate = studentData?.attendance_rate ?? 0
  const pendingCount   = pending.length
  const enrolledCount  = studentData?.enrolled_courses ?? 0

  const dayName = now.toLocaleDateString('en-US', { weekday: 'long' })
  const timeStr = now.toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true,
  })
  const dateStr = now.toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })

  // Focus items
  const focusItems: {
    title: string; detail: string
    accent: string; iconBg: string; icon: React.ReactNode; href?: string
  }[] = []

  if (pendingCount > 0) {
    const next = pending[0]
    const days = daysFromNow(next.due_date)
    const courseHint = next.class_name ? ` · ${next.class_name}` : ''
    focusItems.push({
      title: `${pendingCount} assignment${pendingCount > 1 ? 's' : ''} pending`,
      detail: `"${next.title}"${courseHint} — ${days === 0 ? 'due today' : days === 1 ? 'due tomorrow' : `due in ${days} days`}.`,
      accent: 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30',
      iconBg: 'bg-blue-100 dark:bg-blue-900/40',
      icon: <ClipboardList className="h-4 w-4 text-blue-600 dark:text-blue-400" />,
      href: '/student/assignments',
    })
  }

  if (attendanceRate > 0 && attendanceRate < 75) {
    focusItems.push({
      title: 'Attendance needs attention',
      detail: `Your rate is ${attendanceRate}%. Attend more sessions to avoid academic penalties.`,
      accent: 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30',
      iconBg: 'bg-amber-100 dark:bg-amber-900/40',
      icon: <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />,
      href: '/student/attendance',
    })
  }

  if (nextSlot && focusItems.length < 3) {
    focusItems.push({
      title: `Class at ${nextClassTime}`,
      detail: `${nextClassName ?? 'Upcoming class'}${nextSlot.room ? ` · ${nextSlot.room}` : ''}.`,
      accent: 'border-violet-200 bg-violet-50 dark:border-violet-800 dark:bg-violet-950/30',
      iconBg: 'bg-violet-100 dark:bg-violet-900/40',
      icon: <Clock className="h-4 w-4 text-violet-600 dark:text-violet-400" />,
      href: '/student/schedule',
    })
  }

  if (focusItems.length === 0) {
    focusItems.push({
      title: "You're all caught up!",
      detail: 'No pending assignments and attendance is on track. Keep it up!',
      accent: 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30',
      iconBg: 'bg-emerald-100 dark:bg-emerald-900/40',
      icon: <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />,
    })
  }

  return (
    <PageContainer>
      <div className="space-y-6">

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary/90 to-primary/60 shadow-xl">
          {/* decorative circles */}
          <div className="absolute -top-16 -right-16 h-64 w-64 rounded-full bg-white/5" />
          <div className="absolute -bottom-12 -left-12 h-48 w-48 rounded-full bg-white/5" />
          <div className="absolute top-1/2 right-1/4 h-32 w-32 rounded-full bg-white/5" />

          <div className="relative grid gap-6 p-7 lg:grid-cols-[1.5fr_1fr] lg:items-center">

            {/* Left */}
            <div className="space-y-5 text-primary-foreground">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 backdrop-blur-sm px-3 py-1 text-xs font-semibold">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-60" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                  </span>
                  Live
                </span>
                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-mono tabular-nums">
                  {dayName}, {timeStr}
                </span>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-primary-foreground/70">
                  {dateStr}
                </span>
              </div>

              <div>
                <h1 className="text-3xl font-bold leading-tight md:text-4xl">
                  Welcome back, {userName}
                  <Sparkles className="inline ml-2 h-6 w-6 opacity-70" />
                </h1>
                <p className="mt-2 text-sm text-primary-foreground/70 max-w-lg">
                  Your academic day at a glance — classes, assignments, and progress in one place.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  className="rounded-full bg-white text-primary hover:bg-white/90 font-semibold shadow"
                  onClick={() => router.push('/student/courses')}
                >
                  My Courses
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  className="rounded-full border-white/30 bg-white/10 text-white hover:bg-white/20"
                  onClick={() => router.push('/student/assignments')}
                >
                  Assignments
                </Button>
              </div>
            </div>

            {/* Right — highlight tiles */}
            <div className="grid grid-cols-3 gap-3 lg:grid-cols-1">
              {[
                {
                  label: 'Next Class',
                  value: nextClassTime ?? '—',
                  detail: nextClassName ?? (todaySlots.length > 0 ? 'All done' : 'None today'),
                  icon: CalendarDays,
                  color: 'bg-white/15',
                },
                {
                  label: 'Assignments',
                  value: String(pendingCount),
                  detail: pendingCount === 0 ? 'All clear' : `${pendingCount} due soon`,
                  icon: FileText,
                  color: pendingCount > 0 ? 'bg-amber-400/20' : 'bg-white/15',
                },
                {
                  label: 'Attendance',
                  value: `${attendanceRate}%`,
                  detail: attendanceRate === 0 ? 'No data' : attendanceRate >= 75 ? 'On track' : 'Needs work',
                  icon: TrendingUp,
                  color: attendanceRate < 75 && attendanceRate > 0 ? 'bg-red-400/20' : 'bg-white/15',
                },
              ].map(({ label, value, detail, icon: Icon, color }) => (
                <div key={label} className={cn('rounded-2xl p-4 backdrop-blur-sm', color)}>
                  <Icon className="h-4 w-4 text-white/70 mb-2" />
                  <p className="text-[10px] font-medium uppercase tracking-wide text-white/60">{label}</p>
                  <p className="mt-1 text-xl font-bold text-white">{value}</p>
                  <p className="mt-0.5 text-[11px] text-white/60 truncate">{detail}</p>
                </div>
              ))}
            </div>

          </div>
        </div>

        {/* ── Stats row ────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: 'Enrolled Courses',
              value: studentData ? String(enrolledCount) : '—',
              icon: GraduationCap,
              color: 'text-blue-600 dark:text-blue-400',
              bg: 'bg-blue-50 dark:bg-blue-950/40',
              progress: null,
            },
            {
              label: "Today's Classes",
              value: String(todaySlots.length),
              icon: CalendarCheck,
              color: 'text-violet-600 dark:text-violet-400',
              bg: 'bg-violet-50 dark:bg-violet-950/40',
              progress: null,
            },
            {
              label: 'Pending Assignments',
              value: studentData ? String(pendingCount) : '—',
              icon: ClipboardList,
              color: pendingCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400',
              bg: pendingCount > 0 ? 'bg-amber-50 dark:bg-amber-950/40' : 'bg-green-50 dark:bg-green-950/40',
              progress: null,
            },
            {
              label: 'Attendance Rate',
              value: studentData ? `${attendanceRate}%` : '—',
              icon: TrendingUp,
              color: attendanceRate >= 75 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400',
              bg: attendanceRate >= 75 ? 'bg-emerald-50 dark:bg-emerald-950/40' : 'bg-red-50 dark:bg-red-950/40',
              progress: attendanceRate,
            },
          ].map(({ label, value, icon: Icon, color, bg, progress }) => (
            <div key={label} className="rounded-2xl border bg-background p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', bg)}>
                  <Icon className={cn('h-5 w-5', color)} />
                </div>
              </div>
              <div>
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              </div>
              {progress !== null && progress > 0 && (
                <div className="space-y-1">
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', progress >= 75 ? 'bg-emerald-500' : progress >= 50 ? 'bg-amber-400' : 'bg-red-500')}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* ── Quick actions + Focus panel ───────────────────────────────────── */}
        <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">

          <SectionCard
            title="Quick Access"
            subtitle="Jump straight to what matters."
            contentClassName="pt-0"
          >
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'My Courses',   icon: BookOpen,    href: '/student/courses',     desc: 'Enrolled classes',   color: 'border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-400' },
                { label: 'Assignments',  icon: FileText,    href: '/student/assignments',  desc: `${pendingCount} pending`, color: 'border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400' },
                { label: 'My Schedule',  icon: CalendarDays, href: '/student/schedule',    desc: `${todaySlots.length} today`,  color: 'border-violet-200 bg-violet-50 text-violet-600 dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-400' },
                { label: 'Grades',       icon: BarChart3,   href: '/student/grades',       desc: 'View results',       color: 'border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400' },
              ].map(({ label, icon: Icon, href, desc, color }) => (
                <button
                  key={label}
                  onClick={() => router.push(href)}
                  className="group flex items-center gap-3 rounded-2xl border bg-background p-4 shadow-sm text-left transition-all hover:shadow-md hover:-translate-y-0.5"
                >
                  <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border', color)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{label}</p>
                    <p className="text-xs text-muted-foreground truncate">{desc}</p>
                  </div>
                  <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </button>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="Focus"
            subtitle="What needs attention now."
            contentClassName="pt-0"
          >
            <div className="space-y-2.5">
              {focusItems.map((item) => (
                <div
                  key={item.title}
                  onClick={() => item.href && router.push(item.href)}
                  className={cn(
                    'flex items-start gap-3 rounded-2xl border p-4 transition-all',
                    item.accent,
                    item.href ? 'cursor-pointer hover:shadow-sm hover:brightness-95' : ''
                  )}
                >
                  <div className={cn('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', item.iconBg)}>
                    {item.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-snug">{item.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground leading-snug">{item.detail}</p>
                  </div>
                  {item.href && <ArrowRight className="ml-auto mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                </div>
              ))}
            </div>
          </SectionCard>

        </div>

        {/* ── Pending assignments feed ──────────────────────────────────────── */}
        <SectionCard
          title="Upcoming Deadlines"
          subtitle="Assignments due soon — click any to submit."
          contentClassName="pt-0"
        >
          {pending.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 rounded-2xl border border-dashed text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 mb-3">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              </div>
              <p className="text-sm font-semibold">No pending assignments</p>
              <p className="text-xs text-muted-foreground mt-1">You're all caught up. Great work!</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {pending.slice(0, 5).map((a) => {
                const days = daysFromNow(a.due_date)
                const urgent = days <= 1
                const soon   = days <= 3
                return (
                  <div
                    key={a.id}
                    onClick={() => router.push(`/student/assignments/${a.id}`)}
                    className={cn(
                      'group flex items-center gap-4 rounded-2xl border-l-4 border border-border bg-background p-4 shadow-sm cursor-pointer',
                      'transition-all hover:shadow-md hover:-translate-y-0.5',
                      urgent ? 'border-l-amber-400' : soon ? 'border-l-blue-400' : 'border-l-primary/30'
                    )}
                  >
                    <div className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border',
                      urgent ? 'bg-amber-50 border-amber-100 text-amber-600 dark:bg-amber-950/30 dark:border-amber-800'
                             : 'bg-primary/5 border-primary/20 text-primary'
                    )}>
                      <ClipboardList className="w-4 h-4" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{a.title}</p>
                      {a.class_name && (
                        <p className="text-xs font-medium text-primary truncate flex items-center gap-1 mt-0.5">
                          <GraduationCap className="w-3 h-3 shrink-0" />{a.class_name}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                        <Calendar className="w-3 h-3 shrink-0" />
                        Due {new Date(a.due_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className={cn(
                        'rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                        days === 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                        : days === 1 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300'
                        : 'bg-muted text-muted-foreground'
                      )}>
                        {days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days}d`}
                      </span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                )
              })}
              {pending.length > 5 && (
                <button
                  onClick={() => router.push('/student/assignments')}
                  className="w-full rounded-2xl border border-dashed py-3 text-xs text-muted-foreground hover:text-foreground hover:border-border transition-colors"
                >
                  View {pending.length - 5} more assignment{pending.length - 5 !== 1 ? 's' : ''} →
                </button>
              )}
            </div>
          )}
        </SectionCard>

      </div>
    </PageContainer>
  )
}
