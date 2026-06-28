import { useEffect, useRef } from 'react'
import { ClockProvider } from '@/clock/ClockProvider'
import { RaceDataProvider } from '@/context/RaceDataContext'
import { useSessionData } from '@/hooks/useSessionData'
import { useDerived } from '@/hooks/useDerived'
import { useBroadcastDirector } from '@/hooks/useBroadcastDirector'
import { useRaceStore } from '@/store/useRaceStore'
import { SessionSelector } from '@/components/SessionSelector'
import { AppLayout } from '@/components/AppLayout'

function LoadingScreen() {
  const progress = useRaceStore((s) => s.loadProgress)
  const pct = progress != null ? Math.round(progress * 100) : null
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <div className="relative h-16 w-16">
        <div className="absolute inset-0 animate-spin rounded-full border-4 border-white/10 border-t-f1-red" />
      </div>
      <div className="text-center">
        <p className="heading text-lg text-white">Building the circuit…</p>
        <p className="text-sm text-f1-mute">
          Loading the full session from OpenF1 (drivers, positions, telemetry)
        </p>
        {pct != null && (
          <div className="mx-auto mt-3 w-64">
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-f1-red transition-[width] duration-200"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-f1-mute">Track positions · {pct}%</p>
          </div>
        )}
      </div>
    </div>
  )
}

function ErrorScreen({ error, onRetry, onBack }: { error: Error; onRetry: () => void; onBack: () => void }) {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="glass max-w-md p-6 text-center">
        <p className="heading mb-2 text-lg text-flag-red">Couldn’t load this session</p>
        <p className="mb-4 text-sm text-f1-mute">{error.message}</p>
        <div className="flex justify-center gap-2">
          <button className="btn-primary btn" onClick={onRetry}>
            Retry
          </button>
          <button className="btn" onClick={onBack}>
            Choose another session
          </button>
        </div>
      </div>
    </div>
  )
}

function AppInner() {
  const selectorOpen = useRaceStore((s) => s.selectorOpen)
  const hasSession = useRaceStore((s) => s.hasSession)
  const sessionKey = useRaceStore((s) => s.sessionKey)
  const displayTime = useRaceStore((s) => s.displayTime)
  const openSelector = useRaceStore((s) => s.openSelector)
  const play = useRaceStore((s) => s.play)

  const { session, raceData, loading, error, refetchAll } = useSessionData()
  const derived = useDerived(raceData, displayTime)
  useBroadcastDirector(derived, session)

  // Auto-start playback once a session's data is ready (once per session).
  const autoPlayed = useRef<number | null>(null)
  useEffect(() => {
    if (raceData && sessionKey != null && autoPlayed.current !== sessionKey) {
      autoPlayed.current = sessionKey
      play()
    }
  }, [raceData, sessionKey, play])

  return (
    <RaceDataProvider value={{ session, raceData, derived, loading, error, refetchAll }}>
      <div className="h-full w-full">
        {error && hasSession && !raceData ? (
          <ErrorScreen error={error} onRetry={refetchAll} onBack={openSelector} />
        ) : raceData ? (
          <AppLayout />
        ) : hasSession ? (
          <LoadingScreen />
        ) : (
          <div className="flex h-full items-center justify-center text-f1-mute">
            Select a session to begin.
          </div>
        )}
      </div>

      {selectorOpen && <SessionSelector />}
    </RaceDataProvider>
  )
}

export default function App() {
  return (
    <ClockProvider>
      <AppInner />
    </ClockProvider>
  )
}
