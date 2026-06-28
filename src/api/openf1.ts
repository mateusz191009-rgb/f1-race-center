// OpenF1 API service layer.
//
// Every endpoint used by the app lives here as a small typed function. Each one
// accepts an optional AbortSignal so callers (React Query) can cancel in-flight
// requests. A tiny in-memory cache de-duplicates identical historical requests
// across the session lifetime (React Query also caches, but this protects
// against bursts during initial load).

import { API_BASE } from '@/config'
import type {
  CarDataSample,
  Driver,
  CompactLoc,
  Interval,
  Lap,
  LocationSample,
  Meeting,
  PitStop,
  PositionRecord,
  RaceControlMessage,
  Session,
  Stint,
  TeamRadio,
  WeatherSample,
} from './types'

type ParamValue = string | number | boolean | undefined | null

/**
 * Builds a query string. Keys may embed an OpenF1 comparison operator, e.g.
 * `"date>="` or `"date<"`. When the key already ends in an operator character
 * we append the value directly (`date>=VALUE`); otherwise we use `key=VALUE`.
 */
function buildQuery(params: Record<string, ParamValue>): string {
  const parts: string[] = []
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    const encoded = encodeURIComponent(String(value))
    const last = key[key.length - 1]
    const sep = last === '=' || last === '>' || last === '<' ? '' : '='
    parts.push(`${key}${sep}${encoded}`)
  }
  return parts.length ? `?${parts.join('&')}` : ''
}

const memcache = new Map<string, unknown>()

export class OpenF1Error extends Error {
  status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.name = 'OpenF1Error'
    this.status = status
  }
}

interface FetchOpts {
  signal?: AbortSignal
  /** Skip the in-memory cache (used for live polling). */
  noCache?: boolean
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// --- Client-side request throttle ---------------------------------------------
// OpenF1's anonymous API rate-limits bursts. The app loads ~10 datasets at once,
// so we cap concurrency and space out request starts, with exponential backoff
// + Retry-After handling on 429. This keeps the whole load under the limit.
const MAX_CONCURRENT = 2
const MIN_SPACING_MS = 350
const MAX_RETRIES = 5

let active = 0
let lastStart = 0

async function acquireSlot(signal?: AbortSignal) {
  while (active >= MAX_CONCURRENT) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    await sleep(40)
  }
  const wait = Math.max(0, lastStart + MIN_SPACING_MS - Date.now())
  if (wait) await sleep(wait)
  lastStart = Date.now()
  active++
}

async function apiGet<T>(
  endpoint: string,
  params: Record<string, ParamValue> = {},
  opts: FetchOpts = {},
): Promise<T[]> {
  const url = `${API_BASE}/${endpoint}${buildQuery(params)}`

  if (!opts.noCache && memcache.has(url)) {
    return memcache.get(url) as T[]
  }

  await acquireSlot(opts.signal)
  try {
    for (let attempt = 0; ; attempt++) {
      let res: Response
      try {
        res = await fetch(url, { signal: opts.signal, headers: { accept: 'application/json' } })
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') throw err
        throw new OpenF1Error(
          `Network error contacting OpenF1. Check your connection or try again. (${endpoint})`,
        )
      }

      // 429: back off and retry within the held slot.
      if (res.status === 429) {
        if (attempt >= MAX_RETRIES) {
          throw new OpenF1Error('OpenF1 rate limit reached – please wait a moment and retry.', 429)
        }
        const retryAfter = Number(res.headers.get('retry-after'))
        const delay =
          isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 600 * 2 ** attempt
        await sleep(delay)
        continue
      }

      // OpenF1 returns 404 when a query matches zero rows (rather than an empty
      // array). Treat that as an empty result so optional/empty datasets don't
      // break the app (e.g. no pit stops, or a window with no samples).
      if (res.status === 404) {
        const empty: T[] = []
        if (!opts.noCache) memcache.set(url, empty)
        return empty
      }
      if (!res.ok) {
        throw new OpenF1Error(`OpenF1 request failed (${res.status}) for ${endpoint}.`, res.status)
      }

      const data = (await res.json()) as T[]
      if (!opts.noCache) memcache.set(url, data)
      return data
    }
  } finally {
    active--
  }
}

// ---------------------------------------------------------------------------
// Endpoint helpers
// ---------------------------------------------------------------------------

export function getMeetings(year: number, opts?: FetchOpts) {
  return apiGet<Meeting>('meetings', { year }, opts)
}

export function getSessions(meetingKey: number, opts?: FetchOpts) {
  return apiGet<Session>('sessions', { meeting_key: meetingKey }, opts)
}

export function getSession(sessionKey: number, opts?: FetchOpts) {
  return apiGet<Session>('sessions', { session_key: sessionKey }, opts)
}

/** "latest" is a special OpenF1 keyword that resolves to the live/most recent session. */
export function getLatestSession(opts?: FetchOpts) {
  return apiGet<Session>('sessions', { session_key: 'latest' }, opts)
}

export function getDrivers(sessionKey: number, opts?: FetchOpts) {
  return apiGet<Driver>('drivers', { session_key: sessionKey }, opts)
}

export function getLocations(
  sessionKey: number,
  range?: { from?: string; to?: string; driverNumber?: number },
  opts?: FetchOpts,
) {
  return apiGet<LocationSample>(
    'location',
    {
      session_key: sessionKey,
      driver_number: range?.driverNumber,
      'date>=': range?.from,
      'date<=': range?.to,
    },
    opts,
  )
}

/**
 * Loads location for an entire time range by fetching it in parallel time-chunks
 * (the throttle limits real concurrency), then compacting + decimating per driver
 * to keep memory bounded. Reports progress 0..1 as chunks complete.
 */
export async function getLocationsChunked(
  sessionKey: number,
  fromMs: number,
  toMs: number,
  config: {
    chunkMs: number
    minIntervalMs: number
    onProgress?: (p: number) => void
    signal?: AbortSignal
    noCache?: boolean
  },
): Promise<CompactLoc[]> {
  const ranges: [number, number][] = []
  for (let s = fromMs; s < toMs; s += config.chunkMs) {
    ranges.push([s, Math.min(toMs, s + config.chunkMs)])
  }
  if (!ranges.length) return []

  let done = 0
  const chunkResults = await Promise.all(
    ranges.map(async ([a, b]) => {
      const raw = await apiGet<LocationSample>(
        'location',
        { session_key: sessionKey, 'date>=': new Date(a).toISOString(), 'date<=': new Date(b).toISOString() },
        { signal: config.signal, noCache: config.noCache },
      )
      // Compact immediately so the raw (string-heavy) payload can be GC'd.
      const compact: CompactLoc[] = []
      for (const s of raw) {
        if (s.x === 0 && s.y === 0) continue
        compact.push({ d: s.driver_number, t: new Date(s.date).getTime(), x: s.x, y: s.y })
      }
      done++
      config.onProgress?.(done / ranges.length)
      return compact
    }),
  )

  // Merge, then decimate per driver to ~config.minIntervalMs spacing.
  const byDriver = new Map<number, CompactLoc[]>()
  for (const chunk of chunkResults) {
    for (const p of chunk) {
      const arr = byDriver.get(p.d)
      if (arr) arr.push(p)
      else byDriver.set(p.d, [p])
    }
  }
  const out: CompactLoc[] = []
  for (const arr of byDriver.values()) {
    arr.sort((a, b) => a.t - b.t)
    let lastT = -Infinity
    for (const p of arr) {
      if (p.t - lastT >= config.minIntervalMs) {
        out.push(p)
        lastT = p.t
      }
    }
  }
  return out
}

export function getLaps(sessionKey: number, driverNumber?: number, opts?: FetchOpts) {
  return apiGet<Lap>('laps', { session_key: sessionKey, driver_number: driverNumber }, opts)
}

export function getIntervals(sessionKey: number, opts?: FetchOpts) {
  return apiGet<Interval>('intervals', { session_key: sessionKey }, opts)
}

export function getPositions(sessionKey: number, opts?: FetchOpts) {
  return apiGet<PositionRecord>('position', { session_key: sessionKey }, opts)
}

export function getCarData(
  sessionKey: number,
  driverNumber: number,
  range?: { from?: string; to?: string },
  opts?: FetchOpts,
) {
  return apiGet<CarDataSample>(
    'car_data',
    {
      session_key: sessionKey,
      driver_number: driverNumber,
      'date>=': range?.from,
      'date<=': range?.to,
    },
    opts,
  )
}

export function getRaceControl(sessionKey: number, opts?: FetchOpts) {
  return apiGet<RaceControlMessage>('race_control', { session_key: sessionKey }, opts)
}

export function getWeather(sessionKey: number, opts?: FetchOpts) {
  return apiGet<WeatherSample>('weather', { session_key: sessionKey }, opts)
}

export function getPits(sessionKey: number, opts?: FetchOpts) {
  return apiGet<PitStop>('pit', { session_key: sessionKey }, opts)
}

export function getStints(sessionKey: number, opts?: FetchOpts) {
  return apiGet<Stint>('stints', { session_key: sessionKey }, opts)
}

export function getTeamRadio(sessionKey: number, driverNumber?: number, opts?: FetchOpts) {
  return apiGet<TeamRadio>(
    'team_radio',
    { session_key: sessionKey, driver_number: driverNumber },
    opts,
  )
}
