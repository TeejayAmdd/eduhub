'use client'

import { useEffect, useState } from 'react'
import { GraduationCap, Loader2, Hash, Search, PenSquare } from 'lucide-react'
import { PageContainer } from '@/app/_components/page-container'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { classes, ca, type Class, type CAStudent } from '@/lib/api'

// Fixed CA split — total 30. Attendance 0–5 is scaled to its weight.
const W_ASSIGN = 10
const W_TEST = 10
const W_ATT = 10
const CA_MAX = W_ASSIGN + W_TEST + W_ATT
const PAGE_SIZE = 50

const fmt = (n: number) => (Math.round(n * 10) / 10).toString()

function useDebounce<T>(value: T, ms: number): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

export default function CAPage() {
  const [classList, setClassList] = useState<Class[]>([])
  const [classId, setClassId] = useState<string>('')
  const [loadingClasses, setLoadingClasses] = useState(true)

  const [students, setStudents] = useState<CAStudent[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 350)

  // Manual override editing
  const [editTarget, setEditTarget] = useState<CAStudent | null>(null)
  const [editScore, setEditScore] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  useEffect(() => {
    classes.list()
      .then((c) => setClassList(c))
      .finally(() => setLoadingClasses(false))
  }, [])

  // Load first page whenever course or search changes
  useEffect(() => {
    if (!classId) { setStudents([]); setTotal(0); return }
    setLoading(true)
    ca.get(Number(classId), { search: debouncedSearch, limit: PAGE_SIZE, offset: 0 })
      .then((r) => { setStudents(r.students); setTotal(r.total) })
      .catch(() => { setStudents([]); setTotal(0) })
      .finally(() => setLoading(false))
  }, [classId, debouncedSearch])

  const loadMore = () => {
    setLoadingMore(true)
    ca.get(Number(classId), { search: debouncedSearch, limit: PAGE_SIZE, offset: students.length })
      .then((r) => setStudents((prev) => [...prev, ...r.students]))
      .finally(() => setLoadingMore(false))
  }

  const computed = (s: CAStudent) => {
    const assign = s.assignment_avg !== null ? (s.assignment_avg / 100) * W_ASSIGN : 0
    const test = s.quiz_avg_pct !== null ? (s.quiz_avg_pct / 100) * W_TEST : 0
    const att = (s.attendance_points / 5) * W_ATT
    return { assign, test, att, total: assign + test + att }
  }
  const effectiveTotal = (s: CAStudent) =>
    s.ca_override !== null ? s.ca_override : computed(s).total

  const openEdit = (s: CAStudent) => {
    setEditTarget(s)
    setEditScore(fmt(effectiveTotal(s)))
    setEditError('')
  }

  const patchStudent = (studentId: number, override: number | null) => {
    setStudents((prev) => prev.map((s) =>
      s.student_id === studentId ? { ...s, ca_override: override } : s
    ))
  }

  const saveOverride = async () => {
    if (!editTarget) return
    const v = Number(editScore)
    if (editScore === '' || Number.isNaN(v) || v < 0 || v > CA_MAX) {
      setEditError(`Enter a mark between 0 and ${CA_MAX}.`)
      return
    }
    setEditSaving(true); setEditError('')
    try {
      await ca.setOverride(Number(classId), editTarget.student_id, v)
      patchStudent(editTarget.student_id, v)
      setEditTarget(null)
    } catch (e: unknown) {
      setEditError(e instanceof Error ? e.message : 'Failed to save.')
    } finally {
      setEditSaving(false)
    }
  }

  const resetOverride = async () => {
    if (!editTarget) return
    setEditSaving(true); setEditError('')
    try {
      await ca.clearOverride(Number(classId), editTarget.student_id)
      patchStudent(editTarget.student_id, null)
      setEditTarget(null)
    } catch (e: unknown) {
      setEditError(e instanceof Error ? e.message : 'Failed to reset.')
    } finally {
      setEditSaving(false)
    }
  }

  return (
    <PageContainer>
      <div className="w-full max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <GraduationCap className="w-6 h-6" />
            Continuous Assessment
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Each student&apos;s assignment, test and attendance marks combined per course — CA is out of {CA_MAX} (exam is the other 70).
          </p>
        </div>

        {/* Controls */}
        <Card>
          <CardContent className="pt-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Course</label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={classId}
                  onChange={(e) => { setClassId(e.target.value); setSearch('') }}
                  disabled={loadingClasses}
                >
                  <option value="">{loadingClasses ? 'Loading…' : 'Select course…'}</option>
                  {classList.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Search student</label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                    placeholder="Name or matric number…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    disabled={!classId}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        {!classId ? (
          <Card>
            <CardContent className="py-16 text-center text-sm text-muted-foreground">
              Select a course to see its continuous assessment.
            </CardContent>
          </Card>
        ) : loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : students.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-sm text-muted-foreground">
              {debouncedSearch ? `No students match “${debouncedSearch}”.` : 'No enrolled students for this course yet.'}
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                        <th className="px-4 py-3 font-medium">Student</th>
                        <th className="px-4 py-3 font-medium text-right">Assign<br /><span className="normal-case font-normal">/ {W_ASSIGN}</span></th>
                        <th className="px-4 py-3 font-medium text-right">Test<br /><span className="normal-case font-normal">/ {W_TEST}</span></th>
                        <th className="px-4 py-3 font-medium text-right">Att<br /><span className="normal-case font-normal">/ {W_ATT}</span></th>
                        <th className="px-4 py-3 font-medium text-right">CA<br /><span className="normal-case font-normal">/ {CA_MAX}</span></th>
                        <th className="px-4 py-3 font-medium text-right">Edit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {students.map((s) => {
                        const c = computed(s)
                        const overridden = s.ca_override !== null
                        return (
                          <tr key={s.student_id} className="hover:bg-muted/30">
                            <td className="px-4 py-3">
                              <p className="font-medium">{s.student_name}</p>
                              {s.matric_number && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Hash className="w-3 h-3" />{s.matric_number}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums">
                              <p className="font-semibold">{fmt(c.assign)}</p>
                              <p className="text-xs text-muted-foreground">
                                {s.assignment_avg !== null ? `${fmt(s.assignment_avg)}/100 · ${s.assignment_count}×` : '—'}
                              </p>
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums">
                              <p className="font-semibold">{fmt(c.test)}</p>
                              <p className="text-xs text-muted-foreground">
                                {s.quiz_avg_score !== null
                                  ? `${fmt(s.quiz_avg_score)}/${fmt(s.quiz_avg_total ?? 0)} · ${fmt(s.quiz_avg_pct ?? 0)}%`
                                  : '—'}
                              </p>
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums">
                              <p className="font-semibold">{fmt(c.att)}</p>
                              <p className="text-xs text-muted-foreground">
                                {s.attendance_total > 0
                                  ? `${s.attendance_points}/5 · ${fmt(s.attendance_pct)}%`
                                  : '—'}
                              </p>
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums">
                              <p className="text-base font-semibold">{fmt(effectiveTotal(s))}</p>
                              {overridden && (
                                <p className="text-xs text-muted-foreground">edited · auto {fmt(c.total)}</p>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Button
                                size="icon" variant="ghost" className="h-8 w-8"
                                onClick={() => openEdit(s)}
                                title="Edit CA"
                              >
                                <PenSquare className="w-4 h-4" />
                              </Button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Showing {students.length} of {total}</p>
              {students.length < total && (
                <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore} className="gap-2">
                  {loadingMore && <Loader2 className="w-4 h-4 animate-spin" />}
                  Load more
                </Button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Edit CA Dialog */}
      <Dialog open={editTarget !== null} onOpenChange={(o) => { if (!o) setEditTarget(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenSquare className="w-5 h-5" />
              Edit CA
            </DialogTitle>
          </DialogHeader>

          {editTarget && (
            <div className="space-y-4 py-2">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">{editTarget.student_name}</p>
                {editTarget.matric_number && (
                  <p className="text-xs text-muted-foreground">{editTarget.matric_number}</p>
                )}
                <p className="text-xs text-muted-foreground pt-1">
                  Calculated CA: <span className="font-medium text-foreground">{fmt(computed(editTarget).total)}</span> / {CA_MAX}
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">CA mark (out of {CA_MAX})</label>
                <input
                  type="number" min={0} max={CA_MAX} step="0.5"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={editScore}
                  onChange={(e) => setEditScore(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Saving overrides the calculated mark until you reset it.
                </p>
              </div>

              {editError && <p className="text-xs text-destructive">{editError}</p>}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            {editTarget?.ca_override !== null && editTarget !== null && (
              <Button variant="outline" onClick={resetOverride} disabled={editSaving} className="mr-auto">
                Reset to calculated
              </Button>
            )}
            <Button variant="outline" onClick={() => setEditTarget(null)} disabled={editSaving}>
              Cancel
            </Button>
            <Button onClick={saveOverride} disabled={editSaving}>
              {editSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  )
}
