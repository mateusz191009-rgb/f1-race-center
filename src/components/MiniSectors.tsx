import { useMemo } from 'react'
import clsx from 'clsx'
import { useRaceData } from '@/context/RaceDataContext'
import { useRaceStore } from '@/store/useRaceStore'
import { sectorColor, type StandingRow } from '@/hooks/useDerived'
import { formatLapTime, toMs } from '@/lib/format'

const SECTOR_BG: Record<string, string> = {
  purple: 'rgba(176,107,255,0.85)',
  green: 'rgba(39,224,122,0.85)',
  white: 'rgba(231,231,239,0.85)',
}

// Live sector tracker for the selected driver: reveals each sector of the lap
// they're currently running as the replay clock passes it, coloured purple
// (session best) / green (personal best) / white. Great for "who's on pole?".
export function MiniSectors({ row, bestSectors }: { row: StandingRow; bestSectors: (number | null)[] }) {
  const { raceData } = useRaceData()
  const time = useRaceStore((s) => s.displayTime)
  const driverNumber = row.driver.driver_number

  const lap = useMemo(() => {
    const laps = raceData?.laps.get(driverNumber)
    if (!laps?.length) return null
    let cur: (typeof laps)[number] | null = null
    let curStart = NaN
    for (const l of laps) {
      const ds = toMs(l.date_start)
      if (isFinite(ds) && ds <= time) {
        cur = l
        curStart = ds
      }
    }
    if (!cur || !isFinite(curStart)) return null
    const secs = [cur.duration_sector_1, cur.duration_sector_2, cur.duration_sector_3]
    // Sector start + completion times within the lap.
    const starts = [curStart, NaN, NaN]
    const ends = [NaN, NaN, NaN]
    let acc = curStart
    for (let i = 0; i < 3; i++) {
      starts[i] = acc
      const d = secs[i]
      if (d != null) {
        acc += d * 1000
        ends[i] = acc
      }
    }
    return { lapNumber: cur.lap_number, secs, starts, ends, lapDuration: cur.lap_duration }
  }, [raceData, driverNumber, time])

  if (!lap) return null

  let running = 0
  for (let i = 0; i < 3; i++) {
    const done = isFinite(lap.ends[i]) && time >= lap.ends[i]
    if (done) running += lap.secs[i] ?? 0
  }
  const allDone = lap.secs.every((s, i) => s != null && time >= lap.ends[i])

  return (
    <div className="glass-tight p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="heading text-xs tracking-wider text-white">LIVE SECTORS · L{lap.lapNumber}</span>
        <span className="text-sm font-semibold tabular-nums text-white">
          {formatLapTime(allDone ? lap.lapDuration : running || null)}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => {
          const dur = lap.secs[i]
          const done = isFinite(lap.ends[i]) && time >= lap.ends[i]
          const active = !done && isFinite(lap.starts[i]) && time >= lap.starts[i]
          const c = done ? sectorColor(dur, row.pbSectors[i], bestSectors[i]) : null
          return (
            <div
              key={i}
              className={clsx(
                'rounded-md border px-2 py-1.5 text-center transition',
                active ? 'animate-pulseGlow border-white/60' : 'border-white/10',
              )}
              style={{ background: c ? SECTOR_BG[c] : 'rgba(255,255,255,0.05)' }}
            >
              <div className={clsx('text-[10px] uppercase tracking-wider', c ? 'text-black/70' : 'text-f1-mute')}>
                S{i + 1}
              </div>
              <div className={clsx('text-sm font-semibold tabular-nums', c ? 'text-black' : 'text-white')}>
                {done ? formatLapTime(dur) : active ? '…' : '—'}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
