'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  BookOpen, CheckCircle2, Loader2, GraduationCap, Hash,
  UserCheck, AlertCircle, Plus, Layers, Radio, CalendarClock, ChevronRight,
  ShieldCheck, KeyRound,
} from 'lucide-react'
import { PageContainer } from '@/app/_components/page-container'
import { PageHeader } from '@/app/_components/page-header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { classes, users, lectures, type ClassAvailable, type UserProfile, type Lecture } from '@/lib/api'

const levelColor: Record<string, string> = {
  '100L': 'bg-blue-50 text-blue-700 border-blue-100',
  '200L': 'bg-violet-50 text-violet-700 border-violet-100',
  '300L': 'bg-amber-50 text-amber-700 border-amber-100',
  '400L': 'bg-green-50 text-green-700 border-green-100',
  '500L': 'bg-rose-50 text-rose-700 border-rose-100',
  '600L': 'bg-orange-50 text-orange-700 border-orange-100',
}

export default function StudentCoursesPage() {
  const [data, setData] = useState<ClassAvailable[]>([])
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [lectureMap, setLectureMap] = useState<Record<number, Lecture | null>>({})
  const [loading, setLoading] = useState(true)

  // Matric dialog state
  const [enrollTarget, setEnrollTarget] = useState<ClassAvailable | null>(null)
  const [matricInput, setMatricInput] = useState('')
  const [matricError, setMatricError] = useState('')
  const [matricLoading, setMatricLoading] = useState(false)

  useEffect(() => {
    Promise.all([classes.available(), users.me(), lectures.list()])
      .then(([c, me, lecs]) => {
        setData(c)
        setProfile(me)
        const now = new Date()
        const map: Record<number, Lecture | null> = {}
        for (const course of c) {
          const courseLecs = lecs.filter((l) => l.class_id === course.id)
          const live = courseLecs.find((l) => l.status === 'live')
          const next = courseLecs
            .filter((l) => l.status === 'scheduled' && l.scheduled_at && new Date(l.scheduled_at) > now)
            .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime())[0]
          map[course.id] = live ?? next ?? null
        }
        setLectureMap(map)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const openEnrollDialog = (cls: ClassAvailable) => {
    setMatricInput('')
    setMatricError('')
    setEnrollTarget(cls)
  }

  const handleConfirmEnroll = async () => {
    if (!enrollTarget) return
    const matric = matricInput.trim()
    if (!matric) { setMatricError('Please enter your matric number'); return }
    setMatricLoading(true)
    setMatricError('')
    try {
      await classes.enroll(enrollTarget.id, matric)
      setData((prev) => prev.map((c) => c.id === enrollTarget.id ? { ...c, is_enrolled: true } : c))
      setEnrollTarget(null)
    } catch (err: any) {
      setMatricError(err?.message ?? 'Enrollment failed')
    } finally {
      setMatricLoading(false)
    }
  }

  const enrolled  = data.filter((c) => c.is_enrolled)
  const available = data.filter((c) => !c.is_enrolled)

  if (loading) {
    return (
      <PageContainer>
        <PageHeader title="My Courses" description="Browse and enroll in your department's courses" />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </PageContainer>
    )
  }

  if (!profile?.department || !profile?.level) {
    return (
      <PageContainer>
        <PageHeader title="My Courses" description="Browse and enroll in your department's courses" />
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex items-start gap-4 p-6">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-800">Profile incomplete</p>
              <p className="text-sm text-amber-700 mt-1">
                Your department and level must be set before you can see available courses.
                Please update your profile in Settings.
              </p>
            </div>
          </CardContent>
        </Card>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <PageHeader
        title="My Courses"
        description={`${profile.department} · ${profile.level} — ${data.length} course${data.length !== 1 ? 's' : ''} available`}
      />

      <div className="space-y-8">
        {/* Enrolled courses */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <h2 className="text-sm font-semibold">Enrolled ({enrolled.length})</h2>
          </div>
          {enrolled.length === 0 ? (
            <p className="text-sm text-muted-foreground">You haven&apos;t enrolled in any courses yet.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {enrolled.map((cls) => (
                <Link key={cls.id} href={`/student/courses/${cls.id}`}>
                  <CourseCard cls={cls} lecture={lectureMap[cls.id] ?? null} onEnroll={openEnrollDialog} />
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Available to join */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Available to Join ({available.length})</h2>
          </div>
          {available.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
                <GraduationCap className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">
                {data.length === 0
                  ? 'No courses available for your department and level yet.'
                  : 'You\'re enrolled in all available courses.'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Check back later or contact your lecturer.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {available.map((cls) => (
                <CourseCard key={cls.id} cls={cls} lecture={null} onEnroll={openEnrollDialog} />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Enroll confirmation dialog */}
      <Dialog open={!!enrollTarget} onOpenChange={(o) => { if (!o) setEnrollTarget(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <ShieldCheck className="w-5 h-5 text-primary" />
              </div>
              <div>
                <DialogTitle>Confirm Enrollment</DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  Enter your matric number to verify your student identity
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {enrollTarget && (
            <div className="rounded-xl border bg-muted/40 px-4 py-3 space-y-0.5">
              <p className="font-semibold text-sm">{enrollTarget.name}</p>
              <p className="text-xs text-muted-foreground">{enrollTarget.course_code} · {enrollTarget.lecturer_name}</p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="enroll-matric" className="flex items-center gap-1.5 text-sm">
              <KeyRound className="w-3.5 h-3.5" /> Matric Number
            </Label>
            <Input
              id="enroll-matric"
              placeholder="e.g. 200401001"
              value={matricInput}
              onChange={(e) => { setMatricInput(e.target.value); setMatricError('') }}
              onKeyDown={(e) => e.key === 'Enter' && handleConfirmEnroll()}
              autoFocus
            />
            {matricError && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> {matricError}
              </p>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEnrollTarget(null)} disabled={matricLoading}>Cancel</Button>
            <Button onClick={handleConfirmEnroll} disabled={matricLoading || !matricInput.trim()}>
              {matricLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              Enroll Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </PageContainer>
  )
}

function CourseCard({
  cls, lecture, onEnroll,
}: {
  cls: ClassAvailable
  lecture: Lecture | null
  onEnroll: (cls: ClassAvailable) => void
}) {
  const router = useRouter()
  const unitLabel = cls.subject
    ? `${cls.subject} Unit${cls.subject !== '1' ? 's' : ''}`
    : null

  return (
    <Card className={cn('flex flex-col transition-all', cls.is_enrolled ? 'hover:shadow-md hover:border-primary/30 cursor-pointer ring-1 ring-primary/20' : 'hover:shadow-sm')}>
      <CardContent className="p-5 flex flex-col gap-4 flex-1">
        {/* Top: icon + badges */}
        <div className="flex items-start justify-between gap-2">
          <div className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
            cls.is_enrolled ? 'bg-primary/10' : 'bg-muted'
          )}>
            <BookOpen className={cn('w-5 h-5', cls.is_enrolled ? 'text-primary' : 'text-muted-foreground')} />
          </div>
          <div className="flex gap-1.5 flex-wrap justify-end">
            {cls.is_enrolled && (
              <span className="inline-flex items-center gap-1 rounded-md bg-green-50 border border-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                <CheckCircle2 className="w-3 h-3" /> Enrolled
              </span>
            )}
            {cls.level && (
              <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${levelColor[cls.level] ?? 'bg-muted text-foreground border-border'}`}>
                {cls.level}
              </span>
            )}
          </div>
        </div>

        {/* Course title + code */}
        <div>
          <h3 className="font-semibold text-sm leading-snug">{cls.name}</h3>
          {cls.course_code && (
            <Badge variant="outline" className="text-xs mt-1">{cls.course_code}</Badge>
          )}
        </div>

        {/* Lecturer name — prominent */}
        <div className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2">
          <UserCheck className="w-4 h-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Lecturer</p>
            <p className="text-sm font-semibold truncate">{cls.lecturer_name}</p>
          </div>
        </div>

        {/* Meta: unit, department, year */}
        <div className="space-y-1 text-xs text-muted-foreground">
          {unitLabel && (
            <div className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 shrink-0" />
              <span>{unitLabel}</span>
            </div>
          )}
          {cls.department && (
            <div className="flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5 shrink-0" />
              <span>{cls.department}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <GraduationCap className="w-3.5 h-3.5 shrink-0" />
            <span>{cls.academic_year}</span>
          </div>
        </div>

        {/* Lecture status */}
        {lecture && (
          lecture.status === 'live' ? (
            <div className="rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                </span>
                <span className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wide">Live Now</span>
              </div>
              <p className="text-xs font-medium text-red-700 dark:text-red-300 truncate">{lecture.title}</p>
              <button
                onClick={(e) => { e.preventDefault(); router.push(`/live/${lecture.id}`) }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600 transition-colors"
              >
                <Radio className="w-3.5 h-3.5" /> Join Lecture
              </button>
            </div>
          ) : (
            <div className="flex items-start gap-2 rounded-xl bg-muted/60 p-3">
              <CalendarClock className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Next Lecture</p>
                <p className="text-xs font-semibold truncate">{lecture.title}</p>
                {lecture.scheduled_at && (
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(lecture.scheduled_at).toLocaleString('en-GB', {
                      weekday: 'short', day: '2-digit', month: 'short',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                )}
              </div>
            </div>
          )
        )}

        {/* Action button — pinned to bottom */}
        <div className="mt-auto pt-1">
          {cls.is_enrolled ? (
            <p className="text-xs text-primary font-medium flex items-center gap-0.5">
              View dashboard <ChevronRight className="w-3.5 h-3.5" />
            </p>
          ) : (
            <Button size="sm" className="w-full" onClick={() => onEnroll(cls)}>
              <Plus className="w-3.5 h-3.5 mr-1.5" />Enroll
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
