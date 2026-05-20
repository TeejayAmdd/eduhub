'use client'

import { useEffect, useState } from 'react'
import { PageContainer } from '@/app/_components/page-container'
import { PageHeader } from '@/app/_components/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { exams, type Exam } from '@/lib/api'

const gradeColor: Record<string, string> = {
  A: 'bg-green-100 text-green-700',
  B: 'bg-blue-100 text-blue-700',
  C: 'bg-amber-100 text-amber-700',
  D: 'bg-orange-100 text-orange-700',
  F: 'bg-red-100 text-red-700',
}

export default function StudentGradesPage() {
  const [data, setData] = useState<Exam[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    exams.list().then(setData).catch(console.error).finally(() => setLoading(false))
  }, [])

  return (
    <PageContainer>
      <PageHeader title="Grades & Exams" description="Your academic exams and results" />

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading exams...</p>
      ) : data.length === 0 ? (
        <p className="text-sm text-muted-foreground">No exams scheduled yet.</p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Exams</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.map((e) => (
                <div key={e.id} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{e.title}</span>
                      <Badge variant="outline" className="text-xs">Class {e.class_id}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(e.exam_date).toLocaleDateString('en-GB', {
                        day: '2-digit', month: 'short', year: 'numeric',
                      })} · {e.total_marks} marks
                    </p>
                  </div>
                  <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${gradeColor['A']}`}>
                    —
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </PageContainer>
  )
}
