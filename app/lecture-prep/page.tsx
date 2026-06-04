'use client'

import { useState, useRef } from 'react'
import {
  Upload, FileText, Sparkles, Download, BookOpen,
  ChevronRight, CheckCircle2, Loader2, ArrowLeft,
  LayoutTemplate, Save,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
  return res.json()
}

async function fetchClasses() {
  return apiFetch('/api/classes')
}

interface GenerationResult {
  presentation_id: string
  title: string
  subject: string
  slide_count: number
  outline: string[]
}

interface CourseClass {
  id: number
  name: string
  course_code: string | null
}

// ── Step indicator ────────────────────────────────────────────────────────────
function StepDot({ n, current, label }: { n: number; current: number; label: string }) {
  const done = n < current
  const active = n === current
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={cn(
        'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all',
        done    ? 'bg-primary text-primary-foreground' :
        active  ? 'bg-primary text-primary-foreground ring-4 ring-primary/20' :
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

// ── Main page ─────────────────────────────────────────────────────────────────
export default function LecturePrepPage() {
  const [step, setStep] = useState(1)

  // Step 1 — material
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Step 2 — preferences
  const [presTitle, setPresTitle]       = useState('')
  const [numSlides, setNumSlides]       = useState('auto')
  const [level, setLevel]               = useState('undergraduate')
  const [focus, setFocus]               = useState('')
  const [tone, setTone]                 = useState('academic')
  const [includeNotes, setIncludeNotes] = useState(true)

  // Step 3 — generating
  const [statusMsg, setStatusMsg] = useState('')
  const [genError, setGenError]   = useState('')

  // Step 4 — result
  const [result, setResult]       = useState<GenerationResult | null>(null)
  const [classes, setClasses]     = useState<CourseClass[]>([])
  const [saveClass, setSaveClass] = useState('')
  const [saveTitle, setSaveTitle] = useState('')
  const [saving, setSaving]       = useState(false)
  const [saveMsg, setSaveMsg]     = useState('')

  const handleFile = (f: File) => {
    setFile(f)
    if (!presTitle) setPresTitle(f.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '))
  }

  const generate = async () => {
    if (!file) return
    setStep(3)
    setGenError('')

    const messages = [
      'Reading your lecture material…',
      'Analysing key concepts…',
      'Structuring your slides…',
      'Building the presentation…',
    ]
    let i = 0
    setStatusMsg(messages[0])
    const ticker = setInterval(() => {
      i = (i + 1) % messages.length
      setStatusMsg(messages[i])
    }, 2200)

    try {
      const form = new FormData()
      form.append('file', file)
      form.append('title', presTitle)
      form.append('num_slides', numSlides)
      form.append('level', level)
      form.append('focus', focus)
      form.append('tone', tone)
      form.append('include_notes', String(includeNotes))

      const token = getToken()
      const res = await fetch(`${BASE}/api/lecture-prep/generate`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Generation failed' }))
        throw new Error(err.detail || 'Generation failed')
      }
      const data: GenerationResult = await res.json()
      setResult(data)
      setSaveTitle(data.title)

      // Fetch courses for "save to course" dropdown
      try {
        const cls = await fetchClasses()
        setClasses(cls)
        if (cls.length > 0) setSaveClass(String(cls[0].id))
      } catch {}

      setStep(4)
    } catch (e: any) {
      setGenError(e.message || 'Something went wrong. Please try again.')
      setStep(2)
    } finally {
      clearInterval(ticker)
    }
  }

  const download = () => {
    if (!result) return
    const token = getToken()
    const url = `${BASE}/api/lecture-prep/download/${result.presentation_id}`
    const a = document.createElement('a')
    a.href = url
    // include auth via fetch + blob
    fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => r.blob())
      .then(blob => {
        const burl = URL.createObjectURL(blob)
        a.href = burl
        a.download = `${result.title || 'cortex-lecture'}.pptx`
        a.click()
        URL.revokeObjectURL(burl)
      })
  }

  const saveToClass = async () => {
    if (!result || !saveClass) return
    setSaving(true)
    setSaveMsg('')
    try {
      const token = getToken()
      const res = await fetch(`${BASE}/api/lecture-prep/save/${saveClass}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ presentation_id: result.presentation_id, title: saveTitle }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Save failed' }))
        throw new Error(err.detail || 'Save failed')
      }
      const data = await res.json()
      setSaveMsg(data.message)
    } catch (e: any) {
      setSaveMsg(`Error: ${e.message}`)
    } finally {
      setSaving(false)
    }
  }

  const restart = () => {
    setStep(1); setFile(null); setPresTitle(''); setResult(null)
    setSaveMsg(''); setGenError(''); setFocus('')
  }

  return (
    <div className="w-full px-4 py-8 space-y-8 min-w-0">

      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <LayoutTemplate className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Lecture Prep with Cortex</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Upload your lecture material and Cortex AI will build a professional PPTX presentation for you.
        </p>
      </div>

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

      {/* ── Step 1: Upload ─────────────────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-6">
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => {
              e.preventDefault(); setDragOver(false)
              const f = e.dataTransfer.files[0]
              if (f) handleFile(f)
            }}
            onClick={() => fileRef.current?.click()}
            className={cn(
              'border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-colors',
              dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30',
            )}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.docx,.txt,.doc"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            />
            {file ? (
              <div className="flex flex-col items-center gap-3">
                <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center">
                  <FileText className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{file.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {(file.size / 1024).toFixed(0)} KB · Click to change
                  </p>
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
            <Label>Presentation title <span className="text-muted-foreground font-normal">(optional — AI will suggest one)</span></Label>
            <Input
              placeholder="e.g. Introduction to Data Structures"
              value={presTitle}
              onChange={e => setPresTitle(e.target.value)}
            />
          </div>

          <Button className="w-full" disabled={!file} onClick={() => setStep(2)}>
            Continue <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}

      {/* ── Step 2: Preferences ────────────────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-6">
          {genError && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3 text-sm text-destructive">
              {genError}
            </div>
          )}

          {/* Slide count */}
          <div className="space-y-2">
            <Label>Number of slides</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { val: 'auto',  label: 'Auto (AI decides)' },
                { val: '10-15', label: '10–15 slides' },
                { val: '15-20', label: '15–20 slides' },
                { val: '20-30', label: '20–30 slides' },
              ].map(o => (
                <button key={o.val} onClick={() => setNumSlides(o.val)}
                  className={cn('rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors text-left',
                    numSlides === o.val ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:border-primary/40')}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* Student level */}
          <div className="space-y-2">
            <Label>Student level</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { val: '100 level', label: '100 Level' },
                { val: '200 level', label: '200 Level' },
                { val: '300 level', label: '300 Level' },
                { val: '400 level', label: '400 Level' },
                { val: 'postgraduate', label: 'Postgraduate' },
                { val: 'undergraduate', label: 'General UG' },
              ].map(o => (
                <button key={o.val} onClick={() => setLevel(o.val)}
                  className={cn('rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors',
                    level === o.val ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:border-primary/40')}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tone */}
          <div className="space-y-2">
            <Label>Presentation tone</Label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { val: 'academic',    label: 'Academic',    desc: 'Formal, detailed' },
                { val: 'simplified',  label: 'Simplified',  desc: 'Clear, concise' },
                { val: 'exam-focused',label: 'Exam-focused',desc: 'Key points to revise' },
              ].map(o => (
                <button key={o.val} onClick={() => setTone(o.val)}
                  className={cn('rounded-xl border px-3 py-2.5 text-sm text-left transition-colors',
                    tone === o.val ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40')}>
                  <p className={cn('font-semibold', tone === o.val ? 'text-primary' : '')}>{o.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{o.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Focus */}
          <div className="space-y-2">
            <Label>What should the slides emphasise? <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea
              placeholder="e.g. Focus on practical examples and definitions. Highlight the formulas students need to memorise."
              value={focus}
              onChange={e => setFocus(e.target.value)}
              rows={2}
              className="resize-none"
            />
          </div>

          {/* Speaker notes toggle */}
          <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
            <div>
              <p className="text-sm font-medium">Include speaker notes</p>
              <p className="text-xs text-muted-foreground mt-0.5">AI adds talking points for each slide</p>
            </div>
            <button
              onClick={() => setIncludeNotes(v => !v)}
              className={cn(
                'relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors',
                includeNotes ? 'bg-primary' : 'bg-muted',
              )}
            >
              <span className={cn(
                'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transform transition-transform mt-0.5',
                includeNotes ? 'translate-x-5' : 'translate-x-0.5',
              )} />
            </button>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
            <Button className="flex-1" onClick={generate}>
              <Sparkles className="mr-2 h-4 w-4" /> Generate Presentation
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 3: Generating ────────────────────────────────────────── */}
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
            {[0,1,2].map(i => (
              <span key={i} className="h-2 w-2 rounded-full bg-primary animate-bounce"
                style={{ animationDelay: `${i * 150}ms` }} />
            ))}
          </div>
        </div>
      )}

      {/* ── Step 4: Result ────────────────────────────────────────────── */}
      {step === 4 && result && (
        <div className="space-y-6">
          {/* Success banner */}
          <div className="rounded-2xl bg-primary/5 border border-primary/20 px-5 py-4 flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm">Your presentation is ready!</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {result.slide_count} slides · {result.title}
              </p>
            </div>
          </div>

          {/* Slide outline */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Slide outline</p>
            <div className="rounded-xl border border-border overflow-hidden">
              {/* Title slide */}
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

          {/* Download */}
          <Button size="lg" className="w-full" onClick={download}>
            <Download className="mr-2 h-5 w-5" /> Download PPTX
          </Button>

          {/* Save to course */}
          <div className="rounded-xl border border-border p-4 space-y-3">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              <p className="font-semibold text-sm">Save to a course</p>
            </div>
            <p className="text-xs text-muted-foreground">
              The PPTX will appear in the course's lecture materials and students can download it.
            </p>

            <div className="space-y-2">
              <Label className="text-xs">Material title</Label>
              <Input
                value={saveTitle}
                onChange={e => setSaveTitle(e.target.value)}
                placeholder="e.g. Week 3 Lecture Slides"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Course</Label>
              <select
                value={saveClass}
                onChange={e => setSaveClass(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {classes.length === 0 && <option value="">No courses found</option>}
                {classes.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.course_code ? `${c.course_code} — ` : ''}{c.name}
                  </option>
                ))}
              </select>
            </div>

            {saveMsg ? (
              <div className={cn('rounded-lg px-3 py-2 text-sm',
                saveMsg.startsWith('Error')
                  ? 'bg-destructive/10 text-destructive'
                  : 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400')}>
                {saveMsg}
              </div>
            ) : (
              <Button
                className="w-full"
                variant="outline"
                disabled={!saveClass || saving}
                onClick={saveToClass}
              >
                {saving
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</>
                  : <><Save className="mr-2 h-4 w-4" /> Save to course</>
                }
              </Button>
            )}
          </div>

          <Button variant="ghost" className="w-full text-muted-foreground" onClick={restart}>
            Generate another presentation
          </Button>
        </div>
      )}
    </div>
  )
}
