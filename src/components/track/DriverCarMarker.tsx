// A single car in the 3D scene. The parent <group> transform (position +
// heading) is driven imperatively every frame by the Cars component; this
// component only renders the visual + label and handles pointer interaction.

import { Suspense } from 'react'
import { Html } from '@react-three/drei'
import clsx from 'clsx'
import { useRaceStore } from '@/store/useRaceStore'
import { DriverCar3D } from './DriverCar3D'

interface Props {
  driverNumber: number
  acronym: string
  color: string
  position: number | null
  selected: boolean
  hovered: boolean
  realistic: boolean
  length: number
}

/** Low-poly fallback / simple-marker car, sized to `len` (scene units long). */
function BoxCar({ color, emphasized, len }: { color: string; emphasized: boolean; len: number }) {
  const w = len * 0.46
  const h = len * 0.2
  return (
    <>
      <mesh castShadow position={[0, h * 0.6, 0]}>
        <boxGeometry args={[w, h, len]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={emphasized ? 0.9 : 0.45}
          metalness={0.4}
          roughness={0.35}
        />
      </mesh>
      <mesh position={[0, h * 0.6, len * 0.64]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[w * 0.3, len * 0.36, 4]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={emphasized ? 0.9 : 0.4} />
      </mesh>
    </>
  )
}

export function DriverCarMarker({
  driverNumber,
  acronym,
  color,
  position,
  selected,
  hovered,
  realistic,
  length,
}: Props) {
  const selectDriver = useRaceStore((s) => s.selectDriver)
  const setHovered = useRaceStore((s) => s.setHovered)

  const emphasized = selected || hovered
  const scale = selected ? 1.35 : hovered ? 1.2 : 1
  const ringInner = length * 1.1
  const ringOuter = length * 1.45
  const labelY = length * 1.6

  return (
    <group
      scale={scale}
      onClick={(e) => {
        e.stopPropagation()
        selectDriver(driverNumber)
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(driverNumber)
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={(e) => {
        e.stopPropagation()
        setHovered(null)
        document.body.style.cursor = 'auto'
      }}
    >
      {realistic ? (
        <Suspense fallback={<BoxCar color={color} emphasized={emphasized} len={length} />}>
          <DriverCar3D color={color} length={length} />
        </Suspense>
      ) : (
        <BoxCar color={color} emphasized={emphasized} len={length} />
      )}

      {/* Selection ring on the ground */}
      {selected && (
        <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[ringInner, ringOuter, 40]} />
          <meshBasicMaterial color={color} transparent opacity={0.85} />
        </mesh>
      )}

      {/* Floating label — fixed screen size (no distanceFactor), so it stays a
          small chip whether the camera is far away or right behind the car. */}
      <Html position={[0, labelY, 0]} center pointerEvents="none" zIndexRange={[20, 0]}>
        <div
          className={clsx(
            'select-none whitespace-nowrap rounded px-1 py-0.5 font-bold leading-none',
            emphasized ? 'text-[11px]' : 'text-[10px]',
          )}
          style={{
            color: '#fff',
            background: emphasized ? color : 'rgba(8,8,12,0.6)',
            border: `1px solid ${color}`,
            boxShadow: emphasized ? `0 0 8px ${color}` : 'none',
            opacity: emphasized ? 1 : 0.85,
          }}
        >
          {position != null ? `P${position} ` : ''}
          {acronym}
        </div>
      </Html>
    </group>
  )
}
