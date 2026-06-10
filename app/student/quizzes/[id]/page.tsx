'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, ArrowRight, Clock, FileText, Check,
  X, Loader2, AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { quizzes, classes, type Quiz, type QuizQuestion, type QuizAttempt, type Class } from '@/lib/api'

type Phase = 'info' | 'taking' | 'result'

const OPTION_LABELS = ['A', 'B', 'C', 'D']
const OPTION_KEYS = ['a', 'b', 'c', 'd'] as const

// ── Timer hook ────────────────────────────────────────────────────────────────
function useTimer(durationSeconds: number, startKey: string, onExpire: () => void) {
  const [remaining, setRemaining] = useState(durationSeconds)
  const expiredRef = useRef(false)

  useEffect(() => {
    if (!startKey) return
    const storageKey = `quiz_start_${startKey}`
    let startedAt = Number(localStorage.getItem(storageKey) ?? 0)
    if (!startedAt) {
      startedAt = Date.now()
      localStorage.setItem(storageKey, String(startedAt))
    }

    const tick = () => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000)
      const left = Math.max(0, durationSeconds - elapsed)
      setRemaining(left)
      if (left === 0 && !expiredRef.current) {
        expiredRef.current = true
        localStorage.removeItem(storageKey)
        onExpire()
      }
    }

    tick()
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [startKey, durationSeconds])

  const clear = useCallback(() => {
    localStorage.removeItem(`quiz_start_${startKey}`)
  }, [startKey])

  return { remaining, clear }
}

function formatTime(s: number) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

// ── Main component ────────────────────────────────────────────────────────────
export default function StudentQuizPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [phase, setPhase] = useState<Phase>('info')
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [attempt, setAttempt] = useState<QuizAttempt | null>(null)
  const [course, setCourse] = useState<Class | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  // Answers: { [question_id]: "a"|"b"|"c"|"d" }
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [currentQ, setCurrentQ] = useState(0)
  const [reviewMode, setReviewMode] = useState(false)

  const quizId = Number(id)

  useEffect(() => {
    const load = async () => {
      try {
        const [q, cs] = await Promise.all([quizzes.get(quizId), classes.list()])
        setQuiz(q)
        const found = cs.find((c) => c.id === q.class_id) ?? null
        setCourse(found)

        // If already submitted → jump straight to result
        if (q.my_score !== null) {
          const [qs, att] = await Promise.all([
            quizzes.questions(quizId),
            quizzes.myResult(quizId),
          ])
          setQuestions(qs)
          setAttempt(att)
          if (att.answers) setAnswers(JSON.parse(att.answers))
          setReviewMode(true)
          setPhase('result')
        }
      } catch {
        router.replace('/student/quizzes')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [quizId])

  const handleStart = async () => {
    setLoading(true)
    try {
      const [att, qs] = await Promise.all([
        quizzes.start(quizId),
        quizzes.questions(quizId),
      ])
      setAttempt(att)
      setQuestions(qs)
      setCurrentQ(0)
      setPhase('taking')
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to start quiz.')
    } finally {
      setLoading(false)
    }
  }

  const submitQuiz = useCallback(async (autoSubmit = false) => {
    if (submitting) return
    if (!autoSubmit) {
      const unanswered = questions.length - Object.keys(answers).length
      if (unanswered > 0 && !confirm(`You have ${unanswered} unanswered question(s). Submit anyway?`)) return
    }
    setSubmitting(true)
    setSubmitError('')
    try {
      const result = await quizzes.submit(quizId, answers)
      timerClearRef.current?.()
      setAttempt(result)
      // Re-fetch questions: correct answers are now revealed post-submission,
      // so the review screen can mark each answer right/wrong.
      try {
        const revealed = await quizzes.questions(quizId)
        setQuestions(revealed)
      } catch {}
      setReviewMode(true)
      setPhase('result')
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : 'Failed to submit.')
    } finally {
      setSubmitting(false)
    }
  }, [quizId, answers, questions.length, submitting])

  const timerClearRef = useRef<(() => void) | null>(null)

  const { remaining, clear } = useTimer(
    (quiz?.duration_minutes ?? 30) * 60,
    phase === 'taking' ? `${quizId}_${attempt?.id ?? ''}` : '',
    () => submitQuiz(true),
  )
  timerClearRef.current = clear

  const lowTime = remaining <= 60

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!quiz) return null

  // ── Info page ─────────────────────────────────────────────────────────────
  if (phase === 'info') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          <Button variant="ghost" size="sm" onClick={() => router.push('/student/quizzes')} className="-ml-2 text-muted-foreground">
            <ArrowLeft className="w-4 h-4 mr-2" />Back
          </Button>

          <div className="rounded-2xl border bg-card overflow-hidden">
            <div className="px-6 pt-7 pb-6 border-b">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">
                <FileText className="w-3.5 h-3.5" />
                Assessment
              </div>
              <h1 className="text-2xl font-semibold tracking-tight leading-tight">{quiz.title}</h1>
              {quiz.description && (
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{quiz.description}</p>
              )}
            </div>

            <div className="px-6 py-6 space-y-5">
              {/* Info grid */}
              <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border">
                {[
                  { label: 'Time limit', value: `${quiz.duration_minutes} min` },
                  { label: 'Questions', value: `${quiz.question_count}` },
                  ...(course ? [{ label: 'Course', value: course.name }] : []),
                  { label: 'Attempts', value: 'One only' },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-card px-4 py-3">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-sm font-semibold mt-0.5 truncate">{value}</p>
                  </div>
                ))}
              </div>

              {/* Notice */}
              <div className="flex items-start gap-2.5 rounded-xl border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  The timer starts the moment you begin and the test auto-submits when time runs out.
                </span>
              </div>

              <Button onClick={handleStart} size="lg" className="w-full text-base gap-2" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Begin
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Taking page ───────────────────────────────────────────────────────────
  if (phase === 'taking') {
    const q = questions[currentQ]
    const answered = Object.keys(answers).length
    const progressPct = questions.length > 0 ? (answered / questions.length) * 100 : 0

    const questionNav = (
      <>
        <p className="text-xs text-muted-foreground mb-3">Jump to question</p>
        <div className="flex flex-wrap gap-1.5">
          {questions.map((qs, i) => {
            const isAnswered = !!answers[String(qs.id)]
            const isCurrent = i === currentQ
            return (
              <button
                key={qs.id}
                onClick={() => setCurrentQ(i)}
                className={`w-8 h-8 rounded-md text-xs font-semibold tabular-nums transition-colors ${
                  isCurrent
                    ? 'bg-foreground text-background'
                    : isAnswered
                      ? 'border border-foreground/30 bg-foreground/[0.04] text-foreground'
                      : 'border border-border text-muted-foreground hover:bg-muted/50'
                }`}
              >
                {i + 1}
              </button>
            )
          })}
        </div>
      </>
    )

    return (
      <div className="min-h-screen bg-background flex flex-col">

        {/* Sticky top bar */}
        <div className="sticky top-0 z-10 bg-card/80 backdrop-blur border-b">
          <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="text-sm font-medium truncate max-w-[160px] sm:max-w-xs">
                {quiz.title}
              </div>
              <div className="hidden sm:block text-xs text-muted-foreground tabular-nums">
                {answered}/{questions.length} answered
              </div>
            </div>

            {/* Timer */}
            <div className={`flex items-center gap-1.5 font-mono text-base font-semibold tabular-nums ${
              lowTime ? 'text-destructive' : 'text-foreground'
            }`}>
              <Clock className="w-4 h-4" />
              {formatTime(remaining)}
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-0.5 bg-muted">
            <div
              className="h-full bg-foreground transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-10 items-start">

            {/* Main column */}
            <div className="space-y-7 min-w-0">
              {/* Question number + text */}
              <div className="space-y-3">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground tabular-nums">
                  Question {currentQ + 1} <span className="text-muted-foreground/50">/ {questions.length}</span>
                </p>
                <p className="text-lg sm:text-xl font-medium leading-relaxed">{q.text}</p>
              </div>

              {/* Options */}
              <div className="space-y-2.5">
                {OPTION_KEYS.map((opt, i) => {
                  const text = q[`option_${opt}` as keyof QuizQuestion] as string | null
                  if (!text) return null
                  const selected = answers[String(q.id)] === opt
                  return (
                    <button
                      key={opt}
                      onClick={() => setAnswers((a) => ({ ...a, [String(q.id)]: opt }))}
                      className={`w-full text-left flex items-center gap-3.5 rounded-xl border px-4 py-3.5 text-sm font-medium transition-colors ${
                        selected
                          ? 'border-foreground bg-foreground/[0.04]'
                          : 'border-border hover:bg-muted/50'
                      }`}
                    >
                      <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold shrink-0 border transition-colors ${
                        selected ? 'border-foreground bg-foreground text-background' : 'border-border text-muted-foreground'
                      }`}>
                        {OPTION_LABELS[i]}
                      </span>
                      <span className="flex-1">{text}</span>
                      {selected && <Check className="w-4 h-4 shrink-0" />}
                    </button>
                  )
                })}
              </div>

              {/* Nav buttons */}
              <div className="flex items-center justify-between pt-1">
                <Button
                  variant="outline"
                  onClick={() => setCurrentQ((q) => Math.max(0, q - 1))}
                  disabled={currentQ === 0}
                  className="gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />Previous
                </Button>

                {currentQ < questions.length - 1 ? (
                  <Button onClick={() => setCurrentQ((q) => q + 1)} className="gap-2">
                    Next<ArrowRight className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button
                    onClick={() => submitQuiz(false)}
                    disabled={submitting}
                    className="gap-2"
                  >
                    {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    Submit
                    <Check className="w-4 h-4" />
                  </Button>
                )}
              </div>

              {submitError && (
                <p className="text-xs text-destructive text-center">{submitError}</p>
              )}

              {/* Navigator — inline on mobile */}
              <div className="lg:hidden pt-5 border-t">
                {questionNav}
              </div>
            </div>

            {/* Navigator — sidebar on laptop */}
            <aside className="hidden lg:block sticky top-24">
              <div className="rounded-xl border bg-card p-4">
                {questionNav}
              </div>
            </aside>
          </div>
        </div>
      </div>
    )
  }

  // ── Result page ───────────────────────────────────────────────────────────
  if (phase === 'result' && attempt) {
    const score = attempt.score ?? 0
    const total = attempt.total ?? questions.length
    const pct = total > 0 ? Math.round((score / total) * 100) : 0
    const passed = pct >= 50

    const submittedAnswers: Record<string, string> = attempt.answers
      ? JSON.parse(attempt.answers)
      : answers

    return (
      <div className="min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-5xl mx-auto space-y-6">

          <Button variant="ghost" size="sm" onClick={() => router.push('/student/quizzes')} className="-ml-2 text-muted-foreground">
            <ArrowLeft className="w-4 h-4 mr-2" />Back to Quizzes
          </Button>

          {/* Score card */}
          <div className="rounded-2xl border bg-card overflow-hidden">
            <div className="px-6 py-8 text-center border-b">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Your score</p>
              <p className="mt-3 text-6xl font-semibold tracking-tight tabular-nums">{pct}<span className="text-3xl text-muted-foreground">%</span></p>
              <p className="mt-2 text-sm text-muted-foreground tabular-nums">{score} of {total} correct</p>
              <div className={`inline-flex items-center gap-1.5 mt-4 px-3 py-1 rounded-full text-xs font-semibold border ${
                passed
                  ? 'border-emerald-600/30 text-emerald-700 dark:text-emerald-400'
                  : 'border-destructive/30 text-destructive'
              }`}>
                {passed ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                {passed ? 'Passed' : 'Not passed'}
              </div>
            </div>

            <div className="px-5 sm:px-6 py-5">
              <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">Review</h3>
              <div className="space-y-5 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-x-8 lg:gap-y-6">
                {questions.map((q, idx) => {
                  const chosen = submittedAnswers[String(q.id)]
                  const isCorrect = chosen === q.correct_option
                  return (
                    <div key={q.id} className="space-y-2.5">
                      <div className="flex items-start gap-2.5">
                        <span className="flex items-center justify-center w-5 h-5 rounded-md bg-muted text-xs font-semibold shrink-0 mt-0.5 tabular-nums">
                          {idx + 1}
                        </span>
                        <p className="text-sm font-medium leading-snug">{q.text}</p>
                      </div>
                      <div className="pl-7.5 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {OPTION_KEYS.map((opt, i) => {
                          const text = q[`option_${opt}` as keyof QuizQuestion] as string | null
                          if (!text) return null
                          const isChosen = chosen === opt
                          const isAnswer = q.correct_option === opt

                          let cls = 'border-border text-muted-foreground'
                          if (isAnswer) cls = 'border-emerald-600/40 bg-emerald-500/[0.06] text-emerald-700 dark:text-emerald-400'
                          if (isChosen && !isCorrect) cls = 'border-destructive/40 bg-destructive/[0.06] text-destructive'

                          return (
                            <div key={opt} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${cls}`}>
                              <span className="font-semibold w-4 shrink-0">{OPTION_LABELS[i]}</span>
                              {isAnswer && <Check className="w-3.5 h-3.5 shrink-0" />}
                              {isChosen && !isCorrect && <X className="w-3.5 h-3.5 shrink-0" />}
                              <span className="truncate">{text}</span>
                            </div>
                          )
                        })}
                      </div>
                      {!chosen && (
                        <p className="pl-7.5 text-xs text-muted-foreground italic">Not answered</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <Button variant="outline" onClick={() => router.push('/student/quizzes')} className="w-full">
            Back to Quizzes
          </Button>
        </div>
      </div>
    )
  }

  return null
}
