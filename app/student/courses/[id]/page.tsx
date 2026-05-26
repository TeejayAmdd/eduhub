'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, BookOpen, CalendarClock, ClipboardList, CheckCircle2,
  Radio, UserCheck, Layers, GraduationCap, Loader2,
  Calendar, Upload, AlertCircle, Clock, History, XCircle, FolderOpen,
  LogOut, KeyRound,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { PageContainer } from '@/app/_components/page-container'
import { cn } from '@/lib/utils'
import {
  classes, lectures, assignments,
  type ClassAvailable, type Lecture, type LectureHistory, type Assignment,
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

function timeUntil(iso: string, now: Date) {
  const diff = new Date(iso).getTime() - now.getTime()
  if (diff <= 0) return 'Starting now'
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  if (h > 48) return `In ${Math.floor(h / 24)} days`
  if (h > 0) return `In ${h}h ${m}m`
  return `In ${m} min`
}

export default function StudentCourseDashboard() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const classId = Number(id)

  const [now, setNow] = useState(new Date())
  const [course, setCourse] = useState<ClassAvailable | null>(null)
  const [lectureList, setLectureList] = useState<Lecture[]>([])
  const [assignmentList, setAssignmentList] = useState<Assignment[]>([])
  const [classHistory, setClassHistory] = useState<LectureHistory[]>([])
  const [showAllHistory, setShowAllHistory] = useState(false)
  const [loading, setLoading] = useState(true)

  // Drop course dialog state
  const [dropOpen, setDropOpen] = useState(false)
  const [dropMatric, setDropMatric] = useState('')
  const [dropError, setDropError] = useState('')
  const [dropLoading, setDropLoading] = useState(false)

  const load = useCallback(async () => {
    const [allCourses, lecs, asgn, hist] = await Promise.all([
      classes.available(),
      lectures.list(classId),
      assignments.list(classId),
      lectures.history(classId).catch((): LectureHistory[] => []),
    ])
    const found = allCourses.find((c) => c.id === classId)
    if (!found || !found.is_enrolled) {
      router.replace('/student/courses')
      return
    }
    setCourse(found)
    setLectureList(lecs.filter((l) => l.status !== 'ended'))
    setAssignmentList(asgn)
    setClassHistory(hist)
  }, [classId, router])

  useEffect(() => {
    load()
      .catch(() => router.replace('/student/courses'))
      .finally(() => setLoading(false))
  }, [load, router])

  // Tick every 30s so "upcoming" list and countdowns stay real-time
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(t)
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }
  if (!course) return null

  const liveLecture = lectureList.find((l) => l.status === 'live')
  const upcoming    = lectureList
    .filter((l) => l.status === 'scheduled' && l.scheduled_at && new Date(l.scheduled_at) > now)
    .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime())
  const nextLecture = upcoming[0] ?? null

  const unitLabel = course.subject
    ? `${course.subject} Unit${course.subject !== '1' ? 's' : ''}`
    : null

  // Derive attendance stats directly from history so they stay in sync
  const totalClasses   = classHistory.length
  const attendedCount  = classHistory.filter((h) => h.student_attended === true).length
  const missedCount    = classHistory.filter((h) => h.student_attended === false).length
  const attendanceRate = totalClasses > 0 ? Math.round((attendedCount / totalClasses) * 100) : 0

  const handleDrop = async () => {
    const matric = dropMatric.trim()
    if (!matric) { setDropError('Please enter your matric number'); return }
    setDropLoading(true)
    setDropError('')
    try {
      await classes.unenroll(classId, matric)
      router.replace('/student/courses')
    } catch (err: any) {
      setDropError(err?.message ?? 'Failed to drop course')
    } finally {
      setDropLoading(false)
    }
  }

  return (
    <PageContainer>
      <div className="max-w-5xl mx-auto space-y-5 sm:space-y-8">

        {/* ── Back ──────────────────────────────────────────────────────────── */}
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/student/courses">
            <ArrowLeft className="w-4 h-4 mr-2" />
            My Courses
          </Link>
        </Button>

        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary/70 p-5 sm:p-8 text-primary-foreground shadow-lg">
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: 'radial-gradient(circle at 70% 50%, white 0%, transparent 60%)' }} />
          <div className="relative flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {course.level && (
                  <span className="inline-flex items-center rounded-lg bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
                    {course.level}
                  </span>
                )}
                {course.course_code && (
                  <span className="inline-flex items-center rounded-lg bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
                    {course.course_code}
                  </span>
                )}
              </div>
              <h1 className="text-xl sm:text-3xl font-bold leading-tight">{course.name}</h1>
              <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-primary-foreground/80">
                <span className="flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4" />{course.lecturer_name}
                </span>
                {unitLabel && (
                  <span className="flex items-center gap-1.5">
                    <Layers className="w-4 h-4" />{unitLabel}
                  </span>
                )}
                {course.department && (
                  <span className="flex items-center gap-1.5">
                    <GraduationCap className="w-4 h-4" />{course.department}
                  </span>
                )}
              </div>
            </div>

            {/* Right side of hero */}
            {liveLecture ? (
              <div className="shrink-0 flex flex-col items-start md:items-end gap-3">
                <div className="flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2 font-semibold text-white shadow-lg">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
                  </span>
                  LIVE NOW
                </div>
                <p className="text-sm text-primary-foreground/80 max-w-full md:max-w-[200px] truncate text-left md:text-right">
                  {liveLecture.title}
                </p>
                <Button
                  size="sm"
                  className="bg-white text-primary hover:bg-white/90 font-semibold shadow"
                  onClick={() => router.push(`/live/${liveLecture.id}`)}
                >
                  <Radio className="w-4 h-4 mr-2" />Join Lecture
                </Button>
              </div>
            ) : nextLecture ? (
              <div className="shrink-0 flex flex-col items-start md:items-end gap-2">
                <p className="text-xs text-primary-foreground/70 uppercase tracking-wide">Next Lecture</p>
                <p className="text-sm font-semibold text-left md:text-right max-w-full md:max-w-[220px]">{nextLecture.title}</p>
                {nextLecture.scheduled_at && (
                  <>
                    <p className="text-xs text-primary-foreground/70">{formatDateTime(nextLecture.scheduled_at)}</p>
                    <span className="rounded-lg bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
                      {timeUntil(nextLecture.scheduled_at, now)}
                    </span>
                  </>
                )}
              </div>
            ) : (
              <div className="shrink-0">
                <p className="text-sm text-primary-foreground/60 text-right">No upcoming lectures.</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Live lecture banner ────────────────────────────────────────────── */}
        {liveLecture && (
          <Card className="border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800">
            <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-100 dark:bg-red-900/40">
                  <span className="relative flex h-3 w-3">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
                  </span>
                </div>
                <div>
                  <p className="font-semibold text-red-700 dark:text-red-400">Lecture is live right now!</p>
                  <p className="text-sm text-red-600 dark:text-red-500 mt-0.5">{liveLecture.title}</p>
                  {liveLecture.description && (
                    <p className="text-xs text-red-500 dark:text-red-600 mt-0.5">{liveLecture.description}</p>
                  )}
                </div>
              </div>
              <Button
                className="bg-red-600 hover:bg-red-700 text-white w-full sm:w-auto shrink-0"
                onClick={() => router.push(`/live/${liveLecture.id}`)}
              >
                <Radio className="w-4 h-4 mr-2" />Join Now
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ── Stats row ─────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <MiniStat
            icon={CalendarClock}
            label="Total Lectures"
            value={totalClasses}
            color="blue"
          />
          <MiniStat
            icon={CheckCircle2}
            label="Attended"
            value={attendedCount}
            color="green"
          />
          <MiniStat
            icon={AlertCircle}
            label="Missed"
            value={missedCount}
            color="amber"
          />
          <MiniStat
            icon={Clock}
            label="Upcoming"
            value={upcoming.length}
            color="violet"
          />
        </div>

        {/* ── Main content ──────────────────────────────────────────────────── */}
        <div className="grid gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-5">

          {/* Left: Assignments */}
          <div className="md:col-span-2 lg:col-span-3 space-y-4 sm:space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-primary" />
                  Assignments
                  <Badge variant="secondary" className="ml-auto text-xs">{assignmentList.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {assignmentList.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    No assignments for this course yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {assignmentList.map((a) => {
                      const isOverdue = new Date(a.due_date) < new Date()
                      const statusBadge = a.submitted
                        ? <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100 text-[10px]"><CheckCircle2 className="w-2.5 h-2.5 mr-1" />Submitted</Badge>
                        : isOverdue
                          ? <Badge variant="destructive" className="text-[10px]">Overdue</Badge>
                          : <Badge variant="outline" className="text-[10px]">Pending</Badge>

                      return (
                        <Link key={a.id} href={`/student/assignments/${a.id}`}>
                          <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3 hover:border-primary/30 hover:bg-muted/60 transition-all cursor-pointer">
                            <div className="min-w-0 space-y-0.5">
                              <p className="text-sm font-medium truncate">{a.title}</p>
                              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                                <Calendar className="w-3 h-3" />
                                Due {new Date(a.due_date).toLocaleDateString('en-GB', {
                                  day: '2-digit', month: 'short', year: 'numeric',
                                })}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {statusBadge}
                              {!a.submitted && !isOverdue && (
                                <Upload className="w-3.5 h-3.5 text-muted-foreground" />
                              )}
                            </div>
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Upcoming Lectures */}
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
                    No lectures scheduled yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {upcoming.map((lec) => (
                      <div key={lec.id}
                        className="rounded-xl border border-border bg-muted/30 p-4">
                        <div className="space-y-1 min-w-0">
                          <p className="font-medium text-sm truncate">{lec.title}</p>
                          {lec.scheduled_at && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                              <CalendarClock className="w-3.5 h-3.5" />
                              {formatDateTime(lec.scheduled_at)}
                              <span className="text-primary font-medium">· {timeUntil(lec.scheduled_at, now)}</span>
                            </p>
                          )}
                          {lec.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2">{lec.description}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Past Classes */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <History className="w-4 h-4 text-primary" />
                  Past Classes
                  {classHistory.length > 0 && (
                    <Badge variant="secondary" className="ml-auto text-xs">{classHistory.length}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {classHistory.length === 0 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    No past classes yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(showAllHistory ? classHistory : classHistory.slice(0, 5)).map((lec) => (
                      <div key={lec.id}
                        className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 space-y-0.5">
                            <p className="font-medium text-sm truncate">{lec.title}</p>
                            {lec.description && (
                              <p className="text-xs text-muted-foreground line-clamp-2">{lec.description}</p>
                            )}
                          </div>
                          {lec.student_attended === true ? (
                            <span className="shrink-0 flex items-center gap-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 text-[10px] font-semibold">
                              <CheckCircle2 className="w-3 h-3" />Attended
                            </span>
                          ) : (
                            <span className="shrink-0 flex items-center gap-1 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2 py-0.5 text-[10px] font-semibold">
                              <XCircle className="w-3 h-3" />Missed
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                          {lec.started_at && (
                            <span className="flex items-center gap-1">
                              <CalendarClock className="w-3 h-3" />
                              {formatDateTime(lec.started_at)}
                            </span>
                          )}
                          {lec.duration_str && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {lec.duration_str}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                    {classHistory.length > 5 && (
                      <button
                        onClick={() => setShowAllHistory((v) => !v)}
                        className="w-full text-xs text-muted-foreground hover:text-foreground py-2 text-center transition-colors"
                      >
                        {showAllHistory
                          ? 'Show less'
                          : `View ${classHistory.length - 5} more class${classHistory.length - 5 !== 1 ? 'es' : ''}`}
                      </button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right: Info + Attendance */}
          <div className="md:col-span-1 lg:col-span-2 space-y-4">

            {/* Attendance card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  My Attendance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {totalClasses === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No classes held yet.
                  </p>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-3xl font-bold">{attendanceRate}%</span>
                      <span className={cn(
                        'text-xs font-semibold rounded-full px-3 py-1',
                        attendanceRate >= 75 ? 'bg-green-100 text-green-700'
                          : attendanceRate >= 50 ? 'bg-amber-100 text-amber-700'
                          : 'bg-red-100 text-red-700'
                      )}>
                        {attendanceRate >= 75 ? 'Good' : attendanceRate >= 50 ? 'Fair' : 'Poor'}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all',
                          attendanceRate >= 75 ? 'bg-green-500' :
                          attendanceRate >= 50 ? 'bg-amber-400' : 'bg-red-500'
                        )}
                        style={{ width: `${attendanceRate}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {attendedCount} attended · {totalClasses} total classes
                    </p>
                    {attendanceRate < 75 && (
                      <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-700 dark:text-amber-400">
                          Attendance below 75%. Aim to attend more classes.
                        </p>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Course info */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" />
                  Course Info
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <InfoLine label="Course Title" value={course.name} />
                {course.course_code && <InfoLine label="Course Code" value={course.course_code} />}
                {unitLabel && <InfoLine label="Credit Units" value={unitLabel} />}
                {course.department && <InfoLine label="Department" value={course.department} />}
                {course.level && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Level</span>
                    <span className={cn(
                      'text-xs font-semibold rounded-md border px-2 py-0.5',
                      levelColor[course.level] ?? 'bg-muted text-foreground border-border'
                    )}>{course.level}</span>
                  </div>
                )}
                <InfoLine label="Academic Year" value={course.academic_year} />
                <div className="h-px bg-border" />
                <div className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2">
                  <UserCheck className="w-4 h-4 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Lecturer</p>
                    <p className="text-sm font-semibold truncate">{course.lecturer_name}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Links */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" />
                  Course Resources
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" size="sm" className="w-full justify-start" asChild>
                  <Link href={`/student/courses/${classId}/materials`}>
                    <FolderOpen className="w-4 h-4 mr-2" />
                    Lecture Materials
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {/* Drop course */}
            <Card className="border-destructive/20">
              <CardContent className="p-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Danger Zone</p>
                <p className="text-xs text-muted-foreground">
                  Dropping this course removes you from all lectures and assignments.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/5"
                  onClick={() => { setDropMatric(''); setDropError(''); setDropOpen(true) }}
                >
                  <LogOut className="w-3.5 h-3.5 mr-1.5" />Drop Course
                </Button>
              </CardContent>
            </Card>

          </div>
        </div>
      </div>

      {/* Drop course dialog */}
      <Dialog open={dropOpen} onOpenChange={(o) => { if (!o) setDropOpen(false) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10">
                <LogOut className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <DialogTitle>Drop Course</DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  Enter your matric number to confirm you want to drop this course
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {course && (
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 space-y-0.5">
              <p className="font-semibold text-sm">{course.name}</p>
              <p className="text-xs text-muted-foreground">{course.course_code} · {course.lecturer_name}</p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="drop-matric" className="flex items-center gap-1.5 text-sm">
              <KeyRound className="w-3.5 h-3.5" /> Matric Number
            </Label>
            <Input
              id="drop-matric"
              placeholder="e.g. 200401001"
              value={dropMatric}
              onChange={(e) => { setDropMatric(e.target.value); setDropError('') }}
              onKeyDown={(e) => e.key === 'Enter' && handleDrop()}
              autoFocus
            />
            {dropError && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> {dropError}
              </p>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDropOpen(false)} disabled={dropLoading}>Cancel</Button>
            <Button variant="destructive" onClick={handleDrop} disabled={dropLoading || !dropMatric.trim()}>
              {dropLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <LogOut className="w-4 h-4 mr-2" />}
              Drop Course
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  )
}

function MiniStat({ icon: Icon, label, value, color }: {
  icon: React.ElementType; label: string; value: number
  color: 'blue' | 'violet' | 'green' | 'amber'
}) {
  const colors = {
    blue:   'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400',
    violet: 'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400',
    green:  'bg-green-50 text-green-600 dark:bg-green-950/40 dark:text-green-400',
    amber:  'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
  }
  return (
    <Card>
      <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
        <div className={cn('flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl shrink-0', colors[color])}>
          <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
        <div>
          <p className="text-lg sm:text-xl font-bold">{value}</p>
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
