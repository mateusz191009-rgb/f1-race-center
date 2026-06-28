import { useRaceData } from '@/context/RaceDataContext'
import { useRaceStore } from '@/store/useRaceStore'
import { lastIndexAtOrBefore } from '@/lib/interpolation'

function Metric({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="flex flex-col">
      <span className="label">{label}</span>
      <span className="text-sm font-semibold text-white">
        {value}
        {unit && <span className="ml-0.5 text-xs text-f1-mute">{unit}</span>}
      </span>
    </div>
  )
}

export function WeatherWidget() {
  const { raceData } = useRaceData()
  const time = useRaceStore((s) => s.displayTime)

  if (!raceData || !raceData.weather.length) return null
  const i = lastIndexAtOrBefore(raceData.weatherTimes, time)
  const w = i >= 0 ? raceData.weather[i] : raceData.weather[0]
  const raining = w.rainfall > 0

  return (
    <div className="glass px-3 py-2">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-base">{raining ? '🌧️' : '☀️'}</span>
        <span className="label">Weather</span>
        {raining && <span className="chip bg-flag-blue/20 text-sky-200">RAIN</span>}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        <Metric label="Track" value={w.track_temperature.toFixed(1)} unit="°C" />
        <Metric label="Air" value={w.air_temperature.toFixed(1)} unit="°C" />
        <Metric label="Humidity" value={w.humidity.toFixed(0)} unit="%" />
        <Metric label="Wind" value={w.wind_speed.toFixed(1)} unit="m/s" />
      </div>
    </div>
  )
}
