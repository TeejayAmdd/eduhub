'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Upload, FileText, Sparkles, Download, BookOpen,
  ChevronRight, ChevronLeft, CheckCircle2, Loader2, ArrowLeft,
  LayoutTemplate, Save, History, Plus,
  Calendar, Eye, X,
  BarChart2, Columns2, ImagePlus, SlidersHorizontal,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { PageContainer } from '@/app/_components/page-container'
import { cn } from '@/lib/utils'

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

function getToken() {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('token')
}

async function apiFetch(path: string, options: RequestInit = {}) {
  const token = getToken()
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers as Record<string, string> || {}),
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }))
    throw new Error(typeof err.detail === 'string' ? err.detail : 'Request failed')
  }
  return res.json().catch(() => { throw new Error('Server returned an unexpected response') })
}

interface SlideContent {
  slide: number
  title: string | null
  body: string[]
  notes: string[]
}

interface GenerationResult {
  presentation_id: string
  title: string
  subject: string
  slide_count: number
  outline: string[]
  slides: SlideContent[]
}

interface CourseClass {
  id: number
  name: string
  course_code: string | null
}

interface HistoryItem {
  history_id: number
  title: string
  class_name: string | null
  course_code: string | null
  saved_at: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatHistoryDate(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  const today = new Date()
  const diff  = Math.floor((today.getTime() - d.getTime()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// ── Step indicator ────────────────────────────────────────────────────────────
function StepDot({ n, current, label }: { n: number; current: number; label: string }) {
  const done   = n < current
  const active = n === current
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={cn(
        'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all',
        done   ? 'bg-primary text-primary-foreground' :
        active ? 'bg-primary text-primary-foreground ring-4 ring-primary/20' :
                 'bg-muted text-muted-foreground',
      )}>
        {done ? <CheckCircle2 className="h-4 w-4" /> : n}
      </div>
      <span className={cn('text-[10px] font-medium hidden sm:block',
        active ? 'text-primary' : 'text-muted-foreground')}>{label}</span>
    </div>
  )
}

function StepLine({ done }: { done: boolean }) {
  return <div className={cn('flex-1 h-px mt-4', done ? 'bg-primary' : 'bg-border')} />
}

// ── Slide preview modal ───────────────────────────────────────────────────────
function SlidePreviewModal({
  open,
  presentationTitle,
  slides: initialSlides,
  fetchUrl,
  onDownload,
  onClose,
}: {
  open: boolean
  presentationTitle: string
  slides?: SlideContent[]
  fetchUrl?: string
  onDownload: () => void
  onClose: () => void
}) {
  const [slides, setSlides] = useState<SlideContent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    if (!open) return
    setCurrent(0)
    if (initialSlides && initialSlides.length > 0) {
      setSlides(initialSlides); setError(''); setLoading(false)
      return
    }
    if (!fetchUrl) return
    setLoading(true); setError(''); setSlides([])
    apiFetch(fetchUrl)
      .then((data: SlideContent[]) => setSlides(data))
      .catch((e: any) => setError(e.message || 'Could not load slides'))
      .finally(() => setLoading(false))
  }, [open, fetchUrl, initialSlides])

  if (!open) return null

  const slide = slides[current]
  const total = slides.length

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-background rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b shrink-0">
          <LayoutTemplate className="h-4 w-4 text-primary shrink-0" />
          <p className="font-semibold text-sm flex-1 min-w-0 truncate">{presentationTitle}</p>
          <Button size="sm" variant="outline" className="shrink-0" onClick={() => { onDownload(); onClose() }}>
            <Download className="h-3.5 w-3.5 mr-1.5" />Download
          </Button>
          <button onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Slide area */}
        <div className="flex-1 overflow-y-auto p-5 min-h-0">
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : error ? (
            <p className="text-sm text-destructive text-center py-10">{error}</p>
          ) : !slide ? (
            <p className="text-sm text-muted-foreground text-center py-10">No slides found</p>
          ) : (
            <div className="space-y-3">
              {/* Slide card */}
              <div className="rounded-xl border bg-muted/20 p-6 min-h-[280px] space-y-4">
                <div className="flex items-center gap-2">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex-1">
                    Slide {slide.slide} of {total}
                  </p>
                  {(slide as any).slide_type && (slide as any).slide_type !== 'bullets' && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary capitalize">
                      {((slide as any).slide_type as string).replace('_', ' ')}
                    </span>
                  )}
                </div>
                {slide.title && (
                  <h2 className="text-xl font-bold leading-snug">{slide.title}</h2>
                )}
                {slide.body.length > 0 && (
                  <ul className="space-y-2 pt-1">
                    {slide.body.map((line, i) => (
                      <li key={i} className="text-sm flex gap-2.5 leading-relaxed">
                        <span className="text-primary mt-[3px] shrink-0">•</span>
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {!slide.title && slide.body.length === 0 && (
                  <p className="text-sm text-muted-foreground italic">Section divider</p>
                )}
              </div>

              {/* Speaker notes */}
              {slide.notes.length > 0 && (
                <div className="rounded-lg border border-border/50 bg-amber-50/50 dark:bg-amber-900/10 px-4 py-3">
                  <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-1.5">
                    Speaker Notes
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{slide.notes.join(' ')}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Navigation */}
        {!loading && total > 0 && (
          <div className="border-t px-5 py-3 flex items-center gap-3 shrink-0">
            <button
              onClick={() => setCurrent(c => Math.max(0, c - 1))}
              disabled={current === 0}
              className="h-8 w-8 flex items-center justify-center rounded-lg border hover:bg-muted disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex-1 flex gap-1 justify-center flex-wrap">
              {Array.from({ length: total }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrent(i)}
                  className={cn(
                    'h-1.5 rounded-full transition-all',
                    i === current ? 'bg-primary w-5' : 'bg-border w-1.5 hover:bg-muted-foreground',
                  )}
                />
              ))}
            </div>
            <button
              onClick={() => setCurrent(c => Math.min(total - 1, c + 1))}
              disabled={current === total - 1}
              className="h-8 w-8 flex items-center justify-center rounded-lg border hover:bg-muted disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function LecturePrepPage() {
  const [view, setView] = useState<'home' | 'wizard'>('home')

  // History
  const [history, setHistory]           = useState<HistoryItem[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [historyError, setHistoryError] = useState('')

  // Wizard state
  const [step, setStep] = useState(1)

  // Step 1
  const [file, setFile]         = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Step 2 — basics
  const [presTitle, setPresTitle]       = useState('')
  const [numSlides, setNumSlides]       = useState('auto')
  const [level, setLevel]               = useState('undergraduate')
  const [focus, setFocus]               = useState('')
  const [tone, setTone]                 = useState('academic')
  const [includeNotes, setIncludeNotes] = useState(true)
  // Step 2 — design
  const [theme, setTheme]               = useState('dark')
  const [font, setFont]                 = useState('calibri')
  const [logo, setLogo]                 = useState<File | null>(null)
  const logoRef = useRef<HTMLInputElement>(null)
  // Step 2 — enhanced features
  const [includeCharts, setIncludeCharts]         = useState(false)
  const [includeDiagrams, setIncludeDiagrams]     = useState(false)
  const [enhancedLayouts, setEnhancedLayouts]     = useState(false)

  // Step 3
  const [statusMsg, setStatusMsg] = useState('')
  const [genError, setGenError]   = useState('')

  // Step 4
  const [result, setResult]     = useState<GenerationResult | null>(null)
  const [classes, setClasses]   = useState<CourseClass[]>([])
  const [saveClass, setSaveClass] = useState('')
  const [saveTitle, setSaveTitle] = useState('')
  const [saving, setSaving]           = useState(false)
  const [saveMsg, setSaveMsg]         = useState('')
  const [historySaving, setHistorySaving] = useState(false)
  const [historyMsg, setHistoryMsg]   = useState('')

  // Preview modal
  const [previewOpen, setPreviewOpen]         = useState(false)
  const [previewTitle, setPreviewTitle]       = useState('')
  const [previewSlides, setPreviewSlides]     = useState<SlideContent[] | undefined>(undefined)
  const [previewFetchUrl, setPreviewFetchUrl] = useState<string | undefined>(undefined)
  const [previewDownload, setPreviewDownload] = useState<(() => void) | undefined>(undefined)

  useEffect(() => {
    apiFetch('/api/lecture-prep/history')
      .then((data) => { setHistory(data); setHistoryError('') })
      .catch((e: any) => setHistoryError(e.message || 'Could not load history'))
      .finally(() => setLoadingHistory(false))
  }, [])

  const refreshHistory = () => {
    apiFetch('/api/lecture-prep/history')
      .then((data) => { setHistory(data); setHistoryError('') })
      .catch((e: any) => setHistoryError(e.message || 'Could not load history'))
  }

  const handleFile = (f: File) => {
    setFile(f)
    if (!presTitle) setPresTitle(f.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '))
  }

  const generate = async () => {
    if (!file) return
    setStep(3); setGenError('')
    const msgs = ['Reading your lecture material…', 'Analysing key concepts…', 'Structuring your slides…', 'Building the presentation…']
    let i = 0; setStatusMsg(msgs[0])
    const tick = setInterval(() => { i = (i + 1) % msgs.length; setStatusMsg(msgs[i]) }, 2200)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('title', presTitle)
      form.append('num_slides', numSlides)
      form.append('level', level)
      form.append('focus', focus)
      form.append('tone', tone)
      form.append('include_notes', String(includeNotes))
      form.append('theme', theme)
      form.append('font', font)
      form.append('include_charts', String(includeCharts))
      form.append('include_diagrams', String(includeDiagrams))
      form.append('enhanced_layouts', String(enhancedLayouts))
      if (logo) form.append('logo', logo)
      const token = getToken()
      const res = await fetch(`${BASE}/api/lecture-prep/generate`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      })
      if (!res.ok) { const e = await res.json().catch(() => ({ detail: 'Failed' })); throw new Error(e.detail) }
      const data: GenerationResult = await res.json()
      setResult(data); setSaveTitle(data.title)
      try { const cls = await apiFetch('/api/classes'); setClasses(cls); if (cls.length) setSaveClass(String(cls[0].id)) } catch {}
      setStep(4)
    } catch (e: any) {
      setGenError(e.message || 'Something went wrong. Please try again.')
      setStep(2)
    } finally { clearInterval(tick) }
  }

  const download = (presentationId: string, title: string) => {
    const token = getToken()
    fetch(`${BASE}/api/lecture-prep/download/${presentationId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).then(r => r.blob()).then(blob => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `${title || 'cortex-lecture'}.pptx`
      a.click(); URL.revokeObjectURL(url)
    })
  }

  const redownload = (historyId: number, title: string) => {
    const token = getToken()
    fetch(`${BASE}/api/lecture-prep/history/${historyId}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).then(r => r.blob()).then(blob => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `${title}.pptx`
      a.click(); URL.revokeObjectURL(url)
    })
  }

  const saveToHistory = async () => {
    if (!result) return
    setHistorySaving(true); setHistoryMsg('')
    try {
      await apiFetch('/api/lecture-prep/save-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presentation_id: result.presentation_id, title: saveTitle }),
      })
      setHistoryMsg('Saved to history')
      refreshHistory()
    } catch (e: any) {
      setHistoryMsg(`Error: ${e.message}`)
    } finally {
      setHistorySaving(false)
    }
  }

  const saveToClass = async () => {
    if (!result || !saveClass) return
    setSaving(true); setSaveMsg('')
    try {
      const token = getToken()
      const res = await fetch(`${BASE}/api/lecture-prep/save/${saveClass}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ presentation_id: result.presentation_id, title: saveTitle }),
      })
      if (!res.ok) { const e = await res.json().catch(() => ({ detail: 'Save failed' })); throw new Error(e.detail) }
      const data = await res.json()
      setSaveMsg(data.message)
      refreshHistory()
    } catch (e: any) { setSaveMsg(`Error: ${e.message}`) }
    finally { setSaving(false) }
  }

  const startNew = () => {
    setStep(1); setFile(null); setPresTitle(''); setResult(null)
    setSaveMsg(''); setHistoryMsg(''); setGenError(''); setFocus('')
    setLogo(null)
  }

  const newPresentation = () => { startNew(); setView('wizard') }
  const goHome = () => { startNew(); setView('home'); refreshHistory() }

  const openPreview = (
    title: string,
    downloadFn: () => void,
    slides?: SlideContent[],
    fetchUrl?: string,
  ) => {
    setPreviewTitle(title)
    setPreviewDownload(() => downloadFn)
    setPreviewSlides(slides)
    setPreviewFetchUrl(fetchUrl)
    setPreviewOpen(true)
  }

  return (
    <>
    <SlidePreviewModal
      open={previewOpen}
      presentationTitle={previewTitle}
      slides={previewSlides}
      fetchUrl={previewFetchUrl}
      onDownload={previewDownload ?? (() => {})}
      onClose={() => setPreviewOpen(false)}
    />
    <PageContainer>
      {view === 'home' ? (
        /* ── Home / main page ── */
        <div className="w-full max-w-7xl mx-auto space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
                <LayoutTemplate className="h-6 w-6" />
                Lecture Prep with Cortex
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Turn your lecture material into a professional PPTX — built by Cortex AI.
              </p>
            </div>
            <Button onClick={newPresentation} className="gap-2">
              <Plus className="h-4 w-4" />
              New presentation
            </Button>
          </div>

          {/* Big CTA */}
          <button
            onClick={newPresentation}
            className="w-full rounded-2xl border-2 border-dashed border-border px-6 py-10 text-center transition-colors hover:border-primary/40 hover:bg-primary/5"
          >
            <div className="mx-auto mb-3 h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <p className="font-semibold">Create a new presentation</p>
            <p className="text-sm text-muted-foreground mt-1">Upload a PDF, DOCX or TXT and Cortex builds your slides</p>
          </button>

          {/* Saved presentations */}
          <div className="space-y-3">
            <div className="flex items-center gap-1.5">
              <History className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Saved presentations</h2>
            </div>
            {loadingHistory ? (
              <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : historyError ? (
              <p className="text-sm text-destructive py-6 text-center">{historyError}</p>
            ) : history.length === 0 ? (
              <div className="rounded-xl border bg-card py-12 text-center text-sm text-muted-foreground">
                Presentations you save will appear here.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {history.map(item => (
                  <button
                    key={item.history_id}
                    onClick={() => openPreview(
                      item.title,
                      () => redownload(item.history_id, item.title),
                      undefined,
                      `/api/lecture-prep/history/${item.history_id}/slides`,
                    )}
                    className="text-left rounded-xl border bg-card p-4 space-y-2.5 transition-colors hover:border-primary/40 hover:bg-muted/30"
                    title="Click to preview"
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <LayoutTemplate className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{item.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {item.course_code ? `${item.course_code} · ` : ''}{item.class_name ?? 'Personal save'}
                        </p>
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                      <Calendar className="h-3 w-3" />{formatHistoryDate(item.saved_at)}
                      <span className="text-muted-foreground/50">·</span>
                      <Eye className="h-3 w-3" />Preview
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ── Wizard ── */
        <div className="w-full max-w-3xl mx-auto space-y-6">
          <Button variant="ghost" size="sm" onClick={goHome} className="-ml-2 text-muted-foreground">
            <ArrowLeft className="mr-2 h-4 w-4" />Back to Lecture Prep
          </Button>

          <div className="space-y-8">

            {/* Step indicator */}
            <div className="flex items-center gap-0">
              <StepDot n={1} current={step} label="Material" />
              <StepLine done={step > 1} />
              <StepDot n={2} current={step} label="Options" />
              <StepLine done={step > 2} />
              <StepDot n={3} current={step} label="Generating" />
              <StepLine done={step > 3} />
              <StepDot n={4} current={step} label="Done" />
            </div>

            {/* ── Step 1: Upload ────────────────────────────────────── */}
            {step === 1 && (
              <div className="space-y-6">
                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
                  onClick={() => fileRef.current?.click()}
                  className={cn(
                    'border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-colors',
                    dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30',
                  )}
                >
                  <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.doc" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
                  {file ? (
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center">
                        <FileText className="h-7 w-7 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{file.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{(file.size / 1024).toFixed(0)} KB · Click to change</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                      <Upload className="h-10 w-10 opacity-40" />
                      <div>
                        <p className="font-semibold text-sm">Drop your lecture material here</p>
                        <p className="text-xs mt-1">PDF, DOCX, or TXT · Click to browse</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Presentation title <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Input placeholder="e.g. Introduction to Data Structures" value={presTitle} onChange={e => setPresTitle(e.target.value)} />
                </div>

                <Button className="w-full" disabled={!file} onClick={() => setStep(2)}>
                  Continue <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            )}

            {/* ── Step 2: Preferences ───────────────────────────────── */}
            {step === 2 && (
              <div className="space-y-6">
                {genError && (
                  <div className="bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3 text-sm text-destructive">{genError}</div>
                )}

                <div className="space-y-2">
                  <Label>Number of slides</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[{ val: 'auto', label: 'Auto' }, { val: '10-15', label: '10–15' }, { val: '15-20', label: '15–20' }, { val: '20-30', label: '20–30' }].map(o => (
                      <button key={o.val} onClick={() => setNumSlides(o.val)}
                        className={cn('rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors',
                          numSlides === o.val ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:border-primary/40')}>
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Student level</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[{ val: '100 level', label: '100 Level' }, { val: '200 level', label: '200 Level' }, { val: '300 level', label: '300 Level' }, { val: '400 level', label: '400 Level' }, { val: 'postgraduate', label: 'Postgraduate' }, { val: 'undergraduate', label: 'General UG' }].map(o => (
                      <button key={o.val} onClick={() => setLevel(o.val)}
                        className={cn('rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors',
                          level === o.val ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:border-primary/40')}>
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Presentation tone</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {[{ val: 'academic', label: 'Academic', desc: 'Formal, detailed' }, { val: 'simplified', label: 'Simplified', desc: 'Clear, concise' }, { val: 'exam-focused', label: 'Exam-focused', desc: 'Key points' }].map(o => (
                      <button key={o.val} onClick={() => setTone(o.val)}
                        className={cn('rounded-xl border px-3 py-2.5 text-sm text-left transition-colors',
                          tone === o.val ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40')}>
                        <p className={cn('font-semibold', tone === o.val ? 'text-primary' : '')}>{o.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{o.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>What should the slides emphasise? <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Textarea placeholder="e.g. Focus on practical examples and key definitions." value={focus} onChange={e => setFocus(e.target.value)} rows={2} className="resize-none" />
                </div>

                <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">Include speaker notes</p>
                    <p className="text-xs text-muted-foreground mt-0.5">AI adds talking points for each slide</p>
                  </div>
                  <button onClick={() => setIncludeNotes(v => !v)}
                    className={cn('relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors', includeNotes ? 'bg-primary' : 'bg-muted')}>
                    <span className={cn('pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transform transition-transform mt-0.5', includeNotes ? 'translate-x-5' : 'translate-x-0.5')} />
                  </button>
                </div>

                {/* ── Design: Theme ── */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><SlidersHorizontal className="h-3.5 w-3.5" />Colour theme</Label>
                  <div className="grid grid-cols-5 gap-2">
                    {([
                      { id: 'dark',      name: 'Dark',      bg: '#0F172A', accent: '#4F46E5', text: '#E2E8F0' },
                      { id: 'corporate', name: 'Corporate', bg: '#003274', accent: '#0071BC', text: '#DCE8F8' },
                      { id: 'minimal',   name: 'Minimal',   bg: '#111111', accent: '#888888', text: '#FAFAF9' },
                      { id: 'forest',    name: 'Forest',    bg: '#0D2B18', accent: '#16A34A', text: '#D1FAE5' },
                      { id: 'sunset',    name: 'Sunset',    bg: '#180802', accent: '#EA580C', text: '#FED7AA' },
                    ] as const).map(t => (
                      <button key={t.id} onClick={() => setTheme(t.id)}
                        className={cn('relative rounded-xl border-2 overflow-hidden h-16 transition-all',
                          theme === t.id ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:border-primary/40')}>
                        <div className="absolute inset-0" style={{ background: t.bg }}>
                          <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ background: t.accent }} />
                          <div className="absolute left-3 top-2 right-1 space-y-0.5">
                            <div className="h-1 rounded-sm" style={{ background: t.accent, width: '55%' }} />
                            <div className="h-0.5 rounded-sm opacity-70" style={{ background: t.text, width: '75%' }} />
                            <div className="h-0.5 rounded-sm opacity-70" style={{ background: t.text, width: '60%' }} />
                            <div className="h-0.5 rounded-sm opacity-70" style={{ background: t.text, width: '70%' }} />
                          </div>
                        </div>
                        <p className="absolute bottom-0 left-0 right-0 text-center text-[8px] font-semibold py-0.5"
                          style={{ background: t.accent + 'cc', color: '#fff' }}>{t.name}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── Design: Font ── */}
                <div className="space-y-2">
                  <Label>Font</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {([
                      { id: 'calibri',   name: 'Calibri',   family: 'Calibri, sans-serif' },
                      { id: 'arial',     name: 'Arial',     family: 'Arial, sans-serif' },
                      { id: 'georgia',   name: 'Georgia',   family: 'Georgia, serif' },
                      { id: 'trebuchet', name: 'Trebuchet', family: '"Trebuchet MS", sans-serif' },
                    ] as const).map(f => (
                      <button key={f.id} onClick={() => setFont(f.id)}
                        className={cn('rounded-xl border px-3 py-2.5 text-left transition-colors',
                          font === f.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40')}>
                        <p className="text-xl font-bold leading-none mb-0.5"
                          style={{ fontFamily: f.family, color: font === f.id ? 'hsl(var(--primary))' : undefined }}>Aa</p>
                        <p className="text-xs text-muted-foreground">{f.name}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── Design: Logo ── */}
                <div className="space-y-1.5">
                  <Label>Logo <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <div className="flex items-center gap-2">
                    {logo ? (
                      <div className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm flex-1 min-w-0">
                        <ImagePlus className="h-4 w-4 text-primary shrink-0" />
                        <span className="truncate text-xs">{logo.name}</span>
                        <button onClick={() => setLogo(null)} className="ml-auto shrink-0">
                          <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => logoRef.current?.click()}
                        className="flex-1 flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors">
                        <ImagePlus className="h-4 w-4 shrink-0" />Upload logo (PNG/JPG)
                      </button>
                    )}
                    <input ref={logoRef} type="file" accept="image/png,image/jpeg,image/jpg" className="hidden"
                      onChange={e => setLogo(e.target.files?.[0] ?? null)} />
                  </div>
                  <p className="text-[11px] text-muted-foreground">Appears in the bottom-right corner of every slide</p>
                </div>

                {/* ── Enhanced slide types ── */}
                <div className="space-y-2">
                  <Label>Enhanced slide types</Label>
                  <div className="space-y-2">
                    {([
                      { key: 'charts',   label: 'Data charts',         desc: 'Auto-generate bar, line & pie charts from statistics in your material', icon: BarChart2,  state: includeCharts,   set: setIncludeCharts },
                      { key: 'diagrams', label: 'Diagram placeholders', desc: 'Add labelled slots where you can insert diagrams after downloading',     icon: ImagePlus,  state: includeDiagrams, set: setIncludeDiagrams },
                      { key: 'layouts',  label: 'Rich layouts',         desc: 'Two-column comparisons, quote highlights, and section dividers',          icon: Columns2,   state: enhancedLayouts, set: setEnhancedLayouts },
                    ] as const).map(f => (
                      <div key={f.key} className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <f.icon className="h-4 w-4 text-primary shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{f.label}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{f.desc}</p>
                          </div>
                        </div>
                        <button onClick={() => f.set((v: boolean) => !v)}
                          className={cn('relative inline-flex h-6 w-11 shrink-0 ml-4 rounded-full transition-colors', f.state ? 'bg-primary' : 'bg-muted')}>
                          <span className={cn('pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transform transition-transform mt-0.5', f.state ? 'translate-x-5' : 'translate-x-0.5')} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep(1)}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
                  <Button className="flex-1" onClick={generate}><Sparkles className="mr-2 h-4 w-4" /> Generate Presentation</Button>
                </div>
              </div>
            )}

            {/* ── Step 3: Generating ────────────────────────────────── */}
            {step === 3 && (
              <div className="flex flex-col items-center justify-center py-20 gap-6 text-center">
                <div className="relative h-20 w-20">
                  <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" />
                  <div className="relative h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
                    <Sparkles className="h-9 w-9 text-primary" />
                  </div>
                </div>
                <div>
                  <p className="font-bold text-lg">Cortex is building your slides</p>
                  <p className="text-sm text-muted-foreground mt-1 animate-pulse">{statusMsg}</p>
                </div>
                <div className="flex gap-1.5">
                  {[0, 1, 2].map(i => (
                    <span key={i} className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                  ))}
                </div>
              </div>
            )}

            {/* ── Step 4: Result ────────────────────────────────────── */}
            {step === 4 && result && (
              <div className="space-y-6">
                <div className="rounded-2xl bg-primary/5 border border-primary/20 px-5 py-4 flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-sm">Your presentation is ready!</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{result.slide_count} slides · {result.title}</p>
                  </div>
                </div>

                {/* Outline */}
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Slide outline</p>
                  <div className="rounded-xl border border-border overflow-hidden">
                    <div className="flex items-center gap-3 px-4 py-3 bg-primary text-primary-foreground">
                      <span className="text-xs font-bold opacity-60 w-6 text-center">1</span>
                      <span className="text-sm font-semibold">{result.title}</span>
                      <span className="ml-auto text-[10px] opacity-60">Title slide</span>
                    </div>
                    {result.outline.map((title, i) => (
                      <div key={i} className="flex items-center gap-3 px-4 py-2.5 border-t border-border/60 hover:bg-muted/30">
                        <span className="text-xs text-muted-foreground w-6 text-center">{i + 2}</span>
                        <span className="text-sm">{title}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button size="lg" className="flex-1" onClick={() => download(result.presentation_id, result.title)}>
                    <Download className="mr-2 h-5 w-5" /> Download PPTX
                  </Button>
                  <Button size="lg" variant="outline" className="flex-1" onClick={() =>
                    openPreview(result.title, () => download(result.presentation_id, result.title), result.slides)
                  }>
                    <Eye className="mr-2 h-5 w-5" /> Preview slides
                  </Button>
                </div>

                {/* Save to history */}
                <div className="flex flex-col gap-2">
                  {historyMsg ? (
                    <div className={cn('rounded-lg px-3 py-2 text-sm text-center',
                      historyMsg.startsWith('Error') ? 'bg-destructive/10 text-destructive' : 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400')}>
                      {historyMsg}
                    </div>
                  ) : (
                    <Button variant="outline" className="w-full" disabled={historySaving} onClick={saveToHistory}>
                      {historySaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</> : <><History className="mr-2 h-4 w-4" />Save to my history</>}
                    </Button>
                  )}
                  <p className="text-[11px] text-muted-foreground text-center">Saves privately — not attached to any course</p>
                </div>

                {/* Save to course */}
                <div className="rounded-xl border border-border p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-primary" />
                    <p className="font-semibold text-sm">Save to a course</p>
                  </div>
                  <p className="text-xs text-muted-foreground">Appears in the course's lecture materials immediately.</p>

                  <div className="space-y-2">
                    <Label className="text-xs">Material title</Label>
                    <Input value={saveTitle} onChange={e => setSaveTitle(e.target.value)} placeholder="e.g. Week 3 Lecture Slides" />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Course</Label>
                    <select value={saveClass} onChange={e => setSaveClass(e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                      {classes.length === 0 && <option value="">No courses found</option>}
                      {classes.map(c => <option key={c.id} value={c.id}>{c.course_code ? `${c.course_code} — ` : ''}{c.name}</option>)}
                    </select>
                  </div>

                  {saveMsg ? (
                    <div className={cn('rounded-lg px-3 py-2 text-sm',
                      saveMsg.startsWith('Error') ? 'bg-destructive/10 text-destructive' : 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400')}>
                      {saveMsg}
                    </div>
                  ) : (
                    <Button className="w-full" variant="outline" disabled={!saveClass || saving} onClick={saveToClass}>
                      {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</> : <><Save className="mr-2 h-4 w-4" />Save to course</>}
                    </Button>
                  )}
                </div>

                <Button variant="ghost" className="w-full text-muted-foreground" onClick={startNew}>
                  Generate another presentation
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </PageContainer>
    </>
  )
}
