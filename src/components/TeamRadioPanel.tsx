import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getTeamRadio } from '@/api/openf1'
import { useRaceStore } from '@/store/useRaceStore'
import { formatClock, toMs } from '@/lib/format'

// Team-radio clips for the selected driver. Only clips up to the current replay
// time are shown, so radio "happens" in sync with the replay.
export function TeamRadioPanel({ driverNumber, color }: { driverNumber: number; color: string }) {
  const sessionKey = useRaceStore((s) => s.sessionKey)
  const time = useRaceStore((s) => s.displayTime)

  const radioQ = useQuery({
    queryKey: ['teamRadio', sessionKey, driverNumber],
    queryFn: ({ signal }) => getTeamRadio(sessionKey!, driverNumber, { signal }),
    enabled: sessionKey != null,
  })

  const clips = useMemo(() => {
    const data = radioQ.data
    if (!data?.length) return []
    return data
      .filter((r) => toMs(r.date) <= time)
      .sort((a, b) => toMs(b.date) - toMs(a.date))
      .slice(0, 6)
  }, [radioQ.data, time])

  if (radioQ.isLoading) {
    return (
      <div className="glass-tight p-3">
        <span className="heading text-xs tracking-wider text-white">TEAM RADIO</span>
        <p className="py-2 text-center text-xs text-f1-mute">Loading…</p>
      </div>
    )
  }
  if (!radioQ.data?.length) return null

  return (
    <div className="glass-tight p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="heading text-xs tracking-wider text-white">📻 TEAM RADIO</span>
        <span className="label">{clips.length} clip{clips.length === 1 ? '' : 's'}</span>
      </div>
      {clips.length === 0 ? (
        <p className="py-1 text-center text-xs text-f1-mute">No radio yet at this point.</p>
      ) : (
        <div className="space-y-2">
          {clips.map((r, i) => (
            <div key={`${r.date}-${i}`} className="rounded-lg border border-white/10 bg-black/30 p-1.5">
              <div className="mb-1 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: color }} />
                <span className="label">{formatClock(toMs(r.date))}</span>
              </div>
              <audio
                controls
                preload="none"
                src={r.recording_url}
                className="h-8 w-full"
                style={{ colorScheme: 'dark' }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
