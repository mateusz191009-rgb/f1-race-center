// Derives the timing snapshot (standings, gaps, lap times, tyres, sectors, flags)
// at a given replay time. Recomputed ~5x/second from the throttled displayTime.

import { useMemo } from 'react'
import type { Driver } from '@/api/types'
import { toMs } from '@/lib/format'
import { lastIndexAtOrBefore } from '@/lib/interpolation'
import { deriveStatus, type RaceData, type SessionStatus } from '@/lib/raceData'

export type SectorColor = 'purple' | 'green' | 'white' | null

export interface StandingRow {
  driver: Driver
  position: number | null
  gapToLeader: number | string | null
  interval: number | string | null
  lastLap: number | null
  bestLap: number | null
  lapNumber: number | null
  compound: string | null
  tyreAge: number | null
  /** Sector durations of the most recently completed lap. */
  lastSectors: (number | null)[]
  /** Personal-best sector durations so far. */
  pbSectors: (number | null)[]
}

export interface DerivedSnapshot {
  standings: StandingRow[]
  status: SessionStatus
  fastestLap: { driverNumber: number; time: number } | null
  leaderLap: number | null
  totalLaps: number
  /** Session-best duration per sector (for purple-sector colouring). */
  bestSectors: (number | null)[]
}

function lapInfo(data: RaceData, driverNumber: number, t: number) {
  const laps = data.laps.get(driverNumber)
  if (!laps?.length) {
    return {
      lastLap: null as number | null,
      bestLap: null as number | null,
      lapNumber: null as number | null,
      lastSectors: [null, null, null] as (number | null)[],
      pbSectors: [null, null, null] as (number | null)[],
    }
  }
  let lastLap: number | null = null
  let bestLap: number | null = null
  let lapNumber: number | null = null
  let lastSectors: (number | null)[] = [null, null, null]
  const pbSectors: (number | null)[] = [null, null, null]

  for (const lap of laps) {
    const start = toMs(lap.date_start)
    if (!isFinite(start) || start > t) continue
    lapNumber = lap.lap_number
    const secs = [lap.duration_sector_1, lap.duration_sector_2, lap.duration_sector_3]
    for (let i = 0; i < 3; i++) {
      const s = secs[i]
      if (s != null && (pbSectors[i] == null || s < pbSectors[i]!)) pbSectors[i] = s
    }
    if (lap.lap_duration != null) {
      lastLap = lap.lap_duration
      lastSectors = secs
      if (bestLap == null || lap.lap_duration < bestLap) bestLap = lap.lap_duration
    }
  }
  return { lastLap, bestLap, lapNumber, lastSectors, pbSectors }
}

function tyreInfo(data: RaceData, driverNumber: number, lapNumber: number | null) {
  const stints = data.stints.get(driverNumber)
  if (!stints?.length || lapNumber == null) return { compound: null, tyreAge: null }
  const cur = stints.find((s) => lapNumber >= s.lap_start && lapNumber <= s.lap_end) ?? stints[stints.length - 1]
  if (!cur) return { compound: null, tyreAge: null }
  return { compound: cur.compound, tyreAge: cur.tyre_age_at_start + Math.max(0, lapNumber - cur.lap_start) }
}

export function useDerived(data: RaceData | null, time: number): DerivedSnapshot {
  return useMemo(() => {
    if (!data) {
      return {
        standings: [],
        status: { kind: 'green', label: 'Track Clear' },
        fastestLap: null,
        leaderLap: null,
        totalLaps: 0,
        bestSectors: [null, null, null],
      }
    }

    const rows: StandingRow[] = []
    let fastestLap: DerivedSnapshot['fastestLap'] = null
    const bestSectors: (number | null)[] = [null, null, null]

    for (const driver of data.drivers) {
      const num = driver.driver_number

      const pos = data.position.get(num)
      const position =
        pos && pos.times.length
          ? (() => {
              const i = lastIndexAtOrBefore(pos.times, time)
              return i >= 0 ? pos.values[i] : null
            })()
          : null

      const iv = data.intervals.get(num)
      let gapToLeader: number | string | null = null
      let interval: number | string | null = null
      if (iv && iv.times.length) {
        const i = lastIndexAtOrBefore(iv.times, time)
        if (i >= 0) {
          gapToLeader = iv.gap[i]
          interval = iv.interval[i]
        }
      }

      const { lastLap, bestLap, lapNumber, lastSectors, pbSectors } = lapInfo(data, num, time)
      if (bestLap != null && (fastestLap == null || bestLap < fastestLap.time)) {
        fastestLap = { driverNumber: num, time: bestLap }
      }
      for (let i = 0; i < 3; i++) {
        if (pbSectors[i] != null && (bestSectors[i] == null || pbSectors[i]! < bestSectors[i]!)) {
          bestSectors[i] = pbSectors[i]
        }
      }
      const { compound, tyreAge } = tyreInfo(data, num, lapNumber)

      rows.push({
        driver,
        position,
        gapToLeader,
        interval,
        lastLap,
        bestLap,
        lapNumber,
        compound,
        tyreAge,
        lastSectors,
        pbSectors,
      })
    }

    rows.sort((a, b) => {
      if (a.position != null && b.position != null) return a.position - b.position
      if (a.position != null) return -1
      if (b.position != null) return 1
      return a.driver.driver_number - b.driver.driver_number
    })

    const leaderLap = rows.length ? rows[0].lapNumber : null

    return {
      standings: rows,
      status: deriveStatus(data, time),
      fastestLap,
      leaderLap,
      totalLaps: data.totalLaps,
      bestSectors,
    }
  }, [data, time])
}

/** Colour for a sector: purple = session best, green = personal best, white = normal. */
export function sectorColor(
  value: number | null,
  personalBest: number | null,
  sessionBest: number | null,
): SectorColor {
  if (value == null) return null
  if (sessionBest != null && value <= sessionBest + 1e-6) return 'purple'
  if (personalBest != null && value <= personalBest + 1e-6) return 'green'
  return 'white'
}
