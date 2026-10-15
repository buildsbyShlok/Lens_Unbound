import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { AudioLines, Box, Camera, Check, ChevronRight, Cpu, Expand, Glasses, Layers3, Lightbulb, MousePointer2, Move3D, RotateCcw, RotateCw, ScanLine, Sparkles, Tag, X, Zap } from 'lucide-react'
import './inspector.css'

const SmartGlassesScene = lazy(() => import('./SmartGlassesScene'))

type ComponentId = 'frame' | 'lenses' | 'camera' | 'audio' | 'processor' | 'power'
type CameraPreset = 'perspective' | 'front' | 'side'

const components: { id: ComponentId; number: string; title: string; icon: LucideIcon; subtitle: string; description: string; note: string }[] = [
  { id: 'frame', number: '01', title: 'Frame & structure', icon: Glasses, subtitle: 'The architecture of everyday wear.', description: 'The frame connects optical surfaces, articulated temples, and electronic subsystems. Its shape balances a familiar eyewear silhouette with space for embedded components.', note: 'A custom geometric study of black polymer eyewear and metal hinge details.' },
  { id: 'lenses', number: '02', title: 'Optical surfaces', icon: ScanLine, subtitle: 'A clearer point of view.', description: 'Two individually modeled, lightly tinted lenses sit within the front frame. Controlled transparency and studio reflections reveal their curvature as you move around the model.', note: 'Illustrative optical surfaces; no display, prescription, or optical-performance specification is implied.' },
  { id: 'camera', number: '03', title: 'Camera module', icon: Camera, subtitle: 'A window into the surroundings.', description: 'A compact front-facing camera represents one possible input for intelligent eyewear. Its placement connects the external scene to the idea of an embedded vision pipeline.', note: 'Conceptual placement. Sensor, resolution, and vision capabilities are not verified product specifications.' },
  { id: 'audio', number: '04', title: 'Audio subsystem', icon: AudioLines, subtitle: 'An interface you can hear.', description: 'Temple-mounted audio elements suggest how personal sound and voice interaction can fit into an eyewear form. The model separates these elements to make their role easier to understand.', note: 'A conceptual audio layout, not a claim of tested microphones, speakers, or voice features.' },
  { id: 'processor', number: '05', title: 'Embedded processing', icon: Cpu, subtitle: 'Where input becomes behavior.', description: 'A miniature circuit-board assembly represents the processing layer between inputs, firmware, and connected software. The exploded view makes this otherwise hidden relationship visible.', note: 'Generic illustrative electronics. The model does not identify the actual product chipset or internal board design.' },
  { id: 'power', number: '06', title: 'Power system', icon: Zap, subtitle: 'Supporting the whole system.', description: 'A compact power module illustrates the need to supply and manage energy within a wearable device. Its shape and position demonstrate packaging constraints inside a narrow temple.', note: 'Conceptual architecture. Battery capacity, runtime, charging performance, and placement are unverified.' },
]

interface ToggleProps { label: string; active: boolean; onClick: () => void; icon: LucideIcon; description: string; disabled?: boolean }

function InspectorToggle({ label, active, onClick, icon: Icon, description, disabled }: ToggleProps) {
  return <button className={`inspector-toggle${active ? ' is-on' : ''}`} type="button" onClick={onClick} aria-pressed={active} title={description} disabled={disabled}>
    <Icon size={17} strokeWidth={1.6} aria-hidden="true" />
    <span>{label}</span>
    <span className="inspector-toggle-indicator" aria-hidden="true">{active && <Check size={10} strokeWidth={2.6} />}</span>
  </button>
}

export default function ProductInspector() {
  const [preset, setPreset] = useState<CameraPreset>('perspective')
  const [autoRotate, setAutoRotate] = useState(false)
  const [labels, setLabels] = useState(true)
  const [exploded, setExploded] = useState(false)
  const [materialMode, setMaterialMode] = useState(false)
  const [wireframe, setWireframe] = useState(false)
  const [templesOpen, setTemplesOpen] = useState(true)
  const [selectedComponent, setSelectedComponent] = useState<ComponentId | null>(null)
  const [resetKey, setResetKey] = useState(0)
  const [reducedMotion, setReducedMotion] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const componentButtonsRef = useRef<Partial<Record<ComponentId, HTMLButtonElement>>>({})
  const selected = components.find((component) => component.id === selectedComponent)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => { setReducedMotion(media.matches); if (media.matches) setAutoRotate(false) }
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  const selectComponent = (id: string) => {
    if (components.some((component) => component.id === id)) {
      setSelectedComponent(id as ComponentId)
      setAutoRotate(false)
      setResetKey((key) => key + 1)
      if (id === 'processor' || id === 'power' || id === 'audio') {
        setExploded(true)
        setTemplesOpen(true)
      }
    }
  }

  const clearSelection = () => {
    if (selectedComponent) componentButtonsRef.current[selectedComponent]?.focus({ preventScroll: true })
    setSelectedComponent(null)
    setResetKey((key) => key + 1)
  }

  const toggleExplosion = () => {
    if (!exploded) setTemplesOpen(true)
    else if (selectedComponent === 'processor' || selectedComponent === 'power' || selectedComponent === 'audio') setSelectedComponent(null)
    setExploded(!exploded)
  }

  const toggleTemples = () => {
    if (templesOpen) {
      setExploded(false)
      if (selectedComponent === 'processor' || selectedComponent === 'power' || selectedComponent === 'audio') setSelectedComponent(null)
    }
    setTemplesOpen(!templesOpen)
  }

  const choosePreset = (view: CameraPreset) => {
    setPreset(view)
    setSelectedComponent(null)
    setAutoRotate(false)
    setResetKey((key) => key + 1)
  }

  const reset = () => {
    setPreset('perspective')
    setAutoRotate(false)
    setLabels(true)
    setExploded(false)
    setMaterialMode(false)
    setWireframe(false)
    setTemplesOpen(true)
    setSelectedComponent(null)
    setResetKey((key) => key + 1)
  }

  return <main className="product-inspector" aria-labelledby="inspector-title" aria-describedby="inspector-description">
    <header className="inspector-header">
      <div>
        <div className="inspector-eyebrow"><span className="inspector-live-dot" />  <span className="inspector-header-slash"></span> PRODUCT EXPLORER</div>
        <h1 id="inspector-title">A closer look<span>.</span></h1>
      </div>
      <button type="button" className="inspector-close" onClick={() => choosePreset('perspective')} aria-label="Reset camera view">
        <span>RESET VIEW</span><RotateCcw size={22} strokeWidth={1.5} aria-hidden="true" />
      </button>
    </header>

    <div className="inspector-layout">
      <section className="inspector-stage" aria-label="Interactive 3D eyewear model">
        <div className="inspector-stage-heading">
          <span className="inspector-mono">3D</span>
          <span className="inspector-stage-state"><span /> {exploded ? 'EXPLODED VIEW' : 'ASSEMBLED VIEW'}</span>
        </div>
        <div className="inspector-scene">
          <Suspense fallback={<div className="inspector-loading" role="status"><Glasses size={48} strokeWidth={1} /><span>PREPARING THE STUDIO</span></div>}>
            <SmartGlassesScene className="inspector-canvas" mode="inspector" exploded={exploded} wireframe={wireframe} materialMode={materialMode} autoRotate={autoRotate} templesOpen={templesOpen} selectedComponent={selectedComponent} onSelectComponent={selectComponent} preset={preset} resetKey={resetKey} reducedMotion={reducedMotion} labels={labels} />
          </Suspense>
        </div>
        <div className="inspector-stage-footer">
          <div className="inspector-views" role="group" aria-label="Camera view">
            {([{ id: 'perspective', label: 'Three-quarter' }, { id: 'front', label: 'Front' }, { id: 'side', label: 'Side' }] as const).map((view) => <button key={view.id} type="button" aria-pressed={preset === view.id && !selectedComponent} className={preset === view.id && !selectedComponent ? 'is-active' : ''} onClick={() => choosePreset(view.id)}>{view.label}</button>)}
          </div>
          <p className="inspector-drag-hint"><MousePointer2 size={13} aria-hidden="true" /> Drag to orbit <span>·</span> Select a view to reframe</p>
        </div>
      </section>

      <aside className="inspector-sidebar" aria-label="Inspection controls and component information">
        <div className="inspector-section inspector-display-section">
          <div className="inspector-section-heading"><h3>Make it your view.</h3><Move3D size={17} strokeWidth={1.5} aria-hidden="true" /></div>
          <p id="inspector-description" className="inspector-description">Turn it. Unpack it. Explore the details that bring an idea into focus.</p>
          <div className="inspector-toggles">
            <InspectorToggle label="Slow rotation" active={autoRotate} disabled={reducedMotion} onClick={() => { setAutoRotate(!autoRotate); setSelectedComponent(null) }} icon={RotateCw} description={reducedMotion ? 'Automatic rotation is disabled by your reduced-motion preference' : 'Toggle slow automatic rotation'} />
            <InspectorToggle label="Labels" active={labels} onClick={() => setLabels(!labels)} icon={Tag} description="Show or hide component annotations" />
            <InspectorToggle label="Exploded view" active={exploded} onClick={toggleExplosion} icon={Expand} description="Separate or reassemble conceptual components" />
            <InspectorToggle label="Materials" active={materialMode} onClick={() => setMaterialMode(!materialMode)} icon={Sparkles} description="Distinguish the model's material surfaces" />
            <InspectorToggle label="Wireframe" active={wireframe} onClick={() => setWireframe(!wireframe)} icon={Box} description="Show or hide the model's underlying mesh geometry" />
            <InspectorToggle label="Open temples" active={templesOpen} onClick={toggleTemples} icon={Glasses} description="Open or fold the articulated temple arms; folding reassembles the model" />
          </div>
          {reducedMotion && <p className="inspector-motion-note">Reduced motion is on. Camera changes are simplified and automatic rotation is disabled.</p>}
          <button type="button" className="inspector-reset" onClick={reset}><RotateCcw size={14} aria-hidden="true" /> Reset all controls</button>
        </div>

        <div className="inspector-section inspector-components-section">
          <div className="inspector-section-heading"><h3>Inside the idea.</h3><span className="inspector-mono">06 COMPONENTS</span></div>
          <div className="inspector-component-list" role="group" aria-label="Select a component to inspect">
            {components.map(({ id, number, title, icon: Icon }) => <button type="button" key={id} ref={(button) => { if (button) componentButtonsRef.current[id] = button; else delete componentButtonsRef.current[id] }} className={`inspector-component${selectedComponent === id ? ' is-selected' : ''}`} onClick={() => selectComponent(id)} aria-pressed={selectedComponent === id} aria-controls="inspector-component-detail">
              <span className="inspector-component-number">{number}</span><Icon size={17} strokeWidth={1.5} aria-hidden="true" /><span>{title}</span><ChevronRight size={14} aria-hidden="true" />
            </button>)}
          </div>
          <div id="inspector-component-detail" className={`inspector-detail${selected ? ' has-selection' : ''}`} aria-live="polite" aria-atomic="true">
            {selected ? <>
              <span className="inspector-detail-label">COMPONENT {selected.number} <span> / </span> CONCEPTUAL</span>
              <h4>{selected.subtitle}</h4>
              <p>{selected.description}</p>
              <p className="inspector-detail-note">{selected.note}</p>
              <button type="button" className="inspector-clear" onClick={clearSelection}><X size={12} aria-hidden="true" /> Clear selection</button>
            </> : <><Lightbulb size={19} strokeWidth={1.4} aria-hidden="true" /><p>Select a component above or on the model to explore its role.</p></>}
          </div>
        </div>

        <div className="inspector-disclaimer"><Layers3 size={15} strokeWidth={1.5} aria-hidden="true" /><div><strong>CONCEPTUAL INTERNAL ARCHITECTURE</strong><p>An original visualization of smart-eyewear concepts. Internal layout and materials are illustrative, not verified product specifications.</p></div></div>
      </aside>
    </div>
  </main>
}
