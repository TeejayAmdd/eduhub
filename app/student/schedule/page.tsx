'use client'

import { useEffect, useState } from 'react'
import {
  Calendar, Clock, MapPin, AlertTriangle, BookOpen, CalendarDays, User,
  Loader2, Send, CheckCircle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageContainer } from '@/app/_components/page-container'
import { PageHeader } from '@/app/_components/page-header'
import { schedule, type ScheduleEntry } from '@/lib/api'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const PALETTE = [
  { bg: 'bg-blue-50 dark:bg-blue-950/40', border: 'border-l-blue-500', text: 'text-blue-800 dark:text-blue-300', dot: 'bg-blue-500' },
  { bg: 'bg-violet-50 dark:bg-violet-950/40', border: 'border-l-violet-500', text: 'text-violet-800 dark:text-violet-300', dot: 'bg-violet-500' },
  { bg: 'bg-amber-50 dark:bg-amber-950/40', border: 'border-l-amber-500', text: 'text-amber-800 dark:text-amber-300', dot: 'bg-amber-500' },
  { bg: 'bg-green-50 dark:bg-green-950/40', border: 'border-l-green-500', text: 'text-green-800 dark:text-green-300', dot: 'bg-green-500' },
  { bg: 'bg-pink-50 dark:bg-pink-950/40', border: 'border-l-pink-500', text: 'text-pink-800 dark:text-pink-300', dot: 'bg-pink-500' },
  { bg: 'bg-cyan-50 dark:bg-cyan-950/40', border: 'border-l-cyan-500', text: 'text-cyan-800 dark:text-cyan-300', dot: 'bg-cyan-500' },
  { bg: 'bg-orange-50 dark:bg-orange-950/40', border: 'border-l-orange-500', text: 'text-orange-800 dark:text-orange-300', dot: 'bg-orange-500' },
  { bg: 'bg-emerald-50 dark:bg-emerald-950/40', border: 'border-l-emerald-500', text: 'text-emerald-800 dark:text-emerald-300', dot: 'bg-emerald-500' },
]

function colorFor(classId: number) {
  return PALETTE[classId % PALETTE.length]
}

function fmtTime(t: string) {
  return t.slice(0, 5)
}

function getDateForDay(dayName: string): Date {
  const dayIndex = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].indexOf(dayName)
  const today = new Date()
  const monday = new Date(today)
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7))
  const d = new Date(monday)
  d.setDate(monday.getDate() + dayIndex)
  return d
}

function fmtShortDate(d: Date) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function StudentSchedulePage() {
  const [items, setItems] = useState<ScheduleEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [sendingDigest, setSendingDigest] = useState(false)
  const [digestSent, setDigestSent] = useState(false)
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' })

  useEffect(() => {
    schedule.weekly().then(setItems).catch(console.error).finally(() => setLoading(false))
  }, [])

  async function handleEmailTimetable() {
    setSendingDigest(true)
    try {
      await schedule.sendWeeklyDigest()
      setDigestSent(true)
      setTimeout(() => setDigestSent(false), 4000)
    } catch {}
    finally { setSendingDigest(false) }
  }

  const byDay = (day: string) =>
    items
      .filter((s) => s.day_of_week === day)
      .sort((a, b) => a.start_time.localeCompare(b.start_time))

  const conflictCount = items.filter((s) => s.has_conflict).length
  const coursesCount  = new Set(items.map((s) => s.class_id)).size
  const activeDays    = DAYS.filter((d) => byDay(d).length > 0).length

  if (loading) {
    return (
      <PageContainer>
        <div className="flex justify-center py-20">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <PageHeader
        title="My Schedule"
        description="Your weekly class timetable based on enrolled courses"
        action={
          items.length > 0 ? (
            <Button
              variant="outline"
              onClick={handleEmailTimetable}
              disabled={sendingDigest}
              title="Email this week's timetable to yourself"
            >
              {sendingDigest
                ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                : digestSent
                  ? <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
                  : <Send className="w-4 h-4 mr-2" />}
              {digestSent ? 'Sent to your email!' : 'Email My Timetable'}
            </Button>
          ) : undefined
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Weekly Slots', value: items.length, icon: Clock },
          { label: 'Courses', value: coursesCount, icon: BookOpen },
          { label: 'Days with Classes', value: activeDays, icon: CalendarDays },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xl font-bold leading-none">{value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Conflict banner */}
      {conflictCount > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 px-5 py-4 mb-4">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-800 dark:text-amber-300">
              {conflictCount} schedule conflict{conflictCount !== 1 ? 's' : ''} detected
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-400 mt-0.5">
              Some of your enrolled courses have overlapping time slots. Please contact your academic advisor.
              Both courses still appear on your timetable.
            </p>
          </div>
        </div>
      )}

      {/* This Week's Classes */}
      {items.length > 0 && (() => {
        const thisWeekSlots = DAYS
          .flatMap((day) => byDay(day).map((slot) => ({ ...slot, _date: getDateForDay(day) })))
          .filter((s) => {
            const d = s._date
            const now = new Date()
            return d >= new Date(now.getFullYear(), now.getMonth(), now.getDate())
          })
          .slice(0, 5)
        if (thisWeekSlots.length === 0) return null
        return (
          <Card className="mb-4 border-primary/20 bg-primary/5">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary" />
                Upcoming This Week
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="space-y-1.5">
                {thisWeekSlots.map((slot) => {
                  const color = colorFor(slot.class_id)
                  const isToday = slot._date.toDateString() === new Date().toDateString()
                  return (
                    <div key={slot.id} className="flex items-center gap-3 text-sm">
                      <span className={`w-24 shrink-0 font-medium ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                        {isToday ? 'Today' : slot.day_of_week.slice(0, 3)}{' '}
                        <span className="text-xs font-normal">{fmtShortDate(slot._date)}</span>
                      </span>
                      <span className={`h-2 w-2 rounded-full shrink-0 ${color.dot}`} />
                      <span className="font-medium truncate">{slot.class_name}</span>
                      <span className="text-xs text-muted-foreground ml-auto shrink-0">
                        {fmtTime(slot.start_time)} – {fmtTime(slot.end_time)}
                      </span>
                      {slot.lecturer_name && (
                        <span className="text-xs text-muted-foreground hidden sm:inline shrink-0">
                          <User className="h-3 w-3 inline mr-0.5" />{slot.lecturer_name}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )
      })()}

      {items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Calendar className="h-12 w-12 text-muted-foreground/20" />
            <p className="text-base font-medium text-muted-foreground">No schedule yet</p>
            <p className="text-sm text-muted-foreground/70">
              Enroll in courses to see your timetable here. Schedules are set by your lecturers.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {DAYS.map((day) => {
            const daySlots = byDay(day)
            const isToday  = day === today
            const dayConflicts = daySlots.filter((s) => s.has_conflict).length
            const dayDate = getDateForDay(day)

            return (
              <Card key={day} className={isToday ? 'ring-2 ring-primary shadow-md' : ''}>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <CardTitle className="text-base font-semibold">{day}</CardTitle>
                    <span className="text-xs text-muted-foreground">{fmtShortDate(dayDate)}</span>
                    {isToday && <Badge className="text-xs">Today</Badge>}
                    {dayConflicts > 0 && (
                      <Badge variant="outline" className="text-xs border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/20">
                        <AlertTriangle className="h-3 w-3 mr-1" />{dayConflicts} conflict{dayConflicts !== 1 ? 's' : ''}
                      </Badge>
                    )}
                    <Badge variant="secondary" className="ml-auto text-xs">
                      {daySlots.length} class{daySlots.length !== 1 ? 'es' : ''}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {daySlots.length === 0 ? (
                    <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                      <div className="h-px flex-1 bg-border" />
                      <span className="text-xs">No classes</span>
                      <div className="h-px flex-1 bg-border" />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {daySlots.map((slot) => {
                        const color = colorFor(slot.class_id)
                        return (
                          <div
                            key={slot.id}
                            className={`rounded-lg border-l-4 px-4 py-3 ${color.bg} ${color.border} ${slot.has_conflict ? 'ring-1 ring-amber-400' : ''}`}
                          >
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <p className={`text-sm font-semibold ${color.text}`}>{slot.class_name}</p>
                              {slot.course_code && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">{slot.course_code}</Badge>
                              )}
                              {slot.has_conflict && (
                                <Badge variant="outline" className="text-[10px] px-1.5 border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/20">
                                  <AlertTriangle className="h-2.5 w-2.5 mr-1" />Conflict
                                </Badge>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-4">
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {fmtTime(slot.start_time)} – {fmtTime(slot.end_time)}
                              </span>
                              {slot.room && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />{slot.room}
                                </span>
                              )}
                              {slot.lecturer_name && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <User className="h-3 w-3" />{slot.lecturer_name}
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Course legend */}
      {items.length > 0 && (
        <Card className="mt-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Enrolled Courses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2">
              {Array.from(new Map(items.map((s) => [s.class_id, s])).values()).map((s) => {
                const color = colorFor(s.class_id)
                return (
                  <div key={s.class_id} className={`flex items-center gap-2 rounded-lg px-3 py-2 ${color.bg}`}>
                    <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${color.dot}`} />
                    <div className="min-w-0">
                      <p className={`text-xs font-semibold truncate ${color.text}`}>{s.class_name}</p>
                      {s.lecturer_name && (
                        <p className="text-[11px] text-muted-foreground truncate">{s.lecturer_name}</p>
                      )}
                    </div>
                    {s.course_code && (
                      <Badge variant="outline" className="ml-auto text-[10px] px-1.5 shrink-0">{s.course_code}</Badge>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </PageContainer>
  )
}
