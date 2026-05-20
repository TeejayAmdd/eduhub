'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Calendar, Upload, Users, CheckCircle2, XCircle,
  ExternalLink, Loader2, Hash, User, CalendarClock,
} from 'lucide-react'
import { PageContainer } from '@/app/_components/page-container'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { assignments, classes, SUBMISSION_TYPES, type Assignment, type RosterEntry, type Class } from '@/lib/api'

export default function AssignmentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [roster, setRoster] = useState<RosterEntry[]>([])
  const [classList, setClassList] = useState<Class[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'submitted' | 'pending'>('submitted')
  const [extendOpen, setExtendOpen] = useState(false)
  const [newDueDate, setNewDueDate] = useState('')
  const [extendError, setExtendError] = useState('')
  const [extendLoading, setExtendLoading] = useState(false)

  useEffect(() => {
    Promise.all([
      assignments.get(Number(id)),
      assignments.roster(Number(id)),
      classes.list(),
    ])
      .then(([a, r, c]) => { setAssignment(a); setRoster(r); setClassList(c) })
      .catch(() => router.replace('/assignments'))
      .finally(() => setLoading(false))
  }, [id, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!assignment) return null

  // Pre-fill the datetime-local input with the current due date
  const toLocalInputValue = (dt: string) => {
    const d = new Date(dt)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  const openExtend = () => {
    setNewDueDate(toLocalInputValue(assignment.due_date))
    setExtendError('')
    setExtendOpen(true)
  }

  const handleExtend = async () => {
    if (!newDueDate) { setExtendError('Please pick a date.'); return }
    const picked = new Date(newDueDate)
    if (picked <= new Date(assignment.due_date)) {
      setExtendError('New deadline must be after the current deadline.')
      return
    }
    setExtendLoading(true)
    setExtendError('')
    try {
      const updated = await assignments.extend(assignment.id, picked.toISOString())
      setAssignment(updated)
      setExtendOpen(false)
    } catch (e: unknown) {
      setExtendError(e instanceof Error ? e.message : 'Failed to extend deadline.')
    } finally {
      setExtendLoading(false)
    }
  }

  const courseName = classList.find((c) => c.id === assignment.class_id)?.name ?? `Course ${assignment.class_id}`
  const submissionLabel = SUBMISSION_TYPES.find((t) => t.value === assignment.submission_type)?.label ?? assignment.submission_type
  const isOverdue = new Date(assignment.due_date) < new Date()

  const submitted = roster.filter((r) => r.submitted)
  const pending   = roster.filter((r) => !r.submitted)

  return (
    <PageContainer>
      <div className="max-w-3xl space-y-6">

        {/* Back */}
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/assignments">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Assignments
          </Link>
        </Button>

        {/* Header card */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <h1 className="text-2xl font-bold">{assignment.title}</h1>
                <div className="flex items-center gap-3 flex-wrap text-sm text-muted-foreground">
                  <Badge variant="outline">{courseName}</Badge>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    Due {new Date(assignment.due_date).toLocaleString('en-GB', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {isOverdue && <Badge variant="destructive">Overdue</Badge>}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={openExtend}
                className="shrink-0 gap-1.5"
              >
                <CalendarClock className="w-4 h-4" />
                Extend Deadline
              </Button>
            </div>

            {assignment.description && (
              <p className="text-sm text-muted-foreground leading-relaxed">{assignment.description}</p>
            )}

            <div className="flex items-center gap-2 rounded-lg bg-muted/60 px-4 py-3 text-sm">
              <Upload className="w-4 h-4 text-primary shrink-0" />
              <span className="font-medium">Submission mode:</span>
              <span className="text-muted-foreground">{submissionLabel}</span>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-4 pt-2">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{submitted.length}</p>
                <p className="text-xs text-muted-foreground">Submitted</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-amber-500">{pending.length}</p>
                <p className="text-xs text-muted-foreground">Not submitted</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{roster.length}</p>
                <p className="text-xs text-muted-foreground">Total enrolled</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tab buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => setTab('submitted')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === 'submitted'
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            Submitted ({submitted.length})
          </button>
          <button
            onClick={() => setTab('pending')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === 'pending'
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            <XCircle className="w-4 h-4" />
            Not Submitted ({pending.length})
          </button>
        </div>

        {/* Roster list */}
        {tab === 'submitted' ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Users className="w-4 h-4 text-green-600" />
                Students who submitted
              </CardTitle>
            </CardHeader>
            <CardContent>
              {submitted.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No submissions yet.</p>
              ) : (
                <div className="divide-y divide-border">
                  {submitted.map((r) => (
                    <div key={r.student_id} className="py-4 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-0.5">
                          <p className="text-sm font-medium flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-muted-foreground" />
                            {r.student_name}
                          </p>
                          {r.matric_number && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                              <Hash className="w-3 h-3" />
                              {r.matric_number}
                            </p>
                          )}
                          {r.submitted_at && (
                            <p className="text-xs text-muted-foreground">
                              Submitted {new Date(r.submitted_at).toLocaleString('en-GB', {
                                day: '2-digit', month: 'short', year: 'numeric',
                                hour: '2-digit', minute: '2-digit',
                              })}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100">
                            <CheckCircle2 className="w-3 h-3 mr-1" />Submitted
                          </Badge>
                          {r.score !== null && (
                            <span className="text-xs font-semibold text-primary">Score: {r.score}</span>
                          )}
                        </div>
                      </div>
                      {r.file_url && (
                        <a
                          href={r.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          View submission
                        </a>
                      )}
                      {r.feedback && (
                        <p className="text-xs text-muted-foreground bg-muted/50 rounded px-3 py-2">
                          {r.feedback}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-500" />
                Students who haven&apos;t submitted
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pending.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">All enrolled students have submitted.</p>
              ) : (
                <div className="divide-y divide-border">
                  {pending.map((r) => (
                    <div key={r.student_id} className="py-3 flex items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-muted-foreground" />
                          {r.student_name}
                        </p>
                        {r.matric_number && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <Hash className="w-3 h-3" />
                            {r.matric_number}
                          </p>
                        )}
                      </div>
                      <Badge variant="outline" className="text-amber-600 border-amber-300 shrink-0">
                        Not submitted
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Extend Deadline Dialog */}
      <Dialog open={extendOpen} onOpenChange={setExtendOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="w-5 h-5 text-primary" />
              Extend Deadline
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Current deadline</p>
              <p className="text-sm font-medium">
                {new Date(assignment.due_date).toLocaleString('en-GB', {
                  day: '2-digit', month: 'long', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="new-due-date">
                New deadline
              </label>
              <input
                id="new-due-date"
                type="datetime-local"
                value={newDueDate}
                onChange={(e) => { setNewDueDate(e.target.value); setExtendError('') }}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {extendError && (
              <p className="text-xs text-destructive">{extendError}</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setExtendOpen(false)} disabled={extendLoading}>
              Cancel
            </Button>
            <Button onClick={handleExtend} disabled={extendLoading}>
              {extendLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirm Extension
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </PageContainer>
  )
}
