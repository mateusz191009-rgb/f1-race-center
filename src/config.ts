// Central configuration for the F1 Race Center.

// Requests go through the local dev/preview proxy (see vite.config.ts), which
// fixes CORS and — if credentials are configured — attaches the OpenF1 auth
// token server-side. The proxy maps `/api/openf1/<endpoint>` -> the real
// `https://api.openf1.org/v1/<endpoint>`.
export const API_BASE = '/api/openf1'

// Default demo session: 2023 Singapore GP – Race (session_key 9165). Used as a
// fallback when the current season has no race data yet.
// Note: 9158 from the OpenF1 docs is actually *Practice 1* of the same weekend.
export const DEMO_SESSION_KEY = 9165

// The whole session is loaded into the replay window (capped for safety). Location
// data is dense (~3.7 Hz per driver), so it is fetched in time-chunks, decimated
// and loaded progressively rather than in one giant request.
export const MAX_SESSION_MINUTES = 200
export const LOCATION_CHUNK_MINUTES = 15
// Decimate location to ~this spacing (ms) per driver to cap memory (~2.8 Hz).
export const LOCATION_MIN_INTERVAL_MS = 350
// In live mode, only the trailing window is loaded.
export const LIVE_WINDOW_MINUTES = 10
// How far behind real-time the live clock sits (lets data arrive first).
export const LIVE_DELAY_MS = 6000

export const CURRENT_YEAR = new Date().getFullYear()

// Years selectable in the session browser. OpenF1 has free historical data from
// 2023 onwards, up to (and including) the current season.
export const AVAILABLE_YEARS: number[] = (() => {
  const last = Math.max(2023, CURRENT_YEAR)
  const years: number[] = []
  for (let y = last; y >= 2023; y--) years.push(y)
  return years
})()

// Replay playback speeds offered in the UI.
export const PLAYBACK_SPEEDS = [0.5, 1, 2, 5, 10] as const

// Live-mode polling intervals (ms). Used only when mode === 'live'. Kept modest
// to respect the API and avoid flooding it with requests.
export const LIVE_POLL = {
  location: 2000,
  carData: 2000,
  intervals: 4000,
  position: 4000,
  laps: 5000,
  raceControl: 5000,
  weather: 15000,
} as const

// Fallback team colour when the API returns a null team_colour.
export const FALLBACK_TEAM_COLOR = '#9aa0b4'

// Default total pit-loss estimate (s) for the pit-stop predictor. Includes the
// pit-lane delta vs. staying out, not just the stationary time.
export const DEFAULT_PIT_LOSS_S = 22
