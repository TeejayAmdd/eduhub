'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Loader2 } from 'lucide-react'
import { SUBMISSION_TYPES, type Class } from '@/lib/api'

export interface CreateAssignmentData {
  title: string
  description: string
  dueDate: string
  classId: number
  submissionType: string
}

interface CreateAssignmentModalProps {
  courses: Class[]
  onSubmit?: (data: CreateAssignmentData) => Promise<void>
}

export function CreateAssignmentModal({ courses, onSubmit }: CreateAssignmentModalProps) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [classId, setClassId] = useState<number | null>(null)
  const [submissionType, setSubmissionType] = useState('any')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const reset = () => {
    setTitle(''); setDescription(''); setDueDate('')
    setClassId(null); setSubmissionType('any'); setError('')
  }

  const handleSubmit = async () => {
    if (!title.trim()) { setError('Title is required.'); return }
    if (!classId)       { setError('Please select a course.'); return }
    if (!dueDate)       { setError('Due date is required.'); return }

    setSaving(true)
    setError('')
    try {
      await onSubmit?.({ title: title.trim(), description, dueDate, classId, submissionType })
      reset()
      setOpen(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create assignment.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset() }}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          New Assignment
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Assignment</DialogTitle>
          <DialogDescription>
            Create a new assignment for your students.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Title</label>
            <Input
              placeholder="Assignment title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Description</label>
            <textarea
              placeholder="Assignment details and instructions"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              rows={4}
            />
          </div>

          <div>
            <label className="text-sm font-medium">Course</label>
            <Select value={classId ? String(classId) : ''} onValueChange={(v) => setClassId(Number(v))}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select course" />
              </SelectTrigger>
              <SelectContent>
                {courses.length === 0 ? (
                  <SelectItem value="none" disabled>No courses found</SelectItem>
                ) : courses.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium">Submission Mode</label>
            <Select value={submissionType} onValueChange={setSubmissionType}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select submission mode" />
              </SelectTrigger>
              <SelectContent>
                {SUBMISSION_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium">Due Date</label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="mt-1"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
