import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { useRaceData } from '@/context/RaceDataContext'
import { useRaceStore } from '@/store/useRaceStore'
import { Track3DView } from './track/Track3DView'
import { TopBar } from './TopBar'
import { TimingTower } from './TimingTower'
import { RaceControlFeed } from './RaceControlFeed'
import { DriverDetailPanel } from './DriverDetailPanel'
import { FlagStatusBanner } from './FlagStatusBanner'
import { WeatherRadar } from './WeatherRadar'
import { ReplayControls } from './ReplayControls'

type MobileTab = 'timing' | 'control' | 'driver'

export function AppLayout() {
  const { raceData, derived } = useRaceData()
  const selectedDriver = useRaceStore((s) => s.selectedDriver)
  const [mobileTab, setMobileTab] = useState<MobileTab>('timing')

  const positionByDriver = useMemo(() => {
    const map = new Map<number, number | null>()
    for (const row of derived.standings) map.set(row.driver.driver_number, row.position)
    return map
  }, [derived.standings])

  if (!raceData) return null

  return (
    <div className="flex h-full flex-col gap-2 p-2">
      <TopBar />

      <div className="flex min-h-0 flex-1 gap-2">
        {/* Main 3D stage */}
        <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden rounded-2xl border border-white/10 bg-black/40">
          {raceData.track ? (
            <Track3DView
              data={raceData}
              positionByDriver={positionByDriver}
              status={derived.status.kind}
            />
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-center text-f1-mute">
              No location data available for this session window. Try a Race session.
            </div>
          )}

          <FlagStatusBanner status={derived.status} />

          <div className="absolute left-3 top-3 z-20">
            <WeatherRadar />
          </div>

          {/* Driver panel as a floating card over the stage (desktop) */}
          {selectedDriver != null && (
            <div className="absolute bottom-3 left-3 z-20 hidden w-80 lg:block">
              <DriverDetailPanel />
            </div>
          )}

          <div className="pointer-events-none absolute bottom-3 right-3 z-10 hidden text-right text-[11px] text-f1-mute lg:block">
            drag to orbit · scroll to zoom · click a car
          </div>
        </div>

        {/* Right column (desktop) */}
        <div className="hidden w-[20rem] flex-col gap-2 lg:flex">
          <div className="min-h-0 flex-1">
            <TimingTower />
          </div>
          <div className="h-[38%] min-h-0">
            <RaceControlFeed />
          </div>
        </div>
      </div>

      {/* Mobile panels with tabs */}
      <div className="lg:hidden">
        <div className="mb-2 flex gap-1 rounded-lg border border-white/10 bg-white/5 p-1">
          {(['timing', 'control', 'driver'] as MobileTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setMobileTab(tab)}
              disabled={tab === 'driver' && selectedDriver == null}
              className={clsx(
                'flex-1 rounded-md px-2 py-1.5 text-xs font-semibold uppercase tracking-wide transition disabled:opacity-30',
                mobileTab === tab ? 'bg-f1-red/30 text-white' : 'text-f1-mute',
              )}
            >
              {tab === 'control' ? 'Race Control' : tab}
            </button>
          ))}
        </div>
        <div className="h-[44vh]">
          {mobileTab === 'timing' && <TimingTower />}
          {mobileTab === 'control' && <RaceControlFeed />}
          {mobileTab === 'driver' && selectedDriver != null && <DriverDetailPanel />}
        </div>
      </div>

      <ReplayControls />
    </div>
  )
}
