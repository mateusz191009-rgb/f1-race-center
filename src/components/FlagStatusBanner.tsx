import clsx from 'clsx'
import type { SessionStatus } from '@/lib/raceData'

// Big status banner that drops in for major race-control states.
export function FlagStatusBanner({ status }: { status: SessionStatus }) {
  if (status.kind === 'green') return null

  const config: Record<string, { cls: string; icon: string; text: string }> = {
    sc: { cls: 'sc-stripes text-black', icon: '🚗', text: 'SAFETY CAR' },
    vsc: { cls: 'sc-stripes text-black', icon: '🚧', text: 'VIRTUAL SAFETY CAR' },
    red: { cls: 'red-stripes text-white', icon: '🛑', text: 'RED FLAG' },
    yellow: { cls: 'bg-flag-yellow text-black', icon: '⚠', text: 'YELLOW FLAG' },
    chequered: { cls: 'bg-white text-black', icon: '🏁', text: 'CHEQUERED FLAG' },
  }
  const c = config[status.kind]
  if (!c) return null

  return (
    <div className="pointer-events-none absolute left-1/2 top-4 z-30 -translate-x-1/2 animate-slideUp">
      <div
        className={clsx(
          'flex items-center gap-3 rounded-xl px-6 py-2.5 shadow-glass ring-1 ring-black/30',
          c.cls,
          (status.kind === 'sc' || status.kind === 'vsc' || status.kind === 'red') &&
            'animate-scStripes',
        )}
      >
        <span className="text-xl">{c.icon}</span>
        <span className="heading text-lg tracking-[0.2em]">{c.text}</span>
      </div>
    </div>
  )
}
