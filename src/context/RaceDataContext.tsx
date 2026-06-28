// Provides the loaded RaceData and the per-tick derived snapshot to all UI
// panels so they don't each re-run the loader/derivation.

import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@/api/types'
import type { RaceData } from '@/lib/raceData'
import type { DerivedSnapshot } from '@/hooks/useDerived'

interface RaceDataContextValue {
  session: Session | undefined
  raceData: RaceData | null
  derived: DerivedSnapshot
  loading: boolean
  error: Error | null
  refetchAll: () => void
}

const RaceDataContext = createContext<RaceDataContextValue | null>(null)

export function RaceDataProvider({
  value,
  children,
}: {
  value: RaceDataContextValue
  children: ReactNode
}) {
  return <RaceDataContext.Provider value={value}>{children}</RaceDataContext.Provider>
}

export function useRaceData(): RaceDataContextValue {
  const ctx = useContext(RaceDataContext)
  if (!ctx) throw new Error('useRaceData must be used within RaceDataProvider')
  return ctx
}
