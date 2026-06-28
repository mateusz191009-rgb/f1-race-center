import { useMemo } from 'react'
import { Area, AreaChart, ResponsiveContainer, YAxis } from 'recharts'
import clsx from 'clsx'
import { useCarData } from '@/hooks/useCarData'
import { useRaceStore } from '@/store/useRaceStore'
import { lastIndexAtOrBefore } from '@/lib/interpolation'

const RPM_MAX = 13000
const RPM_REDLINE = 11000

function Bar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="mb-0.5 flex justify-between">
        <span className="label">{label}</span>
        <span className="text-xs font-semibold tabular-nums text-white">{Math.round(value)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full transition-[width] duration-150"
          style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }}
        />
      </div>
    </div>
  )
}

export function TelemetryPanel({ driverNumber, color }: { driverNumber: number; color: string }) {
  const time = useRaceStore((s) => s.displayTime)
  const { sampleAt, series, loading, hasData } = useCarData(driverNumber)

  const snap = sampleAt(time)

  // History up to the current time (decimated) + top speed so far.
  const { chartData, topSpeed } = useMemo(() => {
    if (!series) return { chartData: [] as { i: number; speed: number; throttle: number; brake: number }[], topSpeed: 0 }
    const end = lastIndexAtOrBefore(series.times, time)
    if (end < 0) return { chartData: [], topSpeed: 0 }
    const start = Math.max(0, end - 320)
    const slice = series.samples.slice(start, end + 1)
    const step = Math.max(1, Math.floor(slice.length / 90))
    const out: { i: number; speed: number; throttle: number; brake: number }[] = []
    let top = 0
    for (let i = 0; i < slice.length; i += step) {
      const s = slice[i]
      out.push({ i, speed: s.speed, throttle: s.throttle, brake: s.brake })
    }
    // top speed across the whole loaded window up to now
    for (let i = 0; i <= end; i++) if (series.samples[i].speed > top) top = series.samples[i].speed
    return { chartData: out, topSpeed: top }
  }, [series, time])

  const rpmPct = snap ? Math.min(100, (snap.rpm / RPM_MAX) * 100) : 0
  const rpmHot = snap ? snap.rpm >= RPM_REDLINE : false

  return (
    <div className="glass-tight p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="heading text-xs tracking-wider text-white">TELEMETRY</span>
        <div className="flex items-center gap-1">
          {topSpeed > 0 && (
            <span className="chip bg-white/5 text-f1-mute" title="Top speed in this session so far">
              ▲ {Math.round(topSpeed)}
            </span>
          )}
          {snap?.drs && (
            <span className="chip bg-flag-green/25 text-green-200 ring-1 ring-flag-green/40">DRS</span>
          )}
        </div>
      </div>

      {loading && <p className="py-3 text-center text-xs text-f1-mute">Loading telemetry…</p>}
      {!loading && !hasData && (
        <p className="py-3 text-center text-xs text-f1-mute">No car data for this window.</p>
      )}

      {hasData && (
        <>
          <div className="mb-3 flex items-end justify-between">
            <div className="flex items-baseline gap-1">
              <span className="heading text-4xl tabular-nums text-white">
                {snap ? Math.round(snap.speed) : '—'}
              </span>
              <span className="text-sm text-f1-mute">km/h</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="label">Gear</span>
              <span
                className="heading text-2xl tabular-nums"
                style={{ color }}
              >
                {snap?.gear ?? '—'}
              </span>
            </div>
            <div className="flex flex-col items-end">
              <span className="label">RPM</span>
              <span
                className={clsx(
                  'text-lg font-semibold tabular-nums',
                  rpmHot ? 'text-flag-red' : 'text-white',
                )}
              >
                {snap ? snap.rpm.toLocaleString() : '—'}
              </span>
            </div>
          </div>

          {/* RPM bar with redline zone */}
          <div className="relative mb-3 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="absolute right-0 top-0 h-full"
              style={{ width: `${100 - (RPM_REDLINE / RPM_MAX) * 100}%`, background: 'rgba(255,34,51,0.25)' }}
            />
            <div
              className="relative h-full rounded-full transition-[width] duration-100"
              style={{ width: `${rpmPct}%`, background: rpmHot ? '#ff2233' : color }}
            />
          </div>

          {/* Speed sparkline */}
          <div className="mb-1 h-12">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="spd" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.7} />
                    <stop offset="100%" stopColor={color} stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <YAxis hide domain={[0, 360]} />
                <Area
                  type="monotone"
                  dataKey="speed"
                  stroke={color}
                  strokeWidth={1.5}
                  fill="url(#spd)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Throttle / brake trace */}
          <div className="mb-2 h-10">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                <YAxis hide domain={[0, 100]} />
                <Area
                  type="monotone"
                  dataKey="throttle"
                  stroke="#27e07a"
                  strokeWidth={1.2}
                  fill="#27e07a"
                  fillOpacity={0.18}
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="brake"
                  stroke="#ff2233"
                  strokeWidth={1.2}
                  fill="#ff2233"
                  fillOpacity={0.18}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-2">
            <Bar label="Throttle" value={snap?.throttle ?? 0} color="#27e07a" />
            <Bar label="Brake" value={snap?.brake ?? 0} color="#ff2233" />
          </div>

          <div className="mt-2 flex items-center gap-2">
            <span className="label">DRS</span>
            <span
              className={clsx(
                'chip',
                snap?.drs ? 'bg-flag-green/25 text-green-200' : 'bg-white/5 text-f1-mute',
              )}
            >
              {snap?.drs ? 'OPEN' : 'CLOSED'}
            </span>
          </div>
        </>
      )}
    </div>
  )
}
