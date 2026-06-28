import clsx from 'clsx'
import { useMemo } from 'react'
import { useRaceData } from '@/context/RaceDataContext'
import { useRaceStore } from '@/store/useRaceStore'
import { sectorColor, type StandingRow } from '@/hooks/useDerived'
import { compoundColor, compoundShort, formatInterval, formatLapTime, teamColor } from '@/lib/format'

function TyreBadge({ compound, age }: { compound: string | null; age: number | null }) {
  if (!compound) return <span className="inline-block w-5" />
  return (
    <span
      className="inline-flex h-4 w-4 items-center justify-center rounded-full border text-[9px] font-bold leading-none"
      style={{ borderColor: compoundColor(compound), color: compoundColor(compound) }}
      title={`${compound}${age != null ? ` · ${age} laps` : ''}`}
    >
      {compoundShort(compound)}
    </span>
  )
}

function SectorDots({ row, bestSectors }: { row: StandingRow; bestSectors: (number | null)[] }) {
  return (
    <span className="flex gap-0.5">
      {[0, 1, 2].map((i) => {
        const c = sectorColor(row.lastSectors[i], row.pbSectors[i], bestSectors[i])
        const bg =
          c === 'purple'
            ? '#b06bff'
            : c === 'green'
              ? '#27e07a'
              : c === 'white'
                ? '#e7e7ef'
                : 'rgba(255,255,255,0.14)'
        return <span key={i} className="h-1 w-2.5 rounded-sm" style={{ background: bg }} />
      })}
    </span>
  )
}

export function TimingTower() {
  const { derived, session } = useRaceData()
  const selectedDriver = useRaceStore((s) => s.selectedDriver)
  const selectDriver = useRaceStore((s) => s.selectDriver)
  const setHovered = useRaceStore((s) => s.setHovered)
  const fastest = derived.fastestLap

  const isQuali = session?.session_type === 'Qualifying' || session?.session_name === 'Sprint Shootout'

  // In qualifying, sort by best lap (provisional grid) rather than race position.
  const { rows, poleTime } = useMemo(() => {
    if (!isQuali) return { rows: derived.standings, poleTime: null as number | null }
    const sorted = [...derived.standings].sort((a, b) => {
      if (a.bestLap != null && b.bestLap != null) return a.bestLap - b.bestLap
      if (a.bestLap != null) return -1
      if (b.bestLap != null) return 1
      return (a.position ?? 99) - (b.position ?? 99)
    })
    return { rows: sorted, poleTime: sorted.find((r) => r.bestLap != null)?.bestLap ?? null }
  }, [derived.standings, isQuali])

  return (
    <div className="glass flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <span className="heading text-sm tracking-wider text-white">
          {isQuali ? 'PROVISIONAL GRID' : 'TIMING'}
        </span>
        <span className="label">{rows.length} drivers</span>
      </div>

      <div className="grid grid-cols-[1.4rem_1fr_1.6rem_3.4rem_3.6rem] gap-1 border-b border-white/10 px-2 py-1">
        <span className="label text-center">P</span>
        <span className="label">Driver</span>
        <span className="label text-center" title="Tyre">
          T
        </span>
        <span className="label text-right">{isQuali ? 'Pole' : 'Int'}</span>
        <span className="label text-right">{isQuali ? 'Best' : 'Last'}</span>
      </div>

      <div className="scroll-thin flex-1 overflow-y-auto">
        {rows.map((row, idx) => {
          const num = row.driver.driver_number
          const color = teamColor(row.driver.team_colour)
          const selected = selectedDriver === num
          const isFastest = fastest?.driverNumber === num
          const rank = isQuali ? idx + 1 : (row.position ?? idx + 1)

          const gapText = isQuali
            ? idx === 0
              ? 'POLE'
              : row.bestLap != null && poleTime != null
                ? `+${(row.bestLap - poleTime).toFixed(3)}`
                : '—'
            : row.position === 1
              ? 'LDR'
              : formatInterval(row.interval)

          const timeText = formatLapTime(isQuali ? row.bestLap : row.lastLap)
          const timeIsBest = !isQuali && row.lastLap != null && row.lastLap === row.bestLap

          return (
            <button
              key={num}
              onClick={() => selectDriver(num)}
              onMouseEnter={() => setHovered(num)}
              onMouseLeave={() => setHovered(null)}
              className={clsx(
                'grid w-full grid-cols-[1.4rem_1fr_1.6rem_3.4rem_3.6rem] items-center gap-1 border-l-2 px-2 py-1 text-left transition hover:bg-white/5',
                selected ? 'bg-white/10' : 'bg-transparent',
              )}
              style={{ borderLeftColor: color }}
            >
              <span className="text-center text-sm font-bold tabular-nums text-white">{rank}</span>
              <span className="flex min-w-0 flex-col">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-3 w-1 shrink-0 rounded-sm" style={{ background: color }} />
                  <span className="truncate text-sm font-semibold text-white">{row.driver.name_acronym}</span>
                  {isFastest && (
                    <span className="chip bg-purple-500/30 text-purple-200" title="Fastest lap">
                      FL
                    </span>
                  )}
                </span>
                <SectorDots row={row} bestSectors={derived.bestSectors} />
              </span>
              <span className="flex justify-center">
                <TyreBadge compound={row.compound} age={row.tyreAge} />
              </span>
              <span className="text-right text-xs tabular-nums text-f1-mute">{gapText}</span>
              <span
                className={clsx(
                  'text-right text-xs tabular-nums',
                  timeIsBest || (isQuali && idx === 0) ? 'text-purple-300' : 'text-f1-ink',
                )}
              >
                {timeText}
              </span>
            </button>
          )
        })}
        {rows.length === 0 && (
          <p className="px-3 py-4 text-center text-sm text-f1-mute">No timing data yet…</p>
        )}
      </div>
    </div>
  )
}
