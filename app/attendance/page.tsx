'use client'

import { useEffect, useState } from 'react'
import { PageContainer } from '@/app/_components/page-container'
import { PageHeader } from '@/app/_components/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  CheckCircle2, XCircle, Clock, Users, Loader2,
  Radio, ChevronDown, ChevronUp, Timer, CalendarDays,
} from 'lucide-react'
import {
  classes, sessions, attendance,
  type Class, type SessionSummary, type AttendanceResult, type ManualAttendanceDay,
} from '@/lib/api'
import { cn } from '@/lib/utils'

const liveStatusCfg: Record<string, { label: string; color: string }> = {
  present: { label: 'Present', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  partial: { label: 'Partial', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  absent:  { label: 'Absent',  color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
}

const manualStatusCfg: Record<string, { label: string; color: string }> = {
  present: { label: 'Present', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  late:    { label: 'Late',    color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  absent:  { label: 'Absent',  color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
}

export default function AttendancePage() {
  const [classList, setClassList] = useState<Class[]>([])
  const [classLoading, setClassLoading] = useState(true)
  const [selectedClass, setSelectedClass] = useState('')

  // Live sessions state
  const [sessionList, setSessionList] = useState<SessionSummary[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [expandedLiveId, setExpandedLiveId] = useState<number | null>(null)
  const [sessionAtt, setSessionAtt] = useState<Record<number, AttendanceResult[]>>({})
  const [loadingLiveId, setLoadingLiveId] = useState<number | null>(null)

  // Manual history state
  const [manualDays, setManualDays] = useState<ManualAttendanceDay[]>([])
  const [manualLoading, setManualLoading] = useState(false)
  const [expandedDateKey, setExpandedDateKey] = useState<string | null>(null)

  useEffect(() => {
    classes.list()
      .then(c => {
        setClassList(c)
        if (c.length > 0) setSelectedClass(String(c[0].id))
      })
      .catch(() => {})
      .finally(() => setClassLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedClass) return
    setExpandedLiveId(null)
    setExpandedDateKey(null)

    setSessionsLoading(true)
    setSessionList([])
    sessions.listForClass(Number(selectedClass))
      .then(setSessionList)
      .catch(() => setSessionList([]))
      .finally(() => setSessionsLoading(false))

    setManualLoading(true)
    setManualDays([])
    attendance.manualHistory(Number(selectedClass))
      .then(setManualDays)
      .catch(() => setManualDays([]))
      .finally(() => setManualLoading(false))
  }, [selectedClass])

  const toggleLive = async (id: number) => {
    if (expandedLiveId === id) { setExpandedLiveId(null); return }
    setExpandedLiveId(id)
    if (!sessionAtt[id]) {
      setLoadingLiveId(id)
      sessions.attendance(id)
        .then(data => setSessionAtt(prev => ({ ...prev, [id]: data })))
        .catch(() => setSessionAtt(prev => ({ ...prev, [id]: [] })))
        .finally(() => setLoadingLiveId(null))
    }
  }

  const toggleManual = (dateKey: string) => {
    setExpandedDateKey(prev => prev === dateKey ? null : dateKey)
  }

  if (classLoading) {
    return (
      <PageContainer>
        <PageHeader title="Attendance" description="Live session cookie attendance for your classes" />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <PageHeader title="Attendance" description="Live session cookie attendance for your classes" />

      {classList.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No classes yet</p>
          <p className="text-sm mt-1">Create a class first from Class Preparation.</p>
        </div>
      ) : (
        <div className="space-y-5 sm:space-y-8">
          <div className="w-full sm:w-72">
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger>
                <SelectValue placeholder="Select a class" />
              </SelectTrigger>
              <SelectContent>
                {classList.map(c => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}{c.course_code ? ` (${c.course_code})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* ── Live Sessions ──────────────────────────────────────────────── */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Radio className="w-4 h-4 text-primary" />
              Live Session Attendance
            </h2>

            {sessionsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <Loader2 className="w-4 h-4 animate-spin" />Loading sessions…
              </div>
            ) : sessionList.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center">
                  <Radio className="w-8 h-8 mx-auto mb-3 opacity-20" />
                  <p className="text-sm font-medium">No live sessions yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Start a live session from the dashboard to track cookie-based attendance.
                  </p>
                </CardContent>
              </Card>
            ) : (
              sessionList.map(s => {
                const date = new Date(s.started_at)
                const isOpen = expandedLiveId === s.id
                const rows = sessionAtt[s.id] ?? []

                return (
                  <Card key={s.id} className="overflow-hidden">
                    <button
                      className="w-full text-left p-4 hover:bg-muted/30 transition-colors"
                      onClick={() => toggleLive(s.id)}
                    >
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                            <Radio className="w-4 h-4 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-sm">
                              {date.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                            </p>
                            <p className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap mt-0.5">
                              <span>{date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                              {s.duration_mins !== null && (
                                <span className="flex items-center gap-1">
                                  <Timer className="w-3 h-3" />{s.duration_mins} min
                                </span>
                              )}
                              <span>{s.total_cookies} cookies · {s.total_students} students</span>
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-xs font-medium text-green-600 dark:text-green-400">
                            <CheckCircle2 className="w-3.5 h-3.5 inline mr-0.5" />{s.present_count}
                          </span>
                          <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                            ~ {s.partial_count}
                          </span>
                          <span className="text-xs font-medium text-red-500 dark:text-red-400">
                            <XCircle className="w-3.5 h-3.5 inline mr-0.5" />{s.absent_count}
                          </span>
                          {isOpen
                            ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                            : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                        </div>
                      </div>
                    </button>

                    {isOpen && (
                      <div className="border-t border-border">
                        {loadingLiveId === s.id ? (
                          <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                            <Loader2 className="w-4 h-4 animate-spin" />Loading breakdown…
                          </div>
                        ) : rows.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-6">No attendance data</p>
                        ) : (
                          <div className="p-4">
                            <div className="rounded-lg border overflow-hidden">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="bg-muted/40 text-xs text-muted-foreground">
                                    <th className="text-left px-3 py-2.5 font-medium">Student</th>
                                    <th className="text-center px-3 py-2.5 font-medium hidden sm:table-cell">Cookies clicked</th>
                                    <th className="text-center px-3 py-2.5 font-medium">Score</th>
                                    <th className="text-right px-3 py-2.5 font-medium">Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {rows.map((row, i) => {
                                    const sc = liveStatusCfg[row.status] ?? liveStatusCfg.absent
                                    return (
                                      <tr key={row.student_id} className={cn('border-t border-border/60', i % 2 !== 0 && 'bg-muted/20')}>
                                        <td className="px-3 py-2.5 font-medium">{row.name}</td>
                                        <td className="px-3 py-2.5 text-center text-muted-foreground hidden sm:table-cell">
                                          {row.cookies_clicked} / {row.total_cookies}
                                        </td>
                                        <td className="px-3 py-2.5 text-center font-semibold">{row.score.toFixed(0)}%</td>
                                        <td className="px-3 py-2.5 text-right">
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
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                )
              })
            )}
          </div>

          {/* ── Manual Records (read-only) ──────────────────────────────────── */}
          {(manualLoading || manualDays.length > 0) && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-muted-foreground" />
                <span>Previous Manual Records</span>
                <span className="text-xs font-normal text-muted-foreground">(read-only)</span>
              </h2>

              {manualLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                  <Loader2 className="w-4 h-4 animate-spin" />Loading records…
                </div>
              ) : (
                manualDays.map(day => {
                  const isOpen = expandedDateKey === day.date
                  const dateLabel = new Date(day.date + 'T00:00:00').toLocaleDateString('en-GB', {
                    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
                  })

                  return (
                    <Card key={day.date} className="overflow-hidden">
                      <button
                        className="w-full text-left p-4 hover:bg-muted/30 transition-colors"
                        onClick={() => toggleManual(day.date)}
                      >
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                              <CalendarDays className="w-4 h-4 text-muted-foreground" />
                            </div>
                            <div>
                              <p className="font-semibold text-sm">{dateLabel}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{day.total} students</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-xs font-medium text-green-600 dark:text-green-400">
                              <CheckCircle2 className="w-3.5 h-3.5 inline mr-0.5" />{day.present_count}
                            </span>
                            <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                              <Clock className="w-3.5 h-3.5 inline mr-0.5" />{day.late_count}
                            </span>
                            <span className="text-xs font-medium text-red-500 dark:text-red-400">
                              <XCircle className="w-3.5 h-3.5 inline mr-0.5" />{day.absent_count}
                            </span>
                            {isOpen
                              ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                              : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                          </div>
                        </div>
                      </button>

                      {isOpen && (
                        <div className="border-t border-border p-4">
                          <div className="rounded-lg border overflow-hidden">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="bg-muted/40 text-xs text-muted-foreground">
                                  <th className="text-left px-3 py-2.5 font-medium">Student</th>
                                  <th className="text-right px-3 py-2.5 font-medium">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {day.records.map((row, i) => {
                                  const sc = manualStatusCfg[row.status] ?? manualStatusCfg.absent
                                  return (
                                    <tr key={row.student_id} className={cn('border-t border-border/60', i % 2 !== 0 && 'bg-muted/20')}>
                                      <td className="px-3 py-2.5 font-medium">{row.name}</td>
                                      <td className="px-3 py-2.5 text-right">
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
                        </div>
                      )}
                    </Card>
                  )
                })
              )}
            </div>
          )}
        </div>
      )}
    </PageContainer>
  )
}
