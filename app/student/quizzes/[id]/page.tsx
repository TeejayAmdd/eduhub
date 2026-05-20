'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, ArrowRight, Clock, PenSquare, CheckCircle2,
  XCircle, Loader2, BookOpen, AlertCircle, Trophy,
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

  const timerColor = remaining <= 60
    ? 'text-red-500 animate-pulse'
    : remaining <= 180
      ? 'text-amber-500'
      : 'text-green-500'

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
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/30 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          <Button variant="ghost" size="sm" onClick={() => router.push('/student/quizzes')} className="-ml-2">
            <ArrowLeft className="w-4 h-4 mr-2" />Back
          </Button>

          <div className="rounded-2xl border bg-card shadow-xl overflow-hidden">
            {/* Coloured banner */}
            <div className="bg-gradient-to-r from-primary to-primary/80 px-6 py-8 text-primary-foreground">
              <div className="flex items-center gap-3 mb-3">
                <div className="rounded-full bg-white/20 p-2.5">
                  <PenSquare className="w-6 h-6" />
                </div>
                <span className="text-sm font-medium opacity-80">Quiz</span>
              </div>
              <h1 className="text-2xl font-bold leading-tight">{quiz.title}</h1>
              {quiz.description && (
                <p className="mt-2 text-sm opacity-80 leading-relaxed">{quiz.description}</p>
              )}
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Info grid */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: Clock, label: 'Time Limit', value: `${quiz.duration_minutes} minutes` },
                  { icon: PenSquare, label: 'Questions', value: `${quiz.question_count}` },
                  ...(course ? [{ icon: BookOpen, label: 'Course', value: course.name }] : []),
                  { icon: CheckCircle2, label: 'Attempts', value: 'One attempt only' },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="rounded-xl bg-muted/50 px-4 py-3">
                    <Icon className="w-4 h-4 text-primary mb-1" />
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-sm font-semibold mt-0.5">{value}</p>
                  </div>
                ))}
              </div>

              {/* Warning */}
              <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Once started, the timer begins immediately.
                  The quiz will auto-submit when time runs out.
                </span>
              </div>

              <Button onClick={handleStart} size="lg" className="w-full text-base gap-2" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Start Quiz
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

    return (
      <div className="min-h-screen bg-background flex flex-col">

        {/* Sticky top bar */}
        <div className="sticky top-0 z-10 bg-card border-b shadow-sm">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="text-sm font-medium truncate max-w-[160px] sm:max-w-xs">
                {quiz.title}
              </div>
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
                <PenSquare className="w-3.5 h-3.5" />
                {answered}/{questions.length} answered
              </div>
            </div>

            {/* Timer */}
            <div className={`flex items-center gap-1.5 font-mono text-lg font-bold ${timerColor}`}>
              <Clock className="w-5 h-5" />
              {formatTime(remaining)}
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-1 bg-muted">
            <div
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Question area */}
        <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-8 space-y-6">

          {/* Question number + text */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="font-bold text-primary">Q{currentQ + 1}</span>
              <span>of {questions.length}</span>
            </div>
            <p className="text-lg font-medium leading-relaxed">{q.text}</p>
          </div>

          {/* Options */}
          <div className="space-y-3">
            {OPTION_KEYS.map((opt, i) => {
              const text = q[`option_${opt}` as keyof QuizQuestion] as string | null
              if (!text) return null
              const selected = answers[String(q.id)] === opt
              return (
                <button
                  key={opt}
                  onClick={() => setAnswers((a) => ({ ...a, [String(q.id)]: opt }))}
                  className={`w-full text-left flex items-center gap-3 rounded-xl border-2 px-5 py-4 text-sm font-medium transition-all ${
                    selected
                      ? 'border-primary bg-primary/5 text-primary shadow-sm'
                      : 'border-border hover:border-primary/40 hover:bg-muted/40'
                  }`}
                >
                  <span className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shrink-0 border-2 transition-all ${
                    selected ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/30 text-muted-foreground'
                  }`}>
                    {OPTION_LABELS[i]}
                  </span>
                  {text}
                </button>
              )
            })}
          </div>

          {/* Nav buttons */}
          <div className="flex items-center justify-between pt-2">
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
                className="gap-2 bg-green-600 hover:bg-green-700 text-white"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Submit Quiz
                <CheckCircle2 className="w-4 h-4" />
              </Button>
            )}
          </div>

          {submitError && (
            <p className="text-xs text-destructive text-center">{submitError}</p>
          )}

          {/* Question navigation dots */}
          <div className="pt-4">
            <p className="text-xs text-muted-foreground mb-3 font-medium">Jump to question:</p>
            <div className="flex flex-wrap gap-2">
              {questions.map((qs, i) => {
                const isAnswered = !!answers[String(qs.id)]
                const isCurrent = i === currentQ
                return (
                  <button
                    key={qs.id}
                    onClick={() => setCurrentQ(i)}
                    className={`w-9 h-9 rounded-lg text-xs font-bold transition-all ${
                      isCurrent
                        ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2'
                        : isAnswered
                          ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 border border-green-300 dark:border-green-700'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {i + 1}
                  </button>
                )
              })}
            </div>
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
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 py-8 px-4">
        <div className="max-w-2xl mx-auto space-y-6">

          <Button variant="ghost" size="sm" onClick={() => router.push('/student/quizzes')} className="-ml-2">
            <ArrowLeft className="w-4 h-4 mr-2" />Back to Quizzes
          </Button>

          {/* Result card */}
          <div className="rounded-2xl border bg-card shadow-xl overflow-hidden">
            <div className={`px-6 py-8 text-white text-center ${
              passed
                ? 'bg-gradient-to-br from-green-500 to-emerald-600'
                : 'bg-gradient-to-br from-red-500 to-rose-600'
            }`}>
              <Trophy className="w-12 h-12 mx-auto mb-3 opacity-90" />
              <h2 className="text-3xl font-bold">{score}/{total}</h2>
              <p className="text-5xl font-black mt-1">{pct}%</p>
              <p className="mt-2 text-lg font-semibold opacity-90">
                {pct >= 80 ? 'Excellent!' : pct >= 70 ? 'Well done!' : pct >= 50 ? 'Good effort.' : 'Keep practising!'}
              </p>
              <div className={`inline-block mt-3 px-4 py-1.5 rounded-full text-sm font-bold ${
                passed ? 'bg-white/20' : 'bg-white/20'
              }`}>
                {passed ? '✓ Passed' : '✗ Not passed'}
              </div>
            </div>

            <div className="px-6 py-4">
              <h3 className="text-sm font-bold mb-4">Question Review</h3>
              <div className="space-y-4">
                {questions.map((q, idx) => {
                  const chosen = submittedAnswers[String(q.id)]
                  const isCorrect = chosen === q.correct_option
                  return (
                    <div key={q.id} className="space-y-2">
                      <div className="flex items-start gap-2">
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-muted text-xs font-bold shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <p className="text-sm font-medium leading-snug">{q.text}</p>
                      </div>
                      <div className="pl-7 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {OPTION_KEYS.map((opt, i) => {
                          const text = q[`option_${opt}` as keyof QuizQuestion] as string | null
                          if (!text) return null
                          const isChosen = chosen === opt
                          const isAnswer = q.correct_option === opt

                          let cls = 'border-border bg-muted/30 text-muted-foreground'
                          if (isAnswer) cls = 'border-green-400 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 font-medium'
                          if (isChosen && !isCorrect) cls = 'border-red-400 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 font-medium'

                          return (
                            <div key={opt} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${cls}`}>
                              <span className="font-bold w-4 shrink-0">{OPTION_LABELS[i]}</span>
                              {isAnswer && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                              {isChosen && !isCorrect && <XCircle className="w-3.5 h-3.5 shrink-0" />}
                              <span className="truncate">{text}</span>
                            </div>
                          )
                        })}
                      </div>
                      {!isCorrect && chosen && (
                        <p className="pl-7 text-xs text-muted-foreground">
                          Correct answer: <span className="font-semibold text-green-600">{q.correct_option?.toUpperCase()}</span>
                        </p>
                      )}
                      {!chosen && (
                        <p className="pl-7 text-xs text-muted-foreground italic">Not answered</p>
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
