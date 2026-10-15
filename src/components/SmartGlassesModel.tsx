import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import * as THREE from 'three'

export type GlassesComponent = 'frame' | 'lenses' | 'camera' | 'audio' | 'processor' | 'power'

export interface SmartGlassesModelProps {
  exploded?: boolean
  wireframe?: boolean
  materialMode?: boolean
  templesOpen?: boolean
  selectedComponent?: string | null
  onSelectComponent?: (id: string) => void
  reducedMotion?: boolean
  labels?: boolean
}

const ACCENT = '#ff7138'
const COLORS: Record<GlassesComponent, string> = {
  frame: '#d8d4cc', lenses: '#7bafa7', camera: '#d89569',
  audio: '#b6bf94', processor: '#688b7f', power: '#8f9eae',
}

function outline(inset = false) {
  const path = new THREE.Shape()
  if (!inset) {
    path.moveTo(-1.43, .69)
    path.bezierCurveTo(-1.48, .92, -1.30, 1.00, -.96, .99)
    path.bezierCurveTo(-.20, 1.02, .62, .95, 1.17, .85)
    path.bezierCurveTo(1.45, .80, 1.48, .64, 1.42, .35)
    path.lineTo(1.17, -.53)
    path.bezierCurveTo(1.08, -.87, .83, -.97, .51, -.97)
    path.lineTo(-.62, -.97)
    path.bezierCurveTo(-.98, -.97, -1.18, -.85, -1.24, -.53)
    path.closePath()
  } else {
    path.moveTo(-1.10, .54)
    path.bezierCurveTo(-1.12, .64, -.99, .69, -.78, .68)
    path.bezierCurveTo(-.17, .70, .54, .65, .94, .59)
    path.bezierCurveTo(1.12, .56, 1.15, .46, 1.11, .30)
    path.lineTo(.91, -.42)
    path.bezierCurveTo(.86, -.61, .70, -.68, .46, -.68)
    path.lineTo(-.55, -.68)
    path.bezierCurveTo(-.78, -.68, -.92, -.59, -.97, -.39)
    path.closePath()
  }
  return path
}

function bendFront(geometry: THREE.BufferGeometry, side: number, isLens = false) {
  const positions = geometry.attributes.position
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i) * side + 1.64 * side
    const y = positions.getY(i)
    const z = positions.getZ(i) - .036 * x * x + (isLens ? .035 * (1 - y * y) : 0)
    positions.setXYZ(i, x, y, z)
  }
  // Mirroring the geometry reverses the triangles, so reverse the index winding.
  if (side < 0) {
    if (geometry.index) {
      for (let i = 0; i < geometry.index.count; i += 3) {
        const b = geometry.index.getX(i + 1)
        geometry.index.setX(i + 1, geometry.index.getX(i + 2))
        geometry.index.setX(i + 2, b)
      }
    } else {
      for (const attribute of Object.values(geometry.attributes)) {
        const itemSize = attribute.itemSize
        for (let i = 0; i < attribute.count; i += 3) {
          for (let j = 0; j < itemSize; j++) {
            const b = attribute.array[(i + 1) * itemSize + j]
            attribute.array[(i + 1) * itemSize + j] = attribute.array[(i + 2) * itemSize + j]
            attribute.array[(i + 2) * itemSize + j] = b
          }
        }
      }
    }
  }
  geometry.computeVertexNormals()
  return geometry
}

function rimGeometry(side: number) {
  const shape = outline()
  shape.holes.push(new THREE.Path(outline(true).getPoints(36)))
  return bendFront(new THREE.ExtrudeGeometry(shape, {
    depth: .24, bevelEnabled: true, bevelSegments: 4, steps: 1,
    bevelSize: .075, bevelThickness: .065, curveSegments: 24,
  }), side)
}

function lensGeometry(side: number) {
  return bendFront(new THREE.ExtrudeGeometry(outline(true), {
    depth: .055, bevelEnabled: true, bevelSegments: 3, steps: 1,
    bevelSize: .035, bevelThickness: .018, curveSegments: 28,
  }), side, true)
}

function templeGeometry() {
  const shape = new THREE.Shape()
  shape.moveTo(0, .17)
  shape.lineTo(-.35, .18)
  shape.bezierCurveTo(-1.2, .17, -2.25, .08, -2.95, .04)
  shape.bezierCurveTo(-3.40, .03, -3.67, -.10, -3.86, -.46)
  shape.lineTo(-4.09, -.91)
  shape.bezierCurveTo(-4.15, -1.07, -3.98, -1.17, -3.88, -1.02)
  shape.lineTo(-3.54, -.57)
  shape.bezierCurveTo(-3.39, -.37, -3.19, -.33, -2.88, -.34)
  shape.lineTo(-.42, -.30)
  shape.bezierCurveTo(-.18, -.30, -.05, -.22, 0, -.18)
  shape.closePath()
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: .24, steps: 1, bevelEnabled: true, bevelSegments: 4,
    bevelThickness: .065, bevelSize: .055, curveSegments: 24,
  })
  const positions = geometry.attributes.position
  for (let i = 0; i < positions.count; i++) {
    const longitudinal = positions.getX(i)
    const depth = positions.getZ(i)
    // A gentle inward curve follows the head instead of using straight box arms.
    const inward = Math.max(0, -longitudinal - 2.6) ** 2 * .065
    positions.setXYZ(i, depth - .12 - inward, positions.getY(i), longitudinal)
  }
  // The axis permutation reverses orientation.
  for (const attribute of Object.values(geometry.attributes)) {
    for (let i = 0; i < attribute.count; i += 3) {
      for (let j = 0; j < attribute.itemSize; j++) {
        const a = (i + 1) * attribute.itemSize + j
        const b = (i + 2) * attribute.itemSize + j
        const temporary = attribute.array[a]
        attribute.array[a] = attribute.array[b]
        attribute.array[b] = temporary
      }
    }
  }
  geometry.computeVertexNormals()
  return geometry
}

function curveGeometry(points: [number, number, number][], radius: number) {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), 28, radius, 10, false)
}

export default function SmartGlassesModel({
  exploded = false, wireframe = false, materialMode = false, templesOpen = true,
  selectedComponent = null, onSelectComponent, reducedMotion = false, labels = false,
}: SmartGlassesModelProps) {
  const front = useRef<THREE.Group>(null)
  const lenses = useRef<THREE.Group>(null)
  const leftTemple = useRef<THREE.Group>(null)
  const rightTemple = useRef<THREE.Group>(null)
  const camera = useRef<THREE.Group>(null)
  const processor = useRef<THREE.Group>(null)
  const power = useRef<THREE.Group>(null)
  const audio = useRef<THREE.Group>(null)
  const progress = useRef(0)
  const geometry = useMemo(() => ({
    rims: [rimGeometry(-1), rimGeometry(1)],
    lenses: [lensGeometry(-1), lensGeometry(1)],
    temple: templeGeometry(),
    bridge: curveGeometry([[-.37, .61, .09], [-.19, .69, .17], [0, .72, .20], [.19, .69, .17], [.37, .61, .09]], .135),
  }), [])

  useEffect(() => () => {
    geometry.rims.forEach(g => g.dispose())
    geometry.lenses.forEach(g => g.dispose())
    geometry.temple.dispose()
    geometry.bridge.dispose()
  }, [geometry])

  useFrame((_, delta) => {
    const a = reducedMotion ? 1 : 1 - Math.exp(-delta * 5)
    const destination = exploded ? 1 : 0
    progress.current = THREE.MathUtils.lerp(progress.current, destination, a)
    const p = progress.current
    if (front.current) front.current.position.z = p * .10
    if (lenses.current) {
      lenses.current.position.z = .12 + p * 1.35
      lenses.current.position.y = p * -.10
    }
    if (camera.current) {
      camera.current.position.set(2.84 + p * .24, .55 + p * .42, .055 + p * 1.05)
    }
    if (leftTemple.current && rightTemple.current) {
      leftTemple.current.position.x = -3.02 - p * .78
      rightTemple.current.position.x = 3.02 + p * .78
      leftTemple.current.position.z = rightTemple.current.position.z = -.19 - p * .48
      const closed = templesOpen || exploded ? 0 : 1.25
      leftTemple.current.rotation.y = THREE.MathUtils.lerp(leftTemple.current.rotation.y, -closed, a)
      rightTemple.current.rotation.y = THREE.MathUtils.lerp(rightTemple.current.rotation.y, closed, a)
    }
    if (processor.current) {
      processor.current.position.set(3.02 + p * .24, .50 + p * 1.16, -1.73)
      processor.current.visible = p > .015
    }
    if (power.current) {
      power.current.position.set(-3.02 - p * .12, .42 + p * .96, -2.12)
      power.current.visible = p > .015
    }
    if (audio.current) {
      audio.current.position.set(3.02 + p * 1.05, .40 - p * .84, -2.86)
      audio.current.visible = p > .015
    }
  }, -2)

  const select = (id: GlassesComponent) => (event: ThreeEvent<MouseEvent>) => {
    if (!onSelectComponent) return
    event.stopPropagation()
    onSelectComponent(id)
  }

  function finish(id: GlassesComponent, variant: 'frame' | 'metal' | 'pcb' | 'lens' = 'frame') {
    const selected = selectedComponent === id
    const palette = materialMode ? COLORS[id] : variant === 'metal' ? '#8c9198' : variant === 'pcb' ? '#193931' : '#11151a'
    if (variant === 'lens') return <meshPhysicalMaterial
      color={selected ? '#876a4b' : materialMode ? COLORS.lenses : '#313e39'}
      metalness={.12} roughness={.075} transmission={wireframe ? 0 : .22}
      transparent opacity={wireframe ? 1 : .88} thickness={.12} ior={1.46}
      clearcoat={1} clearcoatRoughness={.04} envMapIntensity={1.35}
      emissive={selected ? ACCENT : '#000000'} emissiveIntensity={selected ? .20 : 0}
      wireframe={wireframe} side={THREE.DoubleSide} />
    return <meshPhysicalMaterial
      color={palette} metalness={variant === 'metal' ? .86 : variant === 'pcb' ? .28 : .08}
      roughness={variant === 'metal' ? .28 : variant === 'pcb' ? .43 : .22}
      clearcoat={variant === 'frame' ? .85 : .2} clearcoatRoughness={.17}
      envMapIntensity={1.3} emissive={selected ? ACCENT : '#000000'}
      emissiveIntensity={selected ? .24 : 0} wireframe={wireframe} />
  }

  function detail(id: GlassesComponent, color: string, roughness = .4, metalness = 0, clearcoat = 0) {
    return <meshPhysicalMaterial color={materialMode ? COLORS[id] : color}
      roughness={roughness} metalness={metalness} clearcoat={clearcoat} wireframe={wireframe}
      emissive={selectedComponent === id ? ACCENT : '#000000'} emissiveIntensity={selectedComponent === id ? .4 : 0} />
  }

  return <group position={[0, 0, 1.4]}>
    <group ref={front} onClick={select('frame')}>
      {geometry.rims.map((g, i) => <mesh key={i} geometry={g} castShadow>{finish('frame')}</mesh>)}
      <mesh geometry={geometry.bridge} castShadow>{finish('frame')}</mesh>
      {[-1, 1].map(side => <group key={side}>
        <mesh position={[side * .44, -.14, -.08]} rotation={[.13, side * -.28, side * -.20]} scale={[.14, .33, .13]}>
          <sphereGeometry args={[1, 18, 14]} />{finish('frame')}
        </mesh>
        <mesh position={[side * 3.03, .54, -.15]}><boxGeometry args={[.28, .38, .50]} />{finish('frame')}</mesh>
        <mesh position={[side * 3.16, .55, -.19]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[.075, .075, .33, 16]} />{finish('frame', 'metal')}
        </mesh>
        <mesh position={[side * 2.94, .78, -.015]} rotation={[0, 0, -.06 * side]}>
          <capsuleGeometry args={[.026, .11, 4, 8]} />{detail('frame', '#9ea3a6', .3, .9)}
        </mesh>
        <mesh position={[side * .82, .86, .205]} rotation={[Math.PI / 2, 0, 0]} onClick={select('audio')}>
          <cylinderGeometry args={[.025, .025, .025, 12]} />{detail('audio', '#030405', .8)}
        </mesh>
      </group>)}
      <mesh position={[-2.82, .53, .09]}>
        <circleGeometry args={[.12, 24]} />{detail('frame', '#151c20', .15, .4)}
      </mesh>
      <mesh position={[-2.82, .53, .10]}>
        <circleGeometry args={[.035, 18]} />{detail('frame', '#a4ac9a', .25, .15)}
      </mesh>
      {labels && <Annotation id="frame" position={[-2.1, 1.52, .2]} anchor={[-1.7, .97, .15]} onSelect={onSelectComponent}>01 / FRAME</Annotation>}
    </group>

    <group ref={lenses} position={[0, 0, .12]} onClick={select('lenses')}>
      {geometry.lenses.map((g, i) => <mesh key={i} geometry={g}>{finish('lenses', 'lens')}</mesh>)}
      {labels && <Annotation id="lenses" position={[-1.70, -1.43, .25]} anchor={[-1.7, -.42, .05]} onSelect={onSelectComponent}>02 / OPTICS</Annotation>}
    </group>

    {[-1, 1].map(side => <group key={side} ref={side < 0 ? leftTemple : rightTemple} position={[side * 3.02, .55, -.19]}>
      <group scale={[side, 1, 1]} onClick={select('frame')}>
        <mesh geometry={geometry.temple} castShadow>{finish('frame')}</mesh>
        <mesh position={[.19, -.015, -1.33]}><boxGeometry args={[.012, .028, 1.38]} />{detail('frame', '#3b4147', .38, .5)}</mesh>
        <mesh position={[.19, .015, -.35]}><boxGeometry args={[.018, .12, .34]} />{finish('frame', 'metal')}</mesh>
        <mesh position={[.204, .015, -.35]} rotation={[0, Math.PI / 2, 0]}><circleGeometry args={[.034, 16]} />{detail('frame', '#242a30')}</mesh>
        <mesh position={[.17, -.06, -2.06]}><boxGeometry args={[.012, .12, .50]} />{detail('frame', '#15191d', .6)}</mesh>
      </group>
      <group onClick={select('audio')}>
        {[0, 1, 2, 3, 4].map(i => <mesh key={i} position={[side * .174, -.205, -2.36 - i * .115]} rotation={[0, 0, Math.PI / 2]}>
          <capsuleGeometry args={[.022, .045, 3, 6]} />{detail('audio', '#010203', .9)}
        </mesh>)}
        {labels && !exploded && side > 0 && <Annotation id="audio" position={[.65, .55, -2.6]} anchor={[.174, -.205, -2.6]} onSelect={onSelectComponent}>04 / AUDIO</Annotation>}
      </group>
      {side < 0 && <group onClick={select('power')}>
        {[0, 1].map(i => <mesh key={i} position={[.177, -.12, -3.10 - i * .16]} rotation={[0, Math.PI / 2, 0]}>
          <cylinderGeometry args={[.045, .045, .02, 14]} />{detail('power', '#ad8b55', .25, .85)}
        </mesh>)}
        {labels && !exploded && <Annotation id="power" position={[-.65, .55, -3.1]} anchor={[.177, -.12, -3.1]} onSelect={onSelectComponent}>06 / POWER</Annotation>}
      </group>}
    </group>)}

    <group ref={camera} position={[2.84, .55, .055]} onClick={select('camera')}>
      <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[.205, .205, .115, 40]} />{finish('camera', 'metal')}</mesh>
      <mesh position={[0, 0, .071]}><circleGeometry args={[.167, 40]} />{detail('camera', '#04090d', .12, .5, 1)}</mesh>
      <mesh position={[0, 0, .08]}><torusGeometry args={[.112, .014, 10, 36]} />{detail('camera', '#334b5b', .22, .6)}</mesh>
      <mesh position={[0, 0, .088]}><circleGeometry args={[.088, 32]} />{detail('camera', '#081b26', .025, .38, 1)}</mesh>
      <mesh position={[-.035, .036, .091]}><circleGeometry args={[.022, 18]} />{detail('camera', '#94b6c4', .15, .2)}</mesh>
      {labels && <Annotation id="camera" position={[.38, .75, .20]} anchor={[0, 0, .10]} onSelect={onSelectComponent}>03 / VISION</Annotation>}
    </group>

    <group ref={processor} position={[3.02, .5, -1.73]} visible={false} onClick={select('processor')}>
      <mesh><boxGeometry args={[.09, .32, 1.82]} />{finish('processor', 'pcb')}</mesh>
      {[-.58, .04, .57].map((z, i) => <group key={z} position={[.065, 0, z]}>
        <mesh><boxGeometry args={[.07, i === 1 ? .25 : .17, i === 1 ? .40 : .24]} />{detail('processor', '#0b1519', .54)}</mesh>
        {[-1, 1].map(s => <mesh key={s} position={[.04, s * .13, 0]}><boxGeometry args={[.014, .04, .31]} />{detail('processor', '#a9a493', .35, .85)}</mesh>)}
      </group>)}
      {[0, 1, 2, 3, 4, 5].map(i => <group key={i}>
        <mesh position={[.051, .095 - i * .035, -.50]}><boxGeometry args={[.012, .007, .62]} />{detail('processor', '#ab8050', .33, .8)}</mesh>
        <mesh position={[.051, .095 - i * .035, .48]}><boxGeometry args={[.012, .007, .54]} />{detail('processor', '#ab8050', .33, .8)}</mesh>
      </group>)}
      {[-.76, .76].map(z => <mesh key={z} position={[.055, -.075, z]}><boxGeometry args={[.055, .065, .08]} />{detail('processor', '#ceb990', .38, .4)}</mesh>)}
      {labels && exploded && <Annotation id="processor" position={[.22, .72, -.2]} anchor={[.08, .1, 0]} onSelect={onSelectComponent}>05 / PROCESSING</Annotation>}
    </group>

    <group ref={power} position={[-3.02, .42, -2.12]} visible={false} onClick={select('power')}>
      <mesh><boxGeometry args={[.24, .27, 1.22]} />{finish('power', 'metal')}</mesh>
      <mesh position={[-.127, 0, 0]}><boxGeometry args={[.012, .20, 1.10]} />{detail('power', '#273038', .44, .4)}</mesh>
      <mesh position={[0, 0, .67]}><boxGeometry args={[.15, .18, .10]} />{detail('power', '#b09a66', .3, .8)}</mesh>
      <mesh position={[0, 0, -.65]}><boxGeometry args={[.17, .19, .10]} />{detail('power', '#171c21', .65)}</mesh>
      {labels && exploded && <Annotation id="power" position={[-.25, .75, -.2]} anchor={[-.12, .12, 0]} onSelect={onSelectComponent}>06 / POWER</Annotation>}
    </group>

    <group ref={audio} position={[3.02, .4, -2.86]} visible={false} onClick={select('audio')}>
      <mesh><boxGeometry args={[.18, .24, .48]} />{finish('audio', 'metal')}</mesh>
      <mesh position={[.101, 0, 0]} rotation={[0, Math.PI / 2, 0]}><circleGeometry args={[.09, 24]} />{detail('audio', '#131c20', .7)}</mesh>
      <mesh position={[.108, 0, 0]} rotation={[0, Math.PI / 2, 0]}><torusGeometry args={[.07, .009, 8, 24]} />{detail('audio', '#797c7e', .3, .8)}</mesh>
      {labels && exploded && <Annotation id="audio" position={[.20, -.65, .15]} anchor={[.1, 0, 0]} onSelect={onSelectComponent}>04 / AUDIO</Annotation>}
    </group>
  </group>
}

function Annotation({ id, position, anchor, onSelect, children }: {
  id: string; position: [number, number, number]; anchor: [number, number, number]; onSelect?: (id: string) => void; children: string
}) {
  const { gl, camera, size, invalidate } = useThree()
  const marker = useRef<THREE.Group>(null)
  const button = useRef<HTMLButtonElement | null>(null)
  const selection = useRef(onSelect)
  const projected = useRef(new THREE.Vector3())
  selection.current = onSelect

  useEffect(() => {
    const host = gl.domElement.closest('.smart-glasses-scene')
    if (!host) return
    // These lightweight overlays deliberately avoid creating nested React roots.
    const element = document.createElement('button')
    element.type = 'button'
    element.textContent = children
    element.setAttribute('aria-label', `Inspect ${id}`)
    Object.assign(element.style, {
      position: 'absolute', top: '0', left: '0', zIndex: '5', visibility: 'hidden',
      color: '#f4f1ea', background: 'rgba(12,15,18,.86)', border: '1px solid #414246',
      padding: '7px 10px', fontFamily: 'monospace', fontSize: '9px', letterSpacing: '.07em',
      whiteSpace: 'nowrap', cursor: 'pointer', borderRadius: '2px', pointerEvents: 'auto',
      willChange: 'transform',
    })
    const activate = () => selection.current?.(id)
    element.addEventListener('click', activate)
    host.appendChild(element)
    button.current = element
    invalidate()
    return () => {
      element.removeEventListener('click', activate)
      element.remove()
      if (button.current === element) button.current = null
    }
  }, [children, gl, id, invalidate])

  useFrame(() => {
    if (!marker.current || !button.current) return
    let ancestor: THREE.Object3D | null = marker.current
    let visible = true
    while (ancestor) {
      if (!ancestor.visible) { visible = false; break }
      ancestor = ancestor.parent
    }
    marker.current.updateWorldMatrix(true, false)
    projected.current.setFromMatrixPosition(marker.current.matrixWorld).project(camera)
    const { x, y, z } = projected.current
    visible = visible && z >= -1 && z <= 1 && x >= -1 && x <= 1 && y >= -1 && y <= 1
    button.current.style.visibility = visible ? 'visible' : 'hidden'
    if (visible) button.current.style.transform = `translate(${(x * .5 + .5) * size.width}px, ${(-y * .5 + .5) * size.height}px) translate(-50%, -50%)`
  }, -1)

  return <group>
    <Line points={[anchor, [anchor[0], position[1] * .7 + anchor[1] * .3, anchor[2]], position]} color="#96948d" transparent opacity={.65} lineWidth={.8} />
    <mesh position={anchor}><sphereGeometry args={[.025, 8, 6]} /><meshBasicMaterial color={ACCENT} /></mesh>
    <group ref={marker} position={position} />
  </group>
}
