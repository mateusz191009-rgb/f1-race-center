// Telemetry for a single driver. Fetched on demand (only when a driver is
// selected) and bounded to the replay window to keep car_data volume in check.

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getCarData } from '@/api/openf1'
import type { CarDataSample } from '@/api/types'
import { LIVE_POLL } from '@/config'
import { toMs } from '@/lib/format'
import { lastIndexAtOrBefore } from '@/lib/interpolation'
import { useRaceStore } from '@/store/useRaceStore'

export interface TelemetrySnapshot {
  speed: number
  rpm: number
  gear: number
  throttle: number
  brake: number
  drs: boolean
}

export function useCarData(driverNumber: number | null) {
  const sessionKey = useRaceStore((s) => s.sessionKey)
  const mode = useRaceStore((s) => s.mode)
  const windowStart = useRaceStore((s) => s.windowStart)
  const windowEnd = useRaceStore((s) => s.windowEnd)
  const isLive = mode === 'live'

  const fromISO = windowStart ? new Date(windowStart).toISOString() : undefined
  const toISO = windowEnd ? new Date(windowEnd).toISOString() : undefined

  const query = useQuery({
    queryKey: ['carData', sessionKey, driverNumber, fromISO, toISO],
    queryFn: ({ signal }) =>
      getCarData(sessionKey!, driverNumber!, { from: fromISO, to: toISO }, { signal, noCache: isLive }),
    enabled: sessionKey != null && driverNumber != null && !!fromISO && !!toISO,
    refetchInterval: isLive ? LIVE_POLL.carData : false,
  })

  const indexed = useMemo(() => {
    const data = query.data
    if (!data?.length) return null
    const sorted = [...data].sort((a, b) => toMs(a.date) - toMs(b.date))
    return {
      samples: sorted as CarDataSample[],
      times: sorted.map((s) => toMs(s.date)),
    }
  }, [query.data])

  const sampleAt = useMemo(() => {
    return (t: number): TelemetrySnapshot | null => {
      if (!indexed) return null
      const i = lastIndexAtOrBefore(indexed.times, t)
      if (i < 0) return null
      const s = indexed.samples[i]
      return {
        speed: s.speed,
        rpm: s.rpm,
        gear: s.n_gear,
        throttle: s.throttle,
        brake: s.brake,
        // DRS open codes per OpenF1: 10, 12, 14 (and 8 = eligible/closed).
        drs: s.drs === 10 || s.drs === 12 || s.drs === 14,
      }
    }
  }, [indexed])

  return {
    loading: query.isLoading,
    error: query.error as Error | null,
    sampleAt,
    hasData: !!indexed,
    series: indexed,
  }
}
