'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, Clock, AlertCircle, Calendar, ChevronRight, Upload } from 'lucide-react'
import { PageContainer } from '../_components/page-container'
import { PageHeader } from '../_components/page-header'
import { CreateAssignmentModal, CreateAssignmentData } from './_components/create-assignment-modal'
import { assignments, classes, SUBMISSION_TYPES, type Assignment, type Class } from '@/lib/api'

export default function AssignmentsPage() {
  const [data, setData] = useState<Assignment[]>([])
  const [classList, setClassList] = useState<Class[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([assignments.list(), classes.list()])
      .then(([a, c]) => { setData(a); setClassList(c) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const handleCreate = async (formData: CreateAssignmentData) => {
    const created = await assignments.create({
      title: formData.title,
      description: formData.description,
      class_id: formData.classId,
      due_date: new Date(formData.dueDate).toISOString(),
      submission_type: formData.submissionType,
    })
    setData((prev) => [created, ...prev])
  }

  const className = (id: number) => classList.find((c) => c.id === id)?.name ?? `Course ${id}`
  const submissionLabel = (type: string) =>
    SUBMISSION_TYPES.find((t) => t.value === type)?.label ?? type

  return (
    <PageContainer>
      <PageHeader
        title="Assignments"
        description="Create and track student assignments"
        action={<CreateAssignmentModal courses={classList} onSubmit={handleCreate} />}
      />

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading assignments...</p>
      ) : data.length === 0 ? (
        <p className="text-sm text-muted-foreground">No assignments yet. Create one above.</p>
      ) : (
        <div className="space-y-4">
          {data.map((a) => {
            const submitted = a.total_submissions - a.pending_count - a.overdue_count
            const rate = a.total_submissions > 0
              ? Math.round((submitted / a.total_submissions) * 100)
              : 0

            return (
              <Link key={a.id} href={`/assignments/${a.id}`}>
                <Card className="hover:shadow-md hover:border-primary/30 transition-all cursor-pointer">
                  <CardContent className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-2 space-y-2">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-lg">{a.title}</h3>
                          <ChevronRight className="w-4 h-4 text-muted-foreground md:hidden" />
                        </div>
                        {a.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">{a.description}</p>
                        )}
                        <div className="flex items-center gap-3 flex-wrap">
                          <Badge variant="outline">{className(a.class_id)}</Badge>
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Upload className="w-3.5 h-3.5" />
                            {submissionLabel(a.submission_type)}
                          </span>
                          <span className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Calendar className="w-4 h-4" />
                            Due: {new Date(a.due_date).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <div className="border-l border-border pl-4 md:pl-6 space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Submission Rate</span>
                          <span className="font-semibold">{rate}%</span>
                        </div>
                        <div className="flex gap-3 flex-wrap">
                          <span className="flex items-center gap-1 text-xs text-green-600">
                            <CheckCircle2 className="w-4 h-4" />{submitted} submitted
                          </span>
                          <span className="flex items-center gap-1 text-xs text-amber-600">
                            <Clock className="w-4 h-4" />{a.pending_count} pending
                          </span>
                          {a.overdue_count > 0 && (
                            <span className="flex items-center gap-1 text-xs text-red-600">
                              <AlertCircle className="w-4 h-4" />{a.overdue_count} overdue
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-primary font-medium hidden md:block">View details →</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </PageContainer>
  )
}
