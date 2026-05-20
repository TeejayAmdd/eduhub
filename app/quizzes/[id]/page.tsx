'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, PenSquare, Plus, Trash2, Edit3, Check,
  X, Eye, EyeOff, Clock, Users, BookOpen, Loader2,
  CheckCircle2, Hash, Trophy, AlertCircle,
} from 'lucide-react'
import { PageContainer } from '@/app/_components/page-container'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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

  const loadResults = async () => {
    try {
      const r = await quizzes.results(Number(id))
      setResults(r)
    } catch {}
  }

  useEffect(() => {
    load()
  }, [id])

  useEffect(() => {
    if (tab === 'results') loadResults()
  }, [tab])

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
  const submitted = results.filter((r) => r.score !== null)
  const avgPct = submitted.length > 0
    ? Math.round(submitted.reduce((s, r) => s + (r.percentage ?? 0), 0) / submitted.length)
    : null

  return (
    <PageContainer>
      <div className="max-w-3xl space-y-6">

        {/* Back */}
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/quizzes">
            <ArrowLeft className="w-4 h-4 mr-2" />Back to Quizzes
          </Link>
        </Button>

        {/* Header card */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-bold">{quiz.title}</h1>
                  <Badge variant={quiz.is_published ? 'default' : 'secondary'}>
                    {quiz.is_published ? 'Published' : 'Draft'}
                  </Badge>
                </div>
                {quiz.description && (
                  <p className="text-sm text-muted-foreground">{quiz.description}</p>
                )}
                <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap pt-1">
                  {course && (
                    <span className="flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4" />{course.name}
                    </span>
                  )}
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />{quiz.duration_minutes} minutes
                  </span>
                  <span className="flex items-center gap-1.5">
                    <PenSquare className="w-4 h-4" />{questions.length} questions
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

            {!quiz.is_published && questions.length === 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
                <AlertCircle className="w-4 h-4 shrink-0" />
                Add at least one question before publishing.
              </div>
            )}
            {!quiz.is_published && questions.length > 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 px-4 py-3 text-sm text-blue-700 dark:text-blue-400">
                <AlertCircle className="w-4 h-4 shrink-0" />
                Quiz is a draft — publish it so students can take it.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabs */}
        <div className="flex gap-2">
          {(['questions', 'results'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                tab === t
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {t === 'questions' ? `Questions (${questions.length})` : `Results (${quiz.attempt_count})`}
            </button>
          ))}
        </div>

        {/* ── Questions tab ── */}
        {tab === 'questions' && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button onClick={openAdd} size="sm" className="gap-2">
                <Plus className="w-4 h-4" />Add Question
              </Button>
            </div>

            {questions.length === 0 ? (
              <Card>
                <CardContent className="py-12 flex flex-col items-center gap-3 text-center">
                  <PenSquare className="w-8 h-8 text-muted-foreground/40" />
                  <p className="font-medium">No questions yet</p>
                  <p className="text-sm text-muted-foreground">Click "Add Question" to start building your quiz.</p>
                </CardContent>
              </Card>
            ) : (
              questions.map((q, idx) => (
                <Card key={q.id}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start gap-3">
                      <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <div className="flex-1 space-y-2 min-w-0">
                        <p className="text-sm font-medium leading-snug">{q.text}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {(['a', 'b', 'c', 'd'] as const).map((opt) => {
                            const text = q[`option_${opt}` as keyof QuizQuestion] as string | null
                            if (!text) return null
                            const isCorrect = q.correct_option === opt
                            return (
                              <div
                                key={opt}
                                className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm ${
                                  isCorrect
                                    ? 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 font-medium'
                                    : 'bg-muted/50 text-muted-foreground'
                                }`}
                              >
                                <span className={`font-bold text-xs w-4 shrink-0 ${isCorrect ? 'text-green-600' : ''}`}>
                                  {OPTION_LABELS[opt]}
                                </span>
                                {isCorrect && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                                <span className="truncate">{text}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(q)}>
                          <Edit3 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => deleteQuestion(q.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
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
            {results.length > 0 && avgPct !== null && (
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-5 text-center">
                    <p className="text-2xl font-bold text-green-600">{submitted.length}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Submitted</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-5 text-center">
                    <p className="text-2xl font-bold text-amber-500">{results.length - submitted.length}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Not submitted</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-5 text-center">
                    <p className="text-2xl font-bold text-primary">{avgPct}%</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Avg score</p>
                  </CardContent>
                </Card>
              </div>
            )}

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-primary" />
                  Student Results
                </CardTitle>
              </CardHeader>
              <CardContent>
                {results.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    No students have submitted yet.
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
                              <p className="text-sm font-bold">{r.score}/{r.total}</p>
                              <p className={`text-xs font-semibold ${
                                (r.percentage ?? 0) >= 70 ? 'text-green-600'
                                : (r.percentage ?? 0) >= 50 ? 'text-amber-500'
                                : 'text-red-500'
                              }`}>
                                {r.percentage}%
                              </p>
                            </>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              Not submitted
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
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
            <DialogTitle className="flex items-center gap-2">
              <PenSquare className="w-5 h-5 text-primary" />
              {editingId !== null ? 'Edit Question' : 'Add Question'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Question *</label>
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
                  <span className="flex items-center justify-center w-5 h-5 rounded bg-primary/10 text-primary text-xs font-bold">
                    {opt.toUpperCase()}
                  </span>
                  Option {opt.toUpperCase()}
                  {(opt === 'a' || opt === 'b') && <span className="text-destructive">*</span>}
                  {(opt === 'c' || opt === 'd') && <span className="text-muted-foreground text-xs">(optional)</span>}
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
              <label className="text-sm font-medium">Correct Answer *</label>
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
                      className={`rounded-lg border-2 py-2.5 text-sm font-bold transition-all ${
                        qForm.correct_option === opt
                          ? 'border-green-500 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400'
                          : available
                            ? 'border-input hover:border-primary text-muted-foreground'
                            : 'border-input opacity-30 cursor-not-allowed text-muted-foreground'
                      }`}
                    >
                      {opt.toUpperCase()}
                      {qForm.correct_option === opt && (
                        <CheckCircle2 className="w-3.5 h-3.5 mx-auto mt-0.5" />
                      )}
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
