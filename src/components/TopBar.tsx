import clsx from 'clsx'
import { useRaceData } from '@/context/RaceDataContext'
import { useRaceStore, type CameraMode } from '@/store/useRaceStore'
import { deriveQualiPhase } from '@/lib/raceData'

const CAMERA_MODES: { id: CameraMode; label: string }[] = [
  { id: 'orbit', label: 'Orbit' },
  { id: 'tv', label: 'TV Cam' },
  { id: 'top', label: 'Top' },
  { id: 'follow', label: 'Follow' },
]

function ModeBadge({ mode }: { mode: string }) {
  const map: Record<string, string> = {
    demo: 'bg-sky-500/20 text-sky-200 border-sky-400/40',
    replay: 'bg-amber-500/20 text-amber-200 border-amber-400/40',
    live: 'bg-flag-red/25 text-red-200 border-flag-red/50',
  }
  return (
    <span className={clsx('chip border uppercase', map[mode])}>
      {mode === 'live' && <span className="mr-1 h-1.5 w-1.5 animate-pulseGlow rounded-full bg-red-400" />}
      {mode}
    </span>
  )
}

export function TopBar() {
  const { session, derived, raceData } = useRaceData()
  const time = useRaceStore((s) => s.displayTime)
  const mode = useRaceStore((s) => s.mode)
  const cameraMode = useRaceStore((s) => s.cameraMode)
  const setCameraMode = useRaceStore((s) => s.setCameraMode)
  const openSelector = useRaceStore((s) => s.openSelector)
  const broadcast = useRaceStore((s) => s.broadcast)
  const broadcastReason = useRaceStore((s) => s.broadcastReason)
  const toggleBroadcast = useRaceStore((s) => s.toggleBroadcast)
  const realisticCars = useRaceStore((s) => s.realisticCars)
  const toggleRealisticCars = useRaceStore((s) => s.toggleRealisticCars)

  const status = derived.status

  // Lap counter (races) or qualifying segment (Q1/Q2/Q3).
  const type = session?.session_type
  const isQuali = type === 'Qualifying' || session?.session_name === 'Sprint Shootout'
  const phase = isQuali && raceData ? deriveQualiPhase(raceData, time) : null
  const sessionTag =
    type === 'Race'
      ? `LAP ${derived.leaderLap ?? '–'} / ${derived.totalLaps || '–'}`
      : phase
        ? `QUALI · ${phase}`
        : null

  return (
    <header className="glass flex items-center justify-between gap-3 px-4 py-2">
      <div className="flex min-w-0 items-center gap-3">
        <div className="heading hidden text-lg text-white sm:block">
          F1<span className="text-f1-red">·</span>RC
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-white">
              {session ? `${session.circuit_short_name}` : 'Loading…'}
            </span>
            <ModeBadge mode={mode} />
          </div>
          <div className="truncate text-xs text-f1-mute">
            {session ? `${session.session_name} · ${session.year}` : '—'}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {broadcast && broadcastReason && (
          <span className="chip hidden items-center gap-1 border border-f1-red/50 bg-f1-red/20 text-red-100 xl:inline-flex">
            <span className="h-1.5 w-1.5 animate-pulseGlow rounded-full bg-red-400" />
            {broadcastReason}
          </span>
        )}
        {sessionTag && (
          <span className="chip border border-white/15 bg-black/40 font-display tracking-wider text-white">
            {sessionTag}
          </span>
        )}
        <span
          className={clsx(
            'chip border',
            status.kind === 'green'
              ? 'border-flag-green/40 bg-flag-green/15 text-green-200'
              : status.kind === 'red'
                ? 'border-flag-red/50 bg-flag-red/20 text-red-200'
                : 'border-flag-yellow/50 bg-flag-yellow/20 text-yellow-100',
          )}
        >
          {status.label}
        </span>

        <div className="hidden items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-0.5 md:flex">
          {CAMERA_MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setCameraMode(m.id)}
              className={clsx(
                'rounded-md px-2 py-1 text-xs font-semibold transition',
                cameraMode === m.id ? 'bg-f1-red/30 text-white' : 'text-f1-mute hover:text-white',
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        <button
          onClick={toggleBroadcast}
          title="Broadcast director: auto-follows battles / pole contenders"
          className={clsx('btn px-2 py-1 text-xs', broadcast && 'btn-primary')}
        >
          ● Broadcast
        </button>
        <button
          onClick={toggleRealisticCars}
          title="Toggle realistic 3D cars vs. simple markers"
          className={clsx('hidden btn px-2 py-1 text-xs md:inline-flex', realisticCars && 'btn-primary')}
        >
          3D Cars
        </button>

        <button className="btn" onClick={openSelector}>
          <span className="hidden sm:inline">Change Session</span>
          <span className="sm:hidden">⚙</span>
        </button>
      </div>
    </header>
  )
}
