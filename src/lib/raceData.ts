// Pure normalisation: turn the raw API arrays into indexed structures that are
// fast to query at any replay time. Built once per data load (memoised), then
// sampled cheaply on every clock tick.

import type {
  CompactLoc,
  Driver,
  Interval,
  Lap,
  PitStop,
  PositionRecord,
  RaceControlMessage,
  Stint,
  WeatherSample,
} from '@/api/types'
import type { TrackModel } from './geometry'
import { buildTrack } from './geometry'
import { toMs } from './format'
import type { TimedPoint } from './interpolation'

export interface DriverTrace {
  pts: TimedPoint[]
  times: number[]
}

export interface SeriesNum {
  times: number[]
  values: number[]
}

export interface RaceData {
  track: TrackModel | null
  drivers: Driver[]
  driversByNumber: Map<number, Driver>
  /** Scene-space position samples per driver. */
  traces: Map<number, DriverTrace>
  position: Map<number, SeriesNum>
  intervals: Map<number, { times: number[]; gap: (number | string | null)[]; interval: (number | string | null)[] }>
  laps: Map<number, Lap[]>
  stints: Map<number, Stint[]>
  pits: Map<number, PitStop[]>
  raceControl: RaceControlMessage[]
  raceControlTimes: number[]
  weather: WeatherSample[]
  weatherTimes: number[]
  /** Highest lap number seen in the session (race distance). */
  totalLaps: number
}

interface RawBundle {
  drivers: Driver[]
  locations: CompactLoc[]
  laps: Lap[]
  intervals: Interval[]
  positions: PositionRecord[]
  raceControl: RaceControlMessage[]
  weather: WeatherSample[]
  stints: Stint[]
  pits: PitStop[]
}

function groupBy<T>(items: T[], key: (t: T) => number): Map<number, T[]> {
  const map = new Map<number, T[]>()
  for (const item of items) {
    const k = key(item)
    const arr = map.get(k)
    if (arr) arr.push(item)
    else map.set(k, [item])
  }
  return map
}

export function buildRaceData(raw: RawBundle): RaceData {
  const track = buildTrack(raw.locations)

  const drivers = [...raw.drivers].sort((a, b) => a.driver_number - b.driver_number)
  const driversByNumber = new Map(drivers.map((d) => [d.driver_number, d]))

  // --- Scene-space traces from (compact, decimated) location samples ---
  const traces = new Map<number, DriverTrace>()
  if (track) {
    const byDriver = groupBy(raw.locations, (l) => l.d)
    for (const [num, samples] of byDriver) {
      samples.sort((a, b) => a.t - b.t)
      const pts: TimedPoint[] = []
      const times: number[] = []
      for (const s of samples) {
        const [x, y] = track.project(s.x, s.y)
        pts.push({ t: s.t, x, y })
        times.push(s.t)
      }
      traces.set(num, { pts, times })
    }
  }

  // --- Position ---
  const position = new Map<number, SeriesNum>()
  for (const [num, recs] of groupBy(raw.positions, (p) => p.driver_number)) {
    recs.sort((a, b) => toMs(a.date) - toMs(b.date))
    position.set(num, {
      times: recs.map((r) => toMs(r.date)),
      values: recs.map((r) => r.position),
    })
  }

  // --- Intervals ---
  const intervals = new Map<
    number,
    { times: number[]; gap: (number | string | null)[]; interval: (number | string | null)[] }
  >()
  for (const [num, recs] of groupBy(raw.intervals, (i) => i.driver_number)) {
    recs.sort((a, b) => toMs(a.date) - toMs(b.date))
    intervals.set(num, {
      times: recs.map((r) => toMs(r.date)),
      gap: recs.map((r) => r.gap_to_leader),
      interval: recs.map((r) => r.interval),
    })
  }

  // --- Laps / stints / pits ---
  const laps = new Map<number, Lap[]>()
  for (const [num, recs] of groupBy(raw.laps, (l) => l.driver_number)) {
    recs.sort((a, b) => a.lap_number - b.lap_number)
    laps.set(num, recs)
  }
  const stints = new Map<number, Stint[]>()
  for (const [num, recs] of groupBy(raw.stints, (s) => s.driver_number)) {
    recs.sort((a, b) => a.stint_number - b.stint_number)
    stints.set(num, recs)
  }
  const pits = new Map<number, PitStop[]>()
  for (const [num, recs] of groupBy(raw.pits, (p) => p.driver_number)) {
    recs.sort((a, b) => toMs(a.date) - toMs(b.date))
    pits.set(num, recs)
  }

  // --- Race control & weather (global, time-sorted) ---
  const raceControl = [...raw.raceControl].sort((a, b) => toMs(a.date) - toMs(b.date))
  const raceControlTimes = raceControl.map((m) => toMs(m.date))
  const weather = [...raw.weather].sort((a, b) => toMs(a.date) - toMs(b.date))
  const weatherTimes = weather.map((w) => toMs(w.date))

  let totalLaps = 0
  for (const lap of raw.laps) if (lap.lap_number > totalLaps) totalLaps = lap.lap_number

  return {
    track,
    drivers,
    driversByNumber,
    traces,
    position,
    intervals,
    laps,
    stints,
    pits,
    raceControl,
    raceControlTimes,
    weather,
    weatherTimes,
    totalLaps,
  }
}

// ---------------------------------------------------------------------------
// Time-sampled derived snapshots
// ---------------------------------------------------------------------------

export type StatusKind = 'green' | 'yellow' | 'vsc' | 'sc' | 'red' | 'chequered'

export interface SessionStatus {
  kind: StatusKind
  label: string
}

export function deriveStatus(data: RaceData, timeMs: number): SessionStatus {
  let red = false
  let sc = false
  let vsc = false
  let yellow = false
  let chequered = false

  for (let i = 0; i < data.raceControl.length; i++) {
    if (data.raceControlTimes[i] > timeMs) break
    const m = data.raceControl[i]
    const cat = m.category
    const flag = (m.flag ?? '').toUpperCase()
    const text = (m.message ?? '').toUpperCase()

    if (cat === 'SafetyCar' || text.includes('SAFETY CAR')) {
      const ending = text.includes('IN THIS LAP') || text.includes('ENDING')
      if (text.includes('VIRTUAL')) {
        vsc = !ending
      } else {
        sc = !ending
      }
      continue
    }
    if (flag === 'RED') red = true
    else if (flag === 'CHEQUERED') chequered = true
    else if (flag === 'YELLOW' || flag === 'DOUBLE YELLOW') yellow = true
    else if (flag === 'GREEN' || flag === 'CLEAR') {
      // A track-wide green/clear lifts yellow/red and ends a chequered period
      // (e.g. between qualifying segments).
      if (m.scope === 'Track' || m.scope == null) {
        yellow = false
        red = false
        chequered = false
      }
    }
  }

  if (chequered) return { kind: 'chequered', label: 'Chequered Flag' }
  if (red) return { kind: 'red', label: 'Red Flag' }
  if (sc) return { kind: 'sc', label: 'Safety Car' }
  if (vsc) return { kind: 'vsc', label: 'Virtual Safety Car' }
  if (yellow) return { kind: 'yellow', label: 'Yellow Flag' }
  return { kind: 'green', label: 'Track Clear' }
}

/**
 * Best-effort qualifying segment (Q1/Q2/Q3) inferred from the number of
 * track-wide chequered flags seen so far – each Q segment ends with one.
 */
export function deriveQualiPhase(data: RaceData, timeMs: number): string | null {
  let chequered = 0
  for (let i = 0; i < data.raceControl.length; i++) {
    if (data.raceControlTimes[i] > timeMs) break
    const m = data.raceControl[i]
    if ((m.flag ?? '').toUpperCase() === 'CHEQUERED' && (m.scope === 'Track' || m.scope == null)) {
      chequered++
    }
  }
  if (chequered >= 3) return 'Done'
  return ['Q1', 'Q2', 'Q3'][chequered]
}
