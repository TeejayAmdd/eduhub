'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Upload, Trash2, Download, FileText, FileImage,
  File, Loader2, AlertTriangle, FolderOpen, Eye,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { PageContainer } from '@/app/_components/page-container'
import { PageHeader } from '@/app/_components/page-header'
import { classes, materials, type CourseMaterial, type Class } from '@/lib/api'

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

async function authedFetch(materialId: number): Promise<{ blob: Blob; filename: string; mime: string }> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  const res = await fetch(`${BASE}/api/materials/download/${materialId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) throw new Error('Download failed')
  const disposition = res.headers.get('content-disposition') ?? ''
  const match = disposition.match(/filename="?([^"]+)"?/)
  const filename = match?.[1] ?? `material-${materialId}`
  const mime = res.headers.get('content-type') ?? 'application/octet-stream'
  const blob = await res.blob()
  return { blob, filename, mime }
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function openInTab(blob: Blob, mime: string) {
  const url = URL.createObjectURL(new Blob([blob], { type: mime }))
  window.open(url, '_blank')
  setTimeout(() => URL.revokeObjectURL(url), 30000)
}

function fileIcon(mime: string | null) {
  if (!mime) return <File className="h-5 w-5 text-muted-foreground" />
  if (mime.startsWith('image/')) return <FileImage className="h-5 w-5 text-blue-500" />
  if (mime === 'application/pdf') return <FileText className="h-5 w-5 text-red-500" />
  if (mime.includes('word') || mime.includes('document')) return <FileText className="h-5 w-5 text-blue-600" />
  if (mime.includes('sheet') || mime.includes('excel')) return <FileText className="h-5 w-5 text-green-600" />
  if (mime.includes('presentation') || mime.includes('powerpoint')) return <FileText className="h-5 w-5 text-orange-500" />
  return <File className="h-5 w-5 text-muted-foreground" />
}

function formatBytes(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function isViewable(mime: string | null) {
  if (!mime) return false
  return mime.startsWith('image/') || mime === 'application/pdf' || mime.startsWith('text/')
}

export default function LecturerMaterialsPage() {
  const { id } = useParams<{ id: string }>()
  const classId = Number(id)

  const [cls, setCls] = useState<Class | null>(null)
  const [materialList, setMaterialList] = useState<CourseMaterial[]>([])
  const [loading, setLoading] = useState(true)

  // Upload form
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Delete
  const [deletingId, setDeletingId] = useState<number | null>(null)

  async function load() {
    const [allClasses, mats] = await Promise.all([
      classes.list(),
      materials.list(classId).catch((): CourseMaterial[] => []),
    ])
    setCls(allClasses.find((c) => c.id === classId) ?? null)
    setMaterialList(mats)
  }

  useEffect(() => {
    load().finally(() => setLoading(false))
  }, [classId])

  async function handleUpload() {
    if (!title.trim()) { setUploadError('Title is required'); return }
    if (!file) { setUploadError('Please select a file'); return }
    setUploading(true); setUploadError('')
    try {
      const mat = await materials.upload(classId, title.trim(), description.trim(), file)
      setMaterialList((prev) => [mat, ...prev])
      setTitle(''); setDescription(''); setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (e: unknown) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(matId: number) {
    setDeletingId(matId)
    try {
      await materials.delete(matId)
      setMaterialList((prev) => prev.filter((m) => m.id !== matId))
    } catch {}
    finally { setDeletingId(null) }
  }

  if (loading) {
    return (
      <PageContainer>
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <div className="max-w-4xl space-y-6">

        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href={`/class-preparation/${classId}`}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to {cls?.name ?? 'Course'}
          </Link>
        </Button>

        <PageHeader
          title="Lecture Materials"
          description={cls ? `${cls.name}${cls.course_code ? ` · ${cls.course_code}` : ''}` : ''}
        />

        {/* ── Upload card ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="h-4 w-4 text-primary" />
              Upload New Material
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Title <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="e.g. Week 3 Lecture Slides"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input
                  placeholder="Brief note about this material"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>

            {/* Drop zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 cursor-pointer transition-colors ${
                file ? 'border-primary/50 bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/40 hover:bg-muted/30'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="sr-only"
                accept="*/*"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null
                  setFile(f)
                  if (f && !title.trim()) setTitle(f.name.replace(/\.[^.]+$/, ''))
                }}
              />
              {file ? (
                <>
                  <div className="flex items-center gap-2">
                    {fileIcon(file.type)}
                    <span className="text-sm font-medium truncate max-w-[280px]">{file.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{formatBytes(file.size)} · Click to change</span>
                </>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">Click to select a file</p>
                  <p className="text-xs text-muted-foreground/70">Any file type accepted — PDF, images, Word, PowerPoint, etc.</p>
                </>
              )}
            </div>

            {uploadError && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4 shrink-0" />{uploadError}
              </div>
            )}

            <Button onClick={handleUpload} disabled={uploading || !file} className="w-full sm:w-auto">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
              {uploading ? 'Uploading…' : 'Upload Material'}
            </Button>
          </CardContent>
        </Card>

        {/* ── Materials list ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-primary" />
              Uploaded Materials
              <Badge variant="secondary" className="ml-auto">{materialList.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {materialList.length === 0 ? (
              <div className="py-10 flex flex-col items-center gap-3 text-center">
                <FolderOpen className="h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No materials uploaded yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {materialList.map((mat) => (
                  <MaterialRow
                    key={mat.id}
                    material={mat}
                    onDelete={() => handleDelete(mat.id)}
                    deleting={deletingId === mat.id}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  )
}

function MaterialRow({
  material, onDelete, deleting,
}: {
  material: CourseMaterial
  onDelete: () => void
  deleting: boolean
}) {
  const [busy, setBusy] = useState<'view' | 'download' | null>(null)
  const date = new Date(material.uploaded_at).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })

  async function handleView() {
    setBusy('view')
    try {
      const { blob, mime } = await authedFetch(material.id)
      openInTab(blob, mime)
    } catch {}
    finally { setBusy(null) }
  }

  async function handleDownload() {
    setBusy('download')
    try {
      const { blob, filename } = await authedFetch(material.id)
      triggerDownload(blob, filename)
    } catch {}
    finally { setBusy(null) }
  }

  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 px-4 py-3">
      <div className="mt-0.5 shrink-0">{fileIcon(material.file_type)}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{material.title}</p>
        {material.description && (
          <p className="text-xs text-muted-foreground truncate">{material.description}</p>
        )}
        <p className="text-xs text-muted-foreground mt-0.5">
          {material.original_filename}
          {material.file_size ? ` · ${formatBytes(material.file_size)}` : ''}
          {' · '}{date}
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {isViewable(material.file_type) && (
          <Button size="sm" variant="ghost" className="h-8 px-2" onClick={handleView} disabled={!!busy}>
            {busy === 'view' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
          </Button>
        )}
        <Button size="sm" variant="ghost" className="h-8 px-2" onClick={handleDownload} disabled={!!busy}>
          {busy === 'download' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        </Button>
        <Button
          size="sm" variant="ghost"
          className="h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/5"
          onClick={onDelete}
          disabled={deleting || !!busy}
        >
          {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  )
}
