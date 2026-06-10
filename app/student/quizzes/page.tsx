'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PenSquare, Clock, CheckCircle2, ChevronRight, Loader2, BookOpen, Lock } from 'lucide-react'
import { PageContainer } from '@/app/_components/page-container'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { quizzes, classes, type Quiz, type Class } from '@/lib/api'

export default function StudentQuizzesPage() {
  const router = useRouter()
  const [allQuizzes, setAllQuizzes] = useState<Quiz[]>([])
  const [classList, setClassList] = useState<Class[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([quizzes.list(), classes.list()])
      .then(([q, c]) => { setAllQuizzes(q); setClassList(c) })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const pending  = allQuizzes.filter((q) => q.my_score === null)
  const completed = allQuizzes.filter((q) => q.my_score !== null)

  return (
    <PageContainer>
      <div className="w-full max-w-7xl mx-auto space-y-6">

        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <PenSquare className="w-6 h-6 text-primary" />
            Quizzes & Tests
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Timed quizzes — results are shown instantly after you submit.
          </p>
        </div>

        {allQuizzes.length === 0 ? (
          <Card>
            <CardContent className="py-16 flex flex-col items-center gap-3 text-center">
              <PenSquare className="w-10 h-10 text-muted-foreground/40" />
              <p className="font-medium">No quizzes available</p>
              <p className="text-sm text-muted-foreground">Your lecturers haven&apos;t published any quizzes yet.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Pending */}
            {pending.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  To take ({pending.length})
                </h2>
                {pending.map((q) => {
                  const course = classList.find((c) => c.id === q.class_id)
                  return (
                    <Card key={q.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="pt-4 pb-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="space-y-1 flex-1 min-w-0">
                            <p className="font-semibold truncate">{q.title}</p>
                            {q.description && (
                              <p className="text-sm text-muted-foreground line-clamp-1">{q.description}</p>
                            )}
                            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                              {course && (
                                <span className="flex items-center gap-1">
                                  <BookOpen className="w-3.5 h-3.5" />{course.name}
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" />{q.duration_minutes} min
                              </span>
                              <span className="flex items-center gap-1">
                                <PenSquare className="w-3.5 h-3.5" />{q.question_count} questions
                              </span>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => router.push(`/student/quizzes/${q.id}`)}
                            className="shrink-0 gap-1.5"
                          >
                            Start Quiz
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </section>
            )}

            {/* Completed */}
            {completed.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Completed ({completed.length})
                </h2>
                {completed.map((q) => {
                  const course = classList.find((c) => c.id === q.class_id)
                  const pct = q.my_total ? Math.round(((q.my_score ?? 0) / q.my_total) * 100) : 0
                  return (
                    <Card key={q.id} className="hover:shadow-md transition-shadow opacity-90">
                      <CardContent className="pt-4 pb-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="space-y-1 flex-1 min-w-0">
                            <p className="font-semibold truncate">{q.title}</p>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                              {course && (
                                <span className="flex items-center gap-1">
                                  <BookOpen className="w-3.5 h-3.5" />{course.name}
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" />{q.duration_minutes} min
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <div className="text-right">
                              <p className="text-sm font-semibold tabular-nums">{q.my_score}/{q.my_total}</p>
                              <p className={`text-xs font-semibold tabular-nums ${
                                pct >= 50 ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive'
                              }`}>{pct}%</p>
                            </div>
                            <Button
                              variant="outline" size="sm"
                              onClick={() => router.push(`/student/quizzes/${q.id}`)}
                              className="gap-1.5"
                            >
                              Review
                              <ChevronRight className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </section>
            )}
          </>
        )}
      </div>
    </PageContainer>
  )
}
