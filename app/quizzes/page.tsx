'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  PenSquare, Plus, BookOpen, Clock, Users, CheckCircle2,
  Eye, EyeOff, Trash2, Loader2, ChevronRight,
  Sparkles, Upload, FileText, X,
} from 'lucide-react'
import { PageContainer } from '@/app/_components/page-container'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { quizzes, classes, type Quiz, type Class } from '@/lib/api'

export default function QuizzesPage() {
  const router = useRouter()
  const [allQuizzes, setAllQuizzes] = useState<Quiz[]>([])
  const [classList, setClassList] = useState<Class[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [form, setForm] = useState({ title: '', description: '', class_id: '', duration_minutes: '30' })

  // AI generation
  const [aiOpen, setAiOpen] = useState(false)
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiError, setAiError] = useState('')
  const [aiFile, setAiFile] = useState<File | null>(null)
  const [aiForm, setAiForm] = useState({
    class_id: '', title: '', num_questions: '10', duration_minutes: '30', difficulty: 'medium', instructions: '',
  })

  const handleGenerate = async () => {
    if (!aiForm.class_id) { setAiError('Select a course.'); return }
    if (!aiFile) { setAiError('Upload a course material to generate from.'); return }
    setAiGenerating(true); setAiError('')
    try {
      const q = await quizzes.generate({
        class_id: Number(aiForm.class_id),
        file: aiFile,
        title: aiForm.title.trim() || undefined,
        num_questions: Number(aiForm.num_questions) || 10,
        duration_minutes: Number(aiForm.duration_minutes) || 30,
        difficulty: aiForm.difficulty,
        instructions: aiForm.instructions.trim() || undefined,
      })
      setAiOpen(false)
      setAiFile(null)
      setAiForm({ class_id: '', title: '', num_questions: '10', duration_minutes: '30', difficulty: 'medium', instructions: '' })
      router.push(`/quizzes/${q.id}`)
    } catch (e: unknown) {
      setAiError(e instanceof Error ? e.message : 'Failed to generate quiz.')
    } finally {
      setAiGenerating(false)
    }
  }

  const load = () =>
    Promise.all([quizzes.list(), classes.list()])
      .then(([q, c]) => { setAllQuizzes(q); setClassList(c) })
      .finally(() => setLoading(false))

  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    if (!form.title.trim() || !form.class_id) { setCreateError('Title and course are required.'); return }
    setCreating(true); setCreateError('')
    try {
      const q = await quizzes.create({
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        class_id: Number(form.class_id),
        duration_minutes: Number(form.duration_minutes) || 30,
      })
      setCreateOpen(false)
      setForm({ title: '', description: '', class_id: '', duration_minutes: '30' })
      router.push(`/quizzes/${q.id}`)
    } catch (e: unknown) {
      setCreateError(e instanceof Error ? e.message : 'Failed to create quiz.')
    } finally {
      setCreating(false)
    }
  }

  const togglePublish = async (q: Quiz) => {
    try {
      const updated = await quizzes.update(q.id, { is_published: !q.is_published })
      setAllQuizzes((prev) => prev.map((x) => x.id === q.id ? updated : x))
    } catch {}
  }

  const handleDelete = async (q: Quiz) => {
    if (!confirm(`Delete "${q.title}"? This cannot be undone.`)) return
    try {
      await quizzes.delete(q.id)
      setAllQuizzes((prev) => prev.filter((x) => x.id !== q.id))
    } catch {}
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <PageContainer>
      <div className="w-full max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <PenSquare className="w-6 h-6" />
              Quizzes & Tests
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Create timed quizzes — students get instant results on submission.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              onClick={() => { setAiError(''); setAiOpen(true) }}
              className="gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Generate with Cortex
            </Button>
            <Button onClick={() => { setCreateError(''); setCreateOpen(true) }} className="gap-2">
              <Plus className="w-4 h-4" />
              New Quiz
            </Button>
          </div>
        </div>

        {/* Stats row */}
        {allQuizzes.length > 0 && (
          <div className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border bg-border">
            <div className="bg-card px-4 py-5 text-center">
              <p className="text-2xl font-semibold tabular-nums">{allQuizzes.length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Total</p>
            </div>
            <div className="bg-card px-4 py-5 text-center">
              <p className="text-2xl font-semibold tabular-nums">
                {allQuizzes.filter((q) => q.is_published).length}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Published</p>
            </div>
            <div className="bg-card px-4 py-5 text-center">
              <p className="text-2xl font-semibold tabular-nums">
                {allQuizzes.reduce((s, q) => s + q.attempt_count, 0)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Attempts</p>
            </div>
          </div>
        )}

        {/* Quiz list */}
        {allQuizzes.length === 0 ? (
          <Card>
            <CardContent className="py-16 flex flex-col items-center gap-3 text-center">
              <PenSquare className="w-10 h-10 text-muted-foreground/40" />
              <p className="font-medium">No quizzes yet</p>
              <p className="text-sm text-muted-foreground">Create your first quiz to get started.</p>
              <Button onClick={() => setCreateOpen(true)} className="mt-2 gap-2">
                <Plus className="w-4 h-4" />New Quiz
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {allQuizzes.map((q) => {
              const course = classList.find((c) => c.id === q.class_id)
              return (
                <Card key={q.id} className="hover:shadow-md transition-shadow cursor-pointer group">
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-start justify-between gap-4">
                      <div
                        className="flex-1 space-y-1 min-w-0"
                        onClick={() => router.push(`/quizzes/${q.id}`)}
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold truncate">{q.title}</p>
                          <Badge variant={q.is_published ? 'default' : 'secondary'}>
                            {q.is_published ? 'Published' : 'Draft'}
                          </Badge>
                        </div>
                        {q.description && (
                          <p className="text-sm text-muted-foreground line-clamp-1">{q.description}</p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1 flex-wrap">
                          {course && (
                            <span className="flex items-center gap-1">
                              <BookOpen className="w-3.5 h-3.5" />
                              {course.name}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {q.duration_minutes} min
                          </span>
                          <span className="flex items-center gap-1">
                            <PenSquare className="w-3.5 h-3.5" />
                            {q.question_count} questions
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5" />
                            {q.attempt_count} submissions
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost" size="icon"
                          title={q.is_published ? 'Unpublish' : 'Publish'}
                          onClick={(e) => { e.stopPropagation(); togglePublish(q) }}
                          className={q.is_published ? 'text-foreground' : 'text-muted-foreground'}
                        >
                          {q.is_published ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          title="Delete quiz"
                          onClick={(e) => { e.stopPropagation(); handleDelete(q) }}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          onClick={() => router.push(`/quizzes/${q.id}`)}
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenSquare className="w-5 h-5 text-primary" />
              Create New Quiz
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Title *</label>
              <input
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="e.g. Mid-semester Test"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Description (optional)</label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                rows={2}
                placeholder="Instructions for students…"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Course *</label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={form.class_id}
                  onChange={(e) => setForm((f) => ({ ...f, class_id: e.target.value }))}
                >
                  <option value="">Select course…</option>
                  {classList.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Duration (minutes)</label>
                <input
                  type="number" min={1} max={300}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={form.duration_minutes}
                  onChange={(e) => setForm((f) => ({ ...f, duration_minutes: e.target.value }))}
                />
              </div>
            </div>
            {createError && <p className="text-xs text-destructive">{createError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create & Add Questions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate with AI Dialog */}
      <Dialog open={aiOpen} onOpenChange={(o) => { if (!aiGenerating) setAiOpen(o) }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              Generate Test with Cortex
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Upload a course material and Cortex AI will draft the questions. You can review and edit
              everything before publishing.
            </p>

            {/* Course */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Course</label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={aiForm.class_id}
                onChange={(e) => setAiForm((f) => ({ ...f, class_id: e.target.value }))}
              >
                <option value="">Select course…</option>
                {classList.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* File dropzone */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Material</label>
              {aiFile ? (
                <div className="flex items-center gap-3 rounded-lg border bg-muted/40 px-3 py-2.5">
                  <FileText className="w-4 h-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{aiFile.name}</p>
                    <p className="text-xs text-muted-foreground">{(aiFile.size / 1024).toFixed(0)} KB</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAiFile(null)}
                    className="text-muted-foreground hover:text-foreground shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-7 text-center cursor-pointer hover:bg-muted/40 transition-colors">
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
            </div>

            {/* Counts */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Questions</label>
                <input
                  type="number" min={1} max={50}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={aiForm.num_questions}
                  onChange={(e) => setAiForm((f) => ({ ...f, num_questions: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Duration (min)</label>
                <input
                  type="number" min={1} max={300}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={aiForm.duration_minutes}
                  onChange={(e) => setAiForm((f) => ({ ...f, duration_minutes: e.target.value }))}
                />
              </div>
            </div>

            {/* Difficulty */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Difficulty</label>
              <div className="grid grid-cols-4 gap-2">
                {(['easy', 'medium', 'hard', 'mixed'] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setAiForm((f) => ({ ...f, difficulty: d }))}
                    className={`rounded-lg border py-2 text-sm font-medium capitalize transition-colors ${
                      aiForm.difficulty === d
                        ? 'border-foreground bg-foreground text-background'
                        : 'border-input text-muted-foreground hover:bg-muted/60'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Title <span className="text-muted-foreground text-xs font-normal">(optional)</span></label>
              <input
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="e.g. Week 5 Test — defaults to course name"
                value={aiForm.title}
                onChange={(e) => setAiForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>

            {/* Instructions */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Focus / instructions <span className="text-muted-foreground text-xs font-normal">(optional)</span></label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                rows={2}
                placeholder="e.g. Focus on chapters 3-4, avoid definitions…"
                value={aiForm.instructions}
                onChange={(e) => setAiForm((f) => ({ ...f, instructions: e.target.value }))}
              />
            </div>

            {aiError && <p className="text-xs text-destructive">{aiError}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAiOpen(false)} disabled={aiGenerating}>Cancel</Button>
            <Button onClick={handleGenerate} disabled={aiGenerating} className="gap-2">
              {aiGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {aiGenerating ? 'Generating…' : 'Generate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  )
}
