import { create } from 'zustand'
import { CURRENT_YEAR, DEMO_SESSION_KEY, PLAYBACK_SPEEDS } from '@/config'

export type Mode = 'demo' | 'replay' | 'live'
export type CameraMode = 'orbit' | 'top' | 'follow' | 'tv'

interface RaceState {
  // ---- Session selection ----
  mode: Mode
  year: number
  meetingKey: number | null
  sessionKey: number | null
  /** True once a session has been chosen and data loading started. */
  hasSession: boolean
  selectorOpen: boolean

  // ---- Replay window (epoch ms) ----
  windowStart: number
  windowEnd: number

  // ---- Progressive location load (0..1, null when idle/done) ----
  loadProgress: number | null

  // ---- Clock (UI-facing, throttled). The precise per-frame time lives in
  // ClockProvider's ref; this value updates ~5x/second for React components. ----
  displayTime: number
  playing: boolean
  speed: number

  // ---- Interaction ----
  selectedDriver: number | null
  hoveredDriver: number | null
  cameraMode: CameraMode
  /** Use the realistic GLB car models instead of simple markers. */
  realisticCars: boolean
  /** Broadcast director: auto-select drivers/camera like a TV feed. */
  broadcast: boolean
  broadcastReason: string

  // ---- Actions ----
  openSelector: () => void
  closeSelector: () => void
  setYear: (year: number) => void
  selectSession: (meetingKey: number | null, sessionKey: number, mode: Mode) => void
  loadDemo: () => void
  setWindow: (start: number, end: number) => void
  setLoadProgress: (p: number | null) => void
  setDisplayTime: (t: number) => void
  play: () => void
  pause: () => void
  togglePlay: () => void
  setSpeed: (s: number) => void
  cycleSpeed: () => void
  selectDriver: (n: number | null) => void
  setSelectedDriver: (n: number | null) => void
  setBroadcastReason: (r: string) => void
  setHovered: (n: number | null) => void
  setCameraMode: (m: CameraMode) => void
  toggleRealisticCars: () => void
  toggleBroadcast: () => void
}

export const useRaceStore = create<RaceState>((set, get) => ({
  mode: 'demo',
  year: CURRENT_YEAR,
  meetingKey: null,
  sessionKey: null,
  hasSession: false,
  selectorOpen: true,

  windowStart: 0,
  windowEnd: 0,

  loadProgress: null,

  displayTime: 0,
  playing: false,
  speed: 1,

  selectedDriver: null,
  hoveredDriver: null,
  cameraMode: 'orbit',
  realisticCars: true,
  broadcast: false,
  broadcastReason: '',

  openSelector: () => set({ selectorOpen: true }),
  closeSelector: () => set({ selectorOpen: false }),
  setYear: (year) => set({ year }),

  selectSession: (meetingKey, sessionKey, mode) =>
    set({
      meetingKey,
      sessionKey,
      mode,
      hasSession: true,
      selectorOpen: false,
      playing: false,
      selectedDriver: null,
    }),

  loadDemo: () =>
    set({
      meetingKey: null,
      sessionKey: DEMO_SESSION_KEY,
      mode: 'demo',
      hasSession: true,
      selectorOpen: false,
      playing: false,
      selectedDriver: null,
    }),

  setWindow: (start, end) => set({ windowStart: start, windowEnd: end, displayTime: start }),
  setLoadProgress: (p) => set({ loadProgress: p }),
  setDisplayTime: (t) => set({ displayTime: t }),

  play: () => set({ playing: true }),
  pause: () => set({ playing: false }),
  togglePlay: () => set((s) => ({ playing: !s.playing })),
  setSpeed: (speed) => set({ speed }),
  cycleSpeed: () => {
    const cur = get().speed
    const idx = PLAYBACK_SPEEDS.indexOf(cur as (typeof PLAYBACK_SPEEDS)[number])
    const next = PLAYBACK_SPEEDS[(idx + 1) % PLAYBACK_SPEEDS.length]
    set({ speed: next })
  },

  selectDriver: (n) => set((s) => ({ selectedDriver: s.selectedDriver === n ? null : n })),
  setSelectedDriver: (n) => set({ selectedDriver: n }),
  setBroadcastReason: (r) => set({ broadcastReason: r }),
  setHovered: (n) => set({ hoveredDriver: n }),
  setCameraMode: (m) => set({ cameraMode: m }),
  toggleRealisticCars: () => set((s) => ({ realisticCars: !s.realisticCars })),
  toggleBroadcast: () =>
    set((s) =>
      s.broadcast
        ? { broadcast: false, broadcastReason: '', cameraMode: 'orbit' }
        : { broadcast: true, cameraMode: 'tv' },
    ),
}))
