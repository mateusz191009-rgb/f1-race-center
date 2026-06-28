import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { useRaceData } from '@/context/RaceDataContext'
import { DEFAULT_PIT_LOSS_S } from '@/config'
import { teamColor } from '@/lib/format'

/** Converts a gap_to_leader value to seconds; lapped cars become a large proxy. */
function numericGap(g: number | string | null | undefined): number | null {
  if (g == null) return null
  if (typeof g === 'number') return isFinite(g) ? g : null
  const lap = /(\d+)\s*LAP/i.exec(g)
  if (lap) return Number(lap[1]) * 1000 // far behind on the lead lap
  const n = Number(g.replace('+', '').trim())
  return isFinite(n) ? n : null
}

/**
 * Predicts where a driver would rejoin after pitting *now*, based on the current
 * gaps to the leader plus an adjustable pit-loss estimate. This is a simple
 * snapshot model: it assumes nobody else pits and pace stays constant.
 */
export function PitStopPredictor({ driverNumber }: { driverNumber: number }) {
  const { derived } = useRaceData()
  const [pitLoss, setPitLoss] = useState(DEFAULT_PIT_LOSS_S)

  const result = useMemo(() => {
    const rows = derived.standings
    const self = rows.find((r) => r.driver.driver_number === driverNumber)
    if (!self) return null
    const selfGap = numericGap(self.gapToLeader)
    if (selfGap == null) return null

    const field = rows
      .map((r) => ({
        num: r.driver.driver_number,
        acr: r.driver.name_acronym,
        color: teamColor(r.driver.team_colour),
        gap: numericGap(r.gapToLeader),
      }))
      .filter((d): d is { num: number; acr: string; color: string; gap: number } => d.gap != null)

    const projected = selfGap + pitLoss
    const ahead = field.filter((d) => d.num !== driverNumber && d.gap < projected)
    const behind = field.filter((d) => d.num !== driverNumber && d.gap >= projected)
    const carAhead = ahead.sort((a, b) => b.gap - a.gap)[0] ?? null
    const carBehind = behind.sort((a, b) => a.gap - b.gap)[0] ?? null

    return {
      currentPos: self.position,
      predictedPos: ahead.length + 1,
      carAhead,
      carBehind,
    }
  }, [derived.standings, driverNumber, pitLoss])

  return (
    <div className="glass-tight p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="heading text-xs tracking-wider text-white">PIT-STOP PREDICTOR</span>
        <span className="label">undercut sim</span>
      </div>

      {!result ? (
        <p className="py-2 text-center text-xs text-f1-mute">Needs live gap data (best in a race).</p>
      ) : (
        <>
          <div className="mb-3 flex items-center justify-center gap-3">
            <div className="flex flex-col items-center">
              <span className="label">Now</span>
              <span className="heading text-2xl text-white">
                P{result.currentPos ?? '–'}
              </span>
            </div>
            <span className="text-2xl text-f1-mute">→</span>
            <div className="flex flex-col items-center">
              <span className="label">After stop</span>
              <span className="heading text-3xl text-f1-red">P{result.predictedPos}</span>
            </div>
            {result.currentPos != null && (
              <span
                className={clsx(
                  'chip',
                  result.predictedPos > result.currentPos
                    ? 'bg-flag-red/20 text-red-200'
                    : 'bg-flag-green/20 text-green-200',
                )}
              >
                {result.predictedPos > result.currentPos
                  ? `▼ ${result.predictedPos - result.currentPos}`
                  : result.predictedPos < result.currentPos
                    ? `▲ ${result.currentPos - result.predictedPos}`
                    : '= hold'}
              </span>
            )}
          </div>

          <div className="mb-2 text-center text-xs text-f1-mute">
            Rejoins{' '}
            {result.carAhead ? (
              <>
                behind <span style={{ color: result.carAhead.color }}>{result.carAhead.acr}</span>
              </>
            ) : (
              'in the lead'
            )}
            {result.carBehind && (
              <>
                {' '}
                · ahead of <span style={{ color: result.carBehind.color }}>{result.carBehind.acr}</span>
              </>
            )}
          </div>

          <div>
            <div className="mb-1 flex justify-between">
              <span className="label">Pit loss</span>
              <span className="text-xs font-semibold tabular-nums text-white">{pitLoss.toFixed(0)} s</span>
            </div>
            <input
              type="range"
              min={14}
              max={32}
              step={1}
              value={pitLoss}
              onChange={(e) => setPitLoss(Number(e.target.value))}
              className="w-full"
            />
          </div>
        </>
      )}
    </div>
  )
}
