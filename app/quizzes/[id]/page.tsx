'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Plus, Trash2, Edit3, Check,
  Eye, EyeOff, Clock, Users, BookOpen, Loader2,
  FileText, Hash, AlertCircle, Lock, Search,
} from 'lucide-react'
import { PageContainer } from '@/app/_components/page-container'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { quizzes, classes, type Quiz, type QuizQuestion, type QuizResultDetail, type Class } from '@/lib/api'

type Tab = 'questions' | 'results'

interface QForm {
  text: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_option: string
}

const emptyForm = (): QForm => ({
  text: '', option_a: '', option_b: '', option_c: '', option_d: '', correct_option: 'a',
})

const OPTION_LABELS: Record<string, string> = { a: 'A', b: 'B', c: 'C', d: 'D' }

export default function QuizBuilderPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [results, setResults] = useState<QuizResultDetail[]>([])
  const [resultsMeta, setResultsMeta] = useState({
    total: 0, enrolled_total: 0, submitted_count: 0, not_submitted_count: 0, avg_pct: null as number | null,
  })
  const [resultsSearch, setResultsSearch] = useState('')
  const [loadingMoreResults, setLoadingMoreResults] = useState(false)
  const [classList, setClassList] = useState<Class[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('questions')

  // Question form
  const [qDialogOpen, setQDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [qForm, setQForm] = useState<QForm>(emptyForm())
  const [qSaving, setQSaving] = useState(false)
  const [qError, setQError] = useState('')

  const load = async () => {
    const qid = Number(id)
    try {
      const [q, qs, cs] = await Promise.all([
        quizzes.get(qid),
        quizzes.questions(qid),
        classes.list(),
      ])
      setQuiz(q); setQuestions(qs); setClassList(cs)
    } catch {
      router.replace('/quizzes')
    } finally {
      setLoading(false)
    }
  }

  const RESULTS_PAGE = 50

  const loadResults = async (search: string) => {
    try {
      const r = await quizzes.results(Number(id), { search, limit: RESULTS_PAGE, offset: 0 })
      setResults(r.results)
      setResultsMeta({
        total: r.total, enrolled_total: r.enrolled_total,
        submitted_count: r.submitted_count, not_submitted_count: r.not_submitted_count,
        avg_pct: r.avg_pct,
      })
    } catch {}
  }

  const loadMoreResults = async () => {
    setLoadingMoreResults(true)
    try {
      const r = await quizzes.results(Number(id), { search: resultsSearch, limit: RESULTS_PAGE, offset: results.length })
      setResults((prev) => [...prev, ...r.results])
    } finally {
      setLoadingMoreResults(false)
    }
  }

  useEffect(() => {
    load()
  }, [id])

  useEffect(() => {
    if (tab !== 'results') return
    const t = setTimeout(() => loadResults(resultsSearch), 350)
    return () => clearTimeout(t)
  }, [tab, resultsSearch])

  const togglePublish = async () => {
    if (!quiz) return
    try {
      const updated = await quizzes.update(quiz.id, { is_published: !quiz.is_published })
      setQuiz(updated)
    } catch {}
  }

  const openAdd = () => {
    setEditingId(null)
    setQForm(emptyForm())
    setQError('')
    setQDialogOpen(true)
  }

  const openEdit = (q: QuizQuestion) => {
    setEditingId(q.id)
    setQForm({
      text: q.text,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c ?? '',
      option_d: q.option_d ?? '',
      correct_option: q.correct_option ?? 'a',
    })
    setQError('')
    setQDialogOpen(true)
  }

  const saveQuestion = async () => {
    if (!qForm.text.trim() || !qForm.option_a.trim() || !qForm.option_b.trim()) {
      setQError('Question text and at least options A & B are required.')
      return
    }
    setQSaving(true); setQError('')
    const payload = {
      text: qForm.text.trim(),
      option_a: qForm.option_a.trim(),
      option_b: qForm.option_b.trim(),
      option_c: qForm.option_c.trim() || undefined,
      option_d: qForm.option_d.trim() || undefined,
      correct_option: qForm.correct_option,
    }
    try {
      if (editingId !== null) {
        const updated = await quizzes.updateQuestion(Number(id), editingId, payload)
        setQuestions((prev) => prev.map((q) => q.id === editingId ? updated : q))
      } else {
        const added = await quizzes.addQuestion(Number(id), payload)
        setQuestions((prev) => [...prev, added])
      }
      setQDialogOpen(false)
      // Refresh quiz to get updated question_count
      const updated = await quizzes.get(Number(id))
      setQuiz(updated)
    } catch (e: unknown) {
      setQError(e instanceof Error ? e.message : 'Failed to save question.')
    } finally {
      setQSaving(false)
    }
  }

  const deleteQuestion = async (qId: number) => {
    if (!confirm('Delete this question?')) return
    try {
      await quizzes.deleteQuestion(Number(id), qId)
      setQuestions((prev) => prev.filter((q) => q.id !== qId))
      const updated = await quizzes.get(Number(id))
      setQuiz(updated)
    } catch {}
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!quiz) return null

  const course = classList.find((c) => c.id === quiz.class_id)

  return (
    <PageContainer>
      <div className="w-full max-w-7xl mx-auto space-y-6">

        {/* Back */}
        <Button variant="ghost" size="sm" asChild className="-ml-2 text-muted-foreground">
          <Link href="/quizzes">
            <ArrowLeft className="w-4 h-4 mr-2" />Back to Quizzes
          </Link>
        </Button>

        {/* Header card */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-semibold tracking-tight">{quiz.title}</h1>
                  <Badge variant={quiz.is_published ? 'default' : 'secondary'}>
                    {quiz.is_published ? 'Published' : 'Draft'}
                  </Badge>
                </div>
                {quiz.description && (
                  <p className="text-sm text-muted-foreground">{quiz.description}</p>
                )}
                <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap pt-0.5">
                  {course && (
                    <span className="flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4" />{course.name}
                    </span>
                  )}
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />{quiz.duration_minutes} min
                  </span>
                  <span className="flex items-center gap-1.5">
                    <FileText className="w-4 h-4" />{questions.length} questions
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Users className="w-4 h-4" />{quiz.attempt_count} submissions
                  </span>
                </div>
              </div>
              <Button
                variant={quiz.is_published ? 'outline' : 'default'}
                size="sm"
                onClick={togglePublish}
                className="shrink-0 gap-1.5"
              >
                {quiz.is_published
                  ? <><EyeOff className="w-4 h-4" />Unpublish</>
                  : <><Eye className="w-4 h-4" />Publish</>
                }
              </Button>
            </div>

            {!quiz.is_published && (
              <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {questions.length === 0
                  ? 'Add at least one question before publishing.'
                  : 'This quiz is a draft — publish it so students can take it.'}
              </div>
            )}
            {quiz.is_locked && (
              <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                <Lock className="w-4 h-4 shrink-0" />
                Students have started this quiz. You can edit existing questions, but adding or deleting is locked.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabs */}
        <div className="inline-flex gap-1 p-1 rounded-lg bg-muted">
          {(['questions', 'results'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tab === t
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t === 'questions' ? `Questions (${questions.length})` : `Results (${quiz.attempt_count})`}
            </button>
          ))}
        </div>

        {/* ── Questions tab ── */}
        {tab === 'questions' && (
          <div className="space-y-3">
            {!quiz.is_locked && (
              <div className="flex justify-end">
                <Button onClick={openAdd} size="sm" className="gap-2">
                  <Plus className="w-4 h-4" />Add Question
                </Button>
              </div>
            )}

            {questions.length === 0 ? (
              <Card>
                <CardContent className="py-12 flex flex-col items-center gap-3 text-center">
                  <FileText className="w-8 h-8 text-muted-foreground/40" />
                  <p className="font-medium">No questions yet</p>
                  <p className="text-sm text-muted-foreground">Add your first question to start building the test.</p>
                </CardContent>
              </Card>
            ) : (
              questions.map((q, idx) => (
                <Card key={q.id} className="group">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start gap-3">
                      <span className="flex items-center justify-center w-6 h-6 rounded-md bg-muted text-xs font-semibold shrink-0 mt-0.5 tabular-nums">
                        {idx + 1}
                      </span>
                      <div className="flex-1 space-y-2.5 min-w-0">
                        <p className="text-sm font-medium leading-snug">{q.text}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {(['a', 'b', 'c', 'd'] as const).map((opt) => {
                            const text = q[`option_${opt}` as keyof QuizQuestion] as string | null
                            if (!text) return null
                            const isCorrect = q.correct_option === opt
                            return (
                              <div
                                key={opt}
                                className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm ${
                                  isCorrect
                                    ? 'border-emerald-600/40 bg-emerald-500/[0.06] text-emerald-700 dark:text-emerald-400 font-medium'
                                    : 'border-border text-muted-foreground'
                                }`}
                              >
                                <span className="font-semibold text-xs w-4 shrink-0">
                                  {OPTION_LABELS[opt]}
                                </span>
                                {isCorrect && <Check className="w-3.5 h-3.5 shrink-0" />}
                                <span className="truncate">{text}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                      <div className="flex gap-0.5 shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(q)}>
                          <Edit3 className="w-4 h-4" />
                        </Button>
                        {!quiz.is_locked && (
                          <Button
                            variant="ghost" size="icon"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => deleteQuestion(q.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {/* ── Results tab ── */}
        {tab === 'results' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border bg-border">
              <div className="bg-card px-4 py-5 text-center">
                <p className="text-2xl font-semibold tabular-nums">{resultsMeta.submitted_count}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Submitted</p>
              </div>
              <div className="bg-card px-4 py-5 text-center">
                <p className="text-2xl font-semibold tabular-nums">{resultsMeta.not_submitted_count}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Not submitted</p>
              </div>
              <div className="bg-card px-4 py-5 text-center">
                <p className="text-2xl font-semibold tabular-nums">{resultsMeta.avg_pct !== null ? `${resultsMeta.avg_pct}%` : '—'}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Average</p>
              </div>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Search student by name or matric number…"
                value={resultsSearch}
                onChange={(e) => setResultsSearch(e.target.value)}
              />
            </div>

            <Card>
              <CardContent className="pt-5">
                <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
                  Student results
                </h3>
                {results.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    {resultsSearch ? `No students match “${resultsSearch}”.` : 'No students enrolled yet.'}
                  </p>
                ) : (
                  <div className="divide-y divide-border">
                    {results.map((r) => (
                      <div key={r.student_id} className="py-3 flex items-center justify-between gap-3">
                        <div className="space-y-0.5 min-w-0">
                          <p className="text-sm font-medium truncate">{r.student_name}</p>
                          {r.matric_number && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Hash className="w-3 h-3" />{r.matric_number}
                            </p>
                          )}
                          {r.submitted_at && (
                            <p className="text-xs text-muted-foreground">
                              {new Date(r.submitted_at).toLocaleString('en-GB', {
                                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                              })}
                            </p>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          {r.score !== null ? (
                            <>
                              <p className="text-sm font-semibold tabular-nums">{r.score}/{r.total}</p>
                              <p className={`text-xs font-semibold tabular-nums ${
                                (r.percentage ?? 0) >= 50 ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive'
                              }`}>
                                {r.percentage}%
                              </p>
                            </>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground font-normal">
                              Pending
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {results.length < resultsMeta.total && (
                  <div className="flex justify-center pt-4">
                    <Button variant="outline" size="sm" onClick={loadMoreResults} disabled={loadingMoreResults} className="gap-2">
                      {loadingMoreResults && <Loader2 className="w-4 h-4 animate-spin" />}
                      Load more ({results.length} of {resultsMeta.total})
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Add/Edit Question Dialog */}
      <Dialog open={qDialogOpen} onOpenChange={setQDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId !== null ? 'Edit Question' : 'Add Question'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Question</label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                rows={3}
                placeholder="Type your question here…"
                value={qForm.text}
                onChange={(e) => setQForm((f) => ({ ...f, text: e.target.value }))}
              />
            </div>

            {(['a', 'b', 'c', 'd'] as const).map((opt) => (
              <div key={opt} className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded bg-muted text-xs font-semibold">
                    {opt.toUpperCase()}
                  </span>
                  Option {opt.toUpperCase()}
                  {(opt === 'c' || opt === 'd') && <span className="text-muted-foreground text-xs font-normal">(optional)</span>}
                </label>
                <input
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder={`Option ${opt.toUpperCase()}…`}
                  value={qForm[`option_${opt}` as keyof QForm]}
                  onChange={(e) => setQForm((f) => ({ ...f, [`option_${opt}`]: e.target.value }))}
                />
              </div>
            ))}

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Correct answer</label>
              <div className="grid grid-cols-4 gap-2">
                {(['a', 'b', 'c', 'd'] as const).map((opt) => {
                  const optText = qForm[`option_${opt}` as keyof QForm]
                  const available = opt === 'a' || opt === 'b' || !!optText
                  return (
                    <button
                      key={opt}
                      type="button"
                      disabled={!available}
                      onClick={() => setQForm((f) => ({ ...f, correct_option: opt }))}
                      className={`rounded-lg border py-2.5 text-sm font-semibold transition-colors ${
                        qForm.correct_option === opt
                          ? 'border-foreground bg-foreground text-background'
                          : available
                            ? 'border-input hover:bg-muted/60 text-muted-foreground'
                            : 'border-input opacity-30 cursor-not-allowed text-muted-foreground'
                      }`}
                    >
                      {opt.toUpperCase()}
                    </button>
                  )
                })}
              </div>
            </div>

            {qError && <p className="text-xs text-destructive">{qError}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setQDialogOpen(false)} disabled={qSaving}>
              Cancel
            </Button>
            <Button onClick={saveQuestion} disabled={qSaving}>
              {qSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingId !== null ? 'Save Changes' : 'Add Question'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  )
}
