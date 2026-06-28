// Loads everything for the selected session and returns a memoised RaceData
// index. Server state + caching + cancellation are handled by React Query; the
// replay window is derived from the session meta and pushed into the store.

import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  getDrivers,
  getIntervals,
  getLaps,
  getLocationsChunked,
  getPits,
  getPositions,
  getRaceControl,
  getSession,
  getStints,
  getWeather,
} from '@/api/openf1'
import type { Session } from '@/api/types'
import {
  LIVE_POLL,
  LIVE_WINDOW_MINUTES,
  LOCATION_CHUNK_MINUTES,
  LOCATION_MIN_INTERVAL_MS,
  MAX_SESSION_MINUTES,
} from '@/config'
import { toMs } from '@/lib/format'
import { buildRaceData } from '@/lib/raceData'
import { useRaceStore } from '@/store/useRaceStore'

export function useSessionData() {
  const sessionKey = useRaceStore((s) => s.sessionKey)
  const mode = useRaceStore((s) => s.mode)
  const setWindow = useRaceStore((s) => s.setWindow)
  const setLoadProgress = useRaceStore((s) => s.setLoadProgress)
  const isLive = mode === 'live'

  const sessionQ = useQuery({
    queryKey: ['session', sessionKey],
    queryFn: ({ signal }) => getSession(sessionKey!, { signal }),
    enabled: sessionKey != null,
  })
  const session: Session | undefined = sessionQ.data?.[0]

  const enabled = sessionKey != null
  const poll = (key: keyof typeof LIVE_POLL) => (isLive ? LIVE_POLL[key] : false)

  const driversQ = useQuery({
    queryKey: ['drivers', sessionKey],
    queryFn: ({ signal }) => getDrivers(sessionKey!, { signal }),
    enabled,
  })

  // Laps + race control are window-independent and also reveal when the session
  // ACTUALLY stopped running. OpenF1's date_end is sometimes too early (e.g. a
  // qualifying that overruns due to red flags), so we extend the window with them.
  const lapsQ = useQuery({
    queryKey: ['laps', sessionKey],
    queryFn: ({ signal }) => getLaps(sessionKey!, undefined, { signal, noCache: isLive }),
    enabled,
    refetchInterval: poll('laps'),
  })

  const raceControlQ = useQuery({
    queryKey: ['raceControl', sessionKey],
    queryFn: ({ signal }) => getRaceControl(sessionKey!, { signal, noCache: isLive }),
    enabled,
    refetchInterval: poll('raceControl'),
  })

  // Effective session end = latest of date_end, last race-control message and
  // last lap finish (+ a small tail buffer).
  const effectiveEnd = useMemo(() => {
    if (!session) return null
    // Wait until laps + race control are available so the window covers the real
    // running time on the first (and only) location fetch.
    if (lapsQ.data === undefined || raceControlQ.data === undefined) return null
    const start = toMs(session.date_start)
    if (!isFinite(start)) return null
    let end = toMs(session.date_end)
    if (!isFinite(end)) end = start
    for (const m of raceControlQ.data ?? []) {
      const t = toMs(m.date)
      if (isFinite(t) && t > end) end = t
    }
    for (const l of lapsQ.data ?? []) {
      const ds = toMs(l.date_start)
      if (!isFinite(ds)) continue
      const fin = ds + (l.lap_duration ?? 120) * 1000
      if (fin > end) end = fin
    }
    return end + 30_000 // tail buffer
  }, [session, raceControlQ.data, lapsQ.data])

  // Derive the replay window. Replay/demo loads the WHOLE session (capped for
  // safety); live loads only the trailing window.
  const window = useMemo(() => {
    if (!session || effectiveEnd == null) return null
    const start = toMs(session.date_start)
    if (!isFinite(start)) return null
    const capMs = MAX_SESSION_MINUTES * 60_000
    let from: number
    let to: number
    if (isLive) {
      to = Math.min(Date.now(), effectiveEnd)
      from = Math.max(start, to - LIVE_WINDOW_MINUTES * 60_000)
    } else {
      from = start
      to = Math.min(effectiveEnd, start + capMs)
    }
    return { from, to, fromISO: new Date(from).toISOString(), toISO: new Date(to).toISOString() }
  }, [session, effectiveEnd, isLive])

  useEffect(() => {
    if (window) setWindow(window.from, window.to)
  }, [window, setWindow])

  const winEnabled = enabled && window != null

  const locationsQ = useQuery({
    queryKey: ['locations', sessionKey, window?.fromISO, window?.toISO],
    queryFn: ({ signal }) => {
      setLoadProgress(0)
      return getLocationsChunked(sessionKey!, window!.from, window!.to, {
        chunkMs: LOCATION_CHUNK_MINUTES * 60_000,
        minIntervalMs: LOCATION_MIN_INTERVAL_MS,
        signal,
        noCache: isLive,
        onProgress: (p) => setLoadProgress(p < 1 ? p : null),
      })
    },
    enabled: winEnabled,
    refetchInterval: poll('location'),
  })

  const intervalsQ = useQuery({
    queryKey: ['intervals', sessionKey],
    queryFn: ({ signal }) => getIntervals(sessionKey!, { signal, noCache: isLive }),
    enabled,
    refetchInterval: poll('intervals'),
  })

  const positionsQ = useQuery({
    queryKey: ['positions', sessionKey],
    queryFn: ({ signal }) => getPositions(sessionKey!, { signal, noCache: isLive }),
    enabled,
    refetchInterval: poll('position'),
  })

  const weatherQ = useQuery({
    queryKey: ['weather', sessionKey],
    queryFn: ({ signal }) => getWeather(sessionKey!, { signal, noCache: isLive }),
    enabled,
    refetchInterval: poll('weather'),
  })

  const stintsQ = useQuery({
    queryKey: ['stints', sessionKey],
    queryFn: ({ signal }) => getStints(sessionKey!, { signal }),
    enabled,
  })

  const pitsQ = useQuery({
    queryKey: ['pits', sessionKey],
    queryFn: ({ signal }) => getPits(sessionKey!, { signal }),
    enabled,
  })

  // The two essential datasets for the experience are drivers + locations.
  const coreLoading = sessionQ.isLoading || driversQ.isLoading || locationsQ.isLoading
  const coreError = sessionQ.error || driversQ.error || locationsQ.error || null

  const raceData = useMemo(() => {
    if (!driversQ.data || !locationsQ.data) return null
    return buildRaceData({
      drivers: driversQ.data,
      locations: locationsQ.data,
      laps: lapsQ.data ?? [],
      intervals: intervalsQ.data ?? [],
      positions: positionsQ.data ?? [],
      raceControl: raceControlQ.data ?? [],
      weather: weatherQ.data ?? [],
      stints: stintsQ.data ?? [],
      pits: pitsQ.data ?? [],
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    driversQ.data,
    locationsQ.data,
    lapsQ.data,
    intervalsQ.data,
    positionsQ.data,
    raceControlQ.data,
    weatherQ.data,
    stintsQ.data,
    pitsQ.data,
  ])

  return {
    session,
    raceData,
    window,
    loading: coreLoading,
    error: coreError as Error | null,
    // Secondary loading state for non-essential panels.
    enriching:
      lapsQ.isLoading ||
      intervalsQ.isLoading ||
      positionsQ.isLoading ||
      raceControlQ.isLoading ||
      weatherQ.isLoading,
    refetchAll: () => {
      sessionQ.refetch()
      driversQ.refetch()
      locationsQ.refetch()
      lapsQ.refetch()
      intervalsQ.refetch()
      positionsQ.refetch()
      raceControlQ.refetch()
      weatherQ.refetch()
      stintsQ.refetch()
      pitsQ.refetch()
    },
  }
}
