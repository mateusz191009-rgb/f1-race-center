import clsx from 'clsx'
import { useMemo } from 'react'
import { useRaceData } from '@/context/RaceDataContext'
import { useRaceStore } from '@/store/useRaceStore'
import type { RaceControlMessage } from '@/api/types'
import { formatClock, toMs } from '@/lib/format'
import { lastIndexAtOrBefore } from '@/lib/interpolation'

function accent(m: RaceControlMessage): { dot: string; ring?: string } {
  const flag = (m.flag ?? '').toUpperCase()
  const text = (m.message ?? '').toUpperCase()
  if (flag === 'RED' || text.includes('RED FLAG')) return { dot: 'bg-flag-red', ring: 'ring-flag-red/40' }
  if (text.includes('SAFETY CAR')) return { dot: 'bg-flag-yellow', ring: 'ring-flag-yellow/40' }
  if (flag === 'YELLOW' || flag === 'DOUBLE YELLOW') return { dot: 'bg-flag-yellow' }
  if (flag === 'GREEN' || flag === 'CLEAR') return { dot: 'bg-flag-green' }
  if (flag === 'BLUE') return { dot: 'bg-flag-blue' }
  if (m.category === 'Drs') return { dot: 'bg-cyan-400' }
  if (text.includes('PENALTY') || text.includes('DELETED') || text.includes('INVESTIGAT'))
    return { dot: 'bg-orange-400', ring: 'ring-orange-400/40' }
  return { dot: 'bg-white/40' }
}

export function RaceControlFeed() {
  const { raceData } = useRaceData()
  const time = useRaceStore((s) => s.displayTime)

  const messages = useMemo(() => {
    if (!raceData) return []
    const count = lastIndexAtOrBefore(raceData.raceControlTimes, time) + 1
    return raceData.raceControl.slice(0, count).slice(-40).reverse()
  }, [raceData, time])

  return (
    <div className="glass flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <span className="heading text-sm tracking-wider text-white">RACE CONTROL</span>
        <span className="h-2 w-2 animate-pulseGlow rounded-full bg-f1-red" />
      </div>
      <div className="scroll-thin flex-1 space-y-1.5 overflow-y-auto p-2">
        {messages.map((m, i) => {
          const a = accent(m)
          return (
            <div
              key={`${m.date}-${i}`}
              className={clsx(
                'animate-slideUp rounded-lg border border-white/10 bg-black/30 p-2',
                a.ring && `ring-1 ${a.ring}`,
              )}
            >
              <div className="mb-0.5 flex items-center gap-2">
                <span className={clsx('h-2 w-2 rounded-full', a.dot)} />
                <span className="label">{formatClock(toMs(m.date))}</span>
                {m.lap_number != null && <span className="label">· Lap {m.lap_number}</span>}
              </div>
              <p className="text-xs leading-snug text-f1-ink">{m.message}</p>
            </div>
          )
        })}
        {messages.length === 0 && (
          <p className="px-2 py-4 text-center text-sm text-f1-mute">No messages yet…</p>
        )}
      </div>
    </div>
  )
}
