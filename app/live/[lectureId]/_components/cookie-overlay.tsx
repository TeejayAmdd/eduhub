'use client'

import { useEffect, useRef, useState } from 'react'
import { Hand, CheckCircle2, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { cookies as cookiesApi } from '@/lib/api'

interface PendingCookie {
  id: number
  expiresAt: number  // timestamp ms
}

interface CookieOverlayProps {
  sessionId: number
  token: string
}

export function CookieOverlay({ sessionId, token }: CookieOverlayProps) {
  const [pending, setPending] = useState<PendingCookie | null>(null)
  const [clicked, setClicked] = useState(false)
  const [expired, setExpired] = useState(false)
  const [timeLeft, setTimeLeft] = useState(0)
  const [total, setTotal] = useState(0)
  const [clicked_count, setClickedCount] = useState(0)
  const wsRef = useRef<WebSocket | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const wsBase = process.env.NEXT_PUBLIC_API_URL?.replace(/^http/, 'ws') || 'ws://localhost:8000'
    const ws = new WebSocket(`${wsBase}/ws/session/${sessionId}?token=${token}`)
    wsRef.current = ws

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.type === 'cookie') {
          const expiresAt = Date.now() + (msg.expires_in ?? 15) * 1000
          setPending({ id: msg.cookie_id, expiresAt })
          setClicked(false)
          setExpired(false)
          setTimeLeft(msg.expires_in ?? 15)
          setTotal((t) => t + 1)
        }
        if (msg.type === 'session_end') {
          ws.close()
        }
      } catch {}
    }

    ws.onerror = () => {}
    return () => { ws.close() }
  }, [sessionId, token])

  // Countdown tick
  useEffect(() => {
    if (!pending || clicked || expired) {
      if (timerRef.current) clearInterval(timerRef.current)
      return
    }
    timerRef.current = setInterval(() => {
      const left = Math.max(0, Math.ceil((pending.expiresAt - Date.now()) / 1000))
      setTimeLeft(left)
      if (left === 0) {
        setExpired(true)
        clearInterval(timerRef.current!)
        // Auto-hide after 2 s
        setTimeout(() => setPending(null), 2000)
      }
    }, 250)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [pending, clicked, expired])

  const handleClick = async () => {
    if (!pending || clicked || expired) return
    setClicked(true)
    setClickedCount((c) => c + 1)
    try {
      await cookiesApi.click(pending.id)
    } catch {}
    setTimeout(() => setPending(null), 1500)
  }

  return (
    <>
      {/* Score badge — always visible during lecture */}
      {total > 0 && (
        <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
          <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
          {clicked_count}/{total} checks
        </div>
      )}

      {/* Cookie popup */}
      {pending && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-3 animate-bounce-in">
          <div className={cn(
            'relative flex flex-col items-center gap-3 rounded-2xl px-8 py-6 shadow-2xl text-white text-center',
            'bg-gradient-to-br from-orange-500 to-amber-500',
            clicked && 'from-green-500 to-emerald-500',
            expired && 'from-gray-600 to-gray-700 opacity-70',
          )}>
            {/* Countdown ring */}
            {!clicked && !expired && (
              <div className="flex items-center gap-1.5 text-white/80 text-xs font-medium">
                <Clock className="w-3.5 h-3.5" />
                {timeLeft}s
              </div>
            )}

            <div className="text-4xl">{clicked ? '✅' : expired ? '⏱️' : '🍪'}</div>

            <p className="text-sm font-semibold">
              {clicked ? 'Attendance recorded!' : expired ? 'Too slow!' : 'Tap to mark attendance!'}
            </p>

            {!clicked && !expired && (
              <Button
                onClick={handleClick}
                size="lg"
                className="bg-white text-orange-600 hover:bg-white/90 font-bold shadow-lg gap-2"
              >
                <Hand className="w-4 h-4" />
                I'm Here!
              </Button>
            )}
          </div>
        </div>
      )}
    </>
  )
}
