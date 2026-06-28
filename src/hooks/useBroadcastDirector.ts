// Broadcast director: when enabled, periodically switches the "camera" to the
// most interesting driver — like a TV feed. Picks the closest battle in a race,
// or the provisional-pole contender in qualifying.

import { useEffect, useRef } from 'react'
import type { Session } from '@/api/types'
import type { DerivedSnapshot, StandingRow } from './useDerived'
import { useRaceStore } from '@/store/useRaceStore'

const SWITCH_MS = 9000

interface Pick {
  num: number
  reason: string
}

function pickRaceTarget(standings: StandingRow[], avoid: number | null): Pick | null {
  // Closest on-track battle (small interval to the car ahead), not the leader.
  let best: { iv: number; row: StandingRow; ahead: StandingRow | undefined } | null = null
  for (const r of standings) {
    if (r.position == null || r.position < 2) continue
    const iv = typeof r.interval === 'number' ? r.interval : null
    if (iv == null || iv > 2.5) continue
    if (r.driver.driver_number === avoid) continue
    if (best == null || iv < best.iv) {
      const ahead = standings.find((x) => x.position === r.position! - 1)
      best = { iv, row: r, ahead }
    }
  }
  if (best) {
    const a = best.ahead?.driver.name_acronym ?? '—'
    return { num: best.row.driver.driver_number, reason: `BATTLE · ${a} vs ${best.row.driver.name_acronym} (${best.iv.toFixed(1)}s)` }
  }
  const leader = standings.find((r) => r.position === 1)
  if (leader) return { num: leader.driver.driver_number, reason: `LEADER · ${leader.driver.name_acronym}` }
  return null
}

function pickQualiTarget(standings: StandingRow[], cycle: number): Pick | null {
  const sorted = standings.filter((r) => r.bestLap != null).sort((a, b) => a.bestLap! - b.bestLap!)
  if (!sorted.length) return null
  // Mostly watch pole, occasionally the next contenders.
  const idx = cycle % Math.min(3, sorted.length)
  const r = sorted[idx]
  return { num: r.driver.driver_number, reason: `POLE WATCH · P${idx + 1} ${r.driver.name_acronym}` }
}

export function useBroadcastDirector(derived: DerivedSnapshot, session: Session | undefined) {
  const broadcast = useRaceStore((s) => s.broadcast)

  // Keep latest derived/session in a ref so the interval closure stays fresh.
  const ref = useRef({ derived, session })
  ref.current = { derived, session }
  const cycle = useRef(0)
  const last = useRef<number | null>(null)

  useEffect(() => {
    if (!broadcast) return
    const store = useRaceStore.getState

    const run = () => {
      const { derived: d, session: s } = ref.current
      if (!d.standings.length) return
      const isQuali = s?.session_type === 'Qualifying' || s?.session_name === 'Sprint Shootout'
      const pick = isQuali
        ? pickQualiTarget(d.standings, cycle.current)
        : pickRaceTarget(d.standings, last.current)
      cycle.current++
      if (!pick) return
      last.current = pick.num
      store().setSelectedDriver(pick.num)
      store().setBroadcastReason(pick.reason)
      if (store().cameraMode !== 'follow') store().setCameraMode('follow')
    }

    run()
    const id = setInterval(run, SWITCH_MS)
    return () => clearInterval(id)
  }, [broadcast])
}
