'use client'

import { useState, useEffect, useRef } from 'react'
import { Send, Trash2, BookOpen, Loader2, Bot, User, ArrowLeft, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers as Record<string, string> || {}),
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }))
    throw new Error(typeof err.detail === 'string' ? err.detail : 'Request failed')
  }
  if (res.status === 204) return undefined
  return res.json()
}

interface AIClass {
  id: number
  name: string
  course_code: string | null
  pdf_count: number
  has_materials: boolean
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  created_at?: string
}

const QUICK_PROMPTS = [
  'Summarize the key points',
  'What are the main topics covered?',
  'Explain the most important concepts',
  'Give me a study guide for this material',
]

export default function AIAssistantPage() {
  const [classes, setClasses]         = useState<AIClass[]>([])
  const [loadingClasses, setLoadingClasses] = useState(true)
  const [selected, setSelected]       = useState<AIClass | null>(null)
  const [history, setHistory]         = useState<ChatMessage[]>([])
  const [input, setInput]             = useState('')
  const [sending, setSending]         = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [error, setError]             = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    apiFetch('/api/ai/classes')
      .then(setClasses)
      .catch(() => {})
      .finally(() => setLoadingClasses(false))
  }, [])

  useEffect(() => {
    if (!selected) return
    setLoadingHistory(true)
    setHistory([])
    setError('')
    apiFetch(`/api/ai/history/${selected.id}`)
      .then(setHistory)
      .catch(() => {})
      .finally(() => setLoadingHistory(false))
  }, [selected])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history, sending])

  const send = async (text?: string) => {
    const msg = (text ?? input).trim()
    if (!msg || !selected || sending) return
    setInput('')
    setError('')
    setHistory(h => [...h, { role: 'user', content: msg }])
    setSending(true)
    try {
      const res = await apiFetch(`/api/ai/chat/${selected.id}`, {
        method: 'POST',
        body: JSON.stringify({ message: msg }),
      })
      setHistory(h => [...h, { role: 'assistant', content: res.reply }])
    } catch (e: any) {
      setError(e.message || 'Failed to get a response. Please try again.')
      setHistory(h => h.slice(0, -1))
      setInput(msg)
    } finally {
      setSending(false)
      textareaRef.current?.focus()
    }
  }

  const clearHistory = async () => {
    if (!selected) return
    await apiFetch(`/api/ai/history/${selected.id}`, { method: 'DELETE' }).catch(() => {})
    setHistory([])
    setError('')
  }

  const withMaterials = classes.filter(c => c.has_materials)
  const withoutMaterials = classes.filter(c => !c.has_materials)

  // ── Course list panel ──────────────────────────────────────────────────────
  const CourseList = () => (
    <div className="flex flex-col h-full">
      <div className="px-4 py-5 border-b">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="h-5 w-5 text-primary" />
          <h1 className="font-semibold text-base">AI Study Assistant</h1>
        </div>
        <p className="text-xs text-muted-foreground">
          Select a course to chat with AI about your lecture materials
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
        {loadingClasses ? (
          <div className="flex justify-center pt-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : classes.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-12 text-center text-muted-foreground px-4 gap-2">
            <BookOpen className="h-10 w-10 opacity-30" />
            <p className="font-medium text-sm">No courses yet</p>
            <p className="text-xs">Enroll in a course first, then your lecturer needs to upload PDF materials before the AI can help.</p>
          </div>
        ) : (
          <>
            {withMaterials.length > 0 && (
              <>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-2 pt-1 pb-0.5">
                  Ready to chat
                </p>
                {withMaterials.map(cls => (
                  <button
                    key={cls.id}
                    onClick={() => setSelected(cls)}
                    className={cn(
                      'w-full text-left rounded-lg px-3 py-2.5 transition-colors group',
                      selected?.id === cls.id
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted',
                    )}
                  >
                    <p className={cn('font-medium text-sm truncate', selected?.id === cls.id ? 'text-primary-foreground' : '')}>
                      {cls.course_code ? `${cls.course_code} — ` : ''}{cls.name}
                    </p>
                    <p className={cn('text-xs mt-0.5', selected?.id === cls.id ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
                      {cls.pdf_count} material{cls.pdf_count !== 1 ? 's' : ''} available
                    </p>
                  </button>
                ))}
              </>
            )}

            {withoutMaterials.length > 0 && (
              <>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-2 pt-3 pb-0.5">
                  No materials yet
                </p>
                {withoutMaterials.map(cls => (
                  <div
                    key={cls.id}
                    className="w-full text-left rounded-lg px-3 py-2.5 opacity-50 cursor-not-allowed"
                  >
                    <p className="font-medium text-sm truncate">
                      {cls.course_code ? `${cls.course_code} — ` : ''}{cls.name}
                    </p>
                    <p className="text-xs mt-0.5 text-muted-foreground">Waiting for lecturer to upload PDFs</p>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )

  // ── Chat panel ─────────────────────────────────────────────────────────────
  const ChatPanel = () => (
    <div className="flex flex-col h-full">
      {/* Chat header */}
      <div className="border-b px-4 py-3 flex items-center gap-3 shrink-0">
        {/* Back button — mobile only */}
        <button
          className="md:hidden -ml-1 p-1 rounded-md hover:bg-muted"
          onClick={() => setSelected(null)}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Bot className="h-4 w-4 text-primary" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">
            {selected?.course_code ? `${selected.course_code} — ` : ''}{selected?.name}
          </p>
          <p className="text-xs text-muted-foreground">AI Study Assistant</p>
        </div>

        {history.length > 0 && (
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={clearHistory}>
            <Trash2 className="h-4 w-4 text-muted-foreground" />
          </Button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {loadingHistory ? (
          <div className="flex justify-center pt-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : history.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-4 px-4">
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-7 w-7 text-primary" />
            </div>
            <div>
              <p className="font-semibold">Ask anything about {selected?.name}</p>
              <p className="text-sm text-muted-foreground mt-1">
                Based on your lecturer's uploaded materials
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-sm mt-2">
              {QUICK_PROMPTS.map(p => (
                <button
                  key={p}
                  onClick={() => send(p)}
                  className="text-xs text-left border rounded-xl px-3 py-2.5 hover:bg-muted transition-colors"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        ) : (
          history.map((msg, i) => (
            <div key={i} className={cn('flex gap-2.5', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
              {msg.role === 'assistant' && (
                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="h-3.5 w-3.5 text-primary" />
                </div>
              )}
              <div className={cn(
                'max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed',
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground rounded-br-sm'
                  : 'bg-muted rounded-bl-sm',
              )}>
                {msg.content}
              </div>
              {msg.role === 'user' && (
                <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center shrink-0 mt-0.5">
                  <User className="h-3.5 w-3.5 text-primary-foreground" />
                </div>
              )}
            </div>
          ))
        )}

        {sending && (
          <div className="flex gap-2.5 justify-start">
            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Bot className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:0ms]" />
              <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:150ms]" />
              <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        )}

        {error && (
          <p className="text-center text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-2">{error}</p>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t px-4 py-3 shrink-0 bg-background">
        <div className="flex gap-2 items-end">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            placeholder="Ask a question… (Enter to send)"
            className="min-h-[44px] max-h-32 resize-none text-sm"
            rows={1}
            disabled={sending}
          />
          <Button
            size="icon"
            className="shrink-0 h-11 w-11"
            onClick={() => send()}
            disabled={!input.trim() || sending}
          >
            {sending
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Send className="h-4 w-4" />
            }
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
          Answers based on course materials only · {selected?.pdf_count ?? 0} PDF{(selected?.pdf_count ?? 0) !== 1 ? 's' : ''}
        </p>
      </div>
    </div>
  )

  return (
    // ── Desktop: two-column layout ─────────────────────────────────────────
    // ── Mobile: show course list OR chat (not both)  ───────────────────────
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">

      {/* Sidebar — always visible on desktop, hidden on mobile when chat is open */}
      <div className={cn(
        'flex-col border-r w-full md:w-72 lg:w-80 shrink-0',
        selected ? 'hidden md:flex' : 'flex',
      )}>
        <CourseList />
      </div>

      {/* Chat area — hidden on mobile when no course selected */}
      <div className={cn(
        'flex-col flex-1 min-w-0',
        selected ? 'flex' : 'hidden md:flex',
      )}>
        {selected ? (
          <ChatPanel />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground gap-3 px-8">
            <Sparkles className="h-12 w-12 opacity-20" />
            <div>
              <p className="font-semibold">Select a course</p>
              <p className="text-sm mt-1">Pick a course from the left to start chatting with the AI</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
