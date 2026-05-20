'use client'

import { useEffect, useState } from 'react'
import {
  Calendar, Plus, Trash2, Loader2, Clock, MapPin, AlertTriangle,
  BookOpen, CalendarDays, Lock, LockOpen, Send, CheckCircle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { PageContainer } from '@/app/_components/page-container'
import { PageHeader } from '@/app/_components/page-header'
import { schedule, classes, type ScheduleEntry, type Class } from '@/lib/api'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// Get the actual date for a given day name in the current week (Mon–Sun)
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

// Assign a stable color per class_id
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
  // "HH:MM:SS" or "HH:MM" → "HH:MM"
  return t.slice(0, 5)
}

export default function LecturerSchedulePage() {
  const [items, setItems] = useState<ScheduleEntry[]>([])
  const [myClasses, setMyClasses] = useState<Class[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [togglingLockId, setTogglingLockId] = useState<number | null>(null)
  const [sendingDigest, setSendingDigest] = useState(false)
  const [digestSent, setDigestSent] = useState(false)
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' })

  // Add slot dialog
  const [showAdd, setShowAdd] = useState(false)
  const [addClassId, setAddClassId] = useState('')
  const [addDay, setAddDay] = useState('Monday')
  const [addStart, setAddStart] = useState('09:00')
  const [addEnd, setAddEnd] = useState('11:00')
  const [addRoom, setAddRoom] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')

  useEffect(() => {
    Promise.all([schedule.weekly(), classes.list()])
      .then(([s, c]) => { setItems(s); setMyClasses(c) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  async function handleDelete(id: number) {
    setDeletingId(id)
    try {
      await schedule.delete(id)
      setItems((prev) => prev.filter((s) => s.id !== id))
    } catch {}
    finally { setDeletingId(null) }
  }

  async function handleToggleLock(id: number) {
    setTogglingLockId(id)
    try {
      const updated = await schedule.toggleLock(id)
      setItems((prev) => prev.map((s) => s.id === id ? { ...s, is_locked: updated.is_locked } : s))
    } catch {}
    finally { setTogglingLockId(null) }
  }

  async function handleSendDigest() {
    setSendingDigest(true)
    try {
      await schedule.sendWeeklyDigest()
      setDigestSent(true)
      setTimeout(() => setDigestSent(false), 4000)
    } catch {}
    finally { setSendingDigest(false) }
  }

  async function handleAdd() {
    if (!addClassId) { setAddError('Select a course'); return }
    if (!addStart || !addEnd || addStart >= addEnd) { setAddError('End time must be after start time'); return }
    setAdding(true); setAddError('')
    try {
      const created = await schedule.bulkCreate(Number(addClassId), [{
        day_of_week: addDay,
        start_time: addStart,
        end_time: addEnd,
        room: addRoom || undefined,
      }])
      // Re-fetch to get enriched entries
      const fresh = await schedule.weekly()
      setItems(fresh)
      setShowAdd(false)
      setAddClassId(''); setAddDay('Monday'); setAddStart('09:00'); setAddEnd('11:00'); setAddRoom('')
    } catch (e: unknown) {
      setAddError(e instanceof Error ? e.message : 'Failed to add slot')
    } finally { setAdding(false) }
  }

  const byDay = (day: string) =>
    items
      .filter((s) => s.day_of_week === day)
      .sort((a, b) => a.start_time.localeCompare(b.start_time))

  const totalSlots = items.length
  const coursesWithSchedule = new Set(items.map((s) => s.class_id)).size

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
        description="Your weekly teaching timetable. Add time slots when creating a course or from here."
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleSendDigest}
              disabled={sendingDigest || items.length === 0}
              title="Send this week's timetable to you and all enrolled students"
            >
              {sendingDigest
                ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                : digestSent
                  ? <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
                  : <Send className="w-4 h-4 mr-2" />}
              {digestSent ? 'Sent!' : 'Send Timetable'}
            </Button>
            <Button onClick={() => setShowAdd(true)} disabled={myClasses.length === 0}>
              <Plus className="w-4 h-4 mr-2" />
              Add Time Slot
            </Button>
          </div>
        }
      />

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Total Slots', value: totalSlots, icon: Clock },
          { label: 'Courses Scheduled', value: coursesWithSchedule, icon: BookOpen },
          { label: 'Days with Classes', value: DAYS.filter((d) => byDay(d).length > 0).length, icon: CalendarDays },
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

      {/* This Week's Classes */}
      {items.length > 0 && (() => {
        const thisWeekSlots = DAYS
          .flatMap((day) => byDay(day).map((slot) => ({ ...slot, _date: getDateForDay(day) })))
          .filter((s) => {
            const d = s._date
            const now = new Date()
            // Only show today and future days this week
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
                      {slot.room && (
                        <span className="text-xs text-muted-foreground hidden sm:inline shrink-0">
                          <MapPin className="h-3 w-3 inline mr-0.5" />{slot.room}
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
            <p className="text-base font-medium text-muted-foreground">No schedule set yet</p>
            <p className="text-sm text-muted-foreground/70">
              Add time slots when creating a course, or click <strong>Add Time Slot</strong> above.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {DAYS.map((day) => {
            const daySlots = byDay(day)
            const isToday = day === today
            return (
              <Card key={day} className={isToday ? 'ring-2 ring-primary shadow-md' : ''}>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-base font-semibold">{day}</CardTitle>
                    {isToday && <Badge className="text-xs">Today</Badge>}
                    <Badge variant="secondary" className="ml-auto text-xs">{daySlots.length} class{daySlots.length !== 1 ? 'es' : ''}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {daySlots.length === 0 ? (
                    <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                      <div className="h-px flex-1 bg-border" />
                      <span className="text-xs">Free day</span>
                      <div className="h-px flex-1 bg-border" />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {daySlots.map((slot) => {
                        const color = colorFor(slot.class_id)
                        return (
                          <div
                            key={slot.id}
                            className={`flex items-center gap-4 rounded-lg border-l-4 px-4 py-3 ${color.bg} ${color.border} ${slot.is_locked ? 'ring-1 ring-inset ring-primary/20' : ''}`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className={`text-sm font-semibold truncate ${color.text}`}>{slot.class_name}</p>
                                {slot.course_code && (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">{slot.course_code}</Badge>
                                )}
                                {slot.is_locked && (
                                  <Badge className="text-[10px] px-1.5 py-0 gap-1 bg-primary/15 text-primary border border-primary/30 shrink-0">
                                    <Lock className="h-2.5 w-2.5" />Fixed
                                  </Badge>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-3 mt-0.5">
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {fmtTime(slot.start_time)} – {fmtTime(slot.end_time)}
                                </span>
                                {slot.room && (
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />{slot.room}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                size="sm" variant="ghost"
                                className={`h-8 w-8 p-0 ${slot.is_locked ? 'text-primary hover:text-primary/70' : 'text-muted-foreground hover:text-primary'}`}
                                title={slot.is_locked ? 'Unlock slot' : 'Lock slot (fix this schedule)'}
                                onClick={() => handleToggleLock(slot.id)}
                                disabled={togglingLockId === slot.id || deletingId === slot.id}
                              >
                                {togglingLockId === slot.id
                                  ? <Loader2 className="h-4 w-4 animate-spin" />
                                  : slot.is_locked ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
                              </Button>
                              <Button
                                size="sm" variant="ghost"
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                title={slot.is_locked ? 'Unlock before deleting' : 'Delete slot'}
                                onClick={() => handleDelete(slot.id)}
                                disabled={slot.is_locked || deletingId === slot.id || togglingLockId === slot.id}
                              >
                                {deletingId === slot.id
                                  ? <Loader2 className="h-4 w-4 animate-spin" />
                                  : <Trash2 className={`h-4 w-4 ${slot.is_locked ? 'opacity-30' : ''}`} />}
                              </Button>
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
            <CardTitle className="text-sm">Course Legend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {Array.from(new Map(items.map((s) => [s.class_id, s])).values()).map((s) => {
                const color = colorFor(s.class_id)
                return (
                  <div key={s.class_id} className="flex items-center gap-1.5">
                    <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${color.dot}`} />
                    <span className="text-xs font-medium">{s.class_name}</span>
                    {s.course_code && <span className="text-xs text-muted-foreground">({s.course_code})</span>}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Slot Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Add Time Slot
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Course <span className="text-destructive">*</span></Label>
              <Select value={addClassId} onValueChange={setAddClassId}>
                <SelectTrigger><SelectValue placeholder="Select a course" /></SelectTrigger>
                <SelectContent>
                  {myClasses.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Day</Label>
                <Select value={addDay} onValueChange={setAddDay}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DAYS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Room <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input placeholder="e.g. LT4" value={addRoom} onChange={(e) => setAddRoom(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start Time</Label>
                <Input type="time" value={addStart} onChange={(e) => setAddStart(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>End Time</Label>
                <Input type="time" value={addEnd} onChange={(e) => setAddEnd(e.target.value)} />
              </div>
            </div>

            {addError && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4 shrink-0" />{addError}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={adding}>
              {adding ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Plus className="h-4 w-4 mr-1.5" />}
              Add Slot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  )
}
