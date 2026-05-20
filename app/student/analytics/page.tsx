'use client'

import { useEffect, useState } from 'react'
import { Loader2, TrendingUp, Award, BookOpen, CheckCircle2, GraduationCap } from 'lucide-react'
import { PageContainer } from '@/app/_components/page-container'
import { PageHeader } from '@/app/_components/page-header'
import { StatCard } from '@/app/_components/stat-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { analytics, type StudentAnalytics } from '@/lib/api'

const gradeColor: Record<string, string> = {
  A: 'bg-green-100 text-green-700',
  B: 'bg-blue-100 text-blue-700',
  C: 'bg-amber-100 text-amber-700',
  D: 'bg-orange-100 text-orange-700',
  F: 'bg-red-100 text-red-700',
}

function gradeFromScore(score: number | null, total = 100): string {
  if (score === null) return '—'
  const pct = (score / total) * 100
  if (pct >= 70) return 'A'
  if (pct >= 60) return 'B'
  if (pct >= 50) return 'C'
  if (pct >= 45) return 'D'
  return 'F'
}

export default function StudentAnalyticsPage() {
  const [data, setData] = useState<StudentAnalytics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    analytics.student().then(setData).catch(console.error).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <PageContainer>
        <PageHeader title="My Analytics" description="Your academic performance overview" />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </PageContainer>
    )
  }

  const statCards = [
    {
      label: 'Attendance Rate',
      value: data ? `${data.attendance_rate}%` : '—',
      icon: CheckCircle2,
    },
    {
      label: 'Enrolled Courses',
      value: data ? String(data.enrolled_courses) : '—',
      icon: BookOpen,
    },
    {
      label: 'Assignments Done',
      value: data ? String(data.assignments_submitted) : '—',
      icon: GraduationCap,
    },
    {
      label: 'Avg Score',
      value: data?.average_score != null ? `${data.average_score}%` : '—',
      icon: TrendingUp,
    },
  ]

  return (
    <PageContainer>
      <PageHeader title="My Analytics" description="Your academic performance overview" />

      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((s) => (
            <StatCard key={s.label} label={s.label} value={s.value} icon={<s.icon />} />
          ))}
        </div>

        {/* Attendance per course */}
        {data && data.class_stats.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Attendance by Course</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {data.class_stats.map((c) => (
                <div key={c.class_id} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium truncate">{c.subject}</span>
                      {c.course_code && (
                        <Badge variant="outline" className="text-xs shrink-0">{c.course_code}</Badge>
                      )}
                    </div>
                    <span className="text-muted-foreground text-xs shrink-0 ml-2">
                      {c.classes_attended}/{c.total_classes} · {c.attendance_rate}%
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${c.attendance_rate}%`,
                        backgroundColor: c.attendance_rate >= 75 ? 'hsl(var(--primary))' : c.attendance_rate >= 50 ? '#f59e0b' : '#ef4444',
                      }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Exam results */}
        {data && data.exam_results.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Award className="w-4 h-4" /> Exam Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.exam_results.map((r) => {
                  const grade = r.grade || gradeFromScore(r.score)
                  return (
                    <div key={r.exam_id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <div>
                        <p className="text-sm font-medium">Exam #{r.exam_id}</p>
                        <p className="text-xs text-muted-foreground">{r.score} marks</p>
                      </div>
                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${gradeColor[grade] ?? 'bg-muted text-foreground'}`}>
                        {grade}
                      </span>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty state */}
        {data && data.class_stats.length === 0 && data.exam_results.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <TrendingUp className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-30" />
              <p className="text-sm text-muted-foreground">No analytics data yet.</p>
              <p className="text-xs text-muted-foreground mt-1">Enroll in courses to start tracking your performance.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </PageContainer>
  )
}
