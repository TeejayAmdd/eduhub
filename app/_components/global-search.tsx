'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search, Users, BookOpen, FileText, ClipboardList, X, Loader2,
  Home, Calendar, BarChart3, Settings, MessageSquare, CheckSquare,
  GraduationCap, Bell, Plus, UserPlus, Award, LayoutDashboard,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { search, type SearchResults } from '@/lib/api'

// ── Static items (pages + quick actions) ──────────────────────────────────────

interface StaticItem {
  label: string
  sub: string
  type: 'page' | 'action'
  link: string
  role: 'all' | 'lecturer' | 'student'
  icon: React.ReactNode
  keywords: string[]
}

const STATIC_ITEMS: StaticItem[] = [
  // ── Lecturer pages ────────────────────────────────────────
  { label: 'Overview',            sub: 'Lecturer dashboard',       type: 'page',   role: 'lecturer', link: '/overview',          icon: <Home className="w-3.5 h-3.5" />,          keywords: ['dashboard','home','overview'] },
  { label: 'Class Preparation',   sub: 'Create and manage classes', type: 'page',  role: 'lecturer', link: '/class-preparation',  icon: <BookOpen className="w-3.5 h-3.5" />,      keywords: ['class','create','new class','preparation','course'] },
  { label: 'Attendance',          sub: 'Mark student attendance',   type: 'page',  role: 'lecturer', link: '/attendance',         icon: <CheckSquare className="w-3.5 h-3.5" />,   keywords: ['attendance','present','absent','mark'] },
  { label: 'Exams',               sub: 'Schedule and manage exams', type: 'page',  role: 'lecturer', link: '/exams',              icon: <ClipboardList className="w-3.5 h-3.5" />, keywords: ['exam','test','schedule','results'] },
  { label: 'Assignments',         sub: 'Create and track assignments', type: 'page', role: 'lecturer', link: '/assignments',      icon: <FileText className="w-3.5 h-3.5" />,      keywords: ['assignment','homework','submission','due'] },
  { label: 'Schedule',            sub: 'Weekly class timetable',    type: 'page',  role: 'lecturer', link: '/schedule',           icon: <Calendar className="w-3.5 h-3.5" />,      keywords: ['schedule','timetable','week','time'] },
  { label: 'Students',            sub: 'View and manage students',  type: 'page',  role: 'lecturer', link: '/students',           icon: <Users className="w-3.5 h-3.5" />,         keywords: ['students','list','enroll','roster'] },
  { label: 'Messages',            sub: 'Send and receive messages', type: 'page',  role: 'lecturer', link: '/messages',           icon: <MessageSquare className="w-3.5 h-3.5" />, keywords: ['messages','inbox','send','chat'] },
  { label: 'Analytics',           sub: 'Performance analytics',     type: 'page',  role: 'lecturer', link: '/analytics',          icon: <BarChart3 className="w-3.5 h-3.5" />,     keywords: ['analytics','reports','performance','stats','data'] },
  { label: 'Reports',             sub: 'Generate reports',          type: 'page',  role: 'lecturer', link: '/reports',            icon: <ClipboardList className="w-3.5 h-3.5" />, keywords: ['reports','export','generate'] },
  { label: 'Settings',            sub: 'Account settings',          type: 'page',  role: 'lecturer', link: '/settings',           icon: <Settings className="w-3.5 h-3.5" />,      keywords: ['settings','account','profile','password'] },

  // ── Lecturer actions ──────────────────────────────────────
  { label: 'New Class',           sub: 'Create a new class',        type: 'action', role: 'lecturer', link: '/class-preparation', icon: <Plus className="w-3.5 h-3.5" />,          keywords: ['new class','create class','add class'] },
  { label: 'Create Assignment',   sub: 'Post a new assignment',     type: 'action', role: 'lecturer', link: '/assignments',        icon: <FileText className="w-3.5 h-3.5" />,      keywords: ['create assignment','new assignment','post'] },
  { label: 'Add Student',         sub: 'Enroll a student',          type: 'action', role: 'lecturer', link: '/students',           icon: <UserPlus className="w-3.5 h-3.5" />,      keywords: ['add student','enroll student'] },
  { label: 'Mark Attendance',     sub: 'Record attendance for today', type: 'action', role: 'lecturer', link: '/attendance',      icon: <CheckSquare className="w-3.5 h-3.5" />,   keywords: ['mark attendance','record attendance'] },
  { label: 'Schedule Exam',       sub: 'Create a new exam',         type: 'action', role: 'lecturer', link: '/exams',             icon: <ClipboardList className="w-3.5 h-3.5" />, keywords: ['schedule exam','new exam','create exam'] },
  { label: 'Send Announcement',   sub: 'Notify enrolled students',  type: 'action', role: 'lecturer', link: '/messages',          icon: <Bell className="w-3.5 h-3.5" />,          keywords: ['send announcement','announce','notify','broadcast'] },
  { label: 'Send Message',        sub: 'Message a student',         type: 'action', role: 'lecturer', link: '/messages',          icon: <MessageSquare className="w-3.5 h-3.5" />, keywords: ['send message','message student','contact'] },
  { label: 'View Analytics',      sub: 'Class performance report',  type: 'action', role: 'lecturer', link: '/analytics',         icon: <BarChart3 className="w-3.5 h-3.5" />,     keywords: ['view analytics','performance','stats'] },
  { label: 'Publish Exam Results', sub: 'Release grades to students', type: 'action', role: 'lecturer', link: '/exams',          icon: <Award className="w-3.5 h-3.5" />,         keywords: ['publish results','grades','release'] },

  // ── Student pages ─────────────────────────────────────────
  { label: 'Overview',            sub: 'Student dashboard',         type: 'page',  role: 'student',  link: '/student/overview',   icon: <LayoutDashboard className="w-3.5 h-3.5" />, keywords: ['dashboard','home','overview'] },
  { label: 'My Courses',          sub: 'Browse and enroll in classes', type: 'page', role: 'student', link: '/student/courses',   icon: <BookOpen className="w-3.5 h-3.5" />,      keywords: ['courses','classes','enroll','browse','join'] },
  { label: 'My Assignments',      sub: 'View and submit assignments', type: 'page', role: 'student', link: '/student/assignments', icon: <FileText className="w-3.5 h-3.5" />,      keywords: ['assignments','homework','submit','due'] },
  { label: 'Attendance',          sub: 'Your attendance record',    type: 'page',  role: 'student',  link: '/student/attendance', icon: <CheckSquare className="w-3.5 h-3.5" />,   keywords: ['attendance','present','absent'] },
  { label: 'Schedule',            sub: 'Your weekly timetable',     type: 'page',  role: 'student',  link: '/student/schedule',   icon: <Calendar className="w-3.5 h-3.5" />,      keywords: ['schedule','timetable','classes','time'] },
  { label: 'Grades & Exams',      sub: 'Your results and exams',    type: 'page',  role: 'student',  link: '/student/grades',     icon: <GraduationCap className="w-3.5 h-3.5" />, keywords: ['grades','results','exams','marks','score'] },
  { label: 'Messages',            sub: 'Your inbox',                type: 'page',  role: 'student',  link: '/student/messages',   icon: <MessageSquare className="w-3.5 h-3.5" />, keywords: ['messages','inbox','chat'] },
  { label: 'Analytics',           sub: 'Your performance stats',    type: 'page',  role: 'student',  link: '/student/analytics',  icon: <BarChart3 className="w-3.5 h-3.5" />,     keywords: ['analytics','performance','stats'] },
  { label: 'Settings',            sub: 'Account settings',          type: 'page',  role: 'student',  link: '/student/settings',   icon: <Settings className="w-3.5 h-3.5" />,      keywords: ['settings','account','profile','password'] },

  // ── Student actions ───────────────────────────────────────
  { label: 'Submit Assignment',   sub: 'Hand in your work',         type: 'action', role: 'student', link: '/student/assignments', icon: <FileText className="w-3.5 h-3.5" />,     keywords: ['submit','hand in','assignment','upload'] },
  { label: 'Check Attendance',    sub: 'View your attendance rate', type: 'action', role: 'student', link: '/student/attendance',  icon: <CheckSquare className="w-3.5 h-3.5" />,  keywords: ['check attendance','my attendance','rate'] },
  { label: 'View Grades',         sub: 'See your exam results',     type: 'action', role: 'student', link: '/student/grades',      icon: <Award className="w-3.5 h-3.5" />,        keywords: ['view grades','results','marks','score'] },
  { label: 'View Schedule',       sub: 'See today\'s classes',      type: 'action', role: 'student', link: '/student/schedule',    icon: <Calendar className="w-3.5 h-3.5" />,     keywords: ['view schedule','today','classes','timetable'] },
  { label: 'Send Message',        sub: 'Contact your lecturer',     type: 'action', role: 'student', link: '/student/messages',    icon: <MessageSquare className="w-3.5 h-3.5" />,keywords: ['send message','contact','lecturer'] },
  { label: 'Enroll in Course',    sub: 'Join a class',              type: 'action', role: 'student', link: '/student/courses',     icon: <BookOpen className="w-3.5 h-3.5" />,     keywords: ['enroll','join','course','class','register'] },
]

function filterStatic(q: string, role: string): StaticItem[] {
  const lower = q.toLowerCase().trim()
  if (lower.length < 1) return []
  return STATIC_ITEMS.filter((item) => {
    if (item.role !== 'all' && item.role !== role) return false
    return (
      item.label.toLowerCase().includes(lower) ||
      item.sub.toLowerCase().includes(lower) ||
      item.keywords.some((k) => k.includes(lower))
    )
  }).slice(0, 6)
}

// ── Dynamic API items ─────────────────────────────────────────────────────────

interface DynamicItem {
  id: number
  label: string
  sub: string
  type: string
  link: string
  icon: React.ReactNode
}

const dataIcon: Record<string, React.ReactNode> = {
  student:    <Users className="w-3.5 h-3.5" />,
  class:      <BookOpen className="w-3.5 h-3.5" />,
  assignment: <FileText className="w-3.5 h-3.5" />,
  exam:       <ClipboardList className="w-3.5 h-3.5" />,
}

const dataColor: Record<string, string> = {
  student:    'bg-blue-50 text-blue-600 border-blue-100',
  class:      'bg-violet-50 text-violet-600 border-violet-100',
  assignment: 'bg-amber-50 text-amber-600 border-amber-100',
  exam:       'bg-green-50 text-green-600 border-green-100',
}

const staticColor: Record<string, string> = {
  page:   'bg-slate-50 text-slate-600 border-slate-100',
  action: 'bg-primary/5 text-primary border-primary/10',
}

function flattenResults(data: SearchResults): DynamicItem[] {
  const items: DynamicItem[] = []
  data.students.forEach((s) => items.push({ id: s.id, type: 'student', link: s.link, label: s.name,  sub: s.matric_number ?? s.email,                          icon: dataIcon.student }))
  data.classes.forEach((c)  => items.push({ id: c.id, type: 'class',   link: c.link, label: c.name,  sub: c.course_code ? `${c.course_code} · ${c.subject}` : c.subject, icon: dataIcon.class }))
  data.assignments.forEach((a) => items.push({ id: a.id, type: 'assignment', link: a.link, label: a.title, sub: `Due ${new Date(a.due_date).toLocaleDateString()}`, icon: dataIcon.assignment }))
  data.exams.forEach((e)    => items.push({ id: e.id, type: 'exam',     link: e.link, label: e.title, sub: new Date(e.exam_date).toLocaleDateString(),            icon: dataIcon.exam }))
  return items
}

// ── Component ─────────────────────────────────────────────────────────────────

export function GlobalSearch({ placeholder = 'Search anything…' }: { placeholder?: string }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [staticResults, setStaticResults] = useState<StaticItem[]>([])
  const [dynamicResults, setDynamicResults] = useState<DynamicItem[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const [userRole, setUserRole] = useState<string>('lecturer')
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const role = localStorage.getItem('role') ?? 'lecturer'
    setUserRole(role)
  }, [])

  // All visible results combined (static first, then data)
  const allResults = [
    ...staticResults.map((s, i) => ({ key: `static-${i}`, label: s.label, sub: s.sub, type: s.type, link: s.link, icon: s.icon, color: staticColor[s.type] })),
    ...dynamicResults.map((d) => ({ key: `data-${d.type}-${d.id}`, label: d.label, sub: d.sub, type: d.type, link: d.link, icon: d.icon, color: dataColor[d.type] ?? 'bg-muted text-foreground border-border' })),
  ]

  const runAPISearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setDynamicResults([]); return }
    setLoading(true)
    try {
      const data = await search(q)
      setDynamicResults(flattenResults(data))
    } catch {
      setDynamicResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const q = query
    // Static results are instant
    setStaticResults(filterStatic(q, userRole))
    setActiveIdx(0)

    if (q.trim().length >= 2) {
      setOpen(true)
      // Debounce only the API call
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => runAPISearch(q), 350)
    } else {
      setDynamicResults([])
      setOpen(q.length > 0 && filterStatic(q, userRole).length > 0)
    }
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, userRole, runAPISearch])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSelect = (link: string) => {
    setQuery('')
    setStaticResults([])
    setDynamicResults([])
    setOpen(false)
    router.push(link)
  }

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, allResults.length - 1)); return }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); return }
    if (e.key === 'Escape')    { setOpen(false); inputRef.current?.blur(); return }

    if (e.key === 'Enter') {
      e.preventDefault()
      if (debounceRef.current) clearTimeout(debounceRef.current)

      if (open && allResults.length > 0) {
        handleSelect(allResults[activeIdx]?.link ?? allResults[0].link)
      } else if (query.trim().length >= 2) {
        // Fire immediately and navigate to first result
        const sResults = filterStatic(query, userRole)
        if (sResults.length > 0) { handleSelect(sResults[0].link); return }
        setLoading(true)
        try {
          const data = await search(query)
          const flat = flattenResults(data)
          if (flat.length > 0) handleSelect(flat[0].link)
          else { setDynamicResults([]); setOpen(true) }
        } finally { setLoading(false) }
      }
    }
  }

  const clear = () => {
    setQuery('')
    setStaticResults([])
    setDynamicResults([])
    setOpen(false)
    inputRef.current?.focus()
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-xs sm:max-w-sm">
      {/* Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => allResults.length > 0 && setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="pl-9 pr-8 h-9 text-sm"
          autoComplete="off"
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-muted-foreground" />}
        {!loading && query && (
          <button onClick={clear} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && allResults.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1.5 z-50 rounded-xl border border-border bg-background shadow-xl overflow-hidden">
          {/* Section labels */}
          {staticResults.length > 0 && (
            <p className="px-3 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Pages & Actions
            </p>
          )}
          {staticResults.map((item, idx) => (
            <button
              key={`static-${idx}`}
              onMouseDown={(e) => { e.preventDefault(); handleSelect(item.link) }}
              onMouseEnter={() => setActiveIdx(idx)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 text-left transition-colors',
                idx === activeIdx ? 'bg-muted' : 'hover:bg-muted/50'
              )}
            >
              <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border', staticColor[item.type])}>
                {item.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{item.label}</p>
                <p className="text-xs text-muted-foreground truncate">{item.sub}</p>
              </div>
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground shrink-0 capitalize">{item.type}</span>
            </button>
          ))}

          {dynamicResults.length > 0 && (
            <>
              <div className="border-t border-border/50 mt-1" />
              <p className="px-3 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Data
              </p>
              {dynamicResults.map((item, idx) => {
                const globalIdx = staticResults.length + idx
                return (
                  <button
                    key={`data-${item.type}-${item.id}`}
                    onMouseDown={(e) => { e.preventDefault(); handleSelect(item.link) }}
                    onMouseEnter={() => setActiveIdx(globalIdx)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 text-left transition-colors border-b last:border-0',
                      globalIdx === activeIdx ? 'bg-muted' : 'hover:bg-muted/50'
                    )}
                  >
                    <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border', dataColor[item.type])}>
                      {item.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{item.label}</p>
                      <p className="text-xs text-muted-foreground truncate">{item.sub}</p>
                    </div>
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground shrink-0">{item.type}</span>
                  </button>
                )
              })}
            </>
          )}

          {/* Loading indicator for API */}
          {loading && dynamicResults.length === 0 && (
            <div className="flex items-center gap-2 px-3 py-2.5 text-xs text-muted-foreground border-t">
              <Loader2 className="w-3 h-3 animate-spin" /> Searching data…
            </div>
          )}
        </div>
      )}

      {/* No results state */}
      {open && allResults.length === 0 && !loading && query.length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-1.5 z-50 rounded-xl border border-border bg-background shadow-xl px-4 py-6 text-center">
          <Search className="w-6 h-6 mx-auto mb-2 text-muted-foreground opacity-40" />
          <p className="text-sm font-medium">No results for &ldquo;{query}&rdquo;</p>
          <p className="text-xs text-muted-foreground mt-1">Try a different keyword</p>
        </div>
      )}
    </div>
  )
}
