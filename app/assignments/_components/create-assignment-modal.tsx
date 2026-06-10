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
import { Plus, Loader2, Sparkles, Upload, FileText, X, ChevronDown } from 'lucide-react'
import { SUBMISSION_TYPES, assignments, type Class } from '@/lib/api'

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

const AI_FORMATS = [
  { value: 'questions',   label: 'Short-answer questions' },
  { value: 'essay',       label: 'Essay' },
  { value: 'problem_set', label: 'Problem set' },
  { value: 'project',     label: 'Project brief' },
  { value: 'report',      label: 'Report / case study' },
] as const

export function CreateAssignmentModal({ courses, onSubmit }: CreateAssignmentModalProps) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [classId, setClassId] = useState<number | null>(null)
  const [submissionType, setSubmissionType] = useState('any')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // AI generation
  const [aiPanel, setAiPanel] = useState(false)
  const [aiFile, setAiFile] = useState<File | null>(null)
  const [aiFormat, setAiFormat] = useState('questions')
  const [aiDifficulty, setAiDifficulty] = useState('medium')
  const [aiNumItems, setAiNumItems] = useState('5')
  const [aiInstructions, setAiInstructions] = useState('')
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiError, setAiError] = useState('')
  const [aiDrafted, setAiDrafted] = useState(false)

  const reset = () => {
    setTitle(''); setDescription(''); setDueDate('')
    setClassId(null); setSubmissionType('any'); setError('')
    setAiPanel(false); setAiFile(null); setAiFormat('questions')
    setAiDifficulty('medium'); setAiNumItems('5'); setAiInstructions('')
    setAiError(''); setAiDrafted(false)
  }

  const handleGenerate = async () => {
    if (!aiFile) { setAiError('Upload a course material to generate from.'); return }
    setAiGenerating(true); setAiError('')
    try {
      const result = await assignments.generate({
        file: aiFile,
        class_id: classId ?? undefined,
        format: aiFormat,
        difficulty: aiDifficulty,
        num_items: Number(aiNumItems) || 5,
        instructions: aiInstructions.trim() || undefined,
      })
      setTitle(result.title)
      setDescription(result.description)
      setAiDrafted(true)
      setAiPanel(false)
    } catch (err: unknown) {
      setAiError(err instanceof Error ? err.message : 'Failed to generate assignment.')
    } finally {
      setAiGenerating(false)
    }
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
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Assignment</DialogTitle>
          <DialogDescription>
            Create a new assignment for your students.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* ── Generate with AI ── */}
          <div className="rounded-lg border">
            <button
              type="button"
              onClick={() => { setAiPanel((v) => !v); setAiError('') }}
              className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm font-medium"
            >
              <span className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Generate with Cortex
              </span>
              <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${aiPanel ? 'rotate-180' : ''}`} />
            </button>

            {aiPanel && (
              <div className="border-t px-3 py-3 space-y-3">
                <p className="text-xs text-muted-foreground">
                  Upload a material and AI will draft the title and instructions below for you to review and edit.
                </p>

                {/* File */}
                {aiFile ? (
                  <div className="flex items-center gap-2.5 rounded-md border bg-muted/40 px-3 py-2">
                    <FileText className="w-4 h-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{aiFile.name}</p>
                      <p className="text-xs text-muted-foreground">{(aiFile.size / 1024).toFixed(0)} KB</p>
                    </div>
                    <button type="button" onClick={() => setAiFile(null)} className="text-muted-foreground hover:text-foreground shrink-0">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center gap-1.5 rounded-md border border-dashed px-4 py-5 text-center cursor-pointer hover:bg-muted/40 transition-colors">
                    <input
                      type="file"
                      accept=".pdf,.txt,.md,application/pdf,text/plain"
                      className="hidden"
                      onChange={(e) => { setAiFile(e.target.files?.[0] ?? null); setAiError('') }}
                    />
                    <Upload className="w-5 h-5 text-muted-foreground" />
                    <span className="text-sm font-medium">Click to upload</span>
                    <span className="text-xs text-muted-foreground">PDF or text file</span>
                  </label>
                )}

                {/* Format */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Format</label>
                  <Select value={aiFormat} onValueChange={setAiFormat}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AI_FORMATS.map((f) => (
                        <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Difficulty + items */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Difficulty</label>
                    <Select value={aiDifficulty} onValueChange={setAiDifficulty}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {['easy', 'medium', 'hard', 'mixed'].map((d) => (
                          <SelectItem key={d} value={d} className="capitalize">{d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Items</label>
                    <Input
                      type="number" min={1} max={30}
                      value={aiNumItems}
                      onChange={(e) => setAiNumItems(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>

                {/* Instructions */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Focus / instructions (optional)</label>
                  <textarea
                    placeholder="e.g. Focus on chapter 3; require diagrams…"
                    value={aiInstructions}
                    onChange={(e) => setAiInstructions(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                    rows={2}
                  />
                </div>

                {aiError && <p className="text-xs text-destructive">{aiError}</p>}

                <Button onClick={handleGenerate} disabled={aiGenerating} className="w-full gap-2">
                  {aiGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {aiGenerating ? 'Generating…' : 'Generate'}
                </Button>
              </div>
            )}
          </div>

          {aiDrafted && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Drafted by Cortex — review and edit before creating.
            </p>
          )}

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
