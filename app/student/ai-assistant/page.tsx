'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Send, BookOpen, Loader2, Bot, User,
  ArrowLeft, Sparkles, ChevronRight, MessageCircle,
} from 'lucide-react'
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
  'Summarise the key points',
  'What are the main topics?',
  'Explain the most important concepts',
  'Give me a study guide',
  'List definitions I should know',
]

/* Defined outside the page component so React never recreates it */
function CourseAvatar({ name }: { name: string }) {
  const initials = name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
  return (
    <div className="h-11 w-11 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-sm font-bold">
      {initials || <BookOpen className="h-5 w-5" />}
    </div>
  )
}

export default function AIAssistantPage() {
  const [classes, setClasses]               = useState<AIClass[]>([])
  const [loadingClasses, setLoadingClasses] = useState(true)
  const [selected, setSelected]             = useState<AIClass | null>(null)
  const [history, setHistory]               = useState<ChatMessage[]>([])
  const [input, setInput]                   = useState('')
  const [sending, setSending]               = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [error, setError]                   = useState('')
  const [suggestions, setSuggestions]       = useState<string[]>([])
  const bottomRef   = useRef<HTMLDivElement>(null)
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
    setSuggestions([])
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
    setSuggestions([])
    setHistory(h => [...h, { role: 'user', content: msg }])
    setSending(true)
    try {
      const res = await apiFetch(`/api/ai/chat/${selected.id}`, {
        method: 'POST',
        body: JSON.stringify({ message: msg }),
      })
      setHistory(h => [...h, { role: 'assistant', content: res.reply }])
      setSuggestions(res.suggestions ?? [])
    } catch (e: any) {
      setError(e.message || 'Failed to get a response. Please try again.')
      setHistory(h => h.slice(0, -1))
      setInput(msg)
    } finally {
      setSending(false)
      setTimeout(() => textareaRef.current?.focus(), 50)
    }
  }

  const withMaterials    = classes.filter(c => c.has_materials)
  const withoutMaterials = classes.filter(c => !c.has_materials)

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">

      {/* ── Course list sidebar ──────────────────────────────────────── */}
      <div className={cn(
        'flex-col border-r w-full md:w-72 lg:w-80 shrink-0 bg-background',
        selected ? 'hidden md:flex' : 'flex',
      )}>
        {/* Header */}
        <div className="bg-primary text-primary-foreground px-4 pt-5 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary-foreground/20 flex items-center justify-center">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-bold text-base leading-tight">AI Study Assistant</h1>
              <p className="text-xs text-primary-foreground/70 mt-0.5">Powered by your course materials</p>
            </div>
          </div>
        </div>

        <div className="px-4 py-2.5 border-b bg-muted/40">
          <p className="text-xs text-muted-foreground font-medium">
            {withMaterials.length} course{withMaterials.length !== 1 ? 's' : ''} ready to chat
          </p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadingClasses ? (
            <div className="flex justify-center pt-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : classes.length === 0 ? (
            <div className="flex flex-col items-center justify-center pt-16 text-center text-muted-foreground px-6 gap-3">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                <BookOpen className="h-8 w-8 opacity-40" />
              </div>
              <div>
                <p className="font-semibold text-sm">No courses yet</p>
                <p className="text-xs mt-1 leading-relaxed">
                  Enrol in a course first. Your lecturer then needs to upload PDF materials before the AI can help.
                </p>
              </div>
            </div>
          ) : (
            <>
              {withMaterials.map(cls => (
                <button
                  key={cls.id}
                  onClick={() => setSelected(cls)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3.5 border-b border-border/60 transition-colors active:bg-muted/80',
                    selected?.id === cls.id ? 'bg-primary/5' : 'hover:bg-muted/50',
                  )}
                >
                  <CourseAvatar name={cls.name} />
                  <div className="flex-1 min-w-0 text-left">
                    <p className="font-semibold text-sm truncate">
                      {cls.course_code ?? cls.name}
                    </p>
                    {cls.course_code && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{cls.name}</p>
                    )}
                    <p className="text-xs text-primary mt-0.5 font-medium">
                      {cls.pdf_count} material{cls.pdf_count !== 1 ? 's' : ''} · tap to chat
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                </button>
              ))}

              {withoutMaterials.length > 0 && (
                <>
                  <div className="px-4 py-2 bg-muted/30">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Waiting for materials
                    </p>
                  </div>
                  {withoutMaterials.map(cls => (
                    <div
                      key={cls.id}
                      className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-border/60 opacity-50"
                    >
                      <div className="h-11 w-11 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <BookOpen className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <p className="font-semibold text-sm truncate">{cls.course_code ?? cls.name}</p>
                        {cls.course_code && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{cls.name}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-0.5">Awaiting lecturer upload</p>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Chat area ────────────────────────────────────────────────── */}
      <div className={cn(
        'flex-col flex-1 min-w-0 bg-background',
        selected ? 'flex' : 'hidden md:flex',
      )}>
        {selected ? (
          <div className="flex flex-col h-full">

            {/* Chat header */}
            <div className="bg-primary text-primary-foreground px-4 py-3 flex items-center gap-3 shrink-0 shadow-sm">
              <button
                className="md:hidden -ml-1 h-8 w-8 rounded-full flex items-center justify-center hover:bg-primary-foreground/10 transition-colors"
                onClick={() => setSelected(null)}
                aria-label="Back to courses"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>

              <div className="h-9 w-9 rounded-full bg-primary-foreground/20 flex items-center justify-center shrink-0">
                <Bot className="h-4 w-4" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate leading-tight">
                  {selected.course_code ?? selected.name}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                  <p className="text-xs text-primary-foreground/75">AI · online</p>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-3 py-4 space-y-3 bg-muted/20">
              {loadingHistory ? (
                <div className="flex justify-center pt-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : history.length === 0 ? (
                <div className="flex flex-col items-center justify-center min-h-[60%] text-center gap-5 px-4 pt-6">
                  <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Sparkles className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <p className="font-bold text-base">Ask anything about</p>
                    <p className="font-bold text-base text-primary">{selected.name}</p>
                    <p className="text-xs text-muted-foreground mt-1.5">
                      Answers grounded in your lecturer's uploaded materials
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center max-w-xs">
                    {QUICK_PROMPTS.map(p => (
                      <button
                        key={p}
                        onClick={() => send(p)}
                        className="text-xs border border-border bg-background rounded-full px-3.5 py-1.5 hover:bg-muted transition-colors active:scale-95"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                history.map((msg, i) => (
                  <div
                    key={i}
                    className={cn('flex items-end gap-2', msg.role === 'user' ? 'justify-end' : 'justify-start')}
                  >
                    {msg.role === 'assistant' && (
                      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mb-0.5">
                        <Bot className="h-3.5 w-3.5 text-primary" />
                      </div>
                    )}
                    <div className={cn(
                      'max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap leading-relaxed shadow-sm',
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-sm'
                        : 'bg-background text-foreground rounded-bl-sm border border-border/60',
                    )}>
                      {msg.content}
                    </div>
                    {msg.role === 'user' && (
                      <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center shrink-0 mb-0.5">
                        <User className="h-3.5 w-3.5 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                ))
              )}

              {/* Typing indicator */}
              {sending && (
                <div className="flex items-end gap-2 justify-start">
                  <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mb-0.5">
                    <Bot className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="bg-background border border-border/60 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1.5 shadow-sm">
                    <span className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:0ms]" />
                    <span className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:150ms]" />
                    <span className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              )}

              {error && (
                <p className="text-center text-xs text-destructive bg-destructive/10 rounded-xl px-4 py-2.5 mx-2">
                  {error}
                </p>
              )}

              {/* Follow-up suggestion chips */}
              {!sending && suggestions.length > 0 && (
                <div className="flex flex-col gap-2 pl-9">
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                    Suggested follow-ups
                  </p>
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => send(s)}
                      className="text-left text-xs border border-primary/30 bg-primary/5 text-primary rounded-xl px-3.5 py-2 hover:bg-primary/10 transition-colors active:scale-[0.98] w-fit max-w-[85%]"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Input bar */}
            <div className="shrink-0 bg-background border-t border-border px-3 py-3">
              <div className="flex items-end gap-2">
                <div className="flex-1 flex items-end bg-muted rounded-2xl px-4 py-2 min-h-[44px] border border-border/60">
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={e => {
                      setInput(e.target.value)
                      e.target.style.height = 'auto'
                      e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        send()
                      }
                    }}
                    placeholder="Ask about your course materials…"
                    className="flex-1 bg-transparent resize-none text-sm outline-none placeholder:text-muted-foreground leading-relaxed w-full"
                    rows={1}
                    disabled={sending}
                    style={{ height: '24px', maxHeight: '120px' }}
                  />
                </div>

                <button
                  onClick={() => send()}
                  disabled={!input.trim() || sending}
                  className={cn(
                    'h-11 w-11 rounded-full flex items-center justify-center shrink-0 transition-all',
                    input.trim() && !sending
                      ? 'bg-primary text-primary-foreground shadow-md active:scale-95'
                      : 'bg-muted text-muted-foreground cursor-not-allowed',
                  )}
                  aria-label="Send message"
                >
                  {sending
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Send className="h-4 w-4" />
                  }
                </button>
              </div>

              <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
                {selected.pdf_count} PDF{selected.pdf_count !== 1 ? 's' : ''} loaded · answers based on course materials only
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground gap-4 px-8">
            <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center">
              <MessageCircle className="h-8 w-8 opacity-30" />
            </div>
            <div>
              <p className="font-semibold">Select a course</p>
              <p className="text-sm mt-1">Pick a course from the sidebar to start chatting with the AI</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
