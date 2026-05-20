'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import {
  Loader2, Users, Send, Radio, StopCircle, Crown, Clock, AlertCircle,
  Video, Upload, FolderOpen, Download, Eye, File, FileImage, FileText,
  Trash2, Megaphone, BookMarked, GraduationCap, MessageSquare, CheckCircle2,
  UserPlus, Wifi, WifiOff,
} from 'lucide-react'
import { PageContainer } from '@/app/_components/page-container'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { hub, materials, type HubInfo, type HubBroadcast, type CourseMaterial } from '@/lib/api'
import { cn } from '@/lib/utils'

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

async function authedFetch(materialId: number) {
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
  const a = document.createElement('a'); a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
function openInTab(blob: Blob, mime: string) {
  const url = URL.createObjectURL(new Blob([blob], { type: mime }))
  window.open(url, '_blank')
  setTimeout(() => URL.revokeObjectURL(url), 30000)
}
function isViewable(mime: string | null) {
  return !!mime && (mime.startsWith('image/') || mime === 'application/pdf' || mime.startsWith('text/'))
}
function fileIcon(mime: string | null, size = 'h-5 w-5') {
  if (!mime) return <File className={`${size} text-muted-foreground`} />
  if (mime.startsWith('image/')) return <FileImage className={`${size} text-blue-500`} />
  if (mime === 'application/pdf') return <FileText className={`${size} text-red-500`} />
  if (mime.includes('word') || mime.includes('document')) return <FileText className={`${size} text-blue-600`} />
  if (mime.includes('sheet') || mime.includes('excel')) return <FileText className={`${size} text-green-600`} />
  if (mime.includes('presentation') || mime.includes('powerpoint')) return <FileText className={`${size} text-orange-500`} />
  return <FileText className={`${size} text-muted-foreground`} />
}
function formatBytes(b: number | null) {
  if (!b) return ''
  if (b < 1024) return `${b} B`
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1048576).toFixed(1)} MB`
}
function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export default function HubDetailPage() {
  const params = useParams()
  const classId = Number(params.classId)

  const [info, setInfo] = useState<HubInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Apply tutor
  const [showApplyDialog, setShowApplyDialog] = useState(false)
  const [motivation, setMotivation] = useState('')
  const [applyLoading, setApplyLoading] = useState(false)
  const [applyError, setApplyError] = useState('')

  // Broadcast
  const [broadcastMsg, setBroadcastMsg] = useState('')
  const [broadcastLoading, setBroadcastLoading] = useState(false)
  const [broadcastError, setBroadcastError] = useState('')

  // Live session
  const [showLiveDialog, setShowLiveDialog] = useState(false)
  const [liveTitle, setLiveTitle] = useState('')
  const [liveLoading, setLiveLoading] = useState(false)
  const [liveError, setLiveError] = useState('')
  const [endingLive, setEndingLive] = useState(false)

  // Materials
  const [matList, setMatList] = useState<CourseMaterial[]>([])
  const [matTitle, setMatTitle] = useState('')
  const [matDesc, setMatDesc] = useState('')
  const [matFile, setMatFile] = useState<File | null>(null)
  const [matUploading, setMatUploading] = useState(false)
  const [matError, setMatError] = useState('')
  const [deletingMatId, setDeletingMatId] = useState<number | null>(null)
  const matFileRef = useRef<HTMLInputElement>(null)
  const broadcastsEndRef = useRef<HTMLDivElement>(null)

  function loadHub() {
    return hub.getInfo(classId).then(setInfo).catch(() => setError('Failed to load Study Hub'))
  }
  function loadMaterials() {
    return materials.list(classId).then(setMatList).catch(() => {})
  }

  useEffect(() => {
    setLoading(true)
    Promise.all([loadHub(), loadMaterials()]).finally(() => setLoading(false))
  }, [classId])

  useEffect(() => {
    broadcastsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [info?.broadcasts])

  async function handleApply() {
    if (!motivation.trim()) return
    setApplyLoading(true); setApplyError('')
    try {
      await hub.apply(classId, motivation)
      setShowApplyDialog(false); setMotivation('')
      await loadHub()
    } catch (e: unknown) {
      setApplyError(e instanceof Error ? e.message : 'Failed to submit')
    } finally { setApplyLoading(false) }
  }

  async function handleBroadcast() {
    if (!broadcastMsg.trim()) return
    setBroadcastLoading(true); setBroadcastError('')
    try {
      await hub.broadcast(classId, broadcastMsg)
      setBroadcastMsg(''); await loadHub()
    } catch (e: unknown) {
      setBroadcastError(e instanceof Error ? e.message : 'Failed to send')
    } finally { setBroadcastLoading(false) }
  }

  async function handleStartLive() {
    if (!liveTitle.trim()) return
    setLiveLoading(true); setLiveError('')
    try {
      await hub.startLive(classId, liveTitle)
      setShowLiveDialog(false); setLiveTitle(''); await loadHub()
    } catch (e: unknown) {
      setLiveError(e instanceof Error ? e.message : 'Failed to start session')
    } finally { setLiveLoading(false) }
  }

  async function handleEndLive(sessionId: number) {
    setEndingLive(true)
    try { await hub.endLive(classId, sessionId); await loadHub() }
    finally { setEndingLive(false) }
  }

  async function handleMatUpload() {
    if (!matTitle.trim()) { setMatError('Title is required'); return }
    if (!matFile) { setMatError('Select a file'); return }
    setMatUploading(true); setMatError('')
    try {
      const mat = await materials.upload(classId, matTitle.trim(), matDesc.trim(), matFile)
      setMatList((prev) => [mat, ...prev])
      setMatTitle(''); setMatDesc(''); setMatFile(null)
      if (matFileRef.current) matFileRef.current.value = ''
    } catch (e: unknown) {
      setMatError(e instanceof Error ? e.message : 'Upload failed')
    } finally { setMatUploading(false) }
  }

  async function handleMatDelete(matId: number) {
    setDeletingMatId(matId)
    try {
      await materials.delete(matId)
      setMatList((prev) => prev.filter((m) => m.id !== matId))
    } catch {} finally { setDeletingMatId(null) }
  }

  if (loading) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
          <p className="text-sm text-muted-foreground">Loading Study Hub…</p>
        </div>
      </PageContainer>
    )
  }

  if (error || !info) {
    return (
      <PageContainer>
        <p className="text-center text-destructive py-10">{error || 'Hub not found'}</p>
      </PageContainer>
    )
  }

  const canApply = !info.i_am_tutor && !info.my_application_status && info.tutors.length < 2
  const jitsiUrl = info.active_live_session?.jitsi_room
    ? `https://meet.jit.si/${info.active_live_session.jitsi_room}`
    : null

  return (
    <PageContainer>
      {/* ── Hero ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 to-purple-700 p-7 mb-6 text-white shadow-lg">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 75% 40%, white 0%, transparent 55%)' }} />
        <div className="relative flex flex-col md:flex-row md:items-start justify-between gap-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
                <BookMarked className="h-3.5 w-3.5" />
                Study Hub
              </div>
              {info.course_code && (
                <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
                  {info.course_code}
                </span>
              )}
              {info.i_am_tutor && (
                <span className="flex items-center gap-1 rounded-full bg-yellow-400/30 border border-yellow-300/50 px-3 py-1 text-xs font-semibold">
                  <Crown className="h-3 w-3" /> Peer Tutor
                </span>
              )}
            </div>
            <h1 className="text-2xl md:text-3xl font-bold leading-tight">{info.class_name}</h1>
            <div className="flex flex-wrap gap-4 text-sm text-white/80 pt-1">
              <span className="flex items-center gap-1.5"><Users className="h-4 w-4" />{info.member_count} students</span>
              <span className="flex items-center gap-1.5"><Crown className="h-4 w-4" />{info.tutors.length}/2 tutors</span>
              <span className="flex items-center gap-1.5"><FolderOpen className="h-4 w-4" />{matList.length} materials</span>
              <span className="flex items-center gap-1.5"><Megaphone className="h-4 w-4" />{info.broadcasts.length} announcements</span>
            </div>
          </div>

          {/* Live session indicator */}
          {info.active_live_session ? (
            <div className="shrink-0 flex flex-col items-end gap-2">
              <div className="flex items-center gap-2 rounded-xl bg-red-500/90 px-4 py-2 font-semibold shadow-lg text-sm">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
                </span>
                LIVE NOW
              </div>
              <p className="text-xs text-white/80 text-right">{info.active_live_session.title}</p>
              <p className="text-xs text-white/60">by {info.active_live_session.tutor_name}</p>
              {jitsiUrl && (
                <Button size="sm" className="bg-white text-violet-700 hover:bg-white/90 font-semibold shadow mt-1" asChild>
                  <a href={jitsiUrl} target="_blank" rel="noopener noreferrer">
                    <Video className="h-4 w-4 mr-1.5" /> Join Session
                  </a>
                </Button>
              )}
            </div>
          ) : (
            <div className="shrink-0 flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm text-white/70 h-fit">
              <WifiOff className="h-4 w-4" />
              No live session
            </div>
          )}
        </div>
      </div>

      {/* ── Tutor end-session bar ── */}
      {info.active_live_session && info.i_am_tutor && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/20 px-5 py-3">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
            <Wifi className="h-4 w-4 animate-pulse" />
            <span className="text-sm font-medium">You are hosting a live session</span>
          </div>
          <Button size="sm" variant="outline" className="border-red-300 text-red-600 hover:bg-red-50"
            onClick={() => handleEndLive(info.active_live_session!.id)} disabled={endingLive}>
            {endingLive ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <StopCircle className="h-4 w-4 mr-1.5" />}
            End Session
          </Button>
        </div>
      )}

      {/* ── Main tabs ── */}
      <Tabs defaultValue="community" className="space-y-4">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="community" className="flex items-center gap-1.5">
            <MessageSquare className="h-4 w-4" />
            Community
            {info.broadcasts.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">{info.broadcasts.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="materials" className="flex items-center gap-1.5">
            <FolderOpen className="h-4 w-4" />
            Materials
            {matList.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">{matList.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="about" className="flex items-center gap-1.5">
            <GraduationCap className="h-4 w-4" />
            About
          </TabsTrigger>
        </TabsList>

        {/* ══ COMMUNITY TAB ══ */}
        <TabsContent value="community" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Broadcast feed — 2/3 */}
            <div className="lg:col-span-2 space-y-4">

              {/* Compose — tutor only */}
              {info.i_am_tutor && (
                <Card className="border-violet-200 dark:border-violet-800">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2 text-violet-700 dark:text-violet-400">
                      <Megaphone className="h-4 w-4" />
                      Post an Announcement
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Textarea
                      placeholder="Share an update, reminder, or note with all students in this course…"
                      value={broadcastMsg}
                      onChange={(e) => setBroadcastMsg(e.target.value)}
                      rows={3}
                      className="resize-none"
                    />
                    {broadcastError && <p className="text-xs text-destructive">{broadcastError}</p>}
                    <div className="flex justify-end">
                      <Button size="sm" onClick={handleBroadcast}
                        disabled={broadcastLoading || !broadcastMsg.trim()}>
                        {broadcastLoading
                          ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                          : <Send className="h-4 w-4 mr-1.5" />}
                        Post Announcement
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Feed */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Megaphone className="h-4 w-4 text-violet-500" />
                    Announcements
                    <Badge variant="secondary" className="ml-auto">{info.broadcasts.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {info.broadcasts.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-12 text-center">
                      <Megaphone className="h-10 w-10 text-muted-foreground/20" />
                      <p className="text-sm font-medium text-muted-foreground">No announcements yet</p>
                      <p className="text-xs text-muted-foreground/70">Tutors will post updates and reminders here</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[560px] overflow-y-auto pr-1">
                      {[...info.broadcasts].reverse().map((b) => (
                        <BroadcastCard key={b.id} broadcast={b} />
                      ))}
                      <div ref={broadcastsEndRef} />
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Live session panel — 1/3 */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Radio className="h-4 w-4 text-red-500" />
                    Live Session
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {info.active_live_session ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 px-3 py-2.5">
                        <span className="relative flex h-2.5 w-2.5 shrink-0">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-red-700 dark:text-red-400 truncate">{info.active_live_session.title}</p>
                          <p className="text-xs text-red-500">by {info.active_live_session.tutor_name}</p>
                        </div>
                      </div>
                      {jitsiUrl && (
                        <Button className="w-full bg-red-600 hover:bg-red-700 text-white" size="sm" asChild>
                          <a href={jitsiUrl} target="_blank" rel="noopener noreferrer">
                            <Video className="h-4 w-4 mr-1.5" /> Join Live Session
                          </a>
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 py-6 text-center">
                      <WifiOff className="h-8 w-8 text-muted-foreground/25" />
                      <p className="text-xs text-muted-foreground">No live session right now</p>
                      {info.i_am_tutor && (
                        <Button size="sm" variant="outline" className="mt-2 w-full"
                          onClick={() => setShowLiveDialog(true)}>
                          <Radio className="h-4 w-4 mr-1.5" /> Start Live Session
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Tutors quick view */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Crown className="h-4 w-4 text-violet-500" />
                    Peer Tutors
                    <Badge variant="outline" className="ml-auto text-[10px]">{info.tutors.length}/2</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {info.tutors.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-2">Not selected yet</p>
                  ) : (
                    <div className="space-y-2">
                      {info.tutors.map((t) => (
                        <div key={t.student_id}
                          className="flex items-center gap-3 rounded-lg bg-violet-50 dark:bg-violet-950/30 border border-violet-100 dark:border-violet-900 px-3 py-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900 shrink-0">
                            <Crown className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold leading-tight truncate">{t.name}</p>
                            {t.matric_number && (
                              <p className="text-[11px] text-muted-foreground font-mono">{t.matric_number}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ══ MATERIALS TAB ══ */}
        <TabsContent value="materials" className="space-y-4">

          {/* Upload — tutor only */}
          {info.i_am_tutor && (
            <Card className="border-violet-200 dark:border-violet-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2 text-violet-700 dark:text-violet-400">
                  <Upload className="h-4 w-4" />
                  Share a New Material
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Title <span className="text-destructive">*</span></Label>
                    <Input placeholder="e.g. Week 3 Lecture Notes"
                      value={matTitle} onChange={(e) => setMatTitle(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Description <span className="text-muted-foreground">(optional)</span></Label>
                    <Input placeholder="Brief note about this file"
                      value={matDesc} onChange={(e) => setMatDesc(e.target.value)} />
                  </div>
                </div>
                <div
                  onClick={() => matFileRef.current?.click()}
                  className={cn(
                    'mt-3 flex items-center gap-3 rounded-lg border-2 border-dashed px-5 py-4 cursor-pointer transition-colors',
                    matFile
                      ? 'border-violet-400 bg-violet-50 dark:bg-violet-950/20'
                      : 'border-muted-foreground/20 hover:border-violet-400/50 hover:bg-muted/30'
                  )}
                >
                  <Upload className={cn('h-5 w-5 shrink-0', matFile ? 'text-violet-500' : 'text-muted-foreground/50')} />
                  <div className="min-w-0">
                    {matFile ? (
                      <>
                        <p className="text-sm font-medium truncate">{matFile.name}</p>
                        <p className="text-xs text-muted-foreground">{formatBytes(matFile.size)} · Click to change</p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-muted-foreground">Click to select a file</p>
                        <p className="text-xs text-muted-foreground/60">Any file type — PDF, images, Word, PowerPoint, etc.</p>
                      </>
                    )}
                  </div>
                  <input ref={matFileRef} type="file" accept="*/*" className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null
                      setMatFile(f)
                      if (f && !matTitle.trim()) setMatTitle(f.name.replace(/\.[^.]+$/, ''))
                    }} />
                </div>
                {matError && <p className="mt-2 text-xs text-destructive">{matError}</p>}
                <div className="mt-3 flex justify-end">
                  <Button size="sm" onClick={handleMatUpload} disabled={matUploading || !matFile}>
                    {matUploading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Upload className="h-4 w-4 mr-1.5" />}
                    Upload Material
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* File grid */}
          {matList.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
                <FolderOpen className="h-12 w-12 text-muted-foreground/20" />
                <p className="text-base font-medium text-muted-foreground">No materials yet</p>
                <p className="text-sm text-muted-foreground/70">
                  {info.i_am_tutor ? 'Upload the first material above.' : 'Tutors will share study materials here.'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {matList.map((mat) => (
                <MaterialCard
                  key={mat.id}
                  material={mat}
                  canDelete={info.i_am_tutor && mat.uploaded_by === info.tutors.find(t => t.student_id === mat.uploaded_by)?.student_id || info.i_am_tutor}
                  deleting={deletingMatId === mat.id}
                  onDelete={() => handleMatDelete(mat.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ══ ABOUT TAB ══ */}
        <TabsContent value="about">
          <div className="grid gap-4 lg:grid-cols-2">

            {/* Hub info */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <BookMarked className="h-4 w-4 text-violet-500" />
                  About This Hub
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Course', value: info.class_name },
                    { label: 'Code', value: info.course_code ?? '—' },
                    { label: 'Members', value: `${info.member_count} students` },
                    { label: 'Tutors', value: `${info.tutors.length} / 2 selected` },
                    { label: 'Materials', value: `${matList.length} files` },
                    { label: 'Broadcasts', value: `${info.broadcasts.length} posts` },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-lg bg-muted/40 px-3 py-2.5">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">{label}</p>
                      <p className="text-sm font-semibold mt-0.5">{value}</p>
                    </div>
                  ))}
                </div>
                <Separator />
                <div className="space-y-1.5 text-sm text-muted-foreground">
                  <p>📢 Tutors can broadcast announcements to all enrolled students.</p>
                  <p>📹 Tutors can host live Jitsi sessions — join from the Community tab.</p>
                  <p>📂 Shared materials are available to all enrolled students.</p>
                </div>
              </CardContent>
            </Card>

            {/* Tutor profiles */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Crown className="h-4 w-4 text-violet-500" />
                  Peer Tutor Profiles
                </CardTitle>
              </CardHeader>
              <CardContent>
                {info.tutors.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-8 text-center">
                    <Crown className="h-10 w-10 text-muted-foreground/20" />
                    <p className="text-sm text-muted-foreground">No tutors selected yet</p>
                    <p className="text-xs text-muted-foreground/60">Your lecturer will pick 2 students from the applicant pool</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {info.tutors.map((t, i) => (
                      <div key={t.student_id}
                        className="flex items-center gap-4 rounded-xl border border-violet-100 dark:border-violet-900 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 p-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900 shrink-0 text-lg font-bold text-violet-600">
                          {t.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold truncate">{t.name}</p>
                            <Badge variant="secondary" className="text-[10px] px-1.5 shrink-0">Tutor {i + 1}</Badge>
                          </div>
                          {t.matric_number && (
                            <p className="text-xs text-muted-foreground font-mono mt-0.5">{t.matric_number}</p>
                          )}
                        </div>
                        <Crown className="h-5 w-5 text-violet-400 shrink-0" />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Become a tutor */}
            {!info.i_am_tutor && (
              <Card className="lg:col-span-2">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <UserPlus className="h-4 w-4 text-violet-500" />
                    Become a Peer Tutor
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {canApply && (
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border border-violet-200 bg-violet-50 dark:bg-violet-950/20 px-5 py-4">
                      <div>
                        <p className="font-medium text-violet-800 dark:text-violet-300">Applications are open!</p>
                        <p className="text-sm text-violet-600 dark:text-violet-400 mt-0.5">
                          Apply to be one of 2 peer tutors. Your lecturer will review all applicants and select 2.
                        </p>
                      </div>
                      <Button size="sm" onClick={() => setShowApplyDialog(true)} className="shrink-0">
                        <UserPlus className="h-4 w-4 mr-1.5" /> Apply Now
                      </Button>
                    </div>
                  )}
                  {info.my_application_status === 'pending' && (
                    <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 px-5 py-4">
                      <Clock className="h-5 w-5 text-amber-600 shrink-0" />
                      <div>
                        <p className="font-medium text-amber-800 dark:text-amber-300">Application Under Review</p>
                        <p className="text-sm text-amber-600 dark:text-amber-400">Your lecturer will review your application and notify you by email.</p>
                      </div>
                    </div>
                  )}
                  {info.my_application_status === 'rejected' && (
                    <div className="flex items-center gap-3 rounded-xl border border-muted bg-muted/30 px-5 py-4">
                      <AlertCircle className="h-5 w-5 text-muted-foreground shrink-0" />
                      <div>
                        <p className="font-medium">Not selected this session</p>
                        <p className="text-sm text-muted-foreground">Keep participating and apply again next semester — every contribution counts!</p>
                      </div>
                    </div>
                  )}
                  {info.tutors.length >= 2 && !info.my_application_status && (
                    <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 dark:bg-green-950/20 px-5 py-4">
                      <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                      <div>
                        <p className="font-medium text-green-800 dark:text-green-300">Tutors already selected</p>
                        <p className="text-sm text-green-600 dark:text-green-400">Both tutor spots are filled for this session.</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Apply Dialog ── */}
      <Dialog open={showApplyDialog} onOpenChange={setShowApplyDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-violet-500" />
              Apply to be a Peer Tutor
            </DialogTitle>
            <DialogDescription>
              Tell your lecturer why you'd make a great tutor for <strong>{info.class_name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="motivation">Why should you be selected?</Label>
            <Textarea
              id="motivation"
              placeholder="Describe your knowledge of this subject and how you plan to help your peers…"
              value={motivation}
              onChange={(e) => setMotivation(e.target.value)}
              rows={5}
              className="resize-none"
            />
            {applyError && <p className="text-sm text-destructive">{applyError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApplyDialog(false)}>Cancel</Button>
            <Button onClick={handleApply} disabled={applyLoading || !motivation.trim()}>
              {applyLoading && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Submit Application
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Start Live Dialog ── */}
      <Dialog open={showLiveDialog} onOpenChange={setShowLiveDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Radio className="h-5 w-5 text-red-500" />
              Start Live Tutorial Session
            </DialogTitle>
            <DialogDescription>
              All students in <strong>{info.class_name}</strong> will be notified instantly.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="live-title">Session title</Label>
            <Input id="live-title" placeholder="e.g. Week 5 — Revision & Q&A"
              value={liveTitle} onChange={(e) => setLiveTitle(e.target.value)} />
            {liveError && <p className="text-sm text-destructive">{liveError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLiveDialog(false)}>Cancel</Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleStartLive} disabled={liveLoading || !liveTitle.trim()}>
              {liveLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Radio className="h-4 w-4 mr-1.5" />}
              Go Live
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  )
}

function MaterialCard({
  material, canDelete, deleting, onDelete,
}: {
  material: CourseMaterial
  canDelete: boolean
  deleting: boolean
  onDelete: () => void
}) {
  const [busy, setBusy] = useState<'view' | 'dl' | null>(null)
  const date = new Date(material.uploaded_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  async function handleDownload() {
    setBusy('dl')
    try { const { blob, filename } = await authedFetch(material.id); triggerDownload(blob, filename) }
    catch {} finally { setBusy(null) }
  }
  async function handleView() {
    setBusy('view')
    try { const { blob, mime } = await authedFetch(material.id); openInTab(blob, mime) }
    catch {} finally { setBusy(null) }
  }

  return (
    <div className="flex flex-col rounded-xl border border-border bg-card hover:shadow-md transition-shadow overflow-hidden">
      {/* Icon header */}
      <div className="flex items-center justify-center bg-muted/40 py-6">
        {fileIcon(material.file_type, 'h-10 w-10')}
      </div>
      <div className="flex flex-col flex-1 p-4 gap-2">
        <p className="font-semibold text-sm leading-tight line-clamp-2">{material.title}</p>
        {material.description && (
          <p className="text-xs text-muted-foreground line-clamp-1">{material.description}</p>
        )}
        <p className="text-[11px] text-muted-foreground mt-auto">
          {formatBytes(material.file_size)}{material.file_size ? ' · ' : ''}{date}
        </p>
        <p className="text-[11px] text-muted-foreground">by {material.uploader_name}</p>
        <div className="flex gap-1.5 pt-1">
          {isViewable(material.file_type) && (
            <Button size="sm" variant="outline" className="flex-1 h-8 text-xs gap-1" onClick={handleView} disabled={!!busy}>
              {busy === 'view' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Eye className="h-3 w-3" />}
              View
            </Button>
          )}
          <Button size="sm" className="flex-1 h-8 text-xs gap-1" onClick={handleDownload} disabled={!!busy}>
            {busy === 'dl' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
            Download
          </Button>
          {canDelete && (
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:text-destructive" onClick={onDelete} disabled={deleting || !!busy}>
              {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function BroadcastCard({ broadcast }: { broadcast: HubBroadcast }) {
  return (
    <div className="flex gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900 shrink-0 text-sm font-bold text-violet-700 dark:text-violet-300">
        {broadcast.tutor_name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-semibold">{broadcast.tutor_name}</span>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Tutor</Badge>
          <span className="text-xs text-muted-foreground ml-auto shrink-0">{timeAgo(broadcast.created_at)}</span>
        </div>
        <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{broadcast.message}</p>
      </div>
    </div>
  )
}
