'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Send, Search, MessageSquare, Loader2, ChevronLeft,
  SquarePen, X, UserSearch, Paperclip, Pin, Forward,
  Download, FileText, ImageIcon, File as FileIcon, SmilePlus, Check, CheckCheck,
  Mic, Play, Pause, Trash2,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import {
  messages, users,
  type Message, type Contact, type MessageThread,
} from '@/lib/api'

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const EMOJI_LIST = ['👍', '❤️', '😂', '😮', '😢', '🙏']
const WAVE = [3, 5, 8, 12, 9, 14, 16, 11, 7, 10, 15, 13, 9, 6, 11, 14, 10, 7, 5, 3]

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return d.toLocaleDateString('en-US', { weekday: 'short' })
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function isImage(mime: string | null) { return mime?.startsWith('image/') ?? false }
function isAudio(mime: string | null) { return mime?.startsWith('audio/') ?? false }
function isVoiceNote(msg: Message) {
  return isAudio(msg.attachment_type) || (msg.attachment_name?.startsWith('voice_') ?? false)
}
function formatDuration(secs: number) {
  if (!isFinite(secs) || isNaN(secs) || secs < 0) return '0:00'
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

// ── WAV encoder — converts any recorded audio format to universally-playable WAV ─
function encodeWav(audioBuf: AudioBuffer): ArrayBuffer {
  const numCh = audioBuf.numberOfChannels
  const sr    = audioBuf.sampleRate
  const len   = audioBuf.length * numCh * 2
  const buf   = new ArrayBuffer(44 + len)
  const dv    = new DataView(buf)
  const str   = (off: number, s: string) => [...s].forEach((c, i) => dv.setUint8(off + i, c.charCodeAt(0)))
  str(0, 'RIFF'); dv.setUint32(4, 36 + len, true); str(8, 'WAVE')
  str(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true)
  dv.setUint16(22, numCh, true); dv.setUint32(24, sr, true)
  dv.setUint32(28, sr * numCh * 2, true); dv.setUint16(32, numCh * 2, true)
  dv.setUint16(34, 16, true); str(36, 'data'); dv.setUint32(40, len, true)
  let off = 44
  for (let i = 0; i < audioBuf.length; i++)
    for (let ch = 0; ch < numCh; ch++) {
      const s = Math.max(-1, Math.min(1, audioBuf.getChannelData(ch)[i]))
      dv.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true); off += 2
    }
  return buf
}

async function convertToWav(blob: Blob): Promise<Blob> {
  const ctx = new ((window as any).AudioContext || (window as any).webkitAudioContext)()
  const audioBuffer = await ctx.decodeAudioData(await blob.arrayBuffer())
  await ctx.close()
  return new Blob([encodeWav(audioBuffer)], { type: 'audio/wav' })
}

function threadToContact(t: MessageThread): Contact {
  return {
    id: t.contact_id, name: t.contact_name, email: t.contact_email,
    role: t.contact_role, matric_number: t.matric_number,
    staff_number: t.staff_number, department: t.department,
  }
}

// ── Voice note player inside chat bubble ─────────────────────────────────────
function VoiceNoteBubble({ msg, mine }: { msg: Message; mine: boolean }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [speed, setSpeed] = useState(1)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const cycleSpeed = () => {
    const next = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1
    setSpeed(next)
    if (audioRef.current) audioRef.current.playbackRate = next
  }

  useEffect(() => {
    setLoadState('loading')
    setBlobUrl(null)
    setPlaying(false)
    setCurrentTime(0)
    setDuration(0)
    setSpeed(1)
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    const url = `${BASE}/api/messages/attachment/${msg.id}`
    let obj = ''
    fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.blob()
      })
      .then((blob) => {
        // Use the response Content-Type first, then fall back to the stored type.
        // Never hardcode audio/webm — MP4 voice notes from iOS would break.
        const mime = blob.type.startsWith('audio/')
          ? blob.type
          : (msg.attachment_type?.startsWith('audio/') ? msg.attachment_type : 'audio/webm')
        const audioBlob = blob.type === mime ? blob : new Blob([blob], { type: mime })
        obj = URL.createObjectURL(audioBlob)
        setBlobUrl(obj)
        setLoadState('ready')
      })
      .catch(() => setLoadState('error'))
    return () => { if (obj) URL.revokeObjectURL(obj) }
  }, [msg.id, msg.attachment_type])

  const toggle = () => {
    if (!audioRef.current || loadState !== 'ready') return
    if (playing) {
      audioRef.current.pause()
    } else {
      audioRef.current.play().catch(() => setLoadState('error'))
    }
  }

  const progress = duration > 0 ? currentTime / duration : 0

  return (
    <div className="mt-1.5 flex items-center gap-2.5 min-w-[200px] max-w-[240px]">
      {blobUrl && (
        <audio ref={audioRef} src={blobUrl}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => { setPlaying(false); setCurrentTime(0) }}
          onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)}
          onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
          onError={() => { setLoadState('error'); setPlaying(false) }}
        />
      )}
      <button onClick={toggle} disabled={loadState !== 'ready'}
        className={cn('shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
          mine ? 'bg-primary-foreground/20 hover:bg-primary-foreground/30' : 'bg-primary/10 hover:bg-primary/20',
          loadState !== 'ready' && 'opacity-50 cursor-not-allowed',
        )}>
        {loadState === 'loading'
          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
          : loadState === 'error'
          ? <span className="text-[10px]">!</span>
          : playing
          ? <Pause className="w-3.5 h-3.5" />
          : <Play className="w-3.5 h-3.5 ml-0.5" />}
      </button>
      <div className="flex-1 flex flex-col gap-1">
        <div className="flex items-end gap-[2px] h-5">
          {WAVE.map((h, i) => (
            <div key={i}
              className={cn('w-[2px] rounded-full flex-shrink-0',
                loadState === 'error'
                  ? 'bg-red-400/40'
                  : i / WAVE.length <= progress
                  ? mine ? 'bg-primary-foreground' : 'bg-primary'
                  : mine ? 'bg-primary-foreground/30' : 'bg-muted-foreground/40',
              )}
              style={{
                height: `${h}px`,
                transformOrigin: 'center',
                animation: playing ? `voice-wave ${0.7 + (i % 4) * 0.1}s ease-in-out infinite` : 'none',
                animationDelay: `${(i * 55) % 500}ms`,
              }} />
          ))}
        </div>
        <div className="flex items-center justify-between">
          <span className={cn('text-[10px]', mine ? 'text-primary-foreground/60' : 'text-muted-foreground')}>
            {loadState === 'error' ? 'Cannot play' : formatDuration(playing ? currentTime : duration)}
          </span>
          {loadState === 'ready' && (
            <button
              onClick={cycleSpeed}
              className={cn(
                'text-[10px] font-bold px-1.5 py-0.5 rounded-md transition-colors',
                mine
                  ? 'text-primary-foreground/70 hover:bg-primary-foreground/20'
                  : 'text-muted-foreground hover:bg-muted',
                speed !== 1 && (mine ? 'bg-primary-foreground/20' : 'bg-muted'),
              )}
            >
              {speed}×
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Attachment preview inside chat bubble ──────────────────────────────────────
function AttachmentBubble({ msg, mine }: { msg: Message; mine: boolean }) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  const url = `${BASE}/api/messages/attachment/${msg.id}`

  if (isVoiceNote(msg)) return <VoiceNoteBubble msg={msg} mine={mine} />

  if (isImage(msg.attachment_type)) {
    return (
      <div className="mt-1.5 space-y-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={msg.attachment_name ?? 'image'}
          className="max-w-[220px] rounded-xl object-cover cursor-pointer"
          onClick={async () => {
            const r = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
            const blob = await r.blob()
            window.open(URL.createObjectURL(blob), '_blank')
          }}
        />
        <p className="text-[10px] opacity-60">{msg.attachment_name}</p>
      </div>
    )
  }

  return (
    <div className={cn(
      'mt-1.5 flex items-center gap-2 rounded-xl px-3 py-2 text-xs',
      mine ? 'bg-primary-foreground/10' : 'bg-background/60',
    )}>
      <FileText className="h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{msg.attachment_name}</p>
        {msg.attachment_size && <p className="opacity-60">{formatBytes(msg.attachment_size)}</p>}
      </div>
      <a
        href={url}
        download={msg.attachment_name ?? true}
        onClick={(e) => {
          e.preventDefault()
          fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
            .then((r) => r.blob())
            .then((blob) => {
              const a = document.createElement('a')
              a.href = URL.createObjectURL(blob)
              a.download = msg.attachment_name ?? 'file'
              a.click()
            })
        }}
        className="shrink-0"
      >
        <Download className="h-4 w-4" />
      </a>
    </div>
  )
}

// ── Reaction chips below a bubble ─────────────────────────────────────────────
function ReactionRow({
  msg, myId, onReacted,
}: { msg: Message; myId: number | null; onReacted: (updated: Message) => void }) {
  if (!msg.reactions.length) return null
  const grouped = msg.reactions.reduce<Record<string, { count: number; mine: boolean }>>((acc, r) => {
    if (!acc[r.emoji]) acc[r.emoji] = { count: 0, mine: false }
    acc[r.emoji].count++
    if (r.user_id === myId) acc[r.emoji].mine = true
    return acc
  }, {})

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {Object.entries(grouped).map(([emoji, { count, mine }]) => (
        <button
          key={emoji}
          onClick={async () => {
            try {
              const updated = mine
                ? await messages.unreact(msg.id)
                : await messages.react(msg.id, emoji)
              onReacted(updated)
            } catch {}
          }}
          className={cn(
            'flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs border transition-colors',
            mine
              ? 'bg-primary/10 border-primary/30 text-primary'
              : 'bg-muted border-border hover:bg-muted/80',
          )}
        >
          <span>{emoji}</span>
          <span className="text-[10px]">{count}</span>
        </button>
      ))}
    </div>
  )
}

// ── Action bar (hover on desktop, click/long-press triggered) ─────────────────
function MessageActions({
  msg, mine, myId, isActive, onReacted, onPin, onForward, onDelete,
}: {
  msg: Message; mine: boolean; myId: number | null; isActive: boolean
  onReacted: (updated: Message) => void
  onPin: (updated: Message) => void
  onForward: (msg: Message) => void
  onDelete: (id: number) => void
}) {
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const myReaction = msg.reactions.find((r) => r.user_id === myId)

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={cn(
        'absolute top-0 flex items-center gap-0.5 transition-opacity z-10',
        mine ? '-left-2 -translate-x-full' : '-right-2 translate-x-full',
        isActive ? 'opacity-100 pointer-events-auto' : 'opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto',
      )}>
      {/* Emoji picker */}
      <div className="relative">
        <button
          onClick={() => setEmojiOpen((v) => !v)}
          className="p-1.5 rounded-full bg-background border border-border shadow-sm hover:bg-muted text-muted-foreground"
          title="React"
        >
          <SmilePlus className="h-3.5 w-3.5" />
        </button>
        {emojiOpen && (
          <div className={cn(
            'absolute bottom-full mb-1 flex gap-1 rounded-2xl border border-border bg-background px-2 py-1.5 shadow-lg',
            mine ? 'right-0' : 'left-0',
          )}>
            {EMOJI_LIST.map((e) => (
              <button
                key={e}
                onClick={async () => {
                  setEmojiOpen(false)
                  try {
                    const updated = myReaction?.emoji === e
                      ? await messages.unreact(msg.id)
                      : await messages.react(msg.id, e)
                    onReacted(updated)
                  } catch {}
                }}
                className={cn(
                  'text-lg hover:scale-125 transition-transform',
                  myReaction?.emoji === e && 'ring-2 ring-primary rounded-full',
                )}
              >
                {e}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Pin */}
      <button
        onClick={async () => {
          try { onPin(await messages.pin(msg.id)) } catch {}
        }}
        className={cn(
          'p-1.5 rounded-full bg-background border border-border shadow-sm hover:bg-muted',
          msg.is_pinned ? 'text-primary' : 'text-muted-foreground',
        )}
        title={msg.is_pinned ? 'Unpin' : 'Pin'}
      >
        <Pin className="h-3.5 w-3.5" />
      </button>

      {/* Forward */}
      <button
        onClick={() => onForward(msg)}
        className="p-1.5 rounded-full bg-background border border-border shadow-sm hover:bg-muted text-muted-foreground"
        title="Forward"
      >
        <Forward className="h-3.5 w-3.5" />
      </button>

      {/* Delete — own messages only */}
      {mine && !confirmDelete && (
        <button
          onClick={() => setConfirmDelete(true)}
          className="p-1.5 rounded-full bg-background border border-border shadow-sm hover:bg-destructive/10 text-destructive"
          title="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
      {mine && confirmDelete && (
        <>
          <span className="text-[10px] text-destructive font-semibold whitespace-nowrap px-1">Delete?</span>
          <button
            onClick={() => { onDelete(msg.id); setConfirmDelete(false) }}
            className="p-1.5 rounded-full bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90"
            title="Confirm delete"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setConfirmDelete(false)}
            className="p-1.5 rounded-full bg-background border border-border shadow-sm hover:bg-muted text-muted-foreground"
            title="Cancel"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </>
      )}
    </div>
  )
}

// ── Pinned messages banner ────────────────────────────────────────────────────
function PinnedBanner({
  pinned, onJump,
}: { pinned: Message[]; onJump: (id: number) => void }) {
  const [expanded, setExpanded] = useState(false)
  if (!pinned.length) return null
  const latest = pinned[pinned.length - 1]

  return (
    <div className="border-b border-border bg-muted/40 px-4 py-2">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 text-left"
      >
        <Pin className="h-3.5 w-3.5 text-primary shrink-0" />
        <p className="flex-1 text-xs text-foreground truncate">
          <span className="font-medium">Pinned: </span>{latest.body}
        </p>
        <span className="text-[10px] text-muted-foreground">{pinned.length}</span>
      </button>
      {expanded && (
        <div className="mt-2 space-y-1">
          {pinned.map((m) => (
            <button
              key={m.id}
              onClick={() => { onJump(m.id); setExpanded(false) }}
              className="w-full text-left text-xs rounded-lg px-3 py-1.5 hover:bg-muted truncate"
            >
              {m.body}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function MessagesPage() {
  const [threads, setThreads]           = useState<MessageThread[]>([])
  const [selected, setSelected]         = useState<Contact | null>(null)
  const [conversation, setConversation] = useState<Message[]>([])
  const [query, setQuery]               = useState('')
  const [input, setInput]               = useState('')
  const [sending, setSending]           = useState(false)
  const [loading, setLoading]           = useState(true)
  const [myId, setMyId]                 = useState<number | null>(null)
  const [mobileView, setMobileView]     = useState<'list' | 'chat'>('list')
  const [pendingOpenId, setPendingOpenId] = useState<number | null>(null)

  // Attachment state
  const [attachFile, setAttachFile]         = useState<File | null>(null)
  const [attachMenuOpen, setAttachMenuOpen] = useState(false)
  const [justSentIds, setJustSentIds]       = useState<Set<number>>(new Set())
  const [isRecording, setIsRecording]       = useState(false)
  const [recordSecs, setRecordSecs]         = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef   = useRef<Blob[]>([])
  const recordTimerRef   = useRef<ReturnType<typeof setInterval> | null>(null)
  const autoSendRef      = useRef(false)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const pdfInputRef   = useRef<HTMLInputElement>(null)
  const docInputRef   = useRef<HTMLInputElement>(null)

  // Compose dialog
  const [composeOpen, setComposeOpen]       = useState(false)
  const [composeQuery, setComposeQuery]     = useState('')
  const [composeResults, setComposeResults] = useState<Contact[]>([])
  const [composeLoading, setComposeLoading] = useState(false)

  // Forward dialog
  const [forwardMsg, setForwardMsg]         = useState<Message | null>(null)
  const [forwardQuery, setForwardQuery]     = useState('')
  const [forwardResults, setForwardResults] = useState<Contact[]>([])
  const [forwardLoading, setForwardLoading] = useState(false)
  const [forwarding, setForwarding]         = useState(false)

  const [activeMenuMsgId, setActiveMenuMsgId] = useState<number | null>(null)

  const bottomRef      = useRef<HTMLDivElement>(null)
  const composeRef     = useRef<HTMLInputElement>(null)
  const msgRefs        = useRef<Record<number, HTMLDivElement | null>>({})
  const wsRef          = useRef<WebSocket | null>(null)
  const selectedRef    = useRef<Contact | null>(null)
  const typingTimer    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [partnerTyping, setPartnerTyping] = useState(false)

  useEffect(() => { selectedRef.current = selected }, [selected])

  const refreshThreads = useCallback(() =>
    messages.threads().then(setThreads).catch(console.error), [])

  // ── WebSocket for real-time messages & typing ────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return
    const wsBase = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/^http/, 'ws')
    const ws = new WebSocket(`${wsBase}/ws/messages?token=${token}`)
    wsRef.current = ws

    const ping = setInterval(() => { if (ws.readyState === WebSocket.OPEN) ws.send('ping') }, 25000)

    ws.onmessage = (e) => {
      if (e.data === 'pong') return
      try {
        const data = JSON.parse(e.data)
        if (data.type === 'message') {
          const incoming: Message = data.message
          refreshThreads()
          if (selectedRef.current && incoming.sender_id === selectedRef.current.id) {
            setConversation((prev) => [...prev, incoming])
            setPartnerTyping(false)
            messages.markRead(incoming.id).catch(() => {})
          }
        } else if (data.type === 'typing') {
          if (selectedRef.current && data.from_user_id === selectedRef.current.id) {
            setPartnerTyping(data.is_typing)
          }
        } else if (data.type === 'read') {
          setConversation((prev) =>
            prev.map((m) => m.id === data.message_id ? { ...m, read_at: data.read_at } : m)
          )
        } else if (data.type === 'message_deleted') {
          setConversation((prev) => prev.filter((m) => m.id !== data.message_id))
          refreshThreads()
        }
      } catch { /* ignore parse errors */ }
    }

    return () => { clearInterval(ping); ws.close() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const id = localStorage.getItem('userId')
    if (id) setMyId(Number(id))
    const openId = new URLSearchParams(window.location.search).get('open')
    if (openId) setPendingOpenId(Number(openId))
    refreshThreads().finally(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (loading || pendingOpenId === null) return
    const thread = threads.find((t) => t.contact_id === pendingOpenId)
    if (thread) {
      openChat(threadToContact(thread))
      setPendingOpenId(null)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [loading, threads, pendingOpenId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selected) return
    messages.conversation(selected.id).then((msgs) => {
      setConversation(msgs)
      msgs.filter((m) => m.sender_id === selected.id && !m.read_at)
        .forEach((m) => messages.markRead(m.id).catch(() => {}))
    }).catch(console.error)
  }, [selected])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversation])

  // Compose search
  useEffect(() => {
    if (composeQuery.length < 2) { setComposeResults([]); return }
    const t = setTimeout(() => {
      setComposeLoading(true)
      users.search(composeQuery).then(setComposeResults).catch(console.error).finally(() => setComposeLoading(false))
    }, 300)
    return () => clearTimeout(t)
  }, [composeQuery])

  // Forward search
  useEffect(() => {
    if (forwardQuery.length < 2) { setForwardResults([]); return }
    const t = setTimeout(() => {
      setForwardLoading(true)
      users.search(forwardQuery).then(setForwardResults).catch(console.error).finally(() => setForwardLoading(false))
    }, 300)
    return () => clearTimeout(t)
  }, [forwardQuery])

  useEffect(() => {
    if (composeOpen) setTimeout(() => composeRef.current?.focus(), 50)
    else { setComposeQuery(''); setComposeResults([]) }
  }, [composeOpen])

  const updateMsg = (updated: Message) =>
    setConversation((prev) => prev.map((m) => m.id === updated.id ? updated : m))

  const handleSend = async () => {
    if ((!input.trim() && !attachFile) || !selected || sending) return
    setSending(true)
    try {
      let msg: Message
      if (attachFile) {
        msg = await messages.sendWithAttachment(selected.id, input.trim(), attachFile)
        setAttachFile(null)
      } else {
        msg = await messages.send(selected.id, input.trim())
      }
      setConversation((prev) => [...prev, msg])
      setInput('')
      refreshThreads()
      setJustSentIds((prev) => new Set(prev).add(msg.id))
      setTimeout(() => setJustSentIds((prev) => { const s = new Set(prev); s.delete(msg.id); return s }), 4000)
      if (typingTimer.current) clearTimeout(typingTimer.current)
      wsRef.current?.send(JSON.stringify({ type: 'typing', to_user_id: selected.id, is_typing: false }))
    } catch (err) {
      console.error(err)
    } finally {
      setSending(false)
    }
  }

  const handleForward = async (contact: Contact) => {
    if (!forwardMsg || forwarding) return
    setForwarding(true)
    try {
      await messages.forward(forwardMsg.id, contact.id)
      setForwardMsg(null)
      setForwardQuery('')
    } catch (err) {
      console.error(err)
    } finally {
      setForwarding(false)
    }
  }

  const openChat = (contact: Contact) => {
    setSelected(contact)
    setMobileView('chat')
    setThreads((prev) =>
      prev.map((t) => t.contact_id === contact.id ? { ...t, unread_count: 0 } : t)
    )
  }

  const handleSelectThread = (t: MessageThread) => {
    openChat(threadToContact(t))
  }

  const jumpToMessage = (id: number) => {
    const el = msgRefs.current[id]
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const handleDeleteMsg = async (id: number) => {
    setActiveMenuMsgId(null)
    try {
      await messages.delete(id)
      setConversation((prev) => prev.filter((m) => m.id !== id))
      refreshThreads()
    } catch (err) { console.error(err) }
  }

  const startRecording = async () => {
    const getSupportedMime = () => {
      const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg', 'audio/mp4']
      return types.find((t) => MediaRecorder.isTypeSupported(t)) ?? ''
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = getSupportedMime()
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      mediaRecorderRef.current = recorder
      audioChunksRef.current = []
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const finalMime = recorder.mimeType || mimeType || 'audio/webm'
        const rawBlob = new Blob(audioChunksRef.current, { type: finalMime })
        // Convert to WAV so iOS Safari can play it (webm/ogg not supported on iOS)
        let uploadBlob: Blob = rawBlob
        let uploadMime = finalMime
        let ext = finalMime.includes('ogg') ? '.ogg' : finalMime.includes('mp4') ? '.m4a' : '.webm'
        try {
          uploadBlob = await convertToWav(rawBlob)
          uploadMime = 'audio/wav'
          ext = '.wav'
        } catch { /* keep original if conversion fails */ }
        const file = new File([uploadBlob], `voice_${Date.now()}${ext}`, { type: uploadMime })
        if (autoSendRef.current && selectedRef.current) {
          autoSendRef.current = false
          setSending(true)
          try {
            const msg = await messages.sendWithAttachment(selectedRef.current.id, '', file)
            setConversation((prev) => [...prev, msg])
            refreshThreads()
            setJustSentIds((prev) => new Set(prev).add(msg.id))
            setTimeout(() => setJustSentIds((prev) => { const s = new Set(prev); s.delete(msg.id); return s }), 4000)
            wsRef.current?.send(JSON.stringify({ type: 'typing', to_user_id: selectedRef.current!.id, is_typing: false }))
          } catch (err) { console.error(err) }
          finally { setSending(false) }
        } else {
          setAttachFile(file)
        }
        setRecordSecs(0)
      }
      recorder.start(100)
      setIsRecording(true)
      recordTimerRef.current = setInterval(() => setRecordSecs((s) => s + 1), 1000)
    } catch { alert('Microphone access denied. Please allow microphone permission.') }
  }

  const stopAndSend = () => {
    autoSendRef.current = true
    if (recordTimerRef.current) clearInterval(recordTimerRef.current)
    setIsRecording(false)
    if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop()
  }

  const cancelRecording = () => {
    autoSendRef.current = false
    if (recordTimerRef.current) clearInterval(recordTimerRef.current)
    setIsRecording(false)
    setRecordSecs(0)
    if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop()
    audioChunksRef.current = []
  }

  const filtered = threads.filter((t) => {
    const q = query.toLowerCase()
    return t.contact_name.toLowerCase().includes(q) ||
      (t.matric_number ?? '').toLowerCase().includes(q) ||
      (t.contact_email ?? '').toLowerCase().includes(q)
  })

  const pinned = conversation.filter((m) => m.is_pinned)
  const totalUnread = threads.reduce((s, t) => s + t.unread_count, 0)

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-1 min-h-0 bg-background overflow-hidden">

      {/* ── Sidebar ───────────────────────────────────────────────────────────── */}
      <div
        className={cn(
          'shrink-0 border-r border-border flex-col min-h-0 md:w-[296px]',
          mobileView === 'chat' ? 'hidden md:flex' : 'flex w-full',
        )}
      >
        <div className="p-4 border-b border-border space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold">Messages</h1>
              {totalUnread > 0 && (
                <span className="flex h-5 min-w-5 px-1 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                  {totalUnread}
                </span>
              )}
            </div>
            <button
              onClick={() => setComposeOpen(true)}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              title="New message"
            >
              <SquarePen className="w-4 h-4" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Filter conversations…" value={query}
              onChange={(e) => setQuery(e.target.value)} className="pl-9 h-9 text-sm" />
          </div>
        </div>

        <ScrollArea className="flex-1 min-h-0">
          {threads.length === 0 ? (
            <div className="py-12 px-4 text-center text-sm text-muted-foreground space-y-3">
              <MessageSquare className="w-10 h-10 mx-auto opacity-20" />
              <p>No conversations yet.</p>
              <button onClick={() => setComposeOpen(true)} className="text-primary hover:underline text-sm font-medium">
                Start a new message ↗
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No results</p>
          ) : filtered.map((t) => (
            <button key={t.contact_id} onClick={() => handleSelectThread(t)}
              className={cn(
                'w-full flex items-start gap-3 px-4 py-3.5 text-left border-b border-border hover:bg-muted/50 transition-colors',
                selected?.id === t.contact_id && 'bg-muted',
              )}>
              <Avatar className="h-10 w-10 shrink-0 mt-0.5">
                <AvatarFallback className="text-xs font-semibold">{initials(t.contact_name)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className={cn('text-sm truncate', t.unread_count > 0 ? 'font-semibold' : 'text-foreground/80')}>
                    {t.contact_name}
                  </span>
                  {t.last_message_at && (
                    <span className="text-[10px] text-muted-foreground shrink-0">{formatTime(t.last_message_at)}</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {t.matric_number ?? t.department ?? t.contact_email}
                </p>
                {t.last_message_body && (
                  <p className={cn('text-xs truncate mt-0.5', t.unread_count > 0 ? 'text-foreground/70 font-medium' : 'text-muted-foreground')}>
                    {t.last_message_sender_id === myId ? 'You: ' : ''}{t.last_message_body}
                  </p>
                )}
              </div>
              {t.unread_count > 0 && (
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold mt-0.5">
                  {t.unread_count}
                </span>
              )}
            </button>
          ))}
        </ScrollArea>
      </div>

      {/* ── Chat panel ────────────────────────────────────────────────────────── */}
      <div className={cn('flex-col min-w-0 min-h-0 flex-1', mobileView === 'list' ? 'hidden md:flex' : 'flex')}>
        {selected ? (
          <>
            {/* Header */}
            <div className="flex items-center gap-3 px-4 md:px-6 py-3.5 border-b border-border shrink-0">
              <button onClick={() => setMobileView('list')}
                className="md:hidden p-1 -ml-1 rounded-lg hover:bg-muted transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <Avatar className="h-9 w-9">
                <AvatarFallback className="text-xs font-semibold">{initials(selected.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{selected.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {selected.matric_number ?? selected.department ?? selected.email}
                </p>
              </div>
            </div>

            {/* Pinned banner */}
            <PinnedBanner pinned={pinned} onJump={jumpToMessage} />

            {/* Messages */}
            <ScrollArea className="flex-1 min-h-0 px-4 md:px-6 py-4">
              {conversation.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-16 text-muted-foreground">
                  <MessageSquare className="w-10 h-10 mb-3 opacity-20" />
                  <p className="text-sm">No messages yet. Start the conversation.</p>
                </div>
              ) : (
                <>
                {/* Backdrop to dismiss active menu */}
                {activeMenuMsgId !== null && (
                  <div className="fixed inset-0 z-[5]" onClick={() => setActiveMenuMsgId(null)} />
                )}
                <div className="space-y-4">
                  {conversation.map((m) => {
                    const mine = m.sender_id === myId
                    return (
                      <div
                        key={m.id}
                        ref={(el) => { msgRefs.current[m.id] = el }}
                        className={cn('flex group', mine ? 'justify-end' : 'justify-start')}
                      >
                        <div
                          className={cn('max-w-[78%] md:max-w-sm relative cursor-pointer select-none')}
                          onClick={(e) => { e.stopPropagation(); setActiveMenuMsgId((prev) => prev === m.id ? null : m.id) }}
                          onContextMenu={(e) => { e.preventDefault(); setActiveMenuMsgId(m.id) }}
                          onTouchStart={() => {
                            longPressTimer.current = setTimeout(() => setActiveMenuMsgId(m.id), 500)
                          }}
                          onTouchEnd={() => { if (longPressTimer.current) clearTimeout(longPressTimer.current) }}
                          onTouchMove={() => { if (longPressTimer.current) clearTimeout(longPressTimer.current) }}
                        >
                          {/* Action bar */}
                          <MessageActions
                            msg={m} mine={mine} myId={myId}
                            isActive={activeMenuMsgId === m.id}
                            onReacted={updateMsg}
                            onPin={updateMsg}
                            onForward={(msg) => { setForwardMsg(msg); setForwardQuery(''); setActiveMenuMsgId(null) }}
                            onDelete={handleDeleteMsg}
                          />

                          {/* Forwarded label */}
                          {m.forwarded_from_id && (
                            <div className={cn('flex items-center gap-1 mb-0.5 text-[10px] text-muted-foreground', mine ? 'justify-end' : 'justify-start')}>
                              <Forward className="h-2.5 w-2.5" />
                              <span>Forwarded</span>
                            </div>
                          )}

                          {/* Bubble */}
                          <div className={cn(
                            'px-4 py-2.5 rounded-2xl text-sm',
                            mine ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-muted rounded-bl-sm',
                            m.is_pinned && 'ring-1 ring-primary/30',
                          )}>
                            {m.subject && <p className="font-medium text-xs mb-1 opacity-70">{m.subject}</p>}
                            {m.body && !isVoiceNote(m) && <p className="leading-relaxed">{m.body}</p>}
                            {m.attachment_path && <AttachmentBubble msg={m} mine={mine} />}
                            <div className={cn('flex items-center gap-1.5 mt-1.5', mine ? 'justify-end' : 'justify-start')}>
                              {m.is_pinned && <Pin className="h-2.5 w-2.5 opacity-60" />}
                              <span className={cn('text-[10px]', mine ? 'text-primary-foreground/60' : 'text-muted-foreground')}>
                                {formatTime(m.sent_at)}
                              </span>
                              {mine && (
                                justSentIds.has(m.id) ? (
                                  <span className="flex items-center gap-0.5 opacity-60">
                                    <Check className="h-3 w-3" />
                                    <span className="text-[10px]">Sent</span>
                                  </span>
                                ) : m.read_at ? (
                                  <span className="flex items-center gap-0.5 text-sky-300">
                                    <CheckCheck className="h-3 w-3" />
                                    <span className="text-[10px]">Seen</span>
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-0.5 opacity-60">
                                    <CheckCheck className="h-3 w-3" />
                                    <span className="text-[10px]">Delivered</span>
                                  </span>
                                )
                              )}
                            </div>
                          </div>

                          {/* Reactions */}
                          <div className={mine ? 'flex justify-end' : ''}>
                            <ReactionRow msg={m} myId={myId} onReacted={updateMsg} />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  {/* Typing bubble — shown inside the conversation like a received message */}
                  {partnerTyping && (
                    <div className="flex justify-start">
                      <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1.5">
                        {[0, 160, 320].map((d) => (
                          <span key={d}
                            className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce"
                            style={{ animationDelay: `${d}ms` }} />
                        ))}
                      </div>
                    </div>
                  )}
                  <div ref={bottomRef} />
                </div>
                </>
              )}
            </ScrollArea>

            {/* Attachment preview bar */}
            {attachFile && (
              <div className="flex items-center gap-3 px-4 py-2 border-t border-border bg-muted/40">
                {attachFile.type.startsWith('image/') ? (
                  <ImageIcon className="h-4 w-4 text-blue-500 shrink-0" />
                ) : attachFile.type.startsWith('audio/') ? (
                  <Mic className="h-4 w-4 text-red-500 shrink-0" />
                ) : (
                  <FileIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <p className="flex-1 text-xs truncate">
                  {attachFile.type.startsWith('audio/') ? `Voice note (${formatDuration(recordSecs || 0)})` : attachFile.name}
                </p>
                <p className="text-[10px] text-muted-foreground shrink-0">{formatBytes(attachFile.size)}</p>
                <button onClick={() => setAttachFile(null)} className="shrink-0 p-0.5 hover:text-destructive">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Input bar */}
            <div className="flex items-center gap-2 px-4 py-3 border-t border-border shrink-0">
              {isRecording ? (
                /* ── Recording active UI ── */
                <>
                  <button onClick={cancelRecording}
                    className="shrink-0 p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                  <div className="flex-1 flex items-center gap-2 bg-muted rounded-xl px-3 py-2">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                    <span className="text-sm font-mono text-red-500 shrink-0">{formatDuration(recordSecs)}</span>
                    <div className="flex-1 flex items-end gap-[2px] h-5 overflow-hidden">
                      {WAVE.map((h, i) => (
                        <div key={i} className="w-[2px] rounded-full bg-red-400/60 shrink-0 animate-pulse"
                          style={{ height: `${h}px`, animationDelay: `${i * 40}ms` }} />
                      ))}
                    </div>
                  </div>
                  <Button size="icon" className="h-10 w-10 shrink-0 bg-red-500 hover:bg-red-600" onClick={stopAndSend}>
                    <Send className="w-4 h-4" />
                  </Button>
                </>
              ) : (
                /* ── Normal input UI ── */
                <>
                  {/* Hidden file inputs — one per type */}
                  <input ref={imageInputRef} type="file" className="hidden"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) setAttachFile(f); e.target.value = ''; setAttachMenuOpen(false) }} />
                  <input ref={pdfInputRef} type="file" className="hidden"
                    accept="application/pdf"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) setAttachFile(f); e.target.value = ''; setAttachMenuOpen(false) }} />
                  <input ref={docInputRef} type="file" className="hidden"
                    accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) setAttachFile(f); e.target.value = ''; setAttachMenuOpen(false) }} />

                  {/* Attach button with WhatsApp-style popup */}
                  <div className="relative shrink-0">
                    {attachMenuOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setAttachMenuOpen(false)} />
                        <div className="absolute bottom-full left-0 mb-2 z-20 w-44 rounded-xl border bg-background shadow-lg overflow-hidden">
                          <button onClick={() => imageInputRef.current?.click()}
                            className="flex w-full items-center gap-3 px-4 py-3 text-sm hover:bg-muted transition-colors">
                            <ImageIcon className="w-4 h-4 text-blue-500" />
                            <span>Image</span>
                          </button>
                          <button onClick={() => pdfInputRef.current?.click()}
                            className="flex w-full items-center gap-3 px-4 py-3 text-sm hover:bg-muted transition-colors border-t border-border">
                            <FileText className="w-4 h-4 text-red-500" />
                            <span>PDF</span>
                          </button>
                          <button onClick={() => docInputRef.current?.click()}
                            className="flex w-full items-center gap-3 px-4 py-3 text-sm hover:bg-muted transition-colors border-t border-border">
                            <FileIcon className="w-4 h-4 text-blue-600" />
                            <span>Document</span>
                          </button>
                        </div>
                      </>
                    )}
                    <button
                      onClick={() => setAttachMenuOpen((v) => !v)}
                      className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                      title="Attach file"
                    >
                      <Paperclip className="w-4 h-4" />
                    </button>
                  </div>

                  <Input
                    placeholder={`Message ${selected.name}…`}
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value)
                      if (selected && wsRef.current?.readyState === WebSocket.OPEN) {
                        wsRef.current.send(JSON.stringify({ type: 'typing', to_user_id: selected.id, is_typing: true }))
                        if (typingTimer.current) clearTimeout(typingTimer.current)
                        typingTimer.current = setTimeout(() => {
                          wsRef.current?.send(JSON.stringify({ type: 'typing', to_user_id: selected.id, is_typing: false }))
                        }, 2500)
                      }
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                    className="flex-1 h-10"
                  />

                  {/* Mic (when nothing to send) or Send button */}
                  {!input.trim() && !attachFile ? (
                    <button onClick={startRecording}
                      className="shrink-0 p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
                      <Mic className="w-5 h-5" />
                    </button>
                  ) : (
                    <Button size="icon" className="h-10 w-10 shrink-0" onClick={handleSend}
                      disabled={(!input.trim() && !attachFile) || sending}>
                      {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                  )}
                </>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground gap-4">
            <MessageSquare className="w-14 h-14 opacity-10" />
            <div className="text-center space-y-1">
              <p className="text-sm font-medium">Select a conversation</p>
              <p className="text-xs">or start a new one</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setComposeOpen(true)}>
              <SquarePen className="w-4 h-4 mr-2" />New Message
            </Button>
          </div>
        )}
      </div>

      {/* ── Compose modal ─────────────────────────────────────────────────────── */}
      {composeOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4">
          <div className="fixed inset-0 bg-black/40" onClick={() => setComposeOpen(false)} />
          <div className="relative z-10 w-full max-w-md rounded-2xl border bg-background shadow-xl overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border">
              <UserSearch className="w-4 h-4 text-muted-foreground shrink-0" />
              <Input
                ref={composeRef}
                placeholder="Search by name, matric number, or email…"
                value={composeQuery}
                onChange={(e) => setComposeQuery(e.target.value)}
                className="flex-1 border-0 shadow-none focus-visible:ring-0 px-0 h-8 text-sm"
              />
              {composeLoading
                ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground shrink-0" />
                : <button onClick={() => setComposeOpen(false)} className="p-0.5 rounded hover:bg-muted">
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>}
            </div>
            <div className="max-h-72 overflow-y-auto">
              {composeQuery.length < 2 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Type at least 2 characters to search</p>
              ) : composeResults.length === 0 && !composeLoading ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No users found</p>
              ) : composeResults.map((c) => (
                <button key={c.id}
                  onClick={() => { setComposeOpen(false); openChat(c) }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/60 transition-colors text-left border-b border-border last:border-0">
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarFallback className="text-xs font-semibold">{initials(c.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{c.matric_number ?? c.department ?? c.email}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Forward modal ──────────────────────────────────────────────────────── */}
      {forwardMsg && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4">
          <div className="fixed inset-0 bg-black/40" onClick={() => setForwardMsg(null)} />
          <div className="relative z-10 w-full max-w-md rounded-2xl border bg-background shadow-xl overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border">
              <Forward className="w-4 h-4 text-muted-foreground shrink-0" />
              <Input
                autoFocus
                placeholder="Forward to… (search name, matric, email)"
                value={forwardQuery}
                onChange={(e) => setForwardQuery(e.target.value)}
                className="flex-1 border-0 shadow-none focus-visible:ring-0 px-0 h-8 text-sm"
              />
              {forwardLoading
                ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground shrink-0" />
                : <button onClick={() => setForwardMsg(null)} className="p-0.5 rounded hover:bg-muted">
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>}
            </div>
            <div className="px-4 py-2 border-b border-border bg-muted/30">
              <p className="text-xs text-muted-foreground line-clamp-2">
                <span className="font-medium">Forwarding: </span>{forwardMsg.body}
              </p>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {forwardQuery.length < 2 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Type to search</p>
              ) : forwardResults.length === 0 && !forwardLoading ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No users found</p>
              ) : forwardResults.map((c) => (
                <button key={c.id}
                  onClick={() => handleForward(c)}
                  disabled={forwarding}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/60 transition-colors text-left border-b border-border last:border-0 disabled:opacity-50">
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarFallback className="text-xs font-semibold">{initials(c.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{c.matric_number ?? c.department ?? c.email}</p>
                  </div>
                  {forwarding && <Loader2 className="h-4 w-4 animate-spin shrink-0" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
