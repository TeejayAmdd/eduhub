'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Calendar, Upload, CheckCircle2, Loader2,
  Link as LinkIcon, FileText, Image, FolderOpen, Paperclip,
  Clock, AlertTriangle, Send, GraduationCap,
} from 'lucide-react'
import { PageContainer } from '@/app/_components/page-container'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { assignments, SUBMISSION_TYPES, type Assignment } from '@/lib/api'

// ── Helpers ───────────────────────────────────────────────────────────────────

const TYPE_ICONS: Record<string, React.ElementType> = {
  google_drive: FolderOpen,
  pdf:          FileText,
  word_doc:     FileText,
  image:        Image,
  any:          Paperclip,
}

const TYPE_HINTS: Record<string, string> = {
  google_drive: 'Set sharing to "Anyone with the link can view" before submitting.',
  pdf:          'Upload your PDF to Google Drive or any file host, then paste the share link.',
  word_doc:     'Upload your Word doc to Google Drive or OneDrive and paste the share link.',
  image:        'Upload your image to Google Drive or Imgur and paste the direct link.',
  any:          'Upload your work to any file host and paste the shareable link.',
}

const TYPE_PLACEHOLDERS: Record<string, string> = {
  google_drive: 'https://drive.google.com/file/d/...',
  pdf:          'https://drive.google.com/file/d/...',
  word_doc:     'https://docs.google.com/document/d/...',
  image:        'https://drive.google.com/file/d/...',
  any:          'https://',
}

function daysFromNow(dateStr: string): number {
  const diff = new Date(dateStr).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)
  return Math.ceil(diff / 86400000)
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function StudentAssignmentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router  = useRouter()

  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [loading, setLoading]       = useState(true)
  const [link, setLink]             = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState('')
  const [success, setSuccess]       = useState(false)

  useEffect(() => {
    assignments.get(Number(id))
      .then((a) => {
        setAssignment(a)
        if (a.submitted) setSuccess(true)
      })
      .catch(() => router.replace('/student/assignments'))
      .finally(() => setLoading(false))
  }, [id, router])

  const handleSubmit = async () => {
    if (!link.trim()) { setError('Please enter your submission link.'); return }
    if (!/^https?:\/\/.+/.test(link.trim())) {
      setError('Please enter a valid URL starting with http:// or https://')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await assignments.submit(Number(id), link.trim())
      setSuccess(true)
      setAssignment((prev) => prev ? { ...prev, submitted: true } : prev)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Submission failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }
  if (!assignment) return null

  const isOverdue   = new Date(assignment.due_date) < new Date()
  const days        = daysFromNow(assignment.due_date)
  const submitted   = !!assignment.submitted
  const subLabel    = SUBMISSION_TYPES.find((t) => t.value === assignment.submission_type)?.label ?? assignment.submission_type
  const TypeIcon    = TYPE_ICONS[assignment.submission_type] ?? Paperclip
  const hint        = TYPE_HINTS[assignment.submission_type] ?? TYPE_HINTS.any
  const placeholder = TYPE_PLACEHOLDERS[assignment.submission_type] ?? 'https://'

  const heroGradient = submitted
    ? 'from-green-600 via-green-500 to-emerald-500'
    : isOverdue
    ? 'from-red-700 via-red-600 to-rose-500'
    : days <= 2
    ? 'from-amber-600 via-amber-500 to-orange-400'
    : 'from-primary via-primary/90 to-primary/70'

  return (
    <PageContainer>
      {/* Constrain width on larger screens; full-width on mobile */}
      <div className="w-full max-w-2xl mx-auto space-y-4 sm:space-y-5">

        {/* Back */}
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/student/assignments">
            <ArrowLeft className="w-4 h-4 mr-2" />
            My Assignments
          </Link>
        </Button>

        {/* ── Hero card ─────────────────────────────────────────────────────── */}
        <div className={cn(
          'relative overflow-hidden rounded-2xl bg-gradient-to-br p-5 sm:p-7 text-white shadow-lg',
          heroGradient
        )}>
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, white 0%, transparent 55%)' }} />
          <div className="relative space-y-3">

            {/* Course + status badges */}
            <div className="flex flex-wrap gap-2">
              {assignment.class_name && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 backdrop-blur-sm px-3 py-1 text-xs font-semibold">
                  <GraduationCap className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate max-w-[160px] sm:max-w-none">{assignment.class_name}</span>
                </span>
              )}
              {submitted ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 backdrop-blur-sm px-3 py-1 text-xs font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />Submitted
                </span>
              ) : isOverdue ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 backdrop-blur-sm px-3 py-1 text-xs font-semibold">
                  <AlertTriangle className="w-3.5 h-3.5" />Overdue
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 backdrop-blur-sm px-3 py-1 text-xs font-semibold">
                  <Clock className="w-3.5 h-3.5" />Pending
                </span>
              )}
            </div>

            {/* Title */}
            <h1 className="text-xl sm:text-2xl font-bold leading-snug">{assignment.title}</h1>

            {/* Due date */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-sm text-white/75">
              <span className="flex items-center gap-1.5 text-xs sm:text-sm">
                <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                Due {new Date(assignment.due_date).toLocaleDateString('en-GB', {
                  weekday: 'short', day: '2-digit', month: 'long', year: 'numeric',
                })}
              </span>
              {!submitted && (
                <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold">
                  {isOverdue
                    ? `${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''} overdue`
                    : days === 0 ? 'Due today'
                    : days === 1 ? 'Due tomorrow'
                    : `${days} days left`}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Instructions ──────────────────────────────────────────────────── */}
        {assignment.description && (
          <div className="rounded-2xl border bg-background p-4 sm:p-6 shadow-sm space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Instructions</p>
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
              {assignment.description}
            </p>
          </div>
        )}

        {/* ── Submission format info ────────────────────────────────────────── */}
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:p-5 flex items-start gap-3 sm:gap-4">
          <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <TypeIcon className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0 space-y-0.5">
            <p className="text-sm font-semibold text-primary">Submission Format</p>
            <p className="text-sm font-medium">{subLabel}</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{hint}</p>
          </div>
        </div>

        {/* ── Submission panel ──────────────────────────────────────────────── */}
        <div className="rounded-2xl border bg-background shadow-sm overflow-hidden">
          {/* Panel header */}
          <div className="border-b bg-muted/30 px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-2">
            <Upload className="w-4 h-4 text-primary shrink-0" />
            <p className="font-semibold text-sm">Your Submission</p>
          </div>

          <div className="p-4 sm:p-6">
            {success ? (
              /* Success */
              <div className="space-y-4">
                <div className="flex items-start gap-3 sm:gap-4 rounded-2xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 sm:p-5">
                  <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl bg-green-100 dark:bg-green-900/40">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-green-700 dark:text-green-400">Assignment submitted!</p>
                    <p className="text-sm text-green-600 dark:text-green-500 mt-0.5">
                      Your work has been sent to your lecturer for review.
                    </p>
                  </div>
                </div>
                <Button variant="outline" className="w-full rounded-xl h-11" asChild>
                  <Link href="/student/assignments">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to assignments
                  </Link>
                </Button>
              </div>

            ) : isOverdue ? (
              /* Overdue */
              <div className="flex items-start gap-3 sm:gap-4 rounded-2xl bg-destructive/5 border border-destructive/20 p-4 sm:p-5">
                <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl bg-destructive/10">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-destructive">Submission closed</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    The due date has passed. Contact your lecturer if you need an extension.
                  </p>
                </div>
              </div>

            ) : (
              /* Submit form */
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5 text-sm font-medium">
                    <LinkIcon className="w-3.5 h-3.5 text-primary shrink-0" />
                    Submission Link
                  </Label>
                  <Input
                    value={link}
                    onChange={(e) => { setLink(e.target.value); setError('') }}
                    placeholder={placeholder}
                    type="url"
                    className="rounded-xl h-11 text-base sm:text-sm"
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                    inputMode="url"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                  <p className="text-xs text-muted-foreground">
                    Upload your work to a file host, then paste the shareable link above.
                  </p>
                </div>

                {error && (
                  <div className="flex items-start gap-2 rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3">
                    <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                    <p className="text-sm text-destructive">{error}</p>
                  </div>
                )}

                <Button
                  onClick={handleSubmit}
                  disabled={submitting || !link.trim()}
                  className="w-full rounded-xl h-12 sm:h-11 text-base sm:text-sm"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}
                  {submitting ? 'Submitting…' : 'Submit Assignment'}
                </Button>
              </div>
            )}
          </div>
        </div>

      </div>
    </PageContainer>
  )
}
