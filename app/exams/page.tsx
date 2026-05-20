'use client'

import { useEffect, useState } from 'react'
import { PageContainer } from '@/app/_components/page-container'
import { PageHeader } from '@/app/_components/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Calendar, ClipboardList, Plus, Loader2 } from 'lucide-react'
import { exams, classes, type Exam, type Class } from '@/lib/api'

export default function ExamsPage() {
  const [examList, setExamList] = useState<Exam[]>([])
  const [classList, setClassList] = useState<Class[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  // Form state
  const [title, setTitle] = useState('')
  const [classId, setClassId] = useState('')
  const [examDate, setExamDate] = useState('')
  const [totalMarks, setTotalMarks] = useState('100')

  useEffect(() => {
    Promise.all([exams.list(), classes.list()])
      .then(([e, c]) => { setExamList(e); setClassList(c) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleCreate = async () => {
    if (!title.trim()) { setFormError('Title is required'); return }
    if (!classId) { setFormError('Select a class'); return }
    if (!examDate) { setFormError('Exam date is required'); return }
    if (!totalMarks || Number(totalMarks) <= 0) { setFormError('Enter valid total marks'); return }

    setSaving(true)
    setFormError('')
    const token = localStorage.getItem('token')
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/exams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title,
          class_id: Number(classId),
          exam_date: new Date(examDate).toISOString(),
          total_marks: Number(totalMarks),
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail ?? 'Failed to create exam')
      }
      const created: Exam = await res.json()
      setExamList((prev) => [created, ...prev])
      setOpen(false)
      setTitle(''); setClassId(''); setExamDate(''); setTotalMarks('100')
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to create exam')
    } finally {
      setSaving(false)
    }
  }

  const className = (id: number) =>
    classList.find((c) => c.id === id)?.name ?? `Class ${id}`

  const isPast = (dateStr: string) => new Date(dateStr) < new Date()

  return (
    <PageContainer>
      <PageHeader
        title="Exams"
        description="Schedule exams and publish results for your classes"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Schedule Exam
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Schedule New Exam</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Exam Title</Label>
                  <Input
                    placeholder="e.g. Midterm Examination"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Class</Label>
                  <Select value={classId} onValueChange={setClassId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                    <SelectContent>
                      {classList.length === 0 && (
                        <SelectItem value="none" disabled>No classes yet</SelectItem>
                      )}
                      {classList.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.name} — {c.subject}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Exam Date & Time</Label>
                  <Input
                    type="datetime-local"
                    value={examDate}
                    onChange={(e) => setExamDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Total Marks</Label>
                  <Input
                    type="number"
                    min={1}
                    value={totalMarks}
                    onChange={(e) => setTotalMarks(e.target.value)}
                  />
                </div>
                {formError && (
                  <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                    {formError}
                  </p>
                )}
                <Button className="w-full" onClick={handleCreate} disabled={saving}>
                  {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : 'Schedule Exam'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading exams…</p>
      ) : examList.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No exams scheduled yet</p>
          <p className="text-sm mt-1">Click "Schedule Exam" to create your first exam.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {examList.map((exam) => {
            const past = isPast(exam.exam_date)
            return (
              <Card key={exam.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-base">{exam.title}</h3>
                        <Badge variant={past ? 'secondary' : 'default'}>
                          {past ? 'Completed' : 'Upcoming'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 flex-wrap text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <ClipboardList className="w-3.5 h-3.5" />
                          {className(exam.class_id)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {new Date(exam.exam_date).toLocaleDateString('en-GB', {
                            day: '2-digit', month: 'short', year: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </span>
                        <span className="font-medium text-foreground">
                          {exam.total_marks} marks
                        </span>
                      </div>
                    </div>
                    {past && (
                      <Button size="sm" variant="outline">
                        Enter Results
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </PageContainer>
  )
}
