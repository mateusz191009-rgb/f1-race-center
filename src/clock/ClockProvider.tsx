// Replay clock. The precise playback time is kept in a mutable ref that the 3D
// scene reads every animation frame (no React re-render). A throttled copy is
// pushed into the store ~5x/second to drive timing/telemetry panels.

import { createContext, useContext, useEffect, useMemo, useRef } from 'react'
import type { ReactNode } from 'react'
import { LIVE_DELAY_MS } from '@/config'
import { useRaceStore } from '@/store/useRaceStore'

interface ClockContextValue {
  /** Live playback time in epoch ms, updated every frame. */
  clockRef: React.MutableRefObject<number>
  /** Jump to an absolute epoch-ms time (used by the timeline scrubber). */
  seek: (t: number) => void
}

const ClockContext = createContext<ClockContextValue | null>(null)

const UI_UPDATE_INTERVAL = 180 // ms between store/displayTime pushes

export function ClockProvider({ children }: { children: ReactNode }) {
  const clockRef = useRef<number>(0)
  const lastUiPush = useRef<number>(0)

  // Keep the ref in sync when the window changes (new session loaded).
  const windowStart = useRaceStore((s) => s.windowStart)
  useEffect(() => {
    clockRef.current = windowStart
    lastUiPush.current = 0
  }, [windowStart])

  const seek = useMemo(
    () => (t: number) => {
      clockRef.current = t
      useRaceStore.getState().setDisplayTime(t)
    },
    [],
  )

  useEffect(() => {
    let raf = 0
    let last = performance.now()

    const tick = (now: number) => {
      const dt = now - last
      last = now

      const { playing, speed, windowEnd, windowStart, mode } = useRaceStore.getState()

      if (mode === 'live' && windowEnd > windowStart) {
        // Live mode: pin the clock to the live edge (a few seconds behind now).
        const edge = Date.now() - LIVE_DELAY_MS
        clockRef.current = Math.min(windowEnd, Math.max(windowStart, edge))
      } else if (playing && windowEnd > windowStart) {
        clockRef.current += dt * speed
        if (clockRef.current >= windowEnd) {
          clockRef.current = windowEnd
          useRaceStore.getState().pause()
        }
      }

      if (now - lastUiPush.current >= UI_UPDATE_INTERVAL) {
        lastUiPush.current = now
        useRaceStore.getState().setDisplayTime(clockRef.current)
      }

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const value = useMemo<ClockContextValue>(() => ({ clockRef, seek }), [seek])

  return <ClockContext.Provider value={value}>{children}</ClockContext.Provider>
}

export function useClock(): ClockContextValue {
  const ctx = useContext(ClockContext)
  if (!ctx) throw new Error('useClock must be used within ClockProvider')
  return ctx
}
