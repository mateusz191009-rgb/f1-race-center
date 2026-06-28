import { FALLBACK_TEAM_COLOR } from '@/config'

/** Parses an ISO date string to epoch ms. Returns NaN for null/invalid. */
export function toMs(date: string | null | undefined): number {
  if (!date) return NaN
  return new Date(date).getTime()
}

/** "3671C6" -> "#3671C6"; handles already-prefixed and null values. */
export function teamColor(colour: string | null | undefined): string {
  if (!colour) return FALLBACK_TEAM_COLOR
  return colour.startsWith('#') ? colour : `#${colour}`
}

/** Formats a lap/sector duration in seconds to "m:ss.mmm" or "ss.mmm". */
export function formatLapTime(seconds: number | null | undefined): string {
  if (seconds == null || !isFinite(seconds)) return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds - m * 60
  if (m > 0) {
    return `${m}:${s.toFixed(3).padStart(6, '0')}`
  }
  return s.toFixed(3)
}

/** Formats a gap value which may be a number (seconds) or "+1 LAP" string. */
export function formatGap(gap: number | string | null | undefined): string {
  if (gap == null) return '—'
  if (typeof gap === 'string') return gap
  if (!isFinite(gap)) return '—'
  if (gap === 0) return 'LEADER'
  return `+${gap.toFixed(3)}`
}

/** Formats an interval (seconds) to "+x.xxx". */
export function formatInterval(gap: number | string | null | undefined): string {
  if (gap == null) return '—'
  if (typeof gap === 'string') return gap
  if (!isFinite(gap)) return '—'
  return `+${gap.toFixed(3)}`
}

/** Epoch ms -> "HH:MM:SS" in the local timezone. */
export function formatClock(ms: number): string {
  if (!isFinite(ms)) return '--:--:--'
  const d = new Date(ms)
  return d.toLocaleTimeString('en-GB', { hour12: false })
}

/** Elapsed ms relative to a start -> "MM:SS". */
export function formatElapsed(ms: number): string {
  if (!isFinite(ms) || ms < 0) return '00:00'
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export const COMPOUND_COLORS: Record<string, string> = {
  SOFT: '#ff3b3b',
  MEDIUM: '#ffd000',
  HARD: '#f4f4f4',
  INTERMEDIATE: '#27e07a',
  WET: '#2f7bff',
}

export function compoundColor(compound: string | null | undefined): string {
  if (!compound) return FALLBACK_TEAM_COLOR
  return COMPOUND_COLORS[compound.toUpperCase()] ?? FALLBACK_TEAM_COLOR
}

export function compoundShort(compound: string | null | undefined): string {
  if (!compound) return '—'
  const map: Record<string, string> = {
    SOFT: 'S',
    MEDIUM: 'M',
    HARD: 'H',
    INTERMEDIATE: 'I',
    WET: 'W',
  }
  return map[compound.toUpperCase()] ?? compound[0]
}
