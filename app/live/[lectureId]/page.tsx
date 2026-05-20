'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Loader2, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { lectures, users, getCurrentUser, type Lecture, type UserProfile } from '@/lib/api'
import { JitsiEmbed } from './_components/jitsi-embed'
import { CookieOverlay } from './_components/cookie-overlay'

interface JaasToken {
  token: string
  app_id: string
  room_name: string
}

export default function LiveLecturePage() {
  const { lectureId } = useParams<{ lectureId: string }>()
  const router = useRouter()

  const [lecture, setLecture]     = useState<Lecture | null>(null)
  const [profile, setProfile]     = useState<UserProfile | null>(null)
  const [jaas, setJaas]           = useState<JaasToken | null>(null)
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [jwtToken, setJwtToken]   = useState('')
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')

  const currentUser = getCurrentUser()

  useEffect(() => {
    const id = Number(lectureId)
    Promise.all([
      lectures.list().then((all) => all.find((l) => l.id === id)),
      users.me(),
    ])
      .then(async ([lec, me]) => {
        if (!lec)                  { setError('Lecture not found.');                  return }
        if (lec.status !== 'live') { setError('This lecture is not currently live.'); return }
        if (!lec.jitsi_room)       { setError('No virtual room configured.');         return }
        setLecture(lec)
        setProfile(me)

        // Get JWT token for WebSocket authentication (students only)
        if (getCurrentUser()?.role === 'student') {
          const token = localStorage.getItem('token') ?? ''
          setJwtToken(token)
          lectures.session(id)
            .then(({ session_id }) => setSessionId(session_id))
            .catch(() => {/* no active session — cookies won't show */})
        }

        // Fetch JaaS JWT — this identifies the user as moderator (lecturer) or guest (student)
        try {
          const tokenData = await lectures.jitsiToken(id)
          setJaas(tokenData)
        } catch {
          // Token fetch failed — fall back to unauthenticated room (may show moderator prompt)
          setJaas(null)
        }
      })
      .catch(() => setError('Failed to load lecture.'))
      .finally(() => setLoading(false))
  }, [lectureId])

  const handleLeave = () => {
    if (currentUser?.role === 'student') {
      router.push('/student/courses')
    } else {
      if (lecture) lectures.end(lecture.id).catch(console.error)
      router.push(`/class-preparation/${lecture?.class_id}`)
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950">
        <Loader2 className="w-8 h-8 animate-spin text-white/60" />
      </div>
    )
  }

  if (error || !lecture || !lecture.jitsi_room) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-gray-950 text-white">
        <p className="text-lg font-medium">{error || 'Something went wrong.'}</p>
        <Button
          variant="outline"
          onClick={handleLeave}
          className="border-white/20 text-white hover:bg-white/10"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />Go Back
        </Button>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col bg-gray-950">

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-white/10">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLeave}
            className="text-white/70 hover:text-white hover:bg-white/10"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />Leave
          </Button>
          <div className="h-4 w-px bg-white/20" />
          <div>
            <p className="text-sm font-semibold text-white leading-tight">{lecture.title}</p>
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
              </span>
              <span className="text-xs text-red-400 font-medium">LIVE</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-white/50">
          <span className="capitalize">{currentUser?.role}</span>
          {profile && <span>· {profile.name}</span>}
        </div>
      </div>

      {/* ── Jitsi room ───────────────────────────────────────────────────── */}
      <div className="flex-1 relative">
        <JitsiEmbed
          roomName={jaas ? jaas.room_name : lecture.jitsi_room}
          appId={jaas?.app_id ?? null}
          token={jaas?.token ?? null}
          displayName={profile?.name ?? currentUser?.sub ?? 'User'}
          email={profile?.email ?? ''}
          onLeave={handleLeave}
        />
        {currentUser?.role === 'student' && sessionId !== null && jwtToken && (
          <CookieOverlay sessionId={sessionId} token={jwtToken} />
        )}
      </div>

    </div>
  )
}
