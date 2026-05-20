'use client'

import { useEffect, useState } from 'react'
import {
  CheckCircle2, XCircle, BookOpen, AlertCircle, Loader2, TrendingUp,
  Radio, Cookie,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageContainer } from '@/app/_components/page-container'
import { PageHeader } from '@/app/_components/page-header'
import { cn } from '@/lib/utils'
import { analytics, sessions, type StudentAnalytics, type StudentSessionHistory } from '@/lib/api'

function statusLabel(rate: number) {
  if (rate >= 75) return { text: 'Good',  cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' }
  if (rate >= 50) return { text: 'Fair',  cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' }
  return           { text: 'Poor',  cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' }
}

const liveStatusCfg: Record<string, { label: string; color: string }> = {
  present: { label: 'Present', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  partial: { label: 'Partial', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  absent:  { label: 'Absent',  color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
}

function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className="h-2 rounded-full bg-muted overflow-hidden">
      <div
        className={cn('h-full rounded-full transition-all', className)}
        style={{ width: `${Math.min(value, 100)}%` }}
      />
    </div>
  )
}

export default function StudentAttendancePage() {
  const [data, setData] = useState<StudentAnalytics | null>(null)
  const [history, setHistory] = useState<StudentSessionHistory[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      analytics.student(),
      sessions.myHistory(),
    ])
      .then(([analyticsData, historyData]) => {
        setData(analyticsData)
        setHistory(historyData)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <PageContainer>
        <PageHeader title="Attendance" description="Your attendance records across all enrolled courses" />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </PageContainer>
    )
  }

  const overall = data?.attendance_rate ?? 0
  const attended = data?.classes_attended ?? 0
  const total = data?.total_classes ?? 0
  const missed = total - attended
  const overallStatus = statusLabel(overall)

  return (
    <PageContainer>
      <PageHeader title="Attendance" description="Your attendance records across all enrolled courses" />

      <div className="space-y-8">

        {/* ── Overall summary ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{overall}%</p>
                <p className="text-xs text-muted-foreground">Overall Rate</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-green-50 dark:bg-green-950/40">
                <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{attended}</p>
                <p className="text-xs text-muted-foreground">Classes Attended</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-50 dark:bg-red-950/40">
                <XCircle className="w-6 h-6 text-red-500 dark:text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{missed}</p>
                <p className="text-xs text-muted-foreground">Classes Missed</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Cumulative progress bar ───────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center justify-between">
              <span>Cumulative Attendance</span>
              <Badge className={cn('text-xs font-semibold', overallStatus.cls)}>
                {overallStatus.text}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ProgressBar
              value={overall}
              className={overall >= 75 ? 'bg-green-500' : overall >= 50 ? 'bg-amber-400' : 'bg-red-500'}
            />
            <p className="text-sm text-muted-foreground">
              {attended} attended out of {total} total classes across{' '}
              {data?.enrolled_courses ?? 0} enrolled course{(data?.enrolled_courses ?? 0) !== 1 ? 's' : ''}.
            </p>
            {overall < 75 && (
              <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Your overall attendance is below 75%. Try to attend more classes to avoid penalties.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Per-course breakdown ──────────────────────────────────────────── */}
        <div>
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" />
            Attendance by Course
          </h2>

          {!data || data.class_stats.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No attendance records yet. Enroll in courses to see your records here.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {data.class_stats.map((cs) => {
                const st = statusLabel(cs.attendance_rate)
                const barColor =
                  cs.attendance_rate >= 75 ? 'bg-green-500' :
                  cs.attendance_rate >= 50 ? 'bg-amber-400' : 'bg-red-500'
                const missedCount = cs.total_classes - cs.classes_attended

                return (
                  <Card key={cs.class_id} className="flex flex-col">
                    <CardContent className="p-5 flex flex-col gap-4 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                          <BookOpen className="w-5 h-5 text-primary" />
                        </div>
                        <Badge className={cn('text-xs font-semibold shrink-0', st.cls)}>{st.text}</Badge>
                      </div>
                      <div>
                        <p className="font-semibold text-sm leading-snug">{cs.class_name}</p>
                        {cs.course_code && (
                          <p className="text-xs text-muted-foreground mt-0.5">{cs.course_code}</p>
                        )}
                      </div>
                      <div className="space-y-1.5 mt-auto">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Attendance rate</span>
                          <span className="font-semibold">{cs.attendance_rate}%</span>
                        </div>
                        <ProgressBar value={cs.attendance_rate} className={barColor} />
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-lg bg-muted/60 px-2 py-2">
                          <p className="text-base font-bold text-green-600">{cs.classes_attended}</p>
                          <p className="text-[10px] text-muted-foreground">Attended</p>
                        </div>
                        <div className="rounded-lg bg-muted/60 px-2 py-2">
                          <p className="text-base font-bold text-red-500">{missedCount}</p>
                          <p className="text-[10px] text-muted-foreground">Missed</p>
                        </div>
                        <div className="rounded-lg bg-muted/60 px-2 py-2">
                          <p className="text-base font-bold">{cs.total_classes}</p>
                          <p className="text-[10px] text-muted-foreground">Total</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Live Session History ──────────────────────────────────────────── */}
        <div>
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Radio className="w-4 h-4 text-primary" />
            Live Session Attendance
          </h2>

          {history.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No live sessions yet. Join a live class to see your cookie attendance here.
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 text-xs text-muted-foreground">
                    <th className="text-left px-4 py-3 font-medium">Course</th>
                    <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Date</th>
                    <th className="text-center px-4 py-3 font-medium hidden sm:table-cell">
                      <span className="flex items-center justify-center gap-1">
                        <Cookie className="w-3.5 h-3.5" />Cookies
                      </span>
                    </th>
                    <th className="text-center px-4 py-3 font-medium">Score</th>
                    <th className="text-right px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h, i) => {
                    const sc = liveStatusCfg[h.status] ?? liveStatusCfg.absent
                    const dateStr = h.started_at
                      ? new Date(h.started_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                      : h.date
                        ? new Date(h.date + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                        : '—'

                    return (
                      <tr
                        key={h.session_id}
                        className={cn('border-t border-border/60', i % 2 !== 0 && 'bg-muted/20')}
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium leading-tight">{h.class_name}</p>
                          {h.course_code && (
                            <p className="text-xs text-muted-foreground">{h.course_code}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{dateStr}</td>
                        <td className="px-4 py-3 text-center hidden sm:table-cell">
                          <span className="font-medium">{h.cookies_clicked}</span>
                          <span className="text-muted-foreground"> / {h.total_cookies}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={cn(
                            'font-bold',
                            (h.score ?? 0) >= 70 ? 'text-green-600 dark:text-green-400'
                            : (h.score ?? 0) >= 30 ? 'text-amber-600 dark:text-amber-400'
                            : 'text-red-500 dark:text-red-400'
                          )}>
                            {h.score !== null ? `${h.score.toFixed(0)}%` : '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', sc.color)}>
                            {sc.label}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  )
}
