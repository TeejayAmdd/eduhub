'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Calendar, Upload, CheckCircle2, XCircle,
  ExternalLink, Loader2, Hash, User, CalendarClock, PenSquare, Eye, X, Search, Sparkles,
} from 'lucide-react'
import { PageContainer } from '@/app/_components/page-container'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { assignments, classes, SUBMISSION_TYPES, type Assignment, type RosterEntry, type Class } from '@/lib/api'
import { FormattedText } from '@/app/_components/formatted-text'

// Turn common share links into embeddable preview URLs where possible.
const toEmbedUrl = (url: string): string => {
  try {
    const u = new URL(url)
    const drive = url.match(/drive\.google\.com\/file\/d\/([^/]+)/)
    if (drive) return `https://drive.google.com/file/d/${drive[1]}/preview`
    if (u.hostname.includes('docs.google.com')) return url.replace(/\/edit.*$/, '/preview')
    return url
  } catch {
    return url
  }
}

const ROSTER_PAGE = 50

function useDebounce<T>(value: T, ms: number): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

export default function AssignmentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [classList, setClassList] = useState<Class[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'submitted' | 'pending'>('submitted')

  // Roster (paginated per tab + search)
  const [entries, setEntries] = useState<RosterEntry[]>([])
  const [rosterTotal, setRosterTotal] = useState(0)
  const [counts, setCounts] = useState({ enrolled_total: 0, submitted_count: 0, pending_count: 0 })
  const [rosterLoading, setRosterLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 350)
  const [extendOpen, setExtendOpen] = useState(false)
  const [newDueDate, setNewDueDate] = useState('')
  const [extendError, setExtendError] = useState('')
  const [extendLoading, setExtendLoading] = useState(false)

  // Side preview of a submission link
  const [preview, setPreview] = useState<{ name: string; url: string } | null>(null)

  // Grading
  const [gradeTarget, setGradeTarget] = useState<RosterEntry | null>(null)
  const [gradeScore, setGradeScore] = useState('')
  const [gradeFeedback, setGradeFeedback] = useState('')
  const [gradeSaving, setGradeSaving] = useState(false)
  const [gradeError, setGradeError] = useState('')
  const [suggesting, setSuggesting] = useState(false)

  // Bulk AI grading
  const [bulkRunning, setBulkRunning] = useState(false)
  const [bulkResult, setBulkResult] = useState<{ graded: number; remaining: number; skipped: { student_name: string; reason: string }[] } | null>(null)

  const openGrade = (r: RosterEntry) => {
    setGradeTarget(r)
    setGradeScore(r.score !== null ? String(r.score) : '')
    setGradeFeedback(r.feedback ?? '')
    setGradeError('')
  }

  const handleSuggest = async () => {
    if (!gradeTarget?.submission_id) return
    setSuggesting(true)
    setGradeError('')
    try {
      const r = await assignments.autoGradeSubmission(gradeTarget.submission_id)
      setGradeScore(String(r.score))
      setGradeFeedback(r.feedback)
    } catch (e: unknown) {
      setGradeError(e instanceof Error ? e.message : 'Could not auto-grade this submission.')
    } finally {
      setSuggesting(false)
    }
  }

  const handleAutoGradeAll = async () => {
    if (!confirm('Let Cortex grade all ungraded submissions for this assignment? You can review and edit every grade afterwards.')) return
    setBulkRunning(true)
    setBulkResult(null)
    try {
      const r = await assignments.autoGradeAll(Number(id))
      setBulkResult(r)
      await loadRoster(tab, debouncedSearch)
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Auto-grade failed.')
    } finally {
      setBulkRunning(false)
    }
  }

  const handleGrade = async () => {
    if (!gradeTarget?.submission_id) return
    const scoreNum = Number(gradeScore)
    if (gradeScore === '' || Number.isNaN(scoreNum) || scoreNum < 0 || scoreNum > 100) {
      setGradeError('Enter a score between 0 and 100.')
      return
    }
    setGradeSaving(true)
    setGradeError('')
    try {
      await assignments.gradeSubmission(gradeTarget.submission_id, {
        score: scoreNum,
        feedback: gradeFeedback.trim() || undefined,
        status: 'graded',
      })
      setEntries((prev) => prev.map((x) =>
        x.student_id === gradeTarget.student_id
          ? { ...x, score: scoreNum, feedback: gradeFeedback.trim() || null, status: 'graded' }
          : x
      ))
      setGradeTarget(null)
    } catch (e: unknown) {
      setGradeError(e instanceof Error ? e.message : 'Failed to save grade.')
    } finally {
      setGradeSaving(false)
    }
  }

  const loadRoster = async (status: 'submitted' | 'pending', q: string, append = false) => {
    const offset = append ? entries.length : 0
    if (append) setLoadingMore(true); else setRosterLoading(true)
    try {
      const r = await assignments.roster(Number(id), { status, search: q, limit: ROSTER_PAGE, offset })
      setEntries((prev) => append ? [...prev, ...r.entries] : r.entries)
      setRosterTotal(r.total)
      setCounts({ enrolled_total: r.enrolled_total, submitted_count: r.submitted_count, pending_count: r.pending_count })
    } finally {
      if (append) setLoadingMore(false); else setRosterLoading(false)
    }
  }

  useEffect(() => {
    Promise.all([assignments.get(Number(id)), classes.list()])
      .then(([a, c]) => { setAssignment(a); setClassList(c) })
      .catch(() => router.replace('/assignments'))
      .finally(() => setLoading(false))
  }, [id, router])

  useEffect(() => {
    loadRoster(tab, debouncedSearch)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, tab, debouncedSearch])

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

  return (
    <PageContainer>
      <div className="w-full max-w-7xl mx-auto space-y-6">

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
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div className="space-y-1 min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold break-words">{assignment.title}</h1>
                <div className="flex items-center gap-2 gap-y-1 flex-wrap text-sm text-muted-foreground">
                  <Badge variant="outline">{courseName}</Badge>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4 shrink-0" />
                    Due {new Date(assignment.due_date).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {isOverdue && <Badge variant="destructive">Overdue</Badge>}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={openExtend}
                className="shrink-0 gap-1.5 w-full sm:w-auto justify-center"
              >
                <CalendarClock className="w-4 h-4" />
                Extend Deadline
              </Button>
            </div>

            {assignment.description && (
              <FormattedText text={assignment.description} className="text-sm text-muted-foreground" />
            )}

            <div className="flex items-center gap-2 rounded-lg bg-muted/60 px-4 py-3 text-sm">
              <Upload className="w-4 h-4 text-primary shrink-0" />
              <span className="font-medium">Submission mode:</span>
              <span className="text-muted-foreground">{submissionLabel}</span>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-4 pt-2">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{counts.submitted_count}</p>
                <p className="text-xs text-muted-foreground">Submitted</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-amber-500">{counts.pending_count}</p>
                <p className="text-xs text-muted-foreground">Not submitted</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{counts.enrolled_total}</p>
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
            Submitted ({counts.submitted_count})
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
            Not Submitted ({counts.pending_count})
          </button>
        </div>

        {/* Roster + side preview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <div className="space-y-4 min-w-0">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Search student by name or matric…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Auto-grade (submitted tab) */}
            {tab === 'submitted' && counts.submitted_count > 0 && (
              <div className="space-y-2">
                <Button
                  variant="outline" size="sm"
                  onClick={handleAutoGradeAll}
                  disabled={bulkRunning}
                  className="gap-2"
                >
                  {bulkRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {bulkRunning ? 'Grading…' : 'Auto-grade ungraded with Cortex'}
                </Button>
                {bulkResult && (
                  <div className="rounded-lg border bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground space-y-1">
                    <p className="text-foreground font-medium">
                      Graded {bulkResult.graded} submission{bulkResult.graded === 1 ? '' : 's'}.
                      {bulkResult.remaining > 0 && ` ${bulkResult.remaining} ungraded remaining — run again to continue.`}
                    </p>
                    {bulkResult.skipped.length > 0 && (
                      <div>
                        <p>Couldn&apos;t read {bulkResult.skipped.length}:</p>
                        <ul className="list-disc pl-4">
                          {bulkResult.skipped.slice(0, 8).map((s, i) => (
                            <li key={i}><span className="text-foreground">{s.student_name}</span> — {s.reason}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <Card>
              <CardContent className="pt-5">
                {rosterLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : entries.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    {search
                      ? `No students match “${search}”.`
                      : tab === 'submitted' ? 'No submissions yet.' : 'All enrolled students have submitted.'}
                  </p>
                ) : (
                  <div className="divide-y divide-border">
                    {entries.map((r) => tab === 'submitted' ? (
                      <div key={r.student_id} className="py-4 space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-0.5 min-w-0">
                            <p className="text-sm font-medium flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
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
                            {r.status === 'graded' ? (
                              <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100">
                                <CheckCircle2 className="w-3 h-3 mr-1" />Graded
                              </Badge>
                            ) : (
                              <Badge variant="outline">Submitted</Badge>
                            )}
                            {r.score !== null && (
                              <span className="text-sm font-semibold">{r.score}/100</span>
                            )}
                            <Button
                              size="sm" variant="outline"
                              className="h-7 gap-1.5"
                              onClick={() => openGrade(r)}
                            >
                              <PenSquare className="w-3.5 h-3.5" />
                              {r.score !== null ? 'Edit grade' : 'Grade'}
                            </Button>
                          </div>
                        </div>
                        {r.file_url && (
                          <div className="flex items-center gap-4">
                            <button
                              type="button"
                              onClick={() => setPreview({ name: r.student_name, url: r.file_url! })}
                              className="hidden lg:inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Preview here
                            </button>
                            <a
                              href={r.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              Open link
                            </a>
                          </div>
                        )}
                        {r.feedback && (
                          <p className="text-xs text-muted-foreground bg-muted/50 rounded px-3 py-2">
                            {r.feedback}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div key={r.student_id} className="py-3 flex items-center justify-between gap-3">
                        <div className="space-y-0.5 min-w-0">
                          <p className="text-sm font-medium flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
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

                {entries.length < rosterTotal && (
                  <div className="flex justify-center pt-4">
                    <Button
                      variant="outline" size="sm"
                      onClick={() => loadRoster(tab, debouncedSearch, true)}
                      disabled={loadingMore}
                      className="gap-2"
                    >
                      {loadingMore && <Loader2 className="w-4 h-4 animate-spin" />}
                      Load more ({entries.length} of {rosterTotal})
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Side preview panel */}
          <aside className="hidden lg:block lg:sticky lg:top-4">
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between gap-2 border-b px-4 py-2.5">
                <p className="text-sm font-medium truncate">
                  {preview ? preview.name : 'Submission preview'}
                </p>
                {preview && (
                  <div className="flex items-center gap-1 shrink-0">
                    <a
                      href={preview.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded hover:bg-muted text-muted-foreground"
                      title="Open in new tab"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    <button
                      onClick={() => setPreview(null)}
                      className="p-1.5 rounded hover:bg-muted text-muted-foreground"
                      title="Close preview"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
              {preview ? (
                <div className="flex flex-col">
                  <iframe
                    src={toEmbedUrl(preview.url)}
                    className="w-full h-[66vh] bg-background"
                    title="Submission preview"
                  />
                  <div className="border-t px-4 py-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                    <span className="min-w-0 truncate">Blank or &ldquo;refused to connect&rdquo;? The site blocks embedding.</span>
                    <a
                      href={preview.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-primary hover:underline shrink-0"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Open in new tab
                    </a>
                  </div>
                </div>
              ) : (
                <div className="h-[72vh] flex flex-col items-center justify-center gap-2 text-center px-6 text-muted-foreground">
                  <Eye className="w-8 h-8 opacity-40" />
                  <p className="text-sm">Click &ldquo;Preview here&rdquo; on a submission to view it.</p>
                  <p className="text-xs">Some links (e.g. private Google Drive) may block embedding — use &ldquo;Open in new tab&rdquo;.</p>
                </div>
              )}
            </Card>
          </aside>
        </div>
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

      {/* Grade Dialog */}
      <Dialog open={gradeTarget !== null} onOpenChange={(o) => { if (!o) setGradeTarget(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenSquare className="w-5 h-5" />
              Grade submission
            </DialogTitle>
          </DialogHeader>

          {gradeTarget && (
            <div className="space-y-4 py-2">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">{gradeTarget.student_name}</p>
                {gradeTarget.matric_number && (
                  <p className="text-xs text-muted-foreground">{gradeTarget.matric_number}</p>
                )}
              </div>

              {gradeTarget.file_url && (
                <div className="flex items-center justify-between gap-3">
                  <a
                    href={gradeTarget.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open submission link
                  </a>
                  <Button
                    type="button" variant="outline" size="sm"
                    className="h-7 gap-1.5 shrink-0"
                    onClick={handleSuggest}
                    disabled={suggesting}
                  >
                    {suggesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    Suggest with Cortex
                  </Button>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Score (out of 100)</label>
                <input
                  type="number" min={0} max={100}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={gradeScore}
                  onChange={(e) => setGradeScore(e.target.value)}
                  placeholder="e.g. 75"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Feedback <span className="text-muted-foreground text-xs font-normal">(optional)</span></label>
                <textarea
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  value={gradeFeedback}
                  onChange={(e) => setGradeFeedback(e.target.value)}
                  placeholder="Comments for the student…"
                />
              </div>

              {gradeError && <p className="text-xs text-destructive">{gradeError}</p>}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setGradeTarget(null)} disabled={gradeSaving}>
              Cancel
            </Button>
            <Button onClick={handleGrade} disabled={gradeSaving}>
              {gradeSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save & approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </PageContainer>
  )
}
