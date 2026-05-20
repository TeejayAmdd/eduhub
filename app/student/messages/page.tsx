'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Send, Search, MessageSquare, Loader2, ChevronLeft,
  SquarePen, X, UserSearch,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { messages, users, type Message, type Contact, type MessageThread } from '@/lib/api'

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

function threadToContact(t: MessageThread): Contact {
  return {
    id: t.contact_id,
    name: t.contact_name,
    email: t.contact_email,
    role: t.contact_role,
    matric_number: t.matric_number,
    staff_number: t.staff_number,
    department: t.department,
  }
}

export default function StudentMessagesPage() {
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

  // Compose dialog state
  const [composeOpen, setComposeOpen]       = useState(false)
  const [composeQuery, setComposeQuery]     = useState('')
  const [composeResults, setComposeResults] = useState<Contact[]>([])
  const [composeLoading, setComposeLoading] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const composeRef = useRef<HTMLInputElement>(null)

  const refreshThreads = useCallback(() =>
    messages.threads().then(setThreads).catch(console.error), [])

  useEffect(() => {
    const id = localStorage.getItem('userId')
    if (id) setMyId(Number(id))
    const openId = new URLSearchParams(window.location.search).get('open')
    if (openId) setPendingOpenId(Number(openId))
    refreshThreads().finally(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-open conversation from URL param once threads have loaded
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
    messages.conversation(selected.id).then(setConversation).catch(console.error)
  }, [selected])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversation])

  // Debounced compose search
  useEffect(() => {
    if (composeQuery.length < 2) { setComposeResults([]); return }
    const timer = setTimeout(() => {
      setComposeLoading(true)
      users.search(composeQuery)
        .then(setComposeResults)
        .catch(console.error)
        .finally(() => setComposeLoading(false))
    }, 300)
    return () => clearTimeout(timer)
  }, [composeQuery])

  useEffect(() => {
    if (composeOpen) setTimeout(() => composeRef.current?.focus(), 50)
    else { setComposeQuery(''); setComposeResults([]) }
  }, [composeOpen])

  const handleSend = async () => {
    if (!input.trim() || !selected || sending) return
    setSending(true)
    try {
      const msg = await messages.send(selected.id, input.trim())
      setConversation((prev) => [...prev, msg])
      setInput('')
      refreshThreads()
    } catch (err) {
      console.error(err)
    } finally {
      setSending(false)
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
    messages.conversation(t.contact_id).then((msgs) => {
      msgs.filter((m) => m.sender_id === t.contact_id && !m.read_at)
        .forEach((m) => messages.markRead(m.id).catch(() => {}))
    })
  }

  const handleSelectCompose = (c: Contact) => {
    setComposeOpen(false)
    openChat(c)
  }

  const filtered = threads.filter((t) => {
    const q = query.toLowerCase()
    return (
      t.contact_name.toLowerCase().includes(q) ||
      (t.staff_number ?? '').toLowerCase().includes(q) ||
      (t.contact_email ?? '').toLowerCase().includes(q)
    )
  })

  const totalUnread = threads.reduce((s, t) => s + t.unread_count, 0)

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex h-full bg-background overflow-hidden">

      {/* ── Threads sidebar ──────────────────────────────────────────────────── */}
      <div className={cn(
        'shrink-0 border-r border-border flex-col',
        'w-full md:w-64',
        mobileView === 'chat' ? 'hidden md:flex' : 'flex',
      )}>
        <div className="p-4 border-b border-border space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold">Messages</h1>
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
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Filter conversations…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          {threads.length === 0 ? (
            <div className="py-12 px-4 text-center text-sm text-muted-foreground space-y-3">
              <MessageSquare className="w-10 h-10 mx-auto opacity-20" />
              <p>No conversations yet.</p>
              <button
                onClick={() => setComposeOpen(true)}
                className="text-primary hover:underline text-sm font-medium"
              >
                Message a lecturer ↗
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No results</p>
          ) : filtered.map((t) => (
            <button
              key={t.contact_id}
              onClick={() => handleSelectThread(t)}
              className={cn(
                'w-full flex items-start gap-3 px-4 py-3.5 text-left border-b border-border hover:bg-muted/50 transition-colors',
                selected?.id === t.contact_id && 'bg-muted'
              )}
            >
              <Avatar className="h-10 w-10 shrink-0 mt-0.5">
                <AvatarFallback className="text-xs font-semibold">{initials(t.contact_name)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className={cn('text-sm truncate', t.unread_count > 0 ? 'font-semibold text-foreground' : 'text-foreground/80')}>
                    {t.contact_name}
                  </span>
                  {t.last_message_at && (
                    <span className="text-[10px] text-muted-foreground shrink-0">{formatTime(t.last_message_at)}</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {t.staff_number ?? t.department ?? 'Lecturer'}
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

      {/* ── Chat panel ───────────────────────────────────────────────────────── */}
      <div className={cn(
        'flex-col min-w-0 flex-1',
        mobileView === 'list' ? 'hidden md:flex' : 'flex',
      )}>
        {selected ? (
          <>
            <div className="flex items-center gap-3 px-4 md:px-6 py-3.5 border-b border-border shrink-0">
              <button
                onClick={() => setMobileView('list')}
                className="md:hidden p-1 -ml-1 rounded-lg hover:bg-muted transition-colors"
                aria-label="Back to conversations"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <Avatar className="h-9 w-9">
                <AvatarFallback className="text-xs font-semibold">{initials(selected.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{selected.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {selected.staff_number ?? selected.department ?? 'Lecturer'}
                </p>
              </div>
            </div>

            <ScrollArea className="flex-1 px-4 md:px-6 py-4">
              {conversation.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-16 text-muted-foreground">
                  <MessageSquare className="w-10 h-10 mb-3 opacity-20" />
                  <p className="text-sm">No messages yet. Ask your lecturer anything.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {conversation.map((m) => {
                    const mine = m.sender_id === myId
                    return (
                      <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                        <div className={cn(
                          'max-w-[78%] md:max-w-sm px-4 py-2.5 rounded-2xl text-sm',
                          mine ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-muted rounded-bl-sm'
                        )}>
                          {m.subject && <p className="font-medium text-xs mb-1 opacity-70">{m.subject}</p>}
                          <p className="leading-relaxed">{m.body}</p>
                          <p className={cn('text-[10px] mt-1.5', mine ? 'text-primary-foreground/60' : 'text-muted-foreground')}>
                            {formatTime(m.sent_at)}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                  <div ref={bottomRef} />
                </div>
              )}
            </ScrollArea>

            <div className="flex items-center gap-2 px-4 py-3 border-t border-border shrink-0">
              <Input
                placeholder={`Message ${selected.name}…`}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                className="flex-1 h-10"
              />
              <Button
                size="icon"
                className="h-10 w-10 shrink-0"
                onClick={handleSend}
                disabled={!input.trim() || sending}
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground gap-4">
            <MessageSquare className="w-14 h-14 opacity-10" />
            <div className="text-center space-y-1">
              <p className="text-sm font-medium">Select a conversation</p>
              <p className="text-xs">or message a lecturer</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setComposeOpen(true)}>
              <SquarePen className="w-4 h-4 mr-2" />
              New Message
            </Button>
          </div>
        )}
      </div>

      {/* ── Compose modal ────────────────────────────────────────────────────── */}
      {composeOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4">
          <div className="fixed inset-0 bg-black/40" onClick={() => setComposeOpen(false)} />
          <div className="relative z-10 w-full max-w-md rounded-2xl border bg-background shadow-xl overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border">
              <UserSearch className="w-4 h-4 text-muted-foreground shrink-0" />
              <Input
                ref={composeRef}
                placeholder="Search by lecturer name or staff number…"
                value={composeQuery}
                onChange={(e) => setComposeQuery(e.target.value)}
                className="flex-1 border-0 shadow-none focus-visible:ring-0 px-0 h-8 text-sm"
              />
              {composeLoading
                ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground shrink-0" />
                : <button onClick={() => setComposeOpen(false)} className="p-0.5 rounded hover:bg-muted">
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
              }
            </div>

            <div className="max-h-72 overflow-y-auto">
              {composeQuery.length < 2 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Type at least 2 characters to search
                </p>
              ) : composeResults.length === 0 && !composeLoading ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No lecturers found</p>
              ) : composeResults.map((c) => (
                <button
                  key={c.id}
                  onClick={() => handleSelectCompose(c)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/60 transition-colors text-left border-b border-border last:border-0"
                >
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarFallback className="text-xs font-semibold">{initials(c.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {c.staff_number ?? c.department ?? 'Lecturer'}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
