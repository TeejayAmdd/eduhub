'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowLeft, ArrowLeftRight, ArrowRight, CheckCircle2, Download,
  FileText, Image as ImageIcon, Loader2, RotateCcw, Upload,
  X, AlertCircle, FileArchive, File, Info,
} from 'lucide-react'
import { PageContainer } from '@/app/_components/page-container'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ConversionDef {
  id: string
  label: string
  description: string
  detail: string          // longer description shown on the detail view
  from: string
  to: string
  FromIcon: React.ElementType
  ToIcon: React.ElementType
  acceptStr: string
  accepts: string[]
  category: string
  color: 'blue' | 'emerald' | 'violet'
  outputMime: string      // expected output MIME for preview logic
}

type Step = 'choose' | 'upload' | 'result'

// ── Conversion definitions ────────────────────────────────────────────────────

const CONVERSIONS: ConversionDef[] = [
  {
    id: 'pdf_to_docx',
    label: 'PDF → Word',
    description: 'Convert PDF into an editable Word document',
    detail: 'Extracts all text from each page of your PDF and places it into a properly formatted .docx file you can edit in Microsoft Word or Google Docs.',
    from: 'PDF', to: 'DOCX',
    FromIcon: FileText, ToIcon: FileText,
    acceptStr: '.pdf', accepts: ['.pdf'],
    category: 'PDF Tools', color: 'blue',
    outputMime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  },
  {
    id: 'pdf_to_txt',
    label: 'PDF → Text',
    description: 'Extract plain text from a PDF file',
    detail: 'Strips all formatting and extracts the raw text from every page of your PDF into a clean .txt file — great for copying content or feeding into other tools.',
    from: 'PDF', to: 'TXT',
    FromIcon: FileText, ToIcon: FileText,
    acceptStr: '.pdf', accepts: ['.pdf'],
    category: 'PDF Tools', color: 'blue',
    outputMime: 'text/plain',
  },
  {
    id: 'pdf_to_png',
    label: 'PDF → Image',
    description: 'Export each PDF page as a PNG image',
    detail: 'Renders every page of your PDF at 2× resolution into a high-quality PNG. Single-page PDFs download as one image; multi-page PDFs are bundled into a ZIP archive.',
    from: 'PDF', to: 'PNG',
    FromIcon: FileText, ToIcon: ImageIcon,
    acceptStr: '.pdf', accepts: ['.pdf'],
    category: 'PDF Tools', color: 'blue',
    outputMime: 'image/png',
  },
  {
    id: 'image_to_pdf',
    label: 'Image → PDF',
    description: 'Wrap any image into a PDF document',
    detail: 'Takes your image (JPG, PNG, WebP, BMP, TIFF) and embeds it into a PDF page at 100 DPI — useful for sending photos as PDF attachments.',
    from: 'Image', to: 'PDF',
    FromIcon: ImageIcon, ToIcon: FileText,
    acceptStr: '.jpg,.jpeg,.png,.webp,.bmp,.tiff',
    accepts: ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tiff'],
    category: 'Image Tools', color: 'emerald',
    outputMime: 'application/pdf',
  },
  {
    id: 'png_to_jpg',
    label: 'PNG → JPG',
    description: 'Convert PNG images to compressed JPG',
    detail: 'Converts a lossless PNG into a high-quality JPG (95% quality) — reduces file size while keeping the image looking sharp. Transparent backgrounds become white.',
    from: 'PNG', to: 'JPG',
    FromIcon: ImageIcon, ToIcon: ImageIcon,
    acceptStr: '.png', accepts: ['.png'],
    category: 'Image Tools', color: 'emerald',
    outputMime: 'image/jpeg',
  },
  {
    id: 'jpg_to_png',
    label: 'JPG → PNG',
    description: 'Convert JPG images to lossless PNG',
    detail: 'Converts a compressed JPG into a lossless PNG — useful when you need to preserve full image quality for further editing or when the format requires transparency support.',
    from: 'JPG', to: 'PNG',
    FromIcon: ImageIcon, ToIcon: ImageIcon,
    acceptStr: '.jpg,.jpeg', accepts: ['.jpg', '.jpeg'],
    category: 'Image Tools', color: 'emerald',
    outputMime: 'image/png',
  },
  {
    id: 'image_to_webp',
    label: 'Image → WebP',
    description: 'Convert images to modern WebP format',
    detail: 'Converts JPG, PNG, BMP, or TIFF into WebP — a modern format that is typically 25–35% smaller than JPG at equivalent visual quality. Widely supported in browsers.',
    from: 'Image', to: 'WebP',
    FromIcon: ImageIcon, ToIcon: ImageIcon,
    acceptStr: '.jpg,.jpeg,.png,.bmp,.tiff',
    accepts: ['.jpg', '.jpeg', '.png', '.bmp', '.tiff'],
    category: 'Image Tools', color: 'emerald',
    outputMime: 'image/webp',
  },
  {
    id: 'docx_to_txt',
    label: 'Word → Text',
    description: 'Extract plain text from a Word document',
    detail: 'Reads every paragraph in your .docx file and exports the raw text as a .txt file — removes all formatting, images, and styles, leaving only the written content.',
    from: 'DOCX', to: 'TXT',
    FromIcon: FileText, ToIcon: FileText,
    acceptStr: '.docx', accepts: ['.docx'],
    category: 'Word Tools', color: 'violet',
    outputMime: 'text/plain',
  },
]

const CATEGORIES = ['PDF Tools', 'Image Tools', 'Word Tools']

// ── Palette ───────────────────────────────────────────────────────────────────

const palette = {
  blue: {
    card:      'border-blue-200 hover:border-blue-400 hover:bg-blue-50/40 dark:hover:bg-blue-950/20',
    hero:      'from-blue-600 via-blue-500 to-indigo-500',
    fromBadge: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    toBadge:   'bg-blue-600 text-white',
    arrow:     'text-blue-400',
    icon:      'bg-blue-100 text-blue-600 dark:bg-blue-900/40',
  },
  emerald: {
    card:      'border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20',
    hero:      'from-emerald-600 via-emerald-500 to-teal-500',
    fromBadge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
    toBadge:   'bg-emerald-600 text-white',
    arrow:     'text-emerald-400',
    icon:      'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40',
  },
  violet: {
    card:      'border-violet-200 hover:border-violet-400 hover:bg-violet-50/40 dark:hover:bg-violet-950/20',
    hero:      'from-violet-600 via-violet-500 to-purple-500',
    fromBadge: 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200',
    toBadge:   'bg-violet-600 text-white',
    arrow:     'text-violet-400',
    icon:      'bg-violet-100 text-violet-600 dark:bg-violet-900/40',
  },
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function fmtBytes(b: number) {
  if (b < 1024) return `${b} B`
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1024 ** 2).toFixed(1)} MB`
}

function isImageMime(mime: string) {
  return mime.startsWith('image/')
}

function isTextMime(mime: string) {
  return mime === 'text/plain'
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ConverterPage() {
  const [step, setStep]             = useState<Step>('choose')
  const [selected, setSelected]     = useState<ConversionDef | null>(null)
  const [file, setFile]             = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const [dragging, setDragging]     = useState(false)
  const [converting, setConverting] = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [result, setResult]         = useState<{
    name: string; url: string; mimeType: string; textExcerpt?: string
  } | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)

  // Revoke blob URLs on unmount
  useEffect(() => {
    return () => {
      if (filePreview) URL.revokeObjectURL(filePreview)
      if (result?.url) URL.revokeObjectURL(result.url)
    }
  }, [])

  const selectConversion = (conv: ConversionDef) => {
    setSelected(conv)
    setFile(null)
    setFilePreview(null)
    setError(null)
    setResult(null)
    setStep('upload')
  }

  const backToChoose = () => {
    setStep('choose')
    setSelected(null)
    setFile(null)
    if (filePreview) URL.revokeObjectURL(filePreview)
    setFilePreview(null)
    setError(null)
    if (result?.url) URL.revokeObjectURL(result.url)
    setResult(null)
  }

  const removeFile = () => {
    setFile(null)
    if (filePreview) URL.revokeObjectURL(filePreview)
    setFilePreview(null)
    setError(null)
  }

  const pickFile = (f: File) => {
    if (!selected) return
    const ext = f.name.includes('.') ? '.' + f.name.split('.').pop()!.toLowerCase() : ''
    if (!selected.accepts.includes(ext)) {
      setError(`This conversion only accepts: ${selected.acceptStr}`)
      return
    }
    if (f.size > 20 * 1024 * 1024) {
      setError('File too large — maximum size is 20 MB.')
      return
    }
    setError(null)
    setResult(null)
    setFile(f)
    // Generate image preview for image uploads
    if (f.type.startsWith('image/')) {
      if (filePreview) URL.revokeObjectURL(filePreview)
      setFilePreview(URL.createObjectURL(f))
    } else {
      setFilePreview(null)
    }
  }

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const f = e.dataTransfer.files[0]
      if (f) pickFile(f)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selected],
  )

  const handleConvert = async () => {
    if (!file || !selected) return
    setConverting(true)
    setError(null)
    try {
      const token = localStorage.getItem('token')
      const form = new FormData()
      form.append('file', file)
      form.append('conversion_type', selected.id)

      const res = await fetch(`${BASE}/api/converter/convert`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Conversion failed.' }))
        throw new Error(err.detail || 'Conversion failed.')
      }

      const blob = await res.blob()
      const mimeType = blob.type || selected.outputMime
      const url = URL.createObjectURL(blob)
      const cd = res.headers.get('Content-Disposition') || ''
      const match = cd.match(/filename="([^"]+)"/)
      const name = match ? match[1] : `${file.name.split('.')[0]}.${selected.to.toLowerCase()}`

      let textExcerpt: string | undefined
      if (isTextMime(mimeType)) {
        const text = await blob.text()
        textExcerpt = text.slice(0, 600) + (text.length > 600 ? '…' : '')
      }

      setResult({ name, url, mimeType, textExcerpt })
      setStep('result')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Conversion failed.')
    } finally {
      setConverting(false)
    }
  }

  const download = () => {
    if (!result) return
    const a = document.createElement('a')
    a.href = result.url
    a.download = result.name
    a.click()
  }

  const convertAnother = () => {
    if (result?.url) URL.revokeObjectURL(result.url)
    setResult(null)
    setFile(null)
    if (filePreview) URL.revokeObjectURL(filePreview)
    setFilePreview(null)
    setError(null)
    setStep('upload')
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <PageContainer>
      <div className="max-w-3xl mx-auto space-y-6">

        {/* ── Page header ──────────────────────────────────────────────────── */}
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            Document Converter
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Convert files between formats — files are processed privately in your session.
          </p>
        </div>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* STEP 1 — Choose format                                           */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {step === 'choose' && (
          <div className="space-y-6">
            {CATEGORIES.map((cat) => {
              const items = CONVERSIONS.filter((c) => c.category === cat)
              return (
                <div key={cat}>
                  <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
                    {cat}
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {items.map((conv) => {
                      const p = palette[conv.color]
                      const FromIcon = conv.FromIcon
                      const ToIcon   = conv.ToIcon
                      return (
                        <button
                          key={conv.id}
                          onClick={() => selectConversion(conv)}
                          className={cn(
                            'group rounded-2xl border-2 p-4 text-left transition-all cursor-pointer',
                            'active:scale-[0.97]',
                            p.card,
                          )}
                        >
                          {/* Format badges */}
                          <div className="flex items-center gap-1 mb-3">
                            <span className={cn('rounded px-1.5 py-0.5 text-[11px] font-bold', p.fromBadge)}>
                              {conv.from}
                            </span>
                            <ArrowRight className={cn('w-3 h-3 shrink-0', p.arrow)} />
                            <span className={cn('rounded px-1.5 py-0.5 text-[11px] font-bold', p.toBadge)}>
                              {conv.to}
                            </span>
                          </div>

                          {/* Icons */}
                          <div className="flex items-center gap-1 mb-2.5">
                            <div className={cn('flex h-7 w-7 items-center justify-center rounded-lg', p.icon)}>
                              <FromIcon className="w-3.5 h-3.5" />
                            </div>
                            <ArrowRight className="w-3 h-3 text-muted-foreground" />
                            <div className={cn('flex h-7 w-7 items-center justify-center rounded-lg', p.icon)}>
                              <ToIcon className="w-3.5 h-3.5" />
                            </div>
                          </div>

                          <p className="text-sm font-semibold leading-tight">{conv.label}</p>
                          <p className="text-xs text-muted-foreground mt-1 leading-snug line-clamp-2">
                            {conv.description}
                          </p>

                          <p className="mt-3 text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                            Start converting <ArrowRight className="w-3 h-3" />
                          </p>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* STEP 2 — Upload                                                  */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {step === 'upload' && selected && (
          <div className="space-y-5">

            {/* ── Conversion hero ─────────────────────────────────────────── */}
            <div className={cn(
              'relative overflow-hidden rounded-2xl bg-gradient-to-br p-5 sm:p-7 text-white shadow-lg',
              palette[selected.color].hero
            )}>
              <div className="absolute inset-0 opacity-10"
                style={{ backgroundImage: 'radial-gradient(circle at 75% 25%, white 0%, transparent 55%)' }} />
              <div className="relative">
                <button
                  onClick={backToChoose}
                  className="flex items-center gap-1.5 text-white/70 hover:text-white text-sm mb-4 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  All conversions
                </button>

                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className={cn('rounded-lg px-3 py-1.5 text-sm font-bold', palette[selected.color].fromBadge, 'bg-white/20 text-white')}>
                      {selected.from}
                    </span>
                    <ArrowRight className="w-5 h-5 text-white/70" />
                    <span className="rounded-lg bg-white/25 px-3 py-1.5 text-sm font-bold">
                      {selected.to}
                    </span>
                  </div>
                  <div className="sm:ml-2">
                    <h2 className="text-xl sm:text-2xl font-bold">{selected.label}</h2>
                  </div>
                </div>

                <div className="mt-3 flex items-start gap-2 text-white/80 text-sm">
                  <Info className="w-4 h-4 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">{selected.detail}</p>
                </div>

                <p className="mt-3 text-xs text-white/60">
                  Accepts: {selected.acceptStr} · Max file size: 20 MB
                </p>
              </div>
            </div>

            {/* ── File input section ──────────────────────────────────────── */}
            {!file ? (
              /* Drop zone */
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                className={cn(
                  'rounded-2xl border-2 border-dashed p-10 sm:p-14 text-center cursor-pointer transition-all select-none',
                  dragging
                    ? 'border-primary bg-primary/5 scale-[1.01]'
                    : 'border-muted-foreground/20 hover:border-primary/50 hover:bg-muted/30',
                )}
              >
                <div className="flex flex-col items-center gap-3 pointer-events-none">
                  <div className={cn(
                    'rounded-full p-4 transition-colors',
                    dragging ? 'bg-primary/10' : 'bg-muted',
                  )}>
                    <Upload className={cn('w-7 h-7', dragging ? 'text-primary' : 'text-muted-foreground')} />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">
                      {dragging ? 'Drop your file here' : 'Drag & drop your file here'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">or click to browse files</p>
                  </div>
                  <span className="rounded-full border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
                    {selected.acceptStr}
                  </span>
                </div>
                <input
                  ref={inputRef}
                  type="file"
                  accept={selected.acceptStr}
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) pickFile(f)
                    e.target.value = ''
                  }}
                />
              </div>
            ) : (
              /* ── File preview card ──────────────────────────────────────── */
              <div className="rounded-2xl border bg-background shadow-sm overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b bg-muted/30">
                  <p className="text-sm font-semibold flex items-center gap-2">
                    <File className="w-4 h-4 text-primary" />
                    Uploaded File
                  </p>
                  <button
                    onClick={removeFile}
                    className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-destructive"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Image preview */}
                {filePreview && (
                  <div className="border-b bg-muted/20 flex items-center justify-center p-4 min-h-[180px] max-h-[320px] overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={filePreview}
                      alt="Preview"
                      className="max-h-[280px] max-w-full rounded-xl object-contain shadow-sm"
                    />
                  </div>
                )}

                {/* File info */}
                <div className="flex items-center gap-4 px-5 py-4">
                  <div className={cn(
                    'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl',
                    palette[selected.color].icon
                  )}>
                    <selected.FromIcon className="w-6 h-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{file.name}</p>
                    <div className="flex flex-wrap gap-3 mt-1">
                      <span className="text-xs text-muted-foreground">{fmtBytes(file.size)}</span>
                      <span className="text-xs text-muted-foreground">
                        {file.type || 'Unknown type'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Convert arrow indicator */}
                <div className="flex items-center gap-3 px-5 py-3 border-t bg-muted/10">
                  <div className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold',
                    palette[selected.color].fromBadge
                  )}>
                    {selected.from}
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  <div className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold',
                    palette[selected.color].toBadge
                  )}>
                    {selected.to}
                  </div>
                  <p className="text-xs text-muted-foreground ml-1">
                    Will be converted to <span className="font-semibold">.{selected.to.toLowerCase()}</span>
                  </p>
                </div>
              </div>
            )}

            {/* ── Error ───────────────────────────────────────────────────── */}
            {error && (
              <div className="flex items-start gap-3 rounded-2xl bg-destructive/10 border border-destructive/20 px-4 py-3">
                <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            {/* ── Actions ─────────────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row gap-3">
              {file ? (
                <>
                  <Button
                    className="flex-1 h-12 rounded-xl text-base sm:text-sm"
                    disabled={converting}
                    onClick={handleConvert}
                  >
                    {converting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Converting…
                      </>
                    ) : (
                      <>
                        <ArrowRight className="w-4 h-4 mr-2" />
                        Convert to {selected.to}
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-xl h-12 sm:h-auto"
                    onClick={removeFile}
                    disabled={converting}
                  >
                    Change file
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={backToChoose}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to formats
                </Button>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* STEP 3 — Result                                                  */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {step === 'result' && result && selected && (
          <div className="space-y-5">

            {/* ── Success banner ──────────────────────────────────────────── */}
            <div className="flex items-center gap-4 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-5 py-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/40">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-emerald-700 dark:text-emerald-400">Conversion complete!</p>
                <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-0.5 truncate">
                  {result.name} is ready
                </p>
              </div>
            </div>

            {/* ── Output preview ──────────────────────────────────────────── */}
            <div className="rounded-2xl border bg-background shadow-sm overflow-hidden">
              {/* Header */}
              <div className="flex items-center gap-2 px-5 py-4 border-b bg-muted/30">
                <selected.ToIcon className="w-4 h-4 text-primary" />
                <p className="text-sm font-semibold">Converted File</p>
                <span className={cn(
                  'ml-auto rounded-full px-2 py-0.5 text-[11px] font-bold',
                  palette[selected.color].toBadge
                )}>
                  .{selected.to.toLowerCase()}
                </span>
              </div>

              {/* Image output preview */}
              {isImageMime(result.mimeType) && (
                <div className="border-b bg-muted/20 flex items-center justify-center p-4 min-h-[180px] max-h-[360px] overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={result.url}
                    alt="Converted output"
                    className="max-h-[320px] max-w-full rounded-xl object-contain shadow-sm"
                  />
                </div>
              )}

              {/* Text output preview */}
              {isTextMime(result.mimeType) && result.textExcerpt && (
                <div className="border-b bg-muted/20 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Text preview</p>
                  <pre className="text-xs text-foreground leading-relaxed whitespace-pre-wrap font-mono bg-background rounded-xl border p-3 max-h-[240px] overflow-y-auto">
                    {result.textExcerpt}
                  </pre>
                </div>
              )}

              {/* ZIP output info */}
              {result.mimeType === 'application/zip' && (
                <div className="border-b bg-muted/20 flex items-center gap-3 px-5 py-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-900/40">
                    <FileArchive className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Multi-page ZIP archive</p>
                    <p className="text-xs text-muted-foreground">Contains one PNG per page from your PDF.</p>
                  </div>
                </div>
              )}

              {/* File info row */}
              <div className="flex items-center gap-4 px-5 py-4">
                <div className={cn(
                  'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl',
                  palette[selected.color].icon
                )}>
                  <selected.ToIcon className="w-6 h-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{result.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Ready to download
                  </p>
                </div>
              </div>
            </div>

            {/* ── Source file reference ────────────────────────────────────── */}
            {file && (
              <div className="rounded-2xl border bg-muted/30 px-4 py-3 flex items-center gap-3">
                <div className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                  palette[selected.color].icon
                )}>
                  <selected.FromIcon className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">Converted from</p>
                  <p className="text-sm font-medium truncate">{file.name}</p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{fmtBytes(file.size)}</span>
              </div>
            )}

            {/* ── Download & actions ───────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                className="flex-1 h-12 rounded-xl text-base sm:text-sm gap-2 bg-emerald-600 hover:bg-emerald-700 min-w-0 overflow-hidden"
                onClick={download}
              >
                <Download className="w-4 h-4 shrink-0" />
                <span className="truncate">Download {result.name}</span>
              </Button>
              <Button
                variant="outline"
                className="rounded-xl h-12 sm:h-auto gap-2"
                onClick={convertAnother}
              >
                <RotateCcw className="w-4 h-4" />
                Convert another
              </Button>
              <Button
                variant="outline"
                className="rounded-xl h-12 sm:h-auto gap-2"
                onClick={backToChoose}
              >
                <ArrowLeftRight className="w-4 h-4" />
                New format
              </Button>
            </div>

          </div>
        )}

      </div>
    </PageContainer>
  )
}
