// Track geometry helpers: turn raw OpenF1 location samples into a clean,
// normalised track centerline for the 3D scene, plus a shared coordinate
// mapper so cars and the track use the same projection.

import type { CompactLoc } from '@/api/types'

export interface Vec2 {
  x: number
  y: number
}

export interface TrackModel {
  /** Closed-loop centerline in scene coordinates (X, Z), Y is up. */
  centerline: [number, number][]
  /** Maps raw OpenF1 (x, y) to scene (X, Z). */
  project: (x: number, y: number) => [number, number]
  /** Scene-space extent (used to size the camera/ground). */
  size: number
  /** Total centerline length in scene units (for realistic car scaling). */
  lengthUnits: number
}

const SCENE_SIZE = 170 // target max dimension of the track in scene units

function bounds(points: Vec2[]) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of points) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  return { minX, minY, maxX, maxY }
}

function dist(a: Vec2, b: Vec2) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/**
 * Detects one full lap from a stream of points using loop-closure: walk forward
 * until we are far from the start, then return as soon as we come back near it.
 */
function isolateOneLap(points: Vec2[]): Vec2[] {
  if (points.length < 20) return points
  const b = bounds(points)
  const diag = Math.hypot(b.maxX - b.minX, b.maxY - b.minY) || 1

  // Start a little way in to avoid grid/pit-exit noise.
  const startIdx = Math.min(points.length - 1, Math.floor(points.length * 0.04))
  const start = points[startIdx]
  const minAway = diag * 0.3
  const closeEnough = diag * 0.03

  let awayReached = false
  for (let i = startIdx + 1; i < points.length; i++) {
    const d = dist(points[i], start)
    if (d > minAway) awayReached = true
    if (awayReached && d < closeEnough) {
      return points.slice(startIdx, i + 1)
    }
  }
  // No closure found – fall back to the whole stream.
  return points.slice(startIdx)
}

/** Reduces a dense point list to at most `target` evenly-spaced points. */
function downsample<T>(points: T[], target: number): T[] {
  if (points.length <= target) return points
  const step = points.length / target
  const out: T[] = []
  for (let i = 0; i < target; i++) {
    out.push(points[Math.floor(i * step)])
  }
  return out
}

/** Centripetal-ish Catmull-Rom smoothing for a closed loop. */
function smoothClosed(points: [number, number][], iterations = 2): [number, number][] {
  let pts = points
  for (let it = 0; it < iterations; it++) {
    const next: [number, number][] = []
    const n = pts.length
    for (let i = 0; i < n; i++) {
      const a = pts[(i - 1 + n) % n]
      const b = pts[i]
      const c = pts[(i + 1) % n]
      next.push([(a[0] + 2 * b[0] + c[0]) / 4, (a[1] + 2 * b[1] + c[1]) / 4])
    }
    pts = next
  }
  return pts
}

/**
 * Builds a TrackModel from raw location samples (any number of drivers). It
 * picks the driver with the most samples as the reference, isolates a single
 * lap, and computes a shared projection so every car aligns with the track.
 */
export function buildTrack(locations: CompactLoc[]): TrackModel | null {
  if (!locations.length) return null

  // Group by driver, pick the most complete trace.
  const byDriver = new Map<number, CompactLoc[]>()
  for (const s of locations) {
    const arr = byDriver.get(s.d)
    if (arr) arr.push(s)
    else byDriver.set(s.d, [s])
  }
  let reference: CompactLoc[] = []
  for (const arr of byDriver.values()) {
    if (arr.length > reference.length) reference = arr
  }
  if (reference.length < 20) return null

  reference.sort((a, b) => a.t - b.t)
  const lap = isolateOneLap(reference)
  const sampled = downsample(lap, 320)

  // Projection is derived from ALL points so the whole field stays in frame.
  const b = bounds(locations)
  const spanX = b.maxX - b.minX || 1
  const spanY = b.maxY - b.minY || 1
  const scale = SCENE_SIZE / Math.max(spanX, spanY)
  const cx = (b.minX + b.maxX) / 2
  const cy = (b.minY + b.maxY) / 2

  const project = (x: number, y: number): [number, number] => [
    (x - cx) * scale,
    // Negate so the track isn't mirrored relative to the source coordinate frame.
    -(y - cy) * scale,
  ]

  const centerline = smoothClosed(sampled.map((p) => project(p.x, p.y)))

  let lengthUnits = 0
  for (let i = 0; i < centerline.length; i++) {
    const a = centerline[i]
    const b2 = centerline[(i + 1) % centerline.length]
    lengthUnits += Math.hypot(b2[0] - a[0], b2[1] - a[1])
  }

  return {
    centerline,
    project,
    size: SCENE_SIZE,
    lengthUnits,
  }
}
