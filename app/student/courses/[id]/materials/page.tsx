'use client'


import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Download, Eye, File, FileImage, FileText,
  FolderOpen, Loader2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageContainer } from '@/app/_components/page-container'
import { PageHeader } from '@/app/_components/page-header'
import { classes, materials, type CourseMaterial, type ClassAvailable } from '@/lib/api'

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

function fileLabel(mime: string | null) {
  if (!mime) return 'File'
  if (mime.startsWith('image/')) return 'Image'
  if (mime === 'application/pdf') return 'PDF'
  if (mime.includes('word') || mime.includes('document')) return 'Word Doc'
  if (mime.includes('sheet') || mime.includes('excel')) return 'Spreadsheet'
  if (mime.includes('presentation') || mime.includes('powerpoint')) return 'Presentation'
  if (mime.startsWith('video/')) return 'Video'
  if (mime.startsWith('audio/')) return 'Audio'
  if (mime.startsWith('text/')) return 'Text'
  return 'File'
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

export default function StudentMaterialsPage() {
  const { id } = useParams<{ id: string }>()
  const classId = Number(id)

  const [course, setCourse] = useState<ClassAvailable | null>(null)
  const [materialList, setMaterialList] = useState<CourseMaterial[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      classes.available(),
      materials.list(classId),
    ])
      .then(([allCourses, mats]) => {
        const found = allCourses.find((c) => c.id === classId)
        if (!found || !found.is_enrolled) { setError('Course not found'); return }
        setCourse(found)
        setMaterialList(mats)
      })
      .catch(() => setError('Failed to load materials'))
      .finally(() => setLoading(false))
  }, [classId])

  if (loading) {
    return (
      <PageContainer>
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </PageContainer>
    )
  }

  if (error) {
    return (
      <PageContainer>
        <p className="text-center text-destructive py-10">{error}</p>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <div className="max-w-3xl space-y-6">

        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href={`/student/courses/${classId}`}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to {course?.name ?? 'Course'}
          </Link>
        </Button>

        <PageHeader
          title="Lecture Materials"
          description={course ? `${course.name}${course.course_code ? ` · ${course.course_code}` : ''}` : ''}
        />

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-primary" />
              Course Materials
              <Badge variant="secondary" className="ml-auto">{materialList.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {materialList.length === 0 ? (
              <div className="py-14 flex flex-col items-center gap-3 text-center">
                <FolderOpen className="h-12 w-12 text-muted-foreground/25" />
                <p className="text-base font-medium text-muted-foreground">No materials yet</p>
                <p className="text-sm text-muted-foreground/70">
                  Your lecturer hasn't uploaded any materials for this course yet.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {materialList.map((mat) => (
                  <StudentMaterialRow key={mat.id} material={mat} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  )
}

function StudentMaterialRow({ material }: { material: CourseMaterial }) {
  const [busy, setBusy] = useState<'view' | 'download' | null>(null)
  const date = new Date(material.uploaded_at).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
  const viewable = isViewable(material.file_type)

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
    <div className="flex items-start gap-4 rounded-xl border border-border bg-card p-4 hover:shadow-sm transition-shadow">
      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-muted shrink-0">
        {fileIcon(material.file_type)}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm">{material.title}</p>
        {material.description && (
          <p className="text-xs text-muted-foreground mt-0.5">{material.description}</p>
        )}
        <div className="flex flex-wrap items-center gap-2 mt-1.5">
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{fileLabel(material.file_type)}</Badge>
          {material.file_size && (
            <span className="text-[11px] text-muted-foreground">{formatBytes(material.file_size)}</span>
          )}
          <span className="text-[11px] text-muted-foreground">{date}</span>
          <span className="text-[11px] text-muted-foreground">by {material.uploader_name}</span>
        </div>
      </div>

      <div className="flex flex-col gap-2 shrink-0">
        {viewable && (
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={handleView} disabled={!!busy}>
            {busy === 'view' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
            View
          </Button>
        )}
        <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={handleDownload} disabled={!!busy}>
          {busy === 'download' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          Download
        </Button>
      </div>
    </div>
  )
}
