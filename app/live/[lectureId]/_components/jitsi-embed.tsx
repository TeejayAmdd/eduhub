'use client'

import { useEffect, useRef } from 'react'

interface Props {
  roomName: string
  appId: string | null   // JaaS app ID — if set, uses 8x8.vc + JWT
  token: string | null   // JaaS JWT
  displayName: string
  email: string
  onLeave: () => void
}

interface JitsiAPI {
  addEventListeners: (listeners: Record<string, () => void>) => void
  dispose: () => void
}

declare global {
  interface Window {
    JitsiMeetExternalAPI: new (
      domain: string,
      options: Record<string, unknown>,
    ) => JitsiAPI
  }
}

export function JitsiEmbed({ roomName, appId, token, displayName, email, onLeave }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const apiRef       = useRef<JitsiAPI | null>(null)

  useEffect(() => {
    let disposed = false

    const domain    = appId ? '8x8.vc' : 'meet.jit.si'
    const scriptSrc = appId
      ? `https://8x8.vc/${appId}/external_api.js`
      : 'https://meet.jit.si/external_api.js'

    function initMeeting() {
      if (disposed || !containerRef.current || !window.JitsiMeetExternalAPI) return

      const options: Record<string, unknown> = {
        roomName,
        parentNode: containerRef.current,
        width:  '100%',
        height: '100%',
        userInfo: { displayName, email },
        configOverwrite: {
          startWithAudioMuted: false,
          startWithVideoMuted: false,
          prejoinPageEnabled: false,
          disableDeepLinking: true,
          disableInviteFunctions: true,
          enableWelcomePage: false,
          lobbyModeEnabled: false,
          requireDisplayName: false,
          disableProfile: true,
          enableFeaturesBasedOnToken: !!token,
          toolbarButtons: [
            'microphone', 'camera', 'desktop', 'chat',
            'raisehand', 'participants-pane', 'tileview',
            'fullscreen', 'hangup',
          ],
        },
        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
          SHOW_BRAND_WATERMARK: false,
          DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
          AUTHENTICATION_ENABLE: false,
          HIDE_INVITE_MORE_HEADER: true,
        },
      }

      // Attach JWT when using JaaS — this grants moderator role to the lecturer
      if (token) {
        options.jwt = token
      }

      const api = new window.JitsiMeetExternalAPI(domain, options)
      api.addEventListeners({ readyToClose: onLeave })
      apiRef.current = api
    }

    function loadAndInit() {
      if (typeof window.JitsiMeetExternalAPI !== 'undefined') {
        initMeeting()
        return
      }
      // Remove any previously loaded Jitsi script so the correct one loads
      document.querySelectorAll('script[data-jitsi]').forEach((s) => s.remove())

      const script = document.createElement('script')
      script.src = scriptSrc
      script.async = true
      script.setAttribute('data-jitsi', '1')
      script.onload = initMeeting
      script.onerror = () => console.error(`[Jitsi] Failed to load ${scriptSrc}`)
      document.head.appendChild(script)
    }

    loadAndInit()

    return () => {
      disposed = true
      apiRef.current?.dispose()
      apiRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomName, token])

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%' }}
    />
  )
}
