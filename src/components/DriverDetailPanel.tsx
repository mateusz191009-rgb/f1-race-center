import { useMemo } from 'react'
import { useRaceData } from '@/context/RaceDataContext'
import { useRaceStore } from '@/store/useRaceStore'
import {
  compoundColor,
  compoundShort,
  formatGap,
  formatInterval,
  formatLapTime,
  teamColor,
  toMs,
} from '@/lib/format'
import { lastIndexAtOrBefore } from '@/lib/interpolation'
import { TelemetryPanel } from './TelemetryPanel'
import { PitStopPredictor } from './PitStopPredictor'
import { TeamRadioPanel } from './TeamRadioPanel'
import { MiniSectors } from './MiniSectors'

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="glass-tight px-2.5 py-1.5">
      <div className="label">{label}</div>
      <div className={`text-sm font-semibold tabular-nums ${accent ? 'text-purple-300' : 'text-white'}`}>
        {value}
      </div>
    </div>
  )
}

export function DriverDetailPanel() {
  const { raceData, derived } = useRaceData()
  const time = useRaceStore((s) => s.displayTime)
  const selectedDriver = useRaceStore((s) => s.selectedDriver)
  const selectDriver = useRaceStore((s) => s.selectDriver)

  const driver = selectedDriver != null ? raceData?.driversByNumber.get(selectedDriver) : undefined
  const row = derived.standings.find((r) => r.driver.driver_number === selectedDriver)

  const stint = useMemo(() => {
    if (!raceData || selectedDriver == null || row?.lapNumber == null) return null
    const stints = raceData.stints.get(selectedDriver)
    if (!stints) return null
    const lap = row.lapNumber
    const cur = stints.find((s) => lap >= s.lap_start && lap <= s.lap_end) ?? stints[stints.length - 1]
    if (!cur) return null
    const age = cur.tyre_age_at_start + Math.max(0, lap - cur.lap_start)
    return { compound: cur.compound, age, stintNumber: cur.stint_number }
  }, [raceData, selectedDriver, row?.lapNumber])

  const driverMessages = useMemo(() => {
    if (!raceData || selectedDriver == null) return []
    const count = lastIndexAtOrBefore(raceData.raceControlTimes, time) + 1
    return raceData.raceControl
      .slice(0, count)
      .filter((m) => m.driver_number === selectedDriver)
      .slice(-4)
      .reverse()
  }, [raceData, selectedDriver, time])

  // Pit stops completed so far (by replay time).
  const pitStops = useMemo(() => {
    if (!raceData || selectedDriver == null) return []
    const stops = raceData.pits.get(selectedDriver) ?? []
    return stops.filter((p) => toMs(p.date) <= time)
  }, [raceData, selectedDriver, time])

  if (!driver) return null
  const color = teamColor(driver.team_colour)

  return (
    <div className="glass animate-slideUp flex h-full max-h-[78vh] flex-col overflow-hidden">
      {/* Header */}
      <div
        className="relative flex items-center gap-3 px-4 py-3"
        style={{ background: `linear-gradient(90deg, ${color}33, transparent)` }}
      >
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg text-lg font-bold text-white"
          style={{ background: color }}
        >
          {driver.headshot_url ? (
            <img src={driver.headshot_url} alt={driver.name_acronym} className="h-full w-full object-cover" />
          ) : (
            driver.driver_number
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="heading text-lg text-white">{driver.name_acronym}</span>
            <span className="text-sm text-f1-mute">#{driver.driver_number}</span>
          </div>
          <div className="truncate text-xs text-f1-mute">{driver.team_name}</div>
        </div>
        <button
          className="btn px-2 py-1 text-xs"
          onClick={() => selectDriver(null)}
          aria-label="Close driver panel"
        >
          ✕
        </button>
      </div>

      <div className="scroll-thin min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {/* Core stats */}
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Position" value={row?.position != null ? `P${row.position}` : '—'} />
          <Stat label="Lap" value={row?.lapNumber != null ? `${row.lapNumber}` : '—'} />
          <Stat label="Interval" value={formatInterval(row?.interval)} />
          <Stat label="Gap to Ldr" value={formatGap(row?.gapToLeader)} />
          <Stat label="Last Lap" value={formatLapTime(row?.lastLap)} />
          <Stat
            label="Best Lap"
            value={formatLapTime(row?.bestLap)}
            accent={derived.fastestLap?.driverNumber === driver.driver_number}
          />
        </div>

        {/* Tyre / stint + pit stops */}
        {stint && (
          <div className="glass-tight flex items-center gap-3 px-3 py-2">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold"
              style={{ borderColor: compoundColor(stint.compound), color: compoundColor(stint.compound) }}
            >
              {compoundShort(stint.compound)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-white">
                {stint.compound ?? 'Unknown'} · Stint {stint.stintNumber}
              </div>
              <div className="label">Tyre age ≈ {stint.age} laps</div>
            </div>
            {pitStops.length > 0 && (
              <div className="shrink-0 text-right">
                <div className="label">Pit stops</div>
                <div className="text-sm font-semibold text-white">{pitStops.length}</div>
              </div>
            )}
          </div>
        )}

        {/* Pit-stop times */}
        {pitStops.length > 0 && (
          <div className="glass-tight px-3 py-2">
            <div className="label mb-1">🔧 Pit Stops</div>
            <div className="flex flex-wrap gap-1.5">
              {pitStops.slice(-6).map((p, i) => (
                <span
                  key={`${p.date}-${i}`}
                  className="chip bg-white/5 text-f1-ink"
                  title={`Lap ${p.lap_number}`}
                >
                  L{p.lap_number}
                  {p.pit_duration != null && (
                    <span className="ml-1 font-bold text-f1-red">{p.pit_duration.toFixed(1)}s</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Live sectors (great in qualifying) */}
        {row && <MiniSectors row={row} bestSectors={derived.bestSectors} />}

        {/* Telemetry */}
        <TelemetryPanel driverNumber={driver.driver_number} color={color} />

        {/* Pit-stop position predictor */}
        <PitStopPredictor driverNumber={driver.driver_number} />

        {/* Team radio clips */}
        <TeamRadioPanel driverNumber={driver.driver_number} color={color} />

        {/* Driver race-control events */}
        {driverMessages.length > 0 && (
          <div className="glass-tight p-3">
            <div className="label mb-1">Race Control · this driver</div>
            <div className="space-y-1">
              {driverMessages.map((m, i) => (
                <p key={i} className="text-xs leading-snug text-f1-ink">
                  <span className="text-f1-mute">{m.lap_number ? `L${m.lap_number} · ` : ''}</span>
                  {m.message}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
