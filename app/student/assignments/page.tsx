'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Calendar, CheckCircle2, AlertTriangle, Clock,
  ClipboardList, Loader2, ArrowRight, BookOpen, TrendingUp, GraduationCap,
} from 'lucide-react'
import { PageContainer } from '@/app/_components/page-container'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { assignments, type Assignment } from '@/lib/api'

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysFromNow(dateStr: string): number {
  const diff = new Date(dateStr).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)
  return Math.ceil(diff / 86400000)
}

function dueDateLabel(days: number) {
  if (days < 0)  return { text: `${Math.abs(days)}d overdue`, urgent: true, soon: false }
  if (days === 0) return { text: 'Due today',                 urgent: false, soon: true }
  if (days <= 2)  return { text: `Due in ${days}d`,           urgent: false, soon: true }
  return           { text: `Due in ${days}d`,                 urgent: false, soon: false }
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

type Tab = 'all' | 'pending' | 'submitted' | 'overdue'

const TABS: { id: Tab; label: string }[] = [
  { id: 'all',       label: 'All' },
  { id: 'pending',   label: 'Pending' },
  { id: 'submitted', label: 'Submitted' },
  { id: 'overdue',   label: 'Overdue' },
]

// ── Card ──────────────────────────────────────────────────────────────────────

function AssignmentCard({ a }: { a: Assignment }) {
  const isOverdue = new Date(a.due_date) < new Date()
  const days      = daysFromNow(a.due_date)
  const due       = dueDateLabel(days)
  const submitted = !!a.submitted

  const accentClass = submitted
    ? 'border-l-green-400'
    : isOverdue
    ? 'border-l-destructive'
    : due.soon
    ? 'border-l-amber-400'
    : 'border-l-primary/40'

  const statusBadge = submitted ? (
    <Badge className="rounded-full bg-green-100 text-green-700 border-green-200 hover:bg-green-100 gap-1 text-[11px]">
      <CheckCircle2 className="w-3 h-3" />Submitted
    </Badge>
  ) : isOverdue ? (
    <Badge variant="destructive" className="rounded-full text-[11px]">Overdue</Badge>
  ) : due.soon ? (
    <Badge className="rounded-full bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 text-[11px]">Due soon</Badge>
  ) : (
    <Badge variant="outline" className="rounded-full text-[11px]">Pending</Badge>
  )

  return (
    <Link href={`/student/assignments/${a.id}`}>
      <div className={cn(
        'group flex gap-3 sm:gap-4 rounded-2xl border border-l-4 bg-background p-4 sm:p-5 shadow-sm',
        'transition-all hover:shadow-md hover:border-primary/30 cursor-pointer active:scale-[0.99]',
        accentClass
      )}>
        {/* Icon */}
        <div className={cn(
          'flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl border',
          submitted ? 'bg-green-50 border-green-100 text-green-600'
          : isOverdue ? 'bg-destructive/10 border-destructive/20 text-destructive'
          : 'bg-primary/5 border-primary/20 text-primary'
        )}>
          <ClipboardList className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {/* Title row */}
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-sm leading-snug line-clamp-2">{a.title}</p>
            <ArrowRight className="w-4 h-4 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-0.5 hidden sm:block" />
          </div>

          {/* Description */}
          {a.description && (
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {a.description}
            </p>
          )}

          {/* Badges row */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {statusBadge}
            {a.class_name && (
              <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                <GraduationCap className="w-3 h-3 shrink-0" />
                <span className="truncate max-w-[120px] sm:max-w-none">{a.class_name}</span>
              </span>
            )}
          </div>

          {/* Due date + countdown */}
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className={cn(
              'flex items-center gap-1 text-xs font-medium',
              due.urgent ? 'text-destructive' : due.soon ? 'text-amber-600' : 'text-muted-foreground'
            )}>
              <Calendar className="w-3 h-3 shrink-0" />
              {formatDate(a.due_date)}
            </span>
            <span className={cn(
              'shrink-0 text-[11px] font-semibold rounded-full px-2 py-0.5',
              due.urgent ? 'bg-destructive/10 text-destructive'
              : due.soon ? 'bg-amber-100 text-amber-700'
              : 'bg-muted text-muted-foreground'
            )}>
              {due.text}
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function StudentAssignmentsPage() {
  const [data, setData]       = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab]         = useState<Tab>('all')

  useEffect(() => {
    assignments.list()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const pending   = data.filter((a) => !a.submitted && new Date(a.due_date) >= new Date())
  const submitted = data.filter((a) => !!a.submitted)
  const overdue   = data.filter((a) => !a.submitted && new Date(a.due_date) < new Date())

  const filtered =
    tab === 'pending'   ? pending   :
    tab === 'submitted' ? submitted :
    tab === 'overdue'   ? overdue   : data

  const counts: Record<Tab, number> = {
    all:       data.length,
    pending:   pending.length,
    submitted: submitted.length,
    overdue:   overdue.length,
  }

  return (
    <PageContainer>
      <div className="space-y-4 sm:space-y-6">

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-primary/70 p-5 sm:p-7 text-primary-foreground shadow-lg">
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, white 0%, transparent 55%)' }} />
          <div className="relative space-y-4">
            {/* Top: text + stats */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs font-medium text-primary-foreground/70 uppercase tracking-wide">Student Portal</p>
                <h1 className="text-xl sm:text-2xl font-bold">My Assignments</h1>
                <p className="text-sm text-primary-foreground/70 max-w-sm">
                  Track, manage and submit all your course assignments.
                </p>
              </div>

              {/* Stats — grid of 3 so they never overflow */}
              <div className="grid grid-cols-3 gap-2 sm:flex sm:gap-3 shrink-0">
                {[
                  { value: data.length,      label: 'Total',   color: 'text-white' },
                  { value: pending.length,   label: 'Pending', color: 'text-amber-300' },
                  { value: submitted.length, label: 'Done',    color: 'text-green-300' },
                ].map(({ value, label, color }) => (
                  <div key={label} className="rounded-xl bg-white/15 backdrop-blur-sm px-3 py-2.5 text-center">
                    <p className={cn('text-xl sm:text-2xl font-bold', color)}>{value}</p>
                    <p className="text-[10px] sm:text-[11px] text-primary-foreground/70 mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Progress bar */}
            {data.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] text-primary-foreground/60">
                  <span>Submission progress</span>
                  <span>{Math.round((submitted.length / data.length) * 100)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/20 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-white transition-all"
                    style={{ width: `${(submitted.length / data.length) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Stats row ────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total',     value: data.length,      icon: BookOpen,      color: 'text-primary',     bg: 'bg-primary/10' },
            { label: 'Pending',   value: pending.length,   icon: Clock,         color: 'text-amber-600',   bg: 'bg-amber-50 dark:bg-amber-950/30' },
            { label: 'Submitted', value: submitted.length, icon: CheckCircle2,  color: 'text-green-600',   bg: 'bg-green-50 dark:bg-green-950/30' },
            { label: 'Overdue',   value: overdue.length,   icon: AlertTriangle, color: 'text-destructive', bg: 'bg-destructive/10' },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="rounded-2xl border bg-background p-3 sm:p-4 shadow-sm flex items-center gap-2 sm:gap-3">
              <div className={cn('flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl', bg)}>
                <Icon className={cn('w-4 h-4 sm:w-5 sm:h-5', color)} />
              </div>
              <div>
                <p className="text-base sm:text-lg font-bold">{value}</p>
                <p className="text-[11px] sm:text-xs text-muted-foreground">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Tabs — scrollable on mobile ───────────────────────────────────── */}
        <div className="overflow-x-auto pb-0.5 -mx-1 px-1">
          <div className="flex gap-1 rounded-2xl border bg-muted/40 p-1 w-max min-w-full sm:w-fit">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex-1 sm:flex-none rounded-xl px-3 sm:px-4 py-1.5 text-sm font-medium transition-all whitespace-nowrap',
                  tab === t.id
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {t.label}
                {counts[t.id] > 0 && (
                  <span className={cn(
                    'ml-1 sm:ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                    tab === t.id ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                  )}>
                    {counts[t.id]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── List ─────────────────────────────────────────────────────────── */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 sm:py-16 text-center rounded-2xl border border-dashed">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
              <TrendingUp className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold">
              {tab === 'all' ? 'No assignments yet' : `No ${tab} assignments`}
            </p>
            <p className="text-xs text-muted-foreground mt-1 max-w-[220px] sm:max-w-[240px]">
              {tab === 'submitted'
                ? 'Submit your assignments to see them here.'
                : 'Check back later for new assignments from your lecturers.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5 sm:space-y-3">
            {filtered.map((a) => <AssignmentCard key={a.id} a={a} />)}
          </div>
        )}

      </div>
    </PageContainer>
  )
}
