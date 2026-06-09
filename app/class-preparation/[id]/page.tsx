'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, BookOpen, Users, ClipboardList, Radio, CalendarClock,
  Loader2, Trash2, Play, Square,
  GraduationCap, Layers, Hash, AlertTriangle, Clock, Zap,
  History, UserCheck, PenSquare, Plus, ChevronRight, Eye, EyeOff,
  Crown, BookMarked, FolderOpen,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { PageContainer } from '@/app/_components/page-container'
import { cn } from '@/lib/utils'
import {
  classes, lectures, quizzes, hub,
  type Class, type Lecture, type ClassStats, type LectureHistory, type Quiz,
  type TutorApplication,
} from '@/lib/api'

const levelColor: Record<string, string> = {
  '100L': 'bg-blue-100 text-blue-700 border-blue-200',
  '200L': 'bg-violet-100 text-violet-700 border-violet-200',
  '300L': 'bg-amber-100 text-amber-700 border-amber-200',
  '400L': 'bg-green-100 text-green-700 border-green-200',
  '500L': 'bg-rose-100 text-rose-700 border-rose-200',
  '600L': 'bg-orange-100 text-orange-700 border-orange-200',
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    weekday: 'short', day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit',
  })
}

function timeUntil(iso: string) {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff < 0) return 'Past due'
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  if (h > 48) return `In ${Math.floor(h / 24)} days`
  if (h > 0) return `In ${h}h ${m}m`
  return `In ${m} minutes`
}

export default function ClassDashboardPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const classId = Number(id)

  const [cls, setCls] = useState<Class | null>(null)
  const [stats, setStats] = useState<ClassStats | null>(null)
  const [lectureList, setLectureList] = useState<Lecture[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const [history, setHistory] = useState<LectureHistory[]>([])
  const [showAllHistory, setShowAllHistory] = useState(false)
  const [classQuizzes, setClassQuizzes] = useState<Quiz[]>([])
  const [hubApplications, setHubApplications] = useState<TutorApplication[]>([])
  const [hubLoading, setHubLoading] = useState(false)
  const [hubSelecting, setHubSelecting] = useState(false)
  const [hubError, setHubError] = useState('')
  const [selectedTutorIds, setSelectedTutorIds] = useState<number[]>([])

  // Create-quiz dialog (for this class)
  const [quizDialogOpen, setQuizDialogOpen] = useState(false)
  const [quizTitle, setQuizTitle] = useState('')
  const [quizDuration, setQuizDuration] = useState('30')
  const [quizSaving, setQuizSaving] = useState(false)
  const [quizError, setQuizError] = useState('')

  // Instant lecture dialog

  const [instantOpen, setInstantOpen] = useState(false)
  const [instantTitle, setInstantTitle] = useState('')
  const [instantDesc, setInstantDesc] = useState('')
  const [instantSaving, setInstantSaving] = useState(false)
  const [instantError, setInstantError] = useState('')

  // Schedule form
  const [schedTitle, setSchedTitle] = useState('')
  const [schedDate, setSchedDate] = useState('')
  const [schedTime, setSchedTime] = useState('')
  const [schedDesc, setSchedDesc] = useState('')
  const [schedSaving, setSchedSaving] = useState(false)
  const [schedError, setSchedError] = useState('')

  const refresh = useCallback(async () => {
    const c = await classes.get(classId)
    if (!c) { router.replace('/class-preparation'); return }
    setCls(c)

    const [s, l, h, q] = await Promise.all([
      lectures.classStats(classId).catch((): ClassStats => ({ enrolled_count: 0, assignment_count: 0, live_lecture: null, next_lecture: null })),
      lectures.list(classId).catch((): Lecture[] => []),
      lectures.history(classId).catch((): LectureHistory[] => []),
      quizzes.list(classId).catch((): Quiz[] => []),
    ])
    setStats(s)
    setLectureList(l.filter((lec) => lec.status !== 'ended'))
    setHistory(h)
    setClassQuizzes(q)

    // Load hub applications (non-blocking)
    setHubLoading(true)
    hub.getApplications(classId)
      .then((apps) => {
        setHubApplications(apps)
        const approved = apps.filter(a => a.status === 'approved').map(a => a.student_id)
        setSelectedTutorIds(approved)
      })
      .catch(() => {})
      .finally(() => setHubLoading(false))
  }, [classId, router])

  useEffect(() => {
    refresh()
      .catch(() => router.replace('/class-preparation'))
      .finally(() => setLoading(false))
  }, [refresh, router])

  const handleGoLive = async (lectureId: number) => {
    setActionLoading(`live-${lectureId}`)
    try {
      await lectures.start(lectureId)
      router.push(`/live/${lectureId}`)
    }
    catch (e) { console.error(e) }
    finally { setActionLoading(null) }
  }

  const handleEndLecture = async (lectureId: number) => {
    setActionLoading(`end-${lectureId}`)
    try { await lectures.end(lectureId); await refresh() }
    catch (e) { console.error(e) }
    finally { setActionLoading(null) }
  }

  const handleCancel = async (lectureId: number) => {
    setActionLoading(`cancel-${lectureId}`)
    try { await lectures.cancel(lectureId); await refresh() }
    catch (e) { console.error(e) }
    finally { setActionLoading(null) }
  }

  const handleSchedule = async () => {
    if (!schedTitle.trim()) { setSchedError('Title is required'); return }
    if (!schedDate || !schedTime) { setSchedError('Date and time are required'); return }
    setSchedSaving(true); setSchedError('')
    try {
      await lectures.schedule({
        class_id: classId,
        title: schedTitle.trim(),
        description: schedDesc.trim() || undefined,
        scheduled_at: new Date(`${schedDate}T${schedTime}`).toISOString(),
      })
      setSchedTitle(''); setSchedDate(''); setSchedTime('')
      setSchedDesc('')
      await refresh()
    } catch (err: unknown) {
      setSchedError(err instanceof Error ? err.message : 'Failed to schedule')
    } finally {
      setSchedSaving(false)
    }
  }

  const handleInstant = async () => {
    if (!instantTitle.trim()) { setInstantError('Lecture title is required'); return }
    if (!instantDesc.trim()) { setInstantError('Lecture description is required'); return }
    setInstantSaving(true); setInstantError('')
    try {
      const lec = await lectures.instant(classId, instantTitle.trim(), instantDesc.trim())
      router.push(`/live/${lec.id}`)
    } catch (err: unknown) {
      setInstantError(err instanceof Error ? err.message : 'Failed to start lecture')
      setInstantSaving(false)
    }
  }

  const handleCreateQuiz = async () => {
    if (!quizTitle.trim()) { setQuizError('Title is required'); return }
    setQuizSaving(true); setQuizError('')
    try {
      const q = await quizzes.create({
        class_id: classId,
        title: quizTitle.trim(),
        duration_minutes: Number(quizDuration) || 30,
      })
      setQuizDialogOpen(false)
      setQuizTitle(''); setQuizDuration('30')
      router.push(`/quizzes/${q.id}`)
    } catch (e: unknown) {
      setQuizError(e instanceof Error ? e.message : 'Failed to create quiz.')
      setQuizSaving(false)
    }
  }

  const toggleQuizPublish = async (q: Quiz) => {
    try {
      const updated = await quizzes.update(q.id, { is_published: !q.is_published })
      setClassQuizzes((prev) => prev.map((x) => x.id === q.id ? updated : x))
    } catch {}
  }

  const toggleTutorSelection = (studentId: number) => {
    setSelectedTutorIds((prev) => {
      if (prev.includes(studentId)) return prev.filter(id => id !== studentId)
      if (prev.length >= 2) return prev
      return [...prev, studentId]
    })
  }

  const handleSelectTutors = async () => {
    if (selectedTutorIds.length !== 2) { setHubError('Select exactly 2 tutors'); return }
    setHubSelecting(true); setHubError('')
    try {
      await hub.selectTutors(classId, selectedTutorIds)
      const apps = await hub.getApplications(classId)
      setHubApplications(apps)
    } catch (e: unknown) {
      setHubError(e instanceof Error ? e.message : 'Failed to select tutors')
    } finally {
      setHubSelecting(false)
    }
  }

  const liveLecture = lectureList.find((l) => l.status === 'live')
  const upcoming    = lectureList.filter(
    (l) => l.status === 'scheduled' && l.scheduled_at && new Date(l.scheduled_at).getTime() > Date.now()
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }
  if (!cls) return null

  const unitLabel = cls.subject
    ? `${cls.subject} Unit${cls.subject !== '1' ? 's' : ''}`
    : null

  return (
    <PageContainer>
      <div className="w-full space-y-5 sm:space-y-8 min-w-0">

        {/* ── Back ──────────────────────────────────────────────────────────── */}
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/class-preparation">
            <ArrowLeft className="w-4 h-4 mr-2" />
            All Courses
          </Link>
        </Button>

        {/* ── Hero Header ───────────────────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary/70 p-5 sm:p-8 text-primary-foreground shadow-lg">
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: 'radial-gradient(circle at 70% 50%, white 0%, transparent 60%)' }} />
          <div className="relative flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {cls.level && (
                  <span className="inline-flex items-center rounded-lg bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
                    {cls.level}
                  </span>
                )}
                {cls.course_code && (
                  <span className="inline-flex items-center rounded-lg bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
                    {cls.course_code}
                  </span>
                )}
              </div>
              <h1 className="text-xl sm:text-3xl font-bold leading-tight break-words">{cls.name}</h1>
              <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-primary-foreground/80">
                {unitLabel && (
                  <span className="flex items-center gap-1.5">
                    <Layers className="w-4 h-4" />{unitLabel}
                  </span>
                )}
                {cls.department && (
                  <span className="flex items-center gap-1.5">
                    <GraduationCap className="w-4 h-4" />{cls.department}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Hash className="w-4 h-4" />{cls.academic_year}
                </span>
              </div>
            </div>

            {/* Live indicator / go-live button */}
            {liveLecture ? (
              <div className="shrink-0 flex flex-col items-start md:items-end gap-3">
                <div className="flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2 font-semibold text-white shadow-lg">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
                  </span>
                  LIVE NOW
                </div>
                <p className="text-sm text-primary-foreground/80 text-left md:text-right max-w-full md:max-w-[200px] truncate">
                  {liveLecture.title}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-white/40 bg-white/10 text-white hover:bg-white/20"
                  onClick={() => handleEndLecture(liveLecture.id)}
                  disabled={actionLoading === `end-${liveLecture.id}`}
                >
                  {actionLoading === `end-${liveLecture.id}`
                    ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    : <Square className="w-4 h-4 mr-2" />
                  }
                  End Lecture
                </Button>
              </div>
            ) : (
              upcoming.length > 0 ? (
                <div className="shrink-0 flex flex-col items-start md:items-end gap-3">
                  <div className="text-left md:text-right">
                    <p className="text-xs text-primary-foreground/70 uppercase tracking-wide">Next lecture</p>
                    <p className="text-sm font-semibold">{upcoming[0].title}</p>
                    <p className="text-xs text-primary-foreground/70">
                      {upcoming[0].scheduled_at ? formatDateTime(upcoming[0].scheduled_at) : '—'}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="bg-white text-primary hover:bg-white/90 font-semibold shadow"
                    onClick={() => handleGoLive(upcoming[0].id)}
                    disabled={!!actionLoading}
                  >
                    {actionLoading === `live-${upcoming[0].id}`
                      ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      : <Play className="w-4 h-4 mr-2 fill-current" />
                    }
                    Go Live
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-white/40 bg-white/10 text-white hover:bg-white/20 text-xs"
                    onClick={() => setInstantOpen(true)}
                  >
                    <Zap className="w-3.5 h-3.5 mr-1.5" />
                    Start Instant
                  </Button>
                </div>
              ) : (
                <div className="shrink-0 flex flex-col items-start md:items-end gap-2">
                  <p className="text-sm text-primary-foreground/60 text-left md:text-right">
                    No lectures scheduled.
                  </p>
                  <Button
                    size="sm"
                    className="bg-white text-primary hover:bg-white/90 font-semibold shadow"
                    onClick={() => setInstantOpen(true)}
                  >
                    <Zap className="w-4 h-4 mr-2 fill-current" />
                    Start Instant Lecture
                  </Button>
                </div>
              )
            )}
          </div>
        </div>

        {/* ── Stats Row ─────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <StatCard icon={Users} label="Enrolled Students" value={stats?.enrolled_count ?? 0} color="blue" />
          <StatCard icon={ClipboardList} label="Assignments" value={stats?.assignment_count ?? 0} color="violet" />
          <StatCard icon={CalendarClock} label="Scheduled Lectures" value={upcoming.length} color="amber" />
          <StatCard icon={PenSquare} label="Quizzes & Tests" value={classQuizzes.length} color="green" />
        </div>

        {/* ── Main content: 2 columns ────────────────────────────────────────── */}
        <div className="grid gap-4 lg:gap-6 lg:grid-cols-5 w-full min-w-0">

          {/* Left: Schedule form (3/5) — shown second on mobile */}
          <div className="lg:col-span-3 space-y-4 lg:space-y-6 order-2 lg:order-1 w-full min-w-0">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <CalendarClock className="w-4 h-4 text-primary" />
                  Schedule a Lecture
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Lecture Title</Label>
                  <Input value={schedTitle} onChange={(e) => setSchedTitle(e.target.value)}
                    placeholder="e.g. Introduction to Algorithms" />
                </div>

                <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Date</Label>
                    <Input type="date" value={schedDate} onChange={(e) => setSchedDate(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Time</Label>
                    <Input type="time" value={schedTime} onChange={(e) => setSchedTime(e.target.value)} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <textarea
                    value={schedDesc}
                    onChange={(e) => setSchedDesc(e.target.value)}
                    placeholder="What will be covered in this lecture?"
                    className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                    rows={3}
                  />
                </div>

                {schedError && (
                  <div className="flex items-center gap-2 text-sm text-destructive">
                    <AlertTriangle className="w-4 h-4 shrink-0" />{schedError}
                  </div>
                )}

                <Button onClick={handleSchedule} disabled={schedSaving} className="w-full">
                  {schedSaving
                    ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    : <CalendarClock className="w-4 h-4 mr-2" />
                  }
                  Schedule Lecture
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Enrolled students will be notified when you schedule or go live.
                </p>
              </CardContent>
            </Card>

            {/* Upcoming lectures list */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  Upcoming Lectures
                  {upcoming.length > 0 && (
                    <Badge variant="secondary" className="ml-auto text-xs">{upcoming.length}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {upcoming.length === 0 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    No upcoming lectures scheduled.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {upcoming.map((lec) => (
                      <div key={lec.id}
                        className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 rounded-xl border border-border bg-muted/30 p-4">
                        <div className="space-y-1 min-w-0">
                          <p className="font-medium text-sm truncate">{lec.title}</p>
                          {lec.scheduled_at && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                              <CalendarClock className="w-3.5 h-3.5" />
                              {formatDateTime(lec.scheduled_at)}
                              <span className="text-primary font-medium">
                                · {timeUntil(lec.scheduled_at)}
                              </span>
                            </p>
                          )}
                          {lec.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2">{lec.description}</p>
                          )}
                        </div>
                        <div className="flex sm:flex-col gap-1.5 shrink-0">
                          <Button size="sm" variant="outline" className="h-8 px-3 text-xs"
                            onClick={() => handleGoLive(lec.id)}
                            disabled={!!actionLoading || !!liveLecture}>
                            {actionLoading === `live-${lec.id}`
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : <><Play className="w-3 h-3 mr-1 fill-current" />Go Live</>
                            }
                          </Button>
                          <Button size="sm" variant="ghost"
                            className="h-8 px-3 text-xs text-destructive hover:text-destructive hover:bg-destructive/5"
                            onClick={() => handleCancel(lec.id)}
                            disabled={!!actionLoading}>
                            {actionLoading === `cancel-${lec.id}`
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : <><Trash2 className="w-3 h-3 mr-1" />Cancel</>
                            }
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Class History */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <History className="w-4 h-4 text-primary" />
                  Class History
                  {history.length > 0 && (
                    <Badge variant="secondary" className="ml-auto text-xs">{history.length}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {history.length === 0 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    No past classes yet. Ended lectures will appear here.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(showAllHistory ? history : history.slice(0, 5)).map((h) => {
                      const attendRate = h.total_enrolled > 0
                        ? Math.round((h.attended_count / h.total_enrolled) * 100)
                        : 0
                      return (
                        <div key={h.id} className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">{h.title}</p>
                              {h.description && (
                                <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{h.description}</p>
                              )}
                            </div>
                            {h.duration_str && (
                              <span className="text-xs font-medium text-primary shrink-0 flex items-center gap-1">
                                <Clock className="w-3 h-3" />{h.duration_str}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <CalendarClock className="w-3 h-3" />
                              {h.started_at ? new Date(h.started_at).toLocaleString('en-GB', {
                                day: '2-digit', month: 'short', year: 'numeric',
                                hour: '2-digit', minute: '2-digit',
                              }) : '—'}
                            </span>
                            <span className="flex items-center gap-1 font-medium">
                              <UserCheck className="w-3 h-3" />
                              {h.attended_count}/{h.total_enrolled} attended
                              <span className={cn(
                                'ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                                attendRate >= 75 ? 'bg-green-100 text-green-700' :
                                attendRate >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                              )}>{attendRate}%</span>
                            </span>
                          </div>
                          {h.total_enrolled > 0 && (
                            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                              <div
                                className={cn('h-full rounded-full',
                                  attendRate >= 75 ? 'bg-green-500' :
                                  attendRate >= 50 ? 'bg-amber-400' : 'bg-red-500'
                                )}
                                style={{ width: `${attendRate}%` }}
                              />
                            </div>
                          )}
                        </div>
                      )
                    })}
                    {history.length > 5 && (
                      <button
                        onClick={() => setShowAllHistory((v) => !v)}
                        className="w-full text-xs text-muted-foreground hover:text-foreground py-2 text-center transition-colors"
                      >
                        {showAllHistory
                          ? 'Show less'
                          : `View ${history.length - 5} more class${history.length - 5 !== 1 ? 'es' : ''}`}
                      </button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right: Quick info (2/5) — shown first on mobile */}
          <div className="lg:col-span-2 space-y-4 order-1 lg:order-2 w-full min-w-0">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" />
                  Course Info
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <InfoLine label="Course Title" value={cls.name} />
                {cls.course_code && <InfoLine label="Course Code" value={cls.course_code} />}
                {unitLabel && <InfoLine label="Credit Units" value={unitLabel} />}
                {cls.department && <InfoLine label="Department" value={cls.department} />}
                {cls.level && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Level</span>
                    <span className={cn(
                      'text-xs font-semibold rounded-md border px-2 py-0.5',
                      levelColor[cls.level] ?? 'bg-muted text-foreground border-border'
                    )}>{cls.level}</span>
                  </div>
                )}
                <InfoLine label="Academic Year" value={cls.academic_year} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Radio className="w-4 h-4 text-primary" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" size="sm" className="w-full justify-start" asChild>
                  <Link href={`/class-preparation/${classId}/materials`}>
                    <FolderOpen className="w-4 h-4 mr-2" />
                    Lecture Materials
                  </Link>
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start" asChild>
                  <Link href="/assignments">
                    <ClipboardList className="w-4 h-4 mr-2" />
                    Manage Assignments
                  </Link>
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start" asChild>
                  <Link href="/students">
                    <Users className="w-4 h-4 mr-2" />
                    View Students
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {/* ── Quizzes & Tests ── */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <PenSquare className="w-4 h-4 text-primary" />
                    Quizzes & Tests
                    {classQuizzes.length > 0 && (
                      <Badge variant="secondary" className="ml-1 text-xs">{classQuizzes.length}</Badge>
                    )}
                  </CardTitle>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs gap-1"
                    onClick={() => { setQuizError(''); setQuizDialogOpen(true) }}
                  >
                    <Plus className="w-3.5 h-3.5" />New
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {classQuizzes.length === 0 ? (
                  <div className="py-5 flex flex-col items-center gap-2.5 text-center">
                    <PenSquare className="w-7 h-7 text-muted-foreground/30" />
                    <p className="text-xs text-muted-foreground">No quizzes yet for this course.</p>
                    <Button
                      size="sm" variant="outline"
                      className="text-xs gap-1.5"
                      onClick={() => { setQuizError(''); setQuizDialogOpen(true) }}
                    >
                      <Plus className="w-3.5 h-3.5" />Create Quiz
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {classQuizzes.map((q) => (
                      <div
                        key={q.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2.5 hover:bg-muted/60 transition-colors"
                      >
                        <div
                          className="flex-1 min-w-0 cursor-pointer"
                          onClick={() => router.push(`/quizzes/${q.id}`)}
                        >
                          <p className="text-xs font-medium truncate">{q.title}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {q.question_count} Qs · {q.attempt_count} submitted
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            title={q.is_published ? 'Unpublish' : 'Publish'}
                            onClick={() => toggleQuizPublish(q)}
                            className={`p-1 rounded hover:bg-background transition-colors ${
                              q.is_published ? 'text-green-600' : 'text-muted-foreground'
                            }`}
                          >
                            {q.is_published
                              ? <Eye className="w-3.5 h-3.5" />
                              : <EyeOff className="w-3.5 h-3.5" />
                            }
                          </button>
                          <button
                            onClick={() => router.push(`/quizzes/${q.id}`)}
                            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                    <Button
                      variant="ghost" size="sm"
                      className="w-full text-xs text-muted-foreground gap-1.5 mt-1"
                      asChild
                    >
                      <Link href="/quizzes">
                        View all quizzes
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Study Hub Management ── */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <BookMarked className="w-4 h-4 text-primary" />
                  Study Hub — Peer Tutors
                </CardTitle>
              </CardHeader>
              <CardContent>
                {hubLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : hubApplications.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">
                    No students have applied to be tutors yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">
                      Select exactly 2 students as peer tutors. Selected tutors can broadcast messages and host live sessions.
                    </p>
                    <div className="space-y-2">
                      {hubApplications.map((app) => {
                        const isSelected = selectedTutorIds.includes(app.student_id)
                        const isApproved = app.status === 'approved'
                        return (
                          <div
                            key={app.id}
                            onClick={() => toggleTutorSelection(app.student_id)}
                            className={cn(
                              'flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors',
                              isSelected
                                ? 'border-violet-400 bg-violet-50 dark:bg-violet-950/30'
                                : 'border-border bg-muted/20 hover:bg-muted/50'
                            )}
                          >
                            <div className="mt-0.5 shrink-0">
                              {isSelected
                                ? <Crown className="h-4 w-4 text-violet-500" />
                                : <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />
                              }
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-xs font-semibold truncate">{app.student_name}</p>
                                {app.matric_number && (
                                  <span className="text-[10px] text-muted-foreground font-mono">{app.matric_number}</span>
                                )}
                                {isApproved && (
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-auto shrink-0">Tutor</Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{app.motivation}</p>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    <p className="text-[11px] text-muted-foreground">
                      {selectedTutorIds.length}/2 selected
                    </p>

                    {hubError && (
                      <p className="text-xs text-destructive">{hubError}</p>
                    )}

                    <Button
                      size="sm"
                      className="w-full"
                      onClick={handleSelectTutors}
                      disabled={hubSelecting || selectedTutorIds.length !== 2}
                    >
                      {hubSelecting
                        ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                        : <Crown className="h-4 w-4 mr-1.5" />
                      }
                      Confirm Tutors & Notify Students
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* ── Create Quiz Dialog ────────────────────────────────────────────── */}
      <Dialog open={quizDialogOpen} onOpenChange={(v) => { setQuizDialogOpen(v); if (!v) { setQuizTitle(''); setQuizDuration('30'); setQuizError('') } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
                <PenSquare className="w-4 h-4 text-primary" />
              </span>
              New Quiz for {cls?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label>Quiz Title <span className="text-destructive">*</span></Label>
              <input
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="e.g. Chapter 3 Quiz"
                value={quizTitle}
                onChange={(e) => setQuizTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Duration (minutes)</Label>
              <input
                type="number" min={1} max={300}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={quizDuration}
                onChange={(e) => setQuizDuration(e.target.value)}
              />
            </div>
            {quizError && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertTriangle className="w-4 h-4 shrink-0" />{quizError}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setQuizDialogOpen(false)} disabled={quizSaving}>
              Cancel
            </Button>
            <Button onClick={handleCreateQuiz} disabled={quizSaving}>
              {quizSaving
                ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
                : <PenSquare className="w-4 h-4 mr-2" />
              }
              Create & Add Questions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Instant Lecture Dialog ─────────────────────────────────────────── */}
      <Dialog open={instantOpen} onOpenChange={(v) => { setInstantOpen(v); if (!v) { setInstantTitle(''); setInstantDesc(''); setInstantError('') } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/40">
                <Zap className="w-4 h-4 text-red-600 dark:text-red-400" />
              </span>
              Start Instant Lecture
            </DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground -mt-1">
            Start a live lecture right now. Enrolled students will be notified immediately.
          </p>

          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label>Lecture Title <span className="text-destructive">*</span></Label>
              <Input
                placeholder="e.g. Today's Class — Chapter 5"
                value={instantTitle}
                onChange={(e) => setInstantTitle(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Description <span className="text-destructive">*</span></Label>
              <textarea
                placeholder="What will be covered in this lecture?"
                value={instantDesc}
                onChange={(e) => setInstantDesc(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                rows={3}
              />
            </div>

            {instantError && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertTriangle className="w-4 h-4 shrink-0" />{instantError}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setInstantOpen(false)} disabled={instantSaving}>
              Cancel
            </Button>
            <Button
              onClick={handleInstant}
              disabled={instantSaving}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {instantSaving
                ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
                : <Zap className="w-4 h-4 mr-2" />
              }
              Go Live Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </PageContainer>
  )
}

function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ElementType; label: string; value: number; color: 'blue' | 'violet' | 'amber' | 'green'
}) {
  const colors = {
    blue:   'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400',
    violet: 'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400',
    amber:  'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
    green:  'bg-green-50 text-green-600 dark:bg-green-950/40 dark:text-green-400',
  }
  return (
    <Card>
      <CardContent className="p-3 sm:p-5 flex items-center gap-2 sm:gap-4">
        <div className={cn('flex h-9 w-9 sm:h-12 sm:w-12 items-center justify-center rounded-xl shrink-0', colors[color])}>
          <Icon className="w-4 h-4 sm:w-6 sm:h-6" />
        </div>
        <div className="min-w-0">
          <p className="text-lg sm:text-2xl font-bold">{value}</p>
          <p className="text-[11px] sm:text-xs text-muted-foreground leading-tight">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className="text-xs font-medium text-right truncate">{value}</span>
    </div>
  )
}
