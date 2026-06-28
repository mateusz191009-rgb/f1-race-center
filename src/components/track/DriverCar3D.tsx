// Loads the GLB F1 model once (geometry is shared across all clones) and tints
// every clone to the driver's team colour. Used in place of the simple box
// markers when "realistic cars" is enabled.

import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

const MODEL_URL = '/models/f1-car.glb'
const DEFAULT_LENGTH = 2.4 // scene units along the car's longest axis
// If the model points the wrong way relative to travel direction, tweak this.
const FORWARD_OFFSET = 1.5

useGLTF.preload(MODEL_URL)

export function DriverCar3D({ color, length = DEFAULT_LENGTH }: { color: string; length?: number }) {
  const { scene } = useGLTF(MODEL_URL)

  const { object, scale, yOffset } = useMemo(() => {
    // Static model (no skeleton) → a recursive clone shares geometry buffers
    // across all 20 cars while letting us swap in a per-team material.
    const obj = scene.clone(true)

    // Fit + ground the model from its bounding box.
    const box = new THREE.Box3().setFromObject(obj)
    const size = new THREE.Vector3()
    box.getSize(size)
    const longest = Math.max(size.x, size.z) || 1
    const s = length / longest
    const yOff = -box.min.y * s

    const tint = new THREE.Color(color)
    obj.traverse((o: THREE.Object3D) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      mesh.castShadow = true
      const src = mesh.material as THREE.MeshStandardMaterial
      const mat = (src?.clone?.() as THREE.MeshStandardMaterial) ?? new THREE.MeshStandardMaterial()
      mat.color = tint.clone()
      mat.emissive = tint.clone()
      mat.emissiveIntensity = 0.14
      mat.metalness = 0.55
      mat.roughness = 0.4
      mesh.material = mat
    })

    return { object: obj, scale: s, yOffset: yOff }
  }, [scene, color, length])

  return (
    <primitive object={object} scale={scale} position={[0, yOffset, 0]} rotation={[0, FORWARD_OFFSET, 0]} />
  )
}
