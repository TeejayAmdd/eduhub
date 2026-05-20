'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, Mail, Hash, GraduationCap, BookOpen, BarChart2,
  ClipboardList, Brain, Award, Loader2, MessageSquare,
  CheckCircle2, XCircle, Clock, CalendarDays,
} from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { students, type StudentDetail, type StudentCourseDetail } from '@/lib/api'

function initials(name: string) {
  return name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()
}

function gradeBadgeColor(grade: string | null) {
  if (!grade) return 'bg-muted text-muted-foreground'
  const g = grade.toUpperCase()
  if (g.startsWith('A')) return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
  if (g.startsWith('B')) return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
  if (g.startsWith('C')) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
  return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
}

function attColor(rate: number | null) {
  if (rate === null) return 'bg-muted'
  if (rate >= 75) return 'bg-green-500'
  if (rate >= 50) return 'bg-amber-500'
  return 'bg-red-500'
}

function StatBar({
  label, value, total, color = 'bg-primary',
}: { label: string; value: number; total: number; color?: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value} / {total}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function CourseCard({ c, studentId }: { c: StudentCourseDetail; studentId: number }) {
  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      {/* Course header strip */}
      <div className="h-1.5 w-full bg-gradient-to-r from-primary/70 to-primary/20" />

      <div className="p-5 space-y-4">
        {/* Course title row */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-semibold text-base truncate">{c.class_name}</h3>
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              {c.course_code && (
                <Badge variant="secondary" className="text-xs">{c.course_code}</Badge>
              )}
              {c.level && (
                <Badge variant="outline" className="text-xs">{c.level}</Badge>
              )}
              <span className="text-xs text-muted-foreground">{c.academic_year}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {c.grade ? (
              <span className={cn('inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-sm font-bold', gradeBadgeColor(c.grade))}>
                <Award className="w-3.5 h-3.5" />
                {c.grade}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground rounded-lg border px-2.5 py-1">No grade</span>
            )}
          </div>
        </div>

        {/* Roll number */}
        <p className="text-xs text-muted-foreground">
          Roll number: <span className="font-semibold text-foreground">#{c.roll_number}</span>
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

          {/* ── Attendance ─────────────────────────────────────────────────── */}
          <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
                <BarChart2 className="w-4 h-4 text-green-600 dark:text-green-400" />
              </div>
              <span className="text-sm font-medium">Attendance</span>
            </div>

            {c.att_total === 0 ? (
              <p className="text-xs text-muted-foreground">No records yet</p>
            ) : (
              <>
                {/* Big rate */}
                <div className="text-center py-1">
                  <p className={cn(
                    'text-2xl font-bold',
                    c.attendance_rate !== null && c.attendance_rate >= 75 ? 'text-green-600 dark:text-green-400'
                    : c.attendance_rate !== null && c.attendance_rate >= 50 ? 'text-amber-600 dark:text-amber-400'
                    : 'text-red-600 dark:text-red-400'
                  )}>
                    {c.attendance_rate ?? 0}%
                  </p>
                  <p className="text-xs text-muted-foreground">{c.att_present} of {c.att_total} sessions</p>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn('h-full rounded-full', attColor(c.attendance_rate))}
                    style={{ width: `${c.attendance_rate ?? 0}%` }}
                  />
                </div>

                {/* Breakdown */}
                <div className="grid grid-cols-3 gap-1 pt-1">
                  <div className="text-center">
                    <p className="text-xs font-semibold text-green-600 dark:text-green-400">{c.att_present}</p>
                    <p className="text-[10px] text-muted-foreground">Present</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">{c.att_late}</p>
                    <p className="text-[10px] text-muted-foreground">Late</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-semibold text-red-600 dark:text-red-400">{c.att_absent}</p>
                    <p className="text-[10px] text-muted-foreground">Absent</p>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ── Assignments ─────────────────────────────────────────────────── */}
          <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <ClipboardList className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <span className="text-sm font-medium">Assignments</span>
            </div>

            {c.assignments_total === 0 ? (
              <p className="text-xs text-muted-foreground">No assignments yet</p>
            ) : (
              <>
                <StatBar
                  label="Submitted"
                  value={c.assignments_submitted}
                  total={c.assignments_total}
                  color="bg-blue-500"
                />
                <StatBar
                  label="Graded"
                  value={c.assignments_graded}
                  total={c.assignments_total}
                  color="bg-purple-500"
                />
                {c.assignment_avg_score !== null && (
                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-muted-foreground">Avg score</span>
                    <span className="font-bold text-foreground">{c.assignment_avg_score}</span>
                  </div>
                )}
                {c.assignments_submitted === 0 && (
                  <div className="flex items-center gap-1.5 text-xs text-red-500 pt-1">
                    <XCircle className="w-3.5 h-3.5 shrink-0" />
                    No submissions yet
                  </div>
                )}
                {c.assignments_submitted > 0 && c.assignments_submitted === c.assignments_total && (
                  <div className="flex items-center gap-1.5 text-xs text-green-500 pt-1">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    All submitted
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── Quizzes ──────────────────────────────────────────────────────── */}
          <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <Brain className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              </div>
              <span className="text-sm font-medium">Quizzes</span>
            </div>

            {c.quizzes_total === 0 ? (
              <p className="text-xs text-muted-foreground">No quizzes yet</p>
            ) : (
              <>
                <StatBar
                  label="Attempted"
                  value={c.quizzes_attempted}
                  total={c.quizzes_total}
                  color="bg-purple-500"
                />
                {c.quiz_avg_score !== null ? (
                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-muted-foreground">Avg score</span>
                    <span className="font-bold text-foreground">{c.quiz_avg_score}%</span>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground pt-1">Not attempted yet</p>
                )}
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}

export default function StudentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const studentId = Number(params.id)

  const [detail, setDetail] = useState<StudentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    students.detail(studentId)
      .then(setDetail)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [studentId])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center py-32">
        <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !detail) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3 text-muted-foreground">
        <p className="text-sm">{error ?? 'Student not found'}</p>
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Go back
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="-ml-2">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-semibold">Student Profile</h1>
      </div>

      {/* ── Profile card ─────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border bg-card p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <Avatar className="h-20 w-20 shrink-0">
            <AvatarFallback className="text-xl font-bold bg-primary/10 text-primary">
              {initials(detail.name)}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold">{detail.name}</h2>
              <span className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                detail.is_active
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-red-100 text-red-700'
              )}>
                {detail.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>

            <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
              {detail.matric_number && (
                <span className="flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 shrink-0" />
                  <span className="font-mono">{detail.matric_number}</span>
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 shrink-0" />
                {detail.email}
              </span>
              {detail.department && (
                <span className="flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5 shrink-0" />
                  {detail.department}{detail.level ? ` · ${detail.level}` : ''}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                Joined {new Date(detail.created_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/messages?open=${detail.id}`)}
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Message
            </Button>
          </div>
        </div>

        {/* Courses enrolled summary */}
        <div className="mt-4 pt-4 border-t border-border flex items-center gap-2 text-sm text-muted-foreground">
          <BookOpen className="w-4 h-4 shrink-0" />
          Enrolled in{' '}
          <span className="font-semibold text-foreground">{detail.courses.length}</span>{' '}
          course{detail.courses.length !== 1 ? 's' : ''} with you
        </div>
      </div>

      {/* ── Per-course cards ──────────────────────────────────────────────────── */}
      {detail.courses.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">
          No shared courses found.
        </div>
      ) : (
        <div className="space-y-4">
          {detail.courses.length > 1 && (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Showing progress for each course separately
            </p>
          )}
          {detail.courses.map((c) => (
            <CourseCard key={c.class_id} c={c} studentId={detail.id} />
          ))}
        </div>
      )}
    </div>
  )
}
