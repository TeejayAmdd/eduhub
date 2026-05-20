'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Search, Users, GraduationCap, BookOpen,
  Mail, Hash, BarChart2, Award, Loader2, ChevronDown,
} from 'lucide-react'
import { PageContainer } from '../_components/page-container'
import { PageHeader } from '../_components/page-header'
import { cn } from '@/lib/utils'
import { students, classes, type Class, type StudentInClass, type Student } from '@/lib/api'

const PAGE_SIZE = 20

function initials(name: string) {
  return name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()
}

function AttendancePill({ rate }: { rate: number | null }) {
  if (rate === null) return <span className="text-xs text-muted-foreground">—</span>
  const color =
    rate >= 75 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
    rate >= 50 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', color)}>
      <BarChart2 className="w-3 h-3" />
      {rate}%
    </span>
  )
}

export default function StudentsPage() {
  const router = useRouter()

  const [courseList, setCourseList]   = useState<Class[]>([])
  const [selectedId, setSelectedId]   = useState<number | 'all'>('all')

  // All-students state
  const [allStudents, setAllStudents]           = useState<Student[]>([])
  const [allStudentsTotal, setAllStudentsTotal] = useState(0)
  const [allStudentsOffset, setAllStudentsOffset] = useState(0)

  // Per-course state
  const [studentMap, setStudentMap]         = useState<Record<number, StudentInClass[]>>({})
  const [studentTotals, setStudentTotals]   = useState<Record<number, number>>({})
  const [studentOffsets, setStudentOffsets] = useState<Record<number, number>>({})

  const [search, setSearch]                 = useState('')
  const [loadingCourses, setLoadingCourses] = useState(true)
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [loadingMore, setLoadingMore]       = useState(false)
  const [dropdownOpen, setDropdownOpen]     = useState(false)

  useEffect(() => {
    classes.list()
      .then(setCourseList)
      .catch(console.error)
      .finally(() => setLoadingCourses(false))
  }, [])

  const fetchAllStudents = useCallback(async () => {
    if (allStudents.length > 0) return
    setLoadingStudents(true)
    try {
      const data = await students.list({ limit: PAGE_SIZE, offset: 0 })
      setAllStudents(data.items)
      setAllStudentsTotal(data.total)
      setAllStudentsOffset(data.items.length)
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingStudents(false)
    }
  }, [allStudents.length])

  const loadMoreAllStudents = useCallback(async () => {
    setLoadingMore(true)
    try {
      const data = await students.list({ limit: PAGE_SIZE, offset: allStudentsOffset })
      setAllStudents((prev) => [...prev, ...data.items])
      setAllStudentsTotal(data.total)
      setAllStudentsOffset((prev) => prev + data.items.length)
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingMore(false)
    }
  }, [allStudentsOffset])

  const fetchStudentsForCourse = useCallback(async (classId: number) => {
    if (studentMap[classId] !== undefined) return
    setLoadingStudents(true)
    try {
      const data = await students.listByClass(classId, { limit: PAGE_SIZE, offset: 0 })
      setStudentMap((prev) => ({ ...prev, [classId]: data.items }))
      setStudentTotals((prev) => ({ ...prev, [classId]: data.total }))
      setStudentOffsets((prev) => ({ ...prev, [classId]: data.items.length }))
    } catch (e) {
      console.error(e)
      setStudentMap((prev) => ({ ...prev, [classId]: [] }))
      setStudentTotals((prev) => ({ ...prev, [classId]: 0 }))
      setStudentOffsets((prev) => ({ ...prev, [classId]: 0 }))
    } finally {
      setLoadingStudents(false)
    }
  }, [studentMap])

  const loadMoreForCourse = useCallback(async (classId: number) => {
    const offset = studentOffsets[classId] ?? 0
    setLoadingMore(true)
    try {
      const data = await students.listByClass(classId, { limit: PAGE_SIZE, offset })
      setStudentMap((prev) => ({ ...prev, [classId]: [...(prev[classId] ?? []), ...data.items] }))
      setStudentTotals((prev) => ({ ...prev, [classId]: data.total }))
      setStudentOffsets((prev) => ({ ...prev, [classId]: offset + data.items.length }))
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingMore(false)
    }
  }, [studentOffsets])

  useEffect(() => {
    setSearch('')
    if (selectedId === 'all') {
      fetchAllStudents()
    } else {
      fetchStudentsForCourse(selectedId)
    }
  }, [selectedId]) // eslint-disable-line react-hooks/exhaustive-deps

  const selectedCourse = courseList.find((c) => c.id === selectedId)

  const currentStudents = selectedId === 'all'
    ? allStudents
    : (studentMap[selectedId as number] ?? [])

  const currentTotal = selectedId === 'all'
    ? allStudentsTotal
    : (studentTotals[selectedId as number] ?? 0)

  const hasMore = !search && currentStudents.length < currentTotal

  const filtered = useMemo(() =>
    currentStudents.filter((s) => {
      const q = search.toLowerCase()
      return (
        s.name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        ((s as StudentInClass).matric_number ?? '').toLowerCase().includes(q)
      )
    }), [currentStudents, search])

  const handleLoadMore = () => {
    if (selectedId === 'all') loadMoreAllStudents()
    else loadMoreForCourse(selectedId as number)
  }

  const dropdownLabel = selectedId === 'all'
    ? 'All Courses'
    : selectedCourse
      ? `${selectedCourse.name}${selectedCourse.course_code ? ` (${selectedCourse.course_code})` : ''}`
      : 'Select course'

  return (
    <PageContainer>
      <PageHeader
        title="Students"
        description="View students enrolled in each of your courses"
      />

      {/* ── Filter bar ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 mb-6">

        {/* Course picker dropdown */}
        <div className="relative z-20">
          <button
            onClick={() => setDropdownOpen((v) => !v)}
            className="flex items-center gap-2 rounded-xl border bg-background px-4 py-2 text-sm font-medium shadow-sm hover:bg-muted transition-colors min-w-[220px]"
          >
            <BookOpen className="w-4 h-4 text-primary shrink-0" />
            <span className="flex-1 truncate text-left">{dropdownLabel}</span>
            <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform shrink-0', dropdownOpen && 'rotate-180')} />
          </button>

          {dropdownOpen && (
            <div className="absolute left-0 top-full mt-1 w-72 rounded-xl border bg-popover shadow-lg overflow-hidden">
              <button
                onClick={() => { setSelectedId('all'); setDropdownOpen(false) }}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted transition-colors text-left',
                  selectedId === 'all' && 'bg-primary/5 text-primary font-medium'
                )}
              >
                <Users className="w-4 h-4 shrink-0" />
                <span className="flex-1">All Courses</span>
                {allStudentsTotal > 0 && (
                  <Badge variant="secondary" className="text-xs">{allStudentsTotal}</Badge>
                )}
              </button>

              <div className="h-px bg-border mx-3" />

              {loadingCourses ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              ) : courseList.length === 0 ? (
                <p className="text-sm text-muted-foreground px-4 py-3">No courses found.</p>
              ) : courseList.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { setSelectedId(c.id); setDropdownOpen(false) }}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted transition-colors text-left',
                    selectedId === c.id && 'bg-primary/5 text-primary font-medium'
                  )}
                >
                  <BookOpen className="w-4 h-4 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="truncate">{c.name}</p>
                    {(c.course_code || c.level) && (
                      <p className="text-[11px] text-muted-foreground truncate">
                        {[c.course_code, c.level].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                  {studentTotals[c.id] !== undefined && (
                    <Badge variant="secondary" className="text-xs shrink-0">
                      {studentTotals[c.id]}
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search name, email, matric…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        {/* Course meta badges */}
        {selectedId !== 'all' && selectedCourse && (
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            {selectedCourse.department && (
              <Badge variant="outline" className="text-xs">{selectedCourse.department}</Badge>
            )}
            {selectedCourse.level && (
              <Badge variant="outline" className="text-xs">{selectedCourse.level}</Badge>
            )}
            {selectedCourse.academic_year && (
              <Badge variant="outline" className="text-xs">{selectedCourse.academic_year}</Badge>
            )}
          </div>
        )}
      </div>

      {/* Close dropdown on outside click */}
      {dropdownOpen && (
        <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
      )}

      {/* ── Total count banner ──────────────────────────────────────────────── */}
      {!loadingStudents && currentTotal > 0 && (
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{currentTotal}</span>{' '}
            student{currentTotal !== 1 ? 's' : ''} enrolled
            {currentStudents.length < currentTotal && !search && (
              <span className="text-muted-foreground/70"> · showing first {currentStudents.length}</span>
            )}
          </span>
        </div>
      )}

      {/* ── Student cards ───────────────────────────────────────────────────── */}
      {loadingStudents ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            <GraduationCap className="w-8 h-8 opacity-40" />
          </div>
          <p className="text-sm font-medium">
            {currentStudents.length === 0
              ? selectedId === 'all'
                ? 'No students are enrolled in any of your courses yet.'
                : 'No students are enrolled in this course yet.'
              : 'No students match your search.'}
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((s) => {
              const sc = s as StudentInClass
              return (
                <button
                  key={s.id}
                  onClick={() => router.push(`/students/${s.id}`)}
                  className="group text-left rounded-2xl border bg-card hover:border-primary/50 hover:shadow-md transition-all duration-200 overflow-hidden"
                >
                  <div className="h-1.5 w-full bg-gradient-to-r from-primary/60 to-primary/20" />
                  <div className="p-4 space-y-3">

                    {/* Avatar + name */}
                    <div className="flex items-center gap-3">
                      <Avatar className="h-11 w-11 shrink-0">
                        <AvatarFallback className="text-sm font-bold bg-primary/10 text-primary">
                          {initials(s.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
                          {s.name}
                        </p>
                        {selectedId !== 'all' && sc.roll_number && (
                          <p className="text-xs text-muted-foreground">Roll #{sc.roll_number}</p>
                        )}
                      </div>
                    </div>

                    {/* Details */}
                    <div className="space-y-1.5 text-xs text-muted-foreground">
                      {sc.matric_number && (
                        <div className="flex items-center gap-2">
                          <Hash className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate font-mono">{sc.matric_number}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{s.email}</span>
                      </div>
                      {(sc.department || sc.level) && (
                        <div className="flex items-center gap-2">
                          <GraduationCap className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">
                            {[sc.department, sc.level].filter(Boolean).join(' · ')}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Attendance + grade (course view only) */}
                    {selectedId !== 'all' && (
                      <div className="pt-2 border-t border-border/60 flex items-center justify-between">
                        <AttendancePill rate={sc.attendance_rate} />
                        {sc.grade ? (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Award className="w-3.5 h-3.5" />
                            <span className="font-semibold text-foreground">{sc.grade}</span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">No grade</span>
                        )}
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          {/* ── Footer: Load More + count ───────────────────────────────────── */}
          <div className="mt-6 flex flex-col items-center gap-2">
            {hasMore && (
              <Button
                variant="outline"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="min-w-[200px]"
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Loading…
                  </>
                ) : (
                  `Load More (${currentTotal - currentStudents.length} remaining)`
                )}
              </Button>
            )}
            <p className="text-xs text-muted-foreground">
              {search
                ? `${filtered.length} result${filtered.length !== 1 ? 's' : ''} in loaded students`
                : `Showing ${currentStudents.length} of ${currentTotal} student${currentTotal !== 1 ? 's' : ''}`}
            </p>
          </div>
        </>
      )}
    </PageContainer>
  )
}
