'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bell, CheckCheck, BookOpen, MessageSquare, ClipboardList,
  Megaphone, Award, Loader2, CheckCircle2,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageContainer } from '@/app/_components/page-container'
import { cn } from '@/lib/utils'
import { notifications, type Notification } from '@/lib/api'

const typeIcon: Record<string, React.ReactNode> = {
  assignment:   <BookOpen className="w-5 h-5 text-blue-500" />,
  submission:   <ClipboardList className="w-5 h-5 text-purple-500" />,
  exam_result:  <Award className="w-5 h-5 text-amber-500" />,
  message:      <MessageSquare className="w-5 h-5 text-green-500" />,
  announcement: <Megaphone className="w-5 h-5 text-orange-500" />,
}

const typeBg: Record<string, string> = {
  assignment:   'bg-blue-50 border-blue-100 dark:bg-blue-950/30 dark:border-blue-900',
  submission:   'bg-purple-50 border-purple-100 dark:bg-purple-950/30 dark:border-purple-900',
  exam_result:  'bg-amber-50 border-amber-100 dark:bg-amber-950/30 dark:border-amber-900',
  message:      'bg-green-50 border-green-100 dark:bg-green-950/30 dark:border-green-900',
  announcement: 'bg-orange-50 border-orange-100 dark:bg-orange-950/30 dark:border-orange-900',
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  const diffDays = Math.floor((Date.now() - d.getTime()) / 86400000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return d.toLocaleDateString('en-GB', { weekday: 'long' })
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return new Date(dateStr).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function groupByDate(list: Notification[]) {
  const groups: { label: string; items: Notification[] }[] = []
  const seen = new Map<string, number>()
  for (const n of list) {
    const label = formatDate(n.created_at)
    if (seen.has(label)) {
      groups[seen.get(label)!].items.push(n)
    } else {
      seen.set(label, groups.length)
      groups.push({ label, items: [n] })
    }
  }
  return groups
}

export function NotificationsPageContent() {
  const router = useRouter()
  const [list, setList] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [markingAll, setMarkingAll] = useState(false)

  const unreadCount = list.filter((n) => !n.is_read).length

  const load = useCallback(() => {
    notifications.list().then(setList).catch(() => {}).finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const handleClick = async (n: Notification) => {
    if (!n.is_read) {
      await notifications.markRead(n.id).catch(() => {})
      setList((prev) => prev.map((x) => x.id === n.id ? { ...x, is_read: true } : x))
    }
    if (n.link) router.push(n.link)
  }

  const handleMarkAll = async () => {
    setMarkingAll(true)
    await notifications.markAllRead().catch(() => {})
    setList((prev) => prev.map((x) => ({ ...x, is_read: true })))
    setMarkingAll(false)
  }

  const groups = groupByDate(list)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <PageContainer>
      <div className="max-w-2xl space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Bell className="w-6 h-6 text-primary" />
              Notifications
            </h1>
            {unreadCount > 0 && (
              <p className="text-sm text-muted-foreground mt-0.5">
                {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
              </p>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAll}
              disabled={markingAll}
              className="gap-1.5"
            >
              {markingAll
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <CheckCheck className="w-3.5 h-3.5" />
              }
              Mark all read
            </Button>
          )}
        </div>

        {/* Empty state */}
        {list.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
                <Bell className="w-8 h-8 opacity-40" />
              </div>
              <p className="text-base font-medium">All caught up!</p>
              <p className="text-sm mt-1">You have no notifications yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {groups.map((group) => (
              <div key={group.label} className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {group.label}
                  </span>
                  <div className="flex-1 h-px bg-border" />
                  {group.label === 'Today' && group.items.some((n) => !n.is_read) && (
                    <Badge variant="secondary" className="text-[10px]">
                      {group.items.filter((n) => !n.is_read).length} new
                    </Badge>
                  )}
                </div>

                <Card className="overflow-hidden p-0">
                  {group.items.map((n, i) => (
                    <button
                      key={n.id}
                      onClick={() => handleClick(n)}
                      className={cn(
                        'w-full flex gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/50',
                        i !== group.items.length - 1 && 'border-b border-border',
                        !n.is_read && 'bg-muted/30'
                      )}
                    >
                      <div className={cn(
                        'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border',
                        typeBg[n.type] ?? 'bg-muted border-border'
                      )}>
                        {typeIcon[n.type] ?? <Bell className="w-5 h-5" />}
                      </div>

                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex items-start justify-between gap-2">
                          <p className={cn(
                            'text-sm leading-snug',
                            !n.is_read ? 'font-semibold' : 'font-medium text-muted-foreground'
                          )}>
                            {n.title}
                          </p>
                          <span className="text-[11px] text-muted-foreground shrink-0 mt-0.5">
                            {timeAgo(n.created_at)}
                          </span>
                        </div>
                        {n.body && (
                          <p className="text-xs text-muted-foreground line-clamp-2">{n.body}</p>
                        )}
                        {n.link && (
                          <p className="text-[11px] text-primary font-medium mt-1">Tap to view →</p>
                        )}
                      </div>

                      {!n.is_read ? (
                        <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />
                      ) : (
                        <CheckCircle2 className="mt-2 w-4 h-4 shrink-0 text-muted-foreground/30" />
                      )}
                    </button>
                  ))}
                </Card>
              </div>
            ))}
          </div>
        )}

      </div>
    </PageContainer>
  )
}
