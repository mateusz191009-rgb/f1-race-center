import clsx from 'clsx'
import { useClock } from '@/clock/ClockProvider'
import { useRaceStore } from '@/store/useRaceStore'
import { PLAYBACK_SPEEDS } from '@/config'
import { formatClock, formatElapsed } from '@/lib/format'

export function ReplayControls() {
  const { seek } = useClock()
  const playing = useRaceStore((s) => s.playing)
  const togglePlay = useRaceStore((s) => s.togglePlay)
  const speed = useRaceStore((s) => s.speed)
  const setSpeed = useRaceStore((s) => s.setSpeed)
  const cycleSpeed = useRaceStore((s) => s.cycleSpeed)
  const time = useRaceStore((s) => s.displayTime)
  const start = useRaceStore((s) => s.windowStart)
  const end = useRaceStore((s) => s.windowEnd)
  const mode = useRaceStore((s) => s.mode)

  const duration = Math.max(1, end - start)
  const elapsed = Math.max(0, time - start)
  const atEnd = time >= end - 50

  return (
    <div className="glass flex flex-col gap-2 px-4 py-3">
      <div className="flex items-center gap-3">
        <button
          className="btn-primary btn h-10 w-10 rounded-full p-0 text-lg"
          onClick={() => {
            if (atEnd) seek(start)
            togglePlay()
          }}
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? '❚❚' : atEnd ? '↺' : '▶'}
        </button>
        <button className="btn h-9 px-2 text-xs" onClick={() => seek(start)} title="Restart">
          ⏮
        </button>

        <div className="flex flex-1 items-center gap-3">
          <span className="w-12 text-right text-xs tabular-nums text-f1-mute">
            {formatElapsed(elapsed)}
          </span>
          <input
            type="range"
            min={start}
            max={end}
            step={100}
            value={Math.min(end, Math.max(start, time))}
            onChange={(e) => seek(Number(e.target.value))}
            className="flex-1"
          />
          <span className="w-12 text-xs tabular-nums text-f1-mute">{formatElapsed(duration)}</span>
        </div>

        <div className="hidden items-center gap-1 sm:flex">
          {PLAYBACK_SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={clsx('btn px-2 py-1 text-xs', s === speed && 'btn-primary')}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px] text-f1-mute">
        <span>
          <span className="uppercase tracking-wider">{mode}</span> · session clock{' '}
          <span className="text-f1-ink">{formatClock(time)}</span>
        </span>
        <span className="sm:hidden">
          <button onClick={cycleSpeed} className="btn px-2 py-0.5 text-xs">
            {speed}× ⟳
          </button>
        </span>
      </div>
    </div>
  )
}
