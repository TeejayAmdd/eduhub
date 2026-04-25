'use client'

import { useState } from 'react'
import { PageContainer } from '@/_components/page-container'
import { PageHeader } from '@/_components/page-header'
import { SectionCard } from '@/_components/section-card'
import { CreateAssignmentModal, CreateAssignmentData } from './_components/create-assignment-modal'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, Clock, AlertCircle, Calendar } from 'lucide-react'

type SubmissionStatus = 'submitted' | 'pending' | 'overdue'

interface Assignment {
  id: number
  title: string
  class: string
  dueDate: string
  description: string
  submissions: {
    submitted: number
    pending: number
    overdue: number
  }
  totalStudents: number
}

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([
    {
      id: 1,
      title: 'Quadratic Equations Worksheet',
      class: 'Class 10-A',
      dueDate: '2024-01-20',
      description: 'Solve 20 quadratic equations using different methods',
      submissions: { submitted: 28, pending: 8, overdue: 4 },
      totalStudents: 40,
    },
    {
      id: 2,
      title: 'Essay: Modern Literature',
      class: 'Class 11-B',
      dueDate: '2024-01-18',
      description: 'Write a 1500-word essay on contemporary authors',
      submissions: { submitted: 32, pending: 2, overdue: 6 },
      totalStudents: 40,
    },
    {
      id: 3,
      title: 'Science Lab Report',
      class: 'Class 10-B',
      dueDate: '2024-01-22',
      description: 'Complete the acid-base reaction lab and document results',
      submissions: { submitted: 18, pending: 18, overdue: 2 },
      totalStudents: 38,
    },
  ])

  const handleCreateAssignment = (data: CreateAssignmentData) => {
    const newAssignment: Assignment = {
      id: assignments.length + 1,
      title: data.title,
      class: data.class,
      dueDate: data.dueDate,
      description: data.description,
      submissions: { submitted: 0, pending: 30, overdue: 0 },
      totalStudents: 30,
    }
    setAssignments([newAssignment, ...assignments])
  }

  const getStatusIndicator = (assignment: Assignment) => {
    const { submitted, pending, overdue } = assignment.submissions
    const submissionRate = Math.round((submitted / assignment.totalStudents) * 100)

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Submission Rate</span>
          <span className="font-semibold">{submissionRate}%</span>
        </div>
        <div className="flex gap-2">
          <div className="flex items-center gap-1 text-xs text-green-600">
            <CheckCircle2 className="w-4 h-4" />
            {submitted} submitted
          </div>
          <div className="flex items-center gap-1 text-xs text-amber-600">
            <Clock className="w-4 h-4" />
            {pending} pending
          </div>
          {overdue > 0 && (
            <div className="flex items-center gap-1 text-xs text-red-600">
              <AlertCircle className="w-4 h-4" />
              {overdue} overdue
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <PageContainer>
      <PageHeader
        title="Assignments"
        description="Create and track student assignments"
        action={<CreateAssignmentModal onSubmit={handleCreateAssignment} />}
      />

      <div className="space-y-4">
        {assignments.map((assignment) => (
          <Card key={assignment.id} className="hover:shadow-sm transition-shadow">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Assignment Details */}
                <div className="md:col-span-2">
                  <div className="mb-3">
                    <h3 className="font-semibold text-lg">{assignment.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {assignment.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <Badge variant="outline">{assignment.class}</Badge>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      Due: {new Date(assignment.dueDate).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                {/* Submission Status */}
                <div className="border-l border-border pl-4 md:pl-6">
                  {getStatusIndicator(assignment)}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </PageContainer>
  )
}
