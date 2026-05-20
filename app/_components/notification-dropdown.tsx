'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Bell, CheckCheck, BookOpen, MessageSquare, ClipboardList, Megaphone, Award, GraduationCap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ToastAction } from '@/components/ui/toast'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { notifications, getCurrentUser, type Notification } from '@/lib/api'

const typeIcon: Record<string, React.ReactNode> = {
  assignment:   <BookOpen className="w-4 h-4 text-blue-500" />,
  submission:   <ClipboardList className="w-4 h-4 text-purple-500" />,
  exam_result:  <Award className="w-4 h-4 text-amber-500" />,
  message:      <MessageSquare className="w-4 h-4 text-green-500" />,
  announcement: <Megaphone className="w-4 h-4 text-orange-500" />,
  enrollment:   <GraduationCap className="w-4 h-4 text-teal-500" />,
  schedule:     <Bell className="w-4 h-4 text-indigo-500" />,
}

const typeBg: Record<string, string> = {
  assignment:   'bg-blue-50 border-blue-100',
  submission:   'bg-purple-50 border-purple-100',
  exam_result:  'bg-amber-50 border-amber-100',
  message:      'bg-green-50 border-green-100',
  announcement: 'bg-orange-50 border-orange-100',
  enrollment:   'bg-teal-50 border-teal-100',
  schedule:     'bg-indigo-50 border-indigo-100',
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function playNotificationSound() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new AudioCtx()

    const playTone = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, start)
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.3, start + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration)
      osc.start(start)
      osc.stop(start + duration)
    }

    playTone(880, ctx.currentTime, 0.18)
    playTone(1100, ctx.currentTime + 0.2, 0.28)

    setTimeout(() => ctx.close(), 1200)
  } catch {
    // AudioContext not available — silently skip
  }
}

export function NotificationDropdown() {
  const router = useRouter()
  const { toast } = useToast()

  const [list, setList] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)

  const currentUser = getCurrentUser()
  const allNotificationsHref = currentUser?.role === 'student' ? '/student/notifications' : '/notifications'

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Initial load from REST
  const fetchNotifications = useCallback(async () => {
    try {
      const [notifs, countData] = await Promise.all([
        notifications.list(),
        notifications.unreadCount(),
      ])
      setList(notifs)
      setUnread(countData.count)
    } catch {}
  }, [])

  // Handle an incoming WS notification — prepend to list, no re-fetch needed
  const handleWsNotification = useCallback((data: {
    event: string; id: number; type: string; title: string;
    body?: string; link?: string; is_read: boolean; created_at: string;
  }) => {
    if (data.event !== 'notification') return
    const newNotif: Notification = {
      id: data.id, type: data.type, title: data.title,
      body: data.body ?? null, link: data.link ?? null,
      is_read: false,
      created_at: data.created_at ?? new Date().toISOString(),
    }
    setList((prev) => [newNotif, ...prev])
    setUnread((c) => c + 1)
    playNotificationSound()
    toast({
      title: data.title,
      description: data.body ?? undefined,
      duration: 6000,
      action: data.link
        ? <ToastAction altText="Open" onClick={() => router.push(data.link!)}>Open</ToastAction>
        : undefined,
    })
  }, [toast])

  // Connect WebSocket for real-time delivery
  const connectWs = useCallback(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    if (!token) return

    // Don't attempt connection with an expired token — avoids infinite 403 loop
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      if (payload.exp && payload.exp < Date.now() / 1000) return
    } catch {
      return
    }

    const wsBase = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000')
      .replace(/^https/, 'wss').replace(/^http/, 'ws')
    const ws = new WebSocket(`${wsBase}/ws/notifications?token=${token}`)
    wsRef.current = ws

    ws.onmessage = (e) => {
      try { handleWsNotification(JSON.parse(e.data)) } catch {}
    }

    // Keepalive ping every 25s to prevent idle disconnects
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send('ping')
    }, 25000)

    ws.onclose = (event) => {
      clearInterval(pingInterval)
      // Only reconnect for unexpected drops — not auth failures (1006 = abnormal, e.g. 403)
      const currentToken = localStorage.getItem('token')
      if (!currentToken) return
      try {
        const payload = JSON.parse(atob(currentToken.split('.')[1]))
        if (payload.exp && payload.exp < Date.now() / 1000) return
      } catch {
        return
      }
      reconnectTimer.current = setTimeout(connectWs, 5000)
    }

    ws.onerror = () => ws.close()

    return () => {
      clearInterval(pingInterval)
      ws.close()
    }
  }, [handleWsNotification])

  useEffect(() => {
    fetchNotifications()
    const cleanup = connectWs()
    return () => {
      cleanup?.()
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
    }
  }, [fetchNotifications, connectWs])

  const handleClick = async (n: Notification) => {
    if (!n.is_read) {
      await notifications.markRead(n.id).catch(() => {})
      setList((prev) => prev.map((x) => x.id === n.id ? { ...x, is_read: true } : x))
      setUnread((c) => Math.max(0, c - 1))
    }
    setOpen(false)
    if (n.link) router.push(n.link)
  }

  const handleMarkAll = async () => {
    await notifications.markAllRead().catch(() => {})
    setList((prev) => prev.map((x) => ({ ...x, is_read: true })))
    setUnread(0)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative shrink-0">
          <Bell className="w-5 h-5" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0" sideOffset={8}>
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <p className="text-sm font-semibold">Notifications</p>
            {unread > 0 && (
              <p className="text-xs text-muted-foreground">{unread} unread</p>
            )}
          </div>
          {unread > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={handleMarkAll}>
              <CheckCheck className="w-3.5 h-3.5" />
              Mark all read
            </Button>
          )}
        </div>

        {/* List */}
        <div className="max-h-[420px] overflow-y-auto">
          {list.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Bell className="w-8 h-8 mb-2 opacity-20" />
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            list.map((n) => (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={cn(
                  'w-full flex gap-3 px-4 py-3 text-left border-b last:border-0 transition-colors hover:bg-muted/50',
                  !n.is_read && 'bg-muted/30'
                )}
              >
                <div className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border',
                  typeBg[n.type] ?? 'bg-muted border-border'
                )}>
                  {typeIcon[n.type] ?? <Bell className="w-4 h-4" />}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-1">
                    <p className={cn('text-sm leading-snug', !n.is_read && 'font-medium')}>
                      {n.title}
                    </p>
                    {!n.is_read && (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                    )}
                  </div>
                  {n.body && (
                    <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{n.body}</p>
                  )}
                  <p className="mt-1 text-[11px] text-muted-foreground">{timeAgo(n.created_at)}</p>
                </div>
              </button>
            ))
          )}
        </div>

        <div className="border-t px-4 py-2.5">
          <Link
            href={allNotificationsHref}
            onClick={() => setOpen(false)}
            className="block w-full text-center text-xs font-medium text-primary hover:underline py-0.5"
          >
            View all notifications
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  )
}
