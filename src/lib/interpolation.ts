// Time-series helpers for the replay clock.

export interface TimedPoint {
  t: number // epoch ms
  x: number
  y: number
}

export interface TimedValue<T> {
  t: number
  v: T
}

/** Finds the index of the last element with `t <= target` (binary search). */
export function lastIndexAtOrBefore(times: number[], target: number): number {
  let lo = 0
  let hi = times.length - 1
  let res = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (times[mid] <= target) {
      res = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return res
}

/**
 * Linearly interpolates a 2D position at time `t` from a sorted samples array.
 * Returns null before the first sample. Clamps to the last sample after the end.
 */
export function interpolatePosition(
  samples: TimedPoint[],
  times: number[],
  t: number,
): { x: number; y: number } | null {
  if (!samples.length) return null
  const i = lastIndexAtOrBefore(times, t)
  if (i < 0) return null
  if (i >= samples.length - 1) {
    const last = samples[samples.length - 1]
    return { x: last.x, y: last.y }
  }
  const a = samples[i]
  const b = samples[i + 1]
  const span = b.t - a.t
  if (span <= 0) return { x: a.x, y: a.y }
  const f = Math.min(1, Math.max(0, (t - a.t) / span))
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }
}

/** Returns the most recent value at-or-before `t`, or null. */
export function valueAt<T>(values: TimedValue<T>[], times: number[], t: number): T | null {
  const i = lastIndexAtOrBefore(times, t)
  if (i < 0) return null
  return values[i].v
}
