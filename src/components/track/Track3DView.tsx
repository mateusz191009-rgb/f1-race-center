// The 3D race scene: track ribbon, animated cars, lighting and camera modes.
// Car positions are interpolated from the replay clock every frame and applied
// imperatively to avoid React re-renders.

import { useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Grid, Line, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { RaceData } from '@/lib/raceData'
import type { StatusKind } from '@/lib/raceData'
import { interpolatePosition } from '@/lib/interpolation'
import { teamColor } from '@/lib/format'
import { useClock } from '@/clock/ClockProvider'
import { useRaceStore } from '@/store/useRaceStore'
import { DriverCarMarker } from './DriverCarMarker'

type PosMap = Map<number, { x: number; z: number }>

function statusToTrackColor(status: StatusKind): string {
  switch (status) {
    case 'yellow':
      return '#ffd000'
    case 'sc':
    case 'vsc':
      return '#ffb300'
    case 'red':
      return '#ff2233'
    default:
      return '#27e0c8'
  }
}

function TrackRoad({ data, status, width }: { data: RaceData; status: StatusKind; width: number }) {
  const { geometry, edges, centerline, start } = useMemo(() => {
    const cl = data.track?.centerline ?? []
    const n = cl.length
    const half = width / 2
    const positions = new Float32Array(n * 2 * 3)
    const left: [number, number, number][] = []
    const right: [number, number, number][] = []
    const center: [number, number, number][] = []
    for (let i = 0; i < n; i++) {
      const prev = cl[(i - 1 + n) % n]
      const cur = cl[i]
      const next = cl[(i + 1) % n]
      let tx = next[0] - prev[0]
      let tz = next[1] - prev[1]
      const tl = Math.hypot(tx, tz) || 1
      tx /= tl
      tz /= tl
      const nx = tz
      const nz = -tx
      const lx = cur[0] + nx * half
      const lz = cur[1] + nz * half
      const rx = cur[0] - nx * half
      const rz = cur[1] - nz * half
      positions[i * 6 + 0] = lx
      positions[i * 6 + 1] = 0
      positions[i * 6 + 2] = lz
      positions[i * 6 + 3] = rx
      positions[i * 6 + 4] = 0
      positions[i * 6 + 5] = rz
      left.push([lx, 0.06, lz])
      right.push([rx, 0.06, rz])
      center.push([cur[0], 0.08, cur[1]])
    }
    if (left.length) {
      left.push(left[0])
      right.push(right[0])
      center.push(center[0])
    }
    const indices: number[] = []
    for (let i = 0; i < n; i++) {
      const a = i * 2
      const b = i * 2 + 1
      const c = ((i + 1) % n) * 2
      const d = ((i + 1) % n) * 2 + 1
      indices.push(a, b, c, b, d, c)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    g.setIndex(indices)
    g.computeVertexNormals()
    return { geometry: g, edges: { left, right }, centerline: center, start: center[0] }
  }, [data.track, width])

  if (!data.track) return null
  const racingColor = statusToTrackColor(status)

  return (
    <group>
      {/* Asphalt road surface */}
      <mesh geometry={geometry} position={[0, 0.04, 0]} receiveShadow>
        <meshStandardMaterial color="#2a2a33" metalness={0.1} roughness={0.95} side={THREE.DoubleSide} />
      </mesh>
      {/* White kerb / edge lines */}
      <Line points={edges.left} color="#d8d8e0" lineWidth={1.4} transparent opacity={0.7} />
      <Line points={edges.right} color="#d8d8e0" lineWidth={1.4} transparent opacity={0.7} />
      {/* Neon racing line (colours with the flag state) */}
      <Line points={centerline} color={racingColor} lineWidth={2} transparent opacity={0.85} />
      {/* Start / finish line across the road */}
      {start && (
        <mesh position={[start[0], 0.09, start[2]]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[width, width * 0.18]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      )}
    </group>
  )
}

function Cars({
  data,
  positionByDriver,
  positionsRef,
  carLength,
}: {
  data: RaceData
  positionByDriver: Map<number, number | null>
  positionsRef: React.MutableRefObject<PosMap>
  carLength: number
}) {
  const { clockRef } = useClock()
  const selectedDriver = useRaceStore((s) => s.selectedDriver)
  const hoveredDriver = useRaceStore((s) => s.hoveredDriver)
  const realisticCars = useRaceStore((s) => s.realisticCars)

  const groupRefs = useRef<Map<number, THREE.Group>>(new Map())
  const headingRef = useRef<Map<number, number>>(new Map())

  // Heading is taken from a point ~250 ms ahead on the racing line (stable, not
  // frame-to-frame jitter), then critically damped toward — so turns look smooth.
  useFrame((_, delta) => {
    const t = clockRef.current
    const damp = Math.min(1, delta * 6)
    for (const driver of data.drivers) {
      const num = driver.driver_number
      const g = groupRefs.current.get(num)
      if (!g) continue
      const trace = data.traces.get(num)
      const pos = trace ? interpolatePosition(trace.pts, trace.times, t) : null
      if (!pos) {
        g.visible = false
        continue
      }
      g.visible = true
      g.position.set(pos.x, 0, pos.y)
      positionsRef.current.set(num, { x: pos.x, z: pos.y })

      const ahead = trace ? interpolatePosition(trace.pts, trace.times, t + 250) : null
      if (ahead) {
        const dx = ahead.x - pos.x
        const dz = ahead.y - pos.y
        if (Math.hypot(dx, dz) > 1e-4) {
          const target = Math.atan2(dx, dz)
          let cur = headingRef.current.get(num)
          if (cur == null) cur = target
          else {
            let diff = target - cur
            diff = Math.atan2(Math.sin(diff), Math.cos(diff)) // shortest path
            cur += diff * damp
          }
          headingRef.current.set(num, cur)
          g.rotation.y = cur
        }
      }
    }
  })

  return (
    <>
      {data.drivers.map((driver) => {
        const num = driver.driver_number
        return (
          <group
            key={num}
            ref={(el) => {
              if (el) groupRefs.current.set(num, el)
              else groupRefs.current.delete(num)
            }}
          >
            <DriverCarMarker
              driverNumber={num}
              acronym={driver.name_acronym}
              color={teamColor(driver.team_colour)}
              position={positionByDriver.get(num) ?? null}
              selected={selectedDriver === num}
              hovered={hoveredDriver === num}
              realistic={realisticCars}
              length={carLength}
            />
          </group>
        )
      })}
    </>
  )
}

function CameraRig({
  positionsRef,
  trackSize,
  carLength,
}: {
  positionsRef: React.MutableRefObject<PosMap>
  trackSize: number
  carLength: number
}) {
  const { camera } = useThree()
  const controlsRef = useRef<any>(null)
  const tmp = useRef(new THREE.Vector3()).current
  const desired = useRef(new THREE.Vector3()).current
  const target = useRef(new THREE.Vector3()).current

  // Follow distance scales with car size so battles fill the frame.
  const followDist = Math.max(6, carLength * 7)

  useFrame(() => {
    const mode = useRaceStore.getState().cameraMode
    const selected = useRaceStore.getState().selectedDriver
    const controls = controlsRef.current

    if (mode === 'orbit') {
      if (controls) controls.enabled = true
      return
    }
    if (controls) controls.enabled = false

    if (mode === 'top') {
      camera.position.lerp(tmp.set(0, trackSize * 1.5, 0.001), 0.08)
      camera.lookAt(0, 0, 0)
      return
    }
    if (mode === 'tv') {
      const a = performance.now() * 0.00008
      const r = trackSize * 0.95
      camera.position.lerp(tmp.set(Math.cos(a) * r, trackSize * 0.55, Math.sin(a) * r), 0.04)
      camera.lookAt(0, 0, 0)
      return
    }
    if (mode === 'follow') {
      const pos = selected != null ? positionsRef.current.get(selected) : null
      if (pos) {
        target.set(pos.x, carLength * 0.5, pos.z)
        desired.set(pos.x + followDist * 0.75, followDist * 0.7, pos.z + followDist * 0.75)
        camera.position.lerp(desired, 0.08)
        camera.lookAt(target)
        if (controls) controls.target.copy(target)
      }
    }
  })

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minDistance={Math.max(3, carLength * 2)}
      maxDistance={trackSize * 2.4}
      maxPolarAngle={Math.PI * 0.49}
    />
  )
}

export function Track3DView({
  data,
  positionByDriver,
  status,
}: {
  data: RaceData
  positionByDriver: Map<number, number | null>
  status: StatusKind
}) {
  const positionsRef = useRef<PosMap>(new Map())
  const size = data.track?.size ?? 170
  const glow = status === 'yellow' || status === 'sc' || status === 'vsc'

  // Realistic-ish car size relative to the track length (a real car is ~0.1% of
  // the lap length). Slightly boosted for visibility, and clamped.
  const lengthUnits = data.track?.lengthUnits ?? 400
  const carLength = Math.min(2.6, Math.max(1.1, lengthUnits * 0.0016))
  const trackWidth = carLength * 2.8

  return (
    <Canvas
      shadows
      dpr={[1, 1.8]}
      camera={{ position: [size * 0.7, size * 0.75, size * 0.7], fov: 45, near: 0.1, far: 6000 }}
      gl={{ antialias: true }}
    >
      <color attach="background" args={['#06060a']} />
      <fog attach="fog" args={['#06060a', size * 1.4, size * 3.2]} />

      <ambientLight intensity={0.55} />
      <directionalLight position={[60, 120, 40]} intensity={1.1} castShadow />
      <pointLight position={[-80, 50, -80]} intensity={0.6} color="#2f7bff" />
      <pointLight position={[80, 50, 80]} intensity={0.5} color="#e10600" />
      {glow && <pointLight position={[0, 40, 0]} intensity={1.4} color="#ffd000" distance={size * 2} />}

      {/* Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]} receiveShadow>
        <planeGeometry args={[size * 6, size * 6]} />
        <meshStandardMaterial color="#0a0a10" metalness={0.2} roughness={0.9} />
      </mesh>
      <Grid
        position={[0, -0.15, 0]}
        args={[size * 6, size * 6]}
        cellSize={10}
        cellThickness={0.6}
        cellColor="#1b1b26"
        sectionSize={50}
        sectionThickness={1}
        sectionColor="#2a2a3a"
        fadeDistance={size * 3}
        fadeStrength={1.5}
        infiniteGrid
      />

      <TrackRoad data={data} status={status} width={trackWidth} />
      <Cars
        data={data}
        positionByDriver={positionByDriver}
        positionsRef={positionsRef}
        carLength={carLength}
      />
      <CameraRig positionsRef={positionsRef} trackSize={size} carLength={carLength} />
    </Canvas>
  )
}
