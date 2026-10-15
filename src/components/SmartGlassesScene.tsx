import { Component, Suspense, useEffect, useRef, useState, type ErrorInfo, type ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import SmartGlassesModel, { type SmartGlassesModelProps } from './SmartGlassesModel'

export interface SmartGlassesSceneProps extends SmartGlassesModelProps {
  className?: string
  mode?: 'inspector'
  autoRotate?: boolean
  preset?: 'perspective' | 'front' | 'side'
  resetKey?: number
}

let webglAvailable: boolean | undefined
function supportsWebGL() {
  if (webglAvailable !== undefined) return webglAvailable
  try {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('webgl2')
    webglAvailable = !!context
    context?.getExtension('WEBGL_lose_context')?.loseContext()
  } catch { webglAvailable = false }
  return webglAvailable
}

export default function SmartGlassesScene({ className = '', ...props }: SmartGlassesSceneProps) {
  const container = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(true)
  const [contextLost, setContextLost] = useState(false)
  const [available] = useState(supportsWebGL)

  useEffect(() => {
    const element = container.current
    if (!element) return
    const observer = new IntersectionObserver(([entry]) => {
      setVisible(entry.isIntersecting)
    }, { rootMargin: '160px' })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return <div ref={container} className={`smart-glasses-scene ${className}`} style={{ width: '100%', height: '100%', position: 'relative' }}
    role="group" aria-label="Interactive conceptual AI smart glasses. Drag to rotate, or use the camera preset and component buttons.">
    <SceneBoundary>
      {available && !contextLost ? <Canvas
        dpr={[1, 1.6]} frameloop={visible ? props.reducedMotion ? 'demand' : 'always' : 'never'}
        camera={{ position: [4.6, 2.4, 9.0], fov: 36, near: .1, far: 70 }}
        gl={{ alpha: true, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0)
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = 1.2
        }}
        style={{ touchAction: 'pan-y' }}>
        <ContextWatcher onLost={() => setContextLost(true)} />
        <Suspense fallback={null}>
          <ProductLighting />
          <InspectorRig {...props} />
        </Suspense>
      </Canvas> : <ProductFallback />}
    </SceneBoundary>
    {(!available || contextLost) && <span style={{ position: 'absolute', bottom: 12, left: 12, color: '#989da7', fontSize: 10, fontFamily: 'monospace' }}>PRODUCT ILLUSTRATION · 3D UNAVAILABLE</span>}
  </div>
}

function ContextWatcher({ onLost }: { onLost: () => void }) {
  const gl = useThree(state => state.gl)
  useEffect(() => {
    const canvas = gl.domElement
    const lost = (event: Event) => { event.preventDefault(); onLost() }
    canvas.addEventListener('webglcontextlost', lost)
    return () => canvas.removeEventListener('webglcontextlost', lost)
  }, [gl, onLost])
  return null
}

function ProductLighting() {
  return <>
    <ambientLight intensity={.25} />
    <directionalLight position={[3, 8, 5]} intensity={2.6} color="#e3e9ee" />
    <directionalLight position={[-7, 3, -1]} intensity={1.7} color="#a4b4c6" />
    <spotLight position={[6, 2, -5]} color="#ff7138" intensity={26} angle={.7} penumbra={1} distance={25} />
    <Environment resolution={256} frames={1}>
      <Lightformer form="rect" intensity={4.5} color="#e8edf2" position={[0, 5, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[10, 5, 1]} />
      <Lightformer form="rect" intensity={5} color="#eaf0f5" position={[-5, 2, 5]} rotation={[0, Math.PI / 4, 0]} scale={[2.3, 8, 1]} />
      <Lightformer form="rect" intensity={2.8} color="#bdc7d8" position={[6, 0, 3]} rotation={[0, -Math.PI / 3, 0]} scale={[1.2, 7, 1]} />
      <Lightformer form="rect" intensity={2.0} color="#ff8957" position={[2, 2, -5]} rotation={[0, Math.PI, 0]} scale={[6, .65, 1]} />
      <Lightformer form="rect" intensity={1.4} color="#f4f1ea" position={[0, -3, 5]} rotation={[0, 0, .5]} scale={[7, .7, 1]} />
    </Environment>
  </>
}

function InspectorRig({ autoRotate = false, preset = 'perspective', resetKey = 0, ...modelProps }: SmartGlassesSceneProps) {
  const { camera, size, invalidate } = useThree()
  const controls = useRef<OrbitControlsImpl>(null)
  const transitioning = useRef(true)
  const targetPosition = useRef(new THREE.Vector3())
  const targetLookAt = useRef(new THREE.Vector3())
  const exploded = modelProps.exploded ?? false
  const reducedMotion = modelProps.reducedMotion ?? false
  const selected = modelProps.selectedComponent

  useEffect(() => {
    const positions = { perspective: [4.6, 2.4, 9.0], front: [0, .45, 10.5], side: [9.6, 1.6, 2.5] }
    const p = positions[preset]
    targetPosition.current.set(p[0], p[1], p[2])
    const aspect = size.width / Math.max(size.height, 1)
    const fit = aspect < 1.25 ? 1.25 / Math.max(aspect, .65) : 1
    targetPosition.current.multiplyScalar(fit * (exploded ? 1.15 : 1))
    targetLookAt.current.set(0, 0, -.1)
    if (selected) {
      targetPosition.current.multiplyScalar(.93)
      if (selected === 'camera') targetLookAt.current.set(.52, .12, .2)
      if (selected === 'processor' || selected === 'audio') targetLookAt.current.set(.55, .15, -.3)
      if (selected === 'power') targetLookAt.current.set(-.5, .13, -.3)
    }
    transitioning.current = true
    invalidate()
  }, [preset, resetKey, selected, exploded, size.width, size.height, invalidate])

  useFrame((_, delta) => {
    const easing = reducedMotion ? 1 : 1 - Math.exp(-delta * 4.2)
    if (transitioning.current) {
      camera.position.lerp(targetPosition.current, easing)
      if (controls.current) {
        controls.current.target.lerp(targetLookAt.current, easing)
        controls.current.update()
      } else camera.lookAt(targetLookAt.current)
      if (camera.position.distanceTo(targetPosition.current) < .015) transitioning.current = false
    }
  }, -3)

  return <>
    <SmartGlassesModel {...modelProps} exploded={exploded} />
    <OrbitControls ref={controls} makeDefault enableZoom={false} enablePan={false}
      enableDamping={!reducedMotion} dampingFactor={.07} autoRotate={autoRotate && !reducedMotion} autoRotateSpeed={.6}
      minPolarAngle={.35} maxPolarAngle={Math.PI - .35}
      onStart={() => { transitioning.current = false }} />
  </>
}

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(_error: Error, _info: ErrorInfo) { /* The original vector concept remains available when rendering fails. */ }
  render() { return this.state.failed ? <ProductFallback /> : this.props.children }
}

export function ProductFallback() {
  return <svg viewBox="0 0 800 470" width="100%" height="100%" role="img" aria-label="Illustrated concept of black AI smart glasses" style={{ display: 'block' }}>
    <defs>
      <linearGradient id="lv-fallback-acetate" x1="0" y1="0" x2=".4" y2="1"><stop stopColor="#626970" /><stop offset=".14" stopColor="#272c32" /><stop offset=".55" stopColor="#0a0d11" /><stop offset="1" stopColor="#383f45" /></linearGradient>
      <linearGradient id="lv-fallback-lens" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#5a6b69" /><stop offset=".42" stopColor="#202e2e" /><stop offset="1" stopColor="#0a1217" /></linearGradient>
      <linearGradient id="lv-fallback-rim"><stop stopColor="#656e78" /><stop offset=".35" stopColor="#171d23" /><stop offset="1" stopColor="#a46543" /></linearGradient>
    </defs>
    <g transform="translate(40 15) rotate(-7 360 235)">
      <path d="M100 215 220 108Q235 96 253 100L520 144Q543 152 550 177L568 224 550 234 525 187Q521 175 506 173L253 128 124 242Z" fill="url(#lv-fallback-acetate)" stroke="#404950" strokeWidth="2" />
      <path d="m608 238 50-127q6-18 25-13l30 12q12 6 9 20l-13 51-13-5 6-41q1-7-7-8l-14-3-41 132z" fill="url(#lv-fallback-acetate)" stroke="#49525b" strokeWidth="2" />
      <path d="M76 190Q176 160 302 193L329 213Q342 206 358 214L385 207Q501 194 635 226L647 260 623 344Q615 366 586 369L429 342Q402 336 394 311L370 245Q351 229 332 240L309 310Q301 335 273 332L119 303Q93 296 88 270Z" fill="url(#lv-fallback-acetate)" stroke="url(#lv-fallback-rim)" strokeWidth="3" />
      <path d="M112 213Q189 196 279 217L294 231 279 291Q276 304 259 302L132 280Q119 278 116 263Z" fill="url(#lv-fallback-lens)" stroke="#777b78" strokeOpacity=".4" strokeWidth="2" />
      <path d="M410 234Q504 222 608 246L612 260 594 329Q590 343 574 340L444 317Q431 315 427 301Z" fill="url(#lv-fallback-lens)" stroke="#777b78" strokeOpacity=".4" strokeWidth="2" />
      <path d="m128 220 62-6 55 80-30-5zM442 239l61-1 65 96-33-6z" fill="#b8cfce" opacity=".065" />
      <circle cx="619" cy="239" r="11" fill="#879298" /><circle cx="619" cy="239" r="8" fill="#081118" /><circle cx="619" cy="239" r="5" fill="#213e4c" /><circle cx="617" cy="237" r="2" fill="#9bc4d4" />
      <circle cx="97" cy="205" r="4" fill="#7c8d8d" /><path d="m636 223 12-28" stroke="#bd7953" strokeOpacity=".65" strokeWidth="2" />
    </g>
  </svg>
}
