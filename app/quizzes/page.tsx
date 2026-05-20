'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  PenSquare, Plus, BookOpen, Clock, Users, CheckCircle2,
  Eye, EyeOff, Trash2, Loader2, ChevronRight,
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
      <div className="max-w-4xl space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <PenSquare className="w-6 h-6 text-primary" />
              Quizzes & Tests
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Create timed quizzes — students get instant results on submission.
            </p>
          </div>
          <Button onClick={() => { setCreateError(''); setCreateOpen(true) }} className="gap-2">
            <Plus className="w-4 h-4" />
            New Quiz
          </Button>
        </div>

        {/* Stats row */}
        {allQuizzes.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-5 text-center">
                <p className="text-2xl font-bold">{allQuizzes.length}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Total quizzes</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 text-center">
                <p className="text-2xl font-bold text-green-600">
                  {allQuizzes.filter((q) => q.is_published).length}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Published</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 text-center">
                <p className="text-2xl font-bold text-primary">
                  {allQuizzes.reduce((s, q) => s + q.attempt_count, 0)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Total attempts</p>
              </CardContent>
            </Card>
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
                          className={q.is_published ? 'text-green-600 hover:text-green-700' : 'text-muted-foreground'}
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
    </PageContainer>
  )
}
