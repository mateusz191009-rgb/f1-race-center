import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { getLatestSession, getMeetings, getSessions } from '@/api/openf1'
import { AVAILABLE_YEARS, CURRENT_YEAR } from '@/config'
import { useRaceStore } from '@/store/useRaceStore'

function SessionTypeChip({ type }: { type: string }) {
  const color =
    type === 'Race'
      ? 'bg-f1-red/25 text-red-200 border-f1-red/50'
      : type === 'Qualifying'
        ? 'bg-purple-500/20 text-purple-200 border-purple-400/40'
        : 'bg-sky-500/15 text-sky-200 border-sky-400/30'
  return <span className={clsx('chip border', color)}>{type}</span>
}

export function SessionSelector() {
  const year = useRaceStore((s) => s.year)
  const setYear = useRaceStore((s) => s.setYear)
  const selectSession = useRaceStore((s) => s.selectSession)
  const loadDemo = useRaceStore((s) => s.loadDemo)
  const closeSelector = useRaceStore((s) => s.closeSelector)
  const hasSession = useRaceStore((s) => s.hasSession)

  const [meetingKey, setMeetingKey] = useState<number | null>(null)
  const [loadingLatest, setLoadingLatest] = useState(false)

  const meetingsQ = useQuery({
    queryKey: ['meetings', year],
    queryFn: ({ signal }) => getMeetings(year, { signal }),
  })

  const sessionsQ = useQuery({
    queryKey: ['sessions', meetingKey],
    queryFn: ({ signal }) => getSessions(meetingKey!, { signal }),
    enabled: meetingKey != null,
  })

  const goLive = async () => {
    const latest = await getLatestSession()
    const s = latest?.[0]
    if (s) selectSession(s.meeting_key, s.session_key, 'live')
  }

  // Load the most recent race that has already taken place this season.
  const loadLatestRace = async () => {
    setLoadingLatest(true)
    try {
      const meetings = await getMeetings(CURRENT_YEAR)
      const past = meetings
        .filter((m) => new Date(m.date_start).getTime() <= Date.now())
        .sort((a, b) => new Date(b.date_start).getTime() - new Date(a.date_start).getTime())
      for (const m of past.slice(0, 4)) {
        const sessions = await getSessions(m.meeting_key)
        const race = sessions.find(
          (s) => s.session_type === 'Race' && new Date(s.date_start).getTime() <= Date.now(),
        )
        if (race) {
          selectSession(m.meeting_key, race.session_key, 'replay')
          return
        }
      }
      loadDemo() // fallback: 2023 Singapore
    } catch {
      loadDemo()
    } finally {
      setLoadingLatest(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md">
      <div className="glass flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div>
            <h1 className="heading text-2xl text-white">
              F1 <span className="text-f1-red">RACE CENTER</span>
            </h1>
            <p className="text-sm text-f1-mute">
              Interactive 3D race dashboard · powered by the OpenF1 API
            </p>
          </div>
          {hasSession && (
            <button className="btn" onClick={closeSelector}>
              Close
            </button>
          )}
        </div>

        {/* Year tabs + quick actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-6 py-3">
          <div className="flex gap-2">
            {AVAILABLE_YEARS.map((y) => (
              <button
                key={y}
                onClick={() => {
                  setYear(y)
                  setMeetingKey(null)
                }}
                className={clsx('btn', y === year && 'btn-primary')}
              >
                {y}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button className="btn-primary btn" onClick={loadLatestRace} disabled={loadingLatest}>
              {loadingLatest ? 'Searching…' : `▶ Latest Race (${CURRENT_YEAR})`}
            </button>
            <button className="btn" onClick={() => loadDemo()} title="2023 Singapore GP">
              Demo
            </button>
            <button className="btn" onClick={goLive} title="Requires a live session to be running">
              ● Go Live (beta)
            </button>
          </div>
        </div>

        {/* Body: meetings + sessions */}
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 overflow-hidden md:grid-cols-[1.4fr_1fr]">
          {/* Meetings */}
          <div className="scroll-thin min-h-0 overflow-y-auto border-b border-white/10 p-4 md:border-b-0 md:border-r">
            <p className="label mb-2">Grand Prix · {year}</p>
            {meetingsQ.isLoading && <p className="text-sm text-f1-mute">Loading calendar…</p>}
            {meetingsQ.error && (
              <p className="text-sm text-flag-red">Could not load meetings. Check your connection.</p>
            )}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {meetingsQ.data?.map((m) => (
                <button
                  key={m.meeting_key}
                  onClick={() => setMeetingKey(m.meeting_key)}
                  className={clsx(
                    'glass-tight flex flex-col items-start gap-0.5 p-3 text-left transition hover:border-f1-red/50',
                    meetingKey === m.meeting_key && 'border-f1-red/70 bg-f1-red/10',
                  )}
                >
                  <span className="text-sm font-semibold text-white">{m.meeting_name}</span>
                  <span className="text-xs text-f1-mute">
                    {m.country_name} · {new Date(m.date_start).toLocaleDateString()}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Sessions */}
          <div className="scroll-thin min-h-0 overflow-y-auto p-4">
            <p className="label mb-2">Session</p>
            {meetingKey == null && (
              <p className="text-sm text-f1-mute">Select a Grand Prix to see its sessions.</p>
            )}
            {sessionsQ.isLoading && <p className="text-sm text-f1-mute">Loading sessions…</p>}
            <div className="flex flex-col gap-2">
              {sessionsQ.data?.map((s) => (
                <button
                  key={s.session_key}
                  onClick={() => selectSession(s.meeting_key, s.session_key, 'replay')}
                  className="glass-tight flex items-center justify-between p-3 text-left transition hover:border-f1-red/50"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-white">{s.session_name}</span>
                    <span className="text-xs text-f1-mute">
                      {new Date(s.date_start).toLocaleString()}
                    </span>
                  </div>
                  <SessionTypeChip type={s.session_type} />
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 px-6 py-3 text-xs text-f1-mute">
          Tip: pick a <span className="text-white">Race</span> for the full experience. The{' '}
          <span className="text-white">entire session</span> is loaded; car-position data streams in
          progressively (watch the progress bar), so longer sessions take a few seconds more.
        </div>
      </div>
    </div>
  )
}
