import { useMemo } from 'react'
import { useRaceData } from '@/context/RaceDataContext'
import { useRaceStore } from '@/store/useRaceStore'
import { lastIndexAtOrBefore } from '@/lib/interpolation'

// A stylised weather "radar" for the circuit. OpenF1 exposes weather *samples*
// (track/air temp, humidity, rainfall flag, wind speed/direction) rather than
// radar imagery, so this visualises those: a sweeping radar dish with a wind
// vector and rain blips, plus a wet/dry timeline across the session.
function Metric({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="flex flex-col">
      <span className="label">{label}</span>
      <span className="text-sm font-semibold text-white">
        {value}
        {unit && <span className="ml-0.5 text-[10px] text-f1-mute">{unit}</span>}
      </span>
    </div>
  )
}

export function WeatherRadar() {
  const { raceData } = useRaceData()
  const time = useRaceStore((s) => s.displayTime)
  const start = useRaceStore((s) => s.windowStart)
  const end = useRaceStore((s) => s.windowEnd)

  const data = useMemo(() => {
    if (!raceData || !raceData.weather.length) return null
    const i = lastIndexAtOrBefore(raceData.weatherTimes, time)
    const w = i >= 0 ? raceData.weather[i] : raceData.weather[0]
    // Wet/dry timeline segments across the session window.
    const span = Math.max(1, end - start)
    const segments = raceData.weather.map((s, idx) => {
      const t0 = raceData.weatherTimes[idx]
      const t1 = raceData.weatherTimes[idx + 1] ?? end
      return {
        left: ((t0 - start) / span) * 100,
        width: (Math.max(0, t1 - t0) / span) * 100,
        wet: s.rainfall > 0,
      }
    })
    const playhead = ((time - start) / span) * 100
    return { w, segments, playhead }
  }, [raceData, time, start, end])

  if (!data) return null
  const { w, segments, playhead } = data
  const raining = w.rainfall > 0
  // SVG wind arrow points to where the wind blows TO (meteo direction is "from").
  const windTo = (w.wind_direction + 180) % 360

  return (
    <div className="glass w-56 px-3 py-2.5">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="heading text-xs tracking-wider text-white">WEATHER RADAR</span>
        <span
          className={`chip ${raining ? 'bg-flag-blue/25 text-sky-200' : 'bg-flag-green/15 text-green-200'}`}
        >
          {raining ? 'RAIN' : 'DRY'}
        </span>
      </div>

      <div className="flex items-center gap-3">
        {/* Radar dish */}
        <svg viewBox="0 0 100 100" className="h-24 w-24 shrink-0">
          <defs>
            <radialGradient id="radarBg" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={raining ? 'rgba(47,123,255,0.35)' : 'rgba(39,224,122,0.18)'} />
              <stop offset="100%" stopColor="rgba(0,0,0,0.2)" />
            </radialGradient>
            <linearGradient id="sweep" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="transparent" />
              <stop offset="100%" stopColor={raining ? '#2f7bff' : '#27e07a'} />
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r="46" fill="url(#radarBg)" stroke="rgba(255,255,255,0.15)" />
          <circle cx="50" cy="50" r="30" fill="none" stroke="rgba(255,255,255,0.1)" />
          <circle cx="50" cy="50" r="15" fill="none" stroke="rgba(255,255,255,0.1)" />
          <line x1="4" y1="50" x2="96" y2="50" stroke="rgba(255,255,255,0.08)" />
          <line x1="50" y1="4" x2="50" y2="96" stroke="rgba(255,255,255,0.08)" />

          {/* Sweep */}
          <g className="radar-sweep" style={{ transformBox: 'fill-box' }}>
            <path d="M50 50 L96 50 A46 46 0 0 1 73 90 Z" fill="url(#sweep)" opacity="0.5" />
          </g>

          {/* Rain blips */}
          {raining && (
            <>
              <circle cx="38" cy="40" r="2.5" fill="#2f7bff">
                <animate attributeName="opacity" values="0.2;1;0.2" dur="1.6s" repeatCount="indefinite" />
              </circle>
              <circle cx="64" cy="58" r="2" fill="#2f7bff">
                <animate attributeName="opacity" values="1;0.2;1" dur="2s" repeatCount="indefinite" />
              </circle>
              <circle cx="55" cy="33" r="1.6" fill="#5a9bff">
                <animate attributeName="opacity" values="0.4;1;0.4" dur="1.3s" repeatCount="indefinite" />
              </circle>
            </>
          )}

          {/* Wind vector */}
          <g transform={`rotate(${windTo} 50 50)`}>
            <line x1="50" y1="50" x2="50" y2="16" stroke="#ffd000" strokeWidth="2" />
            <path d="M50 12 L46 20 L54 20 Z" fill="#ffd000" />
          </g>
          <circle cx="50" cy="50" r="2.5" fill="#fff" />
        </svg>

        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
          <Metric label="Track" value={w.track_temperature.toFixed(1)} unit="°C" />
          <Metric label="Air" value={w.air_temperature.toFixed(1)} unit="°C" />
          <Metric label="Humid" value={w.humidity.toFixed(0)} unit="%" />
          <Metric label="Wind" value={w.wind_speed.toFixed(1)} unit="m/s" />
        </div>
      </div>

      {/* Wet/dry timeline */}
      <div className="relative mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
        {segments.map((s, i) => (
          <div
            key={i}
            className="absolute top-0 h-full"
            style={{ left: `${s.left}%`, width: `${s.width}%`, background: s.wet ? '#2f7bff' : 'rgba(39,224,122,0.5)' }}
          />
        ))}
        <div className="absolute top-[-2px] h-[10px] w-0.5 bg-white" style={{ left: `${playhead}%` }} />
      </div>
      <div className="mt-0.5 flex justify-between">
        <span className="label">Rain timeline</span>
        <span className="label">wind {Math.round(w.wind_direction)}°</span>
      </div>
    </div>
  )
}
