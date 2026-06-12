import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree, advance } from '@react-three/fiber'
import { OrbitControls, useGLTF, Clone } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { catItem } from '../catalog'
import { useApp, type SceneItem } from '../store'

/* Таймерный ResizeObserver: в части встроенных webview (и в превью-средах) нативный RO
   не вызывает колбэки — R3F тогда не монтирует сцену (размер 0). Полифилл снимает зависимость. */
class TimerResizeObserver {
  private cb: (entries: { target: Element; contentRect: DOMRectReadOnly }[], ro: TimerResizeObserver) => void
  private els = new Map<Element, { w: number; h: number }>()
  private t: ReturnType<typeof setInterval>
  constructor(cb: TimerResizeObserver['cb']) {
    this.cb = cb
    this.t = setInterval(() => {
      const entries: { target: Element; contentRect: DOMRectReadOnly }[] = []
      this.els.forEach((prev, el) => {
        const r = el.getBoundingClientRect()
        if (Math.abs(r.width - prev.w) > 1 || Math.abs(r.height - prev.h) > 1) {
          this.els.set(el, { w: r.width, h: r.height })
          entries.push({ target: el, contentRect: r })
        }
      })
      if (entries.length) this.cb(entries, this)
    }, 300)
  }
  observe(el: Element) {
    const r = el.getBoundingClientRect()
    this.els.set(el, { w: r.width, h: r.height })
    this.cb([{ target: el, contentRect: r }], this) // первичный замер — как у нативного RO
  }
  unobserve(el: Element) { this.els.delete(el) }
  disconnect() { this.els.clear(); clearInterval(this.t) }
}

/* ====== геометрия предмета: половинные габариты по XZ с учётом поворота ====== */
export interface ItemBounds { hw: number; hd: number; h: number }
const boundsCache: Record<string, ItemBounds> = {}

export function halfExtents(b: ItemBounds, ry: number) {
  const c = Math.abs(Math.cos(ry)), s = Math.abs(Math.sin(ry))
  return { x: b.hw * c + b.hd * s, z: b.hw * s + b.hd * c }
}

export function itemProblems(items: SceneItem[], roomW: number, roomD: number): string[] {
  const out: string[] = []
  for (const it of items) {
    const b = boundsCache[it.sku]; if (!b) continue
    const e = halfExtents(b, it.ry)
    const name = catItem(it.sku).name
    if (it.x - e.x < -roomW / 2 - 0.01 || it.x + e.x > roomW / 2 + 0.01 || it.z - e.z < -roomD / 2 - 0.01 || it.z + e.z > roomD / 2 + 0.01)
      out.push(`${name}: выходит за стены`)
    for (const o of items) {
      if (o.id === it.id) continue
      const k1 = catItem(it.sku).kind, k2 = catItem(o.sku).kind
      if ((k1 === 'seat' && k2 === 'table') || (k1 === 'table' && k2 === 'seat')) continue // стул задвигается под стол
      const ob = boundsCache[o.sku]; if (!ob) continue
      const oe = halfExtents(ob, o.ry)
      if (Math.abs(it.x - o.x) < e.x + oe.x - 0.02 && Math.abs(it.z - o.z) < e.z + oe.z - 0.02) {
        out.push(`${name}: пересекается с «${catItem(o.sku).name}»`); break
      }
    }
  }
  return out
}

/* ====== окружение: студийный свет RoomEnvironment ====== */
function Env() {
  const { gl, scene } = useThree()
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl)
    const tex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = tex
    scene.environmentIntensity = 0.55
    return () => { tex.dispose(); pmrem.dispose() }
  }, [gl, scene])
  return null
}

/* ====== оболочка комнаты: пол PBR + стены с автоскрытием ====== */
function RoomShell({ w, d, h, paint }: { w: number; d: number; h: number; paint: string }) {
  const [diff, rough] = useMemo(() => {
    const tl = new THREE.TextureLoader()
    const t1 = tl.load(import.meta.env.BASE_URL + 'assets/3d/textures/floor_diff.jpg')
    const t2 = tl.load(import.meta.env.BASE_URL + 'assets/3d/textures/floor_rough.jpg')
    t1.colorSpace = THREE.SRGBColorSpace
    for (const t of [t1, t2]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8 }
    return [t1, t2]
  }, [])
  useEffect(() => { for (const t of [diff, rough]) t.repeat.set(w / 2.4, d / 2.4) }, [diff, rough, w, d])

  const wallsRef = useRef<THREE.Group>(null)
  const camDir = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ camera }) => {
    if (!wallsRef.current) return
    camDir.copy(camera.position).setY(0).normalize()
    for (const g of wallsRef.current.children) {
      const n = (g.userData as { n: THREE.Vector3 }).n
      g.visible = n.dot(camDir) < 0.25
    }
  })

  const walls: { n: THREE.Vector3; pos: [number, number, number]; ry: number; len: number }[] = [
    { n: new THREE.Vector3(0, 0, -1), pos: [0, 0, -d / 2 - 0.04], ry: 0, len: w },
    { n: new THREE.Vector3(0, 0, 1), pos: [0, 0, d / 2 + 0.04], ry: 0, len: w },
    { n: new THREE.Vector3(-1, 0, 0), pos: [-w / 2 - 0.04, 0, 0], ry: Math.PI / 2, len: d },
    { n: new THREE.Vector3(1, 0, 0), pos: [w / 2 + 0.04, 0, 0], ry: Math.PI / 2, len: d },
  ]
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial map={diff} roughnessMap={rough} roughness={0.9} metalness={0} />
      </mesh>
      <group ref={wallsRef}>
        {walls.map((wl, i) => (
          <group key={i} position={wl.pos} rotation-y={wl.ry} userData={{ n: wl.n }}>
            <mesh position-y={h / 2} receiveShadow>
              <boxGeometry args={[wl.len, h, 0.08]} />
              <meshStandardMaterial color={paint} roughness={0.95} />
            </mesh>
            <mesh position-y={0.045}>
              <boxGeometry args={[wl.len, 0.09, 0.094]} />
              <meshStandardMaterial color="#f2ede3" roughness={0.6} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  )
}

/* ====== один предмет: GLB, нормализованный к полу и центру XZ ====== */
function Item({ item, selected, invalid, onDown }: {
  item: SceneItem; selected: boolean; invalid: boolean
  onDown: (e: { stopPropagation: () => void; point: THREE.Vector3 }, item: SceneItem) => void
}) {
  const url = import.meta.env.BASE_URL + `assets/3d/${item.sku}/${item.sku}.gltf`
  const { scene } = useGLTF(url)
  const { offset, ring } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    boundsCache[item.sku] = { hw: size.x / 2, hd: size.z / 2, h: size.y }
    return {
      offset: new THREE.Vector3(-center.x, -box.min.y, -center.z),
      ring: Math.hypot(size.x / 2, size.z / 2) + 0.07,
    }
  }, [scene, item.sku])
  useEffect(() => { scene.traverse(o => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true } }) }, [scene])

  return (
    <group position={[item.x, 0, item.z]} rotation-y={item.ry}>
      <group onPointerDown={e => onDown(e, item)}>
        <Clone object={scene} position={offset.toArray()} />
      </group>
      {selected && (
        <mesh rotation-x={-Math.PI / 2} position-y={0.012}>
          <ringGeometry args={[ring, ring + 0.05, 56]} />
          <meshBasicMaterial color={invalid ? '#b91c1c' : '#0f766e'} transparent opacity={0.9} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  )
}

/* ====== камера: обход / план сверху ====== */
function CameraRig({ mode, roomW, roomD, roomH }: { mode: 'orbit' | 'top'; roomW: number; roomD: number; roomH: number }) {
  const controls = useRef<OrbitControlsImpl>(null)
  const anim = useRef<{ p: THREE.Vector3; t: THREE.Vector3; k: number } | null>(null)
  const saved = useRef<{ p: THREE.Vector3; t: THREE.Vector3 } | null>(null)
  const { camera } = useThree()
  const prev = useRef(mode)

  useEffect(() => {
    if (mode === prev.current) return
    prev.current = mode
    if (mode === 'top') {
      saved.current = { p: camera.position.clone(), t: controls.current!.target.clone() }
      anim.current = { p: new THREE.Vector3(0.001, Math.max(roomW, roomD) * 1.35, 0.001), t: new THREE.Vector3(0, 0, 0), k: 0 }
    } else {
      const back = saved.current ?? { p: new THREE.Vector3(roomW * 0.62, roomH * 0.78, roomD * 1.12), t: new THREE.Vector3(0, 0.85, 0) }
      anim.current = { p: back.p.clone(), t: back.t.clone(), k: 0 }
    }
  }, [mode, camera, roomW, roomD, roomH])

  useFrame((_, dt) => {
    if (!anim.current || !controls.current) return
    anim.current.k = Math.min(1, anim.current.k + dt / 0.6)
    const e = 1 - Math.pow(1 - anim.current.k, 3)
    camera.position.lerp(anim.current.p, e)
    controls.current.target.lerp(anim.current.t, e)
    if (anim.current.k >= 1) anim.current = null
  })

  return <OrbitControls
    ref={controls}
    makeDefault
    enableDamping dampingFactor={0.08}
    enableRotate={mode === 'orbit'}
    maxPolarAngle={Math.PI / 2 - 0.02}
    minDistance={1.4} maxDistance={Math.max(roomW, roomD) * 3.2}
    target={[0, 0.85, 0]}
    mouseButtons={{ LEFT: undefined as unknown as THREE.MOUSE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }}
  />
}

/* ====== drag по полу ====== */
function DragController({ roomW, roomD, dragRef }: {
  roomW: number; roomD: number
  dragRef: React.MutableRefObject<{ id: number; dx: number; dz: number } | null>
}) {
  const { gl, camera, controls } = useThree()
  const roomId = useApp(s => s.roomKey)!
  const moveItem = useApp(s => s.moveItem)
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), [])
  const ray = useMemo(() => new THREE.Raycaster(), [])
  const ndc = useMemo(() => new THREE.Vector2(), [])
  const pt = useMemo(() => new THREE.Vector3(), [])

  useEffect(() => {
    const el = gl.domElement
    const onMove = (ev: PointerEvent) => {
      const d = dragRef.current; if (!d) return
      const r = el.getBoundingClientRect()
      ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1)
      ray.setFromCamera(ndc, camera)
      if (!ray.ray.intersectPlane(plane, pt)) return
      const st = useApp.getState()
      const it = st.scenes[roomId]?.items.find(i => i.id === d.id); if (!it) return
      const b = boundsCache[it.sku]; if (!b) return
      const e = halfExtents(b, it.ry)
      moveItem(roomId, d.id,
        THREE.MathUtils.clamp(pt.x - d.dx, -roomW / 2 + e.x, roomW / 2 - e.x),
        THREE.MathUtils.clamp(pt.z - d.dz, -roomD / 2 + e.z, roomD / 2 - e.z))
    }
    const onUp = () => {
      if (dragRef.current) {
        dragRef.current = null
        const c = controls as unknown as { enabled: boolean } | null
        if (c) c.enabled = true
      }
    }
    el.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => { el.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp) }
  }, [gl, camera, controls, plane, ray, ndc, pt, roomId, roomW, roomD, moveItem, dragRef])
  return null
}

/* ====== сцена комнаты целиком ====== */
export function RoomCanvas({ roomW, roomD, mode, selId, setSelId }: {
  roomW: number; roomD: number; mode: 'orbit' | 'top'
  selId: number | null; setSelId: (id: number | null) => void
}) {
  const ROOM_H = 2.7
  const roomId = useApp(s => s.roomKey)!
  const scene = useApp(s => s.scenes[roomId])
  const dragRef = useRef<{ id: number; dx: number; dz: number } | null>(null)
  const [, force] = useState(0)

  const problems = scene ? itemProblems(scene.items, roomW, roomD) : []
  const invalidNames = new Set(problems.map(p => p.split(':')[0]))

  const onItemDown = useCallback((e: { stopPropagation: () => void; point: THREE.Vector3 }, item: SceneItem) => {
    e.stopPropagation()
    setSelId(item.id)
    dragRef.current = { id: item.id, dx: e.point.x - item.x, dz: e.point.z - item.z }
    force(n => n + 1)
  }, [setSelId])

  const sun = Math.max(roomW, roomD)
  return (
    <Canvas
      shadows={{ type: THREE.PCFSoftShadowMap }}
      gl={{ antialias: true, preserveDrawingBuffer: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.12 }}
      camera={{ fov: 46, near: 0.05, far: 120, position: [roomW * 0.62, ROOM_H * 0.78, roomD * 1.12] }}
      onPointerMissed={() => setSelId(null)}
      resize={{ polyfill: TimerResizeObserver as unknown as typeof ResizeObserver, scroll: false, debounce: 0 }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <color attach="background" args={['#f2efe9']} />
      <Env />
      <hemisphereLight args={['#fdf6ea', '#b9a98e', 0.35]} />
      <directionalLight
        color="#fff2e0" intensity={2.6} position={[-roomW * 0.7, ROOM_H * 2.1, roomD * 0.9]}
        castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.02} shadow-radius={7}
        shadow-camera-left={-sun} shadow-camera-right={sun} shadow-camera-top={sun} shadow-camera-bottom={-sun}
        shadow-camera-near={0.5} shadow-camera-far={20}
      />
      <RoomShell w={roomW} d={roomD} h={ROOM_H} paint={scene?.paint ?? '#e7e1d4'} />
      {scene?.items.map(it => (
        <Item key={it.id} item={it}
          selected={selId === it.id}
          invalid={invalidNames.has(catItem(it.sku).name)}
          onDown={onItemDown} />
      ))}
      <CameraRig mode={mode} roomW={roomW} roomD={roomD} roomH={ROOM_H} />
      <DragController roomW={roomW} roomD={roomD} dragRef={dragRef} />
      <DisableControlsWhileDrag dragRef={dragRef} />
      <SizeFix />
    </Canvas>
  )
}

/* отключение OrbitControls на время перетаскивания */
function DisableControlsWhileDrag({ dragRef }: { dragRef: React.MutableRefObject<unknown | null> }) {
  const { controls } = useThree()
  useFrame(() => {
    const c = controls as unknown as { enabled: boolean } | null
    if (c) c.enabled = !dragRef.current
  })
  return null
}

/* страховка размера: в окружениях без рабочего ResizeObserver канвас остаётся 300×150.
   Правим напрямую renderer + camera, в обход стора R3F. */
function SizeFix() {
  const { gl, camera } = useThree()
  useEffect(() => {
    const host = gl.domElement.parentElement
    if (!host) return
    const apply = () => {
      const r = host.getBoundingClientRect()
      ;(window as unknown as Record<string, unknown>).__dlSizeTick = { t: Date.now(), host: [r.width, r.height], canvas: [gl.domElement.width, gl.domElement.height] }
      if (r.width < 2 || r.height < 2) return
      const cur = gl.getSize(new THREE.Vector2())
      if (Math.abs(cur.x - r.width) > 2 || Math.abs(cur.y - r.height) > 2) {
        gl.setSize(r.width, r.height)
        const cam = camera as THREE.PerspectiveCamera
        if (cam.isPerspectiveCamera) { cam.aspect = r.width / r.height; cam.updateProjectionMatrix() }
      }
    }
    apply()
    const t = setInterval(apply, 600)
    window.addEventListener('resize', apply)
    // dev-хук: форс-рендер кадра в окружениях с замороженным rAF (скрытые webview)
    ;(window as unknown as Record<string, unknown>).__r3fAdvance = (n = 3) => {
      for (let i = 0; i < (n as number); i++) advance(performance.now() + i * 16, true)
    }
    return () => { clearInterval(t); window.removeEventListener('resize', apply) }
  }, [gl, camera])
  return null
}

export function preloadModels(ids: string[]) {
  for (const id of ids) useGLTF.preload(import.meta.env.BASE_URL + `assets/3d/${id}/${id}.gltf`)
}
