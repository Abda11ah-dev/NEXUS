// Three.js scene for the NEXUS body. Loaded lazily (see pages/Body.tsx) so the main bundle stays small.
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GROUP_DEFS, buildAnatomy, FIGURE_CENTER_Y } from './anatomy'
import { muscleById } from '../data/muscles'

export type SceneCommand = { type: 'view'; view: 'front' | 'back' | 'side' } | { type: 'reset' } | { type: 'focus'; id: string; rotate: boolean }
interface Props { mode: 'real' | 'holo'; selected: string | null; peel: boolean; onSelect: (id: string | null) => void; command: (SceneCommand & { n: number }) | null; onError: (msg: string) => void }

const VERT = /* glsl */ `
attribute float tend;
varying vec3 vN; varying vec3 vV; varying vec2 vUv; varying float vTend; varying float vY;
void main(){
  vUv = uv; vTend = tend; vY = position.y;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vV = -mv.xyz; vN = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * mv;
}`
// One shader draws BOTH looks. uHolo (0..1) blends from "realistic muscle" to "holographic projection",
// which gives the smooth transition and guarantees the hologram uses exactly the same anatomy.
const FRAG = /* glsl */ `
precision highp float;
uniform float uTime, uHolo, uSel, uDim, uFiber, uAlpha;
uniform vec3 uBase;
varying vec3 vN; varying vec3 vV; varying vec2 vUv; varying float vTend; varying float vY;
void main(){
  vec3 N = normalize(vN); vec3 V = normalize(vV);
  float ndv = clamp(dot(N, V), 0.0, 1.0);
  float fres = pow(1.0 - ndv, 2.2);
  vec3 L1 = normalize(vec3(0.35, 0.6, 0.75)); vec3 L2 = normalize(vec3(-0.6, 0.15, 0.4));
  float dif = 0.30 + 0.72 * max(dot(N, L1), 0.0) + 0.28 * max(dot(N, L2), 0.0);

  // --- realistic: fibre striations, pale tendon ends, soft specular, cool rim ---
  float fib = 1.0 - uFiber * (0.10 - 0.10 * sin(vUv.y * 140.0 + sin(vUv.x * 9.0) * 2.0));
  vec3 real = uBase * dif * fib;
  real = mix(real, vec3(0.88, 0.80, 0.66) * dif, vTend * 0.85 * uFiber);
  vec3 H = normalize(L1 + V);
  real += pow(max(dot(N, H), 0.0), 36.0) * 0.20 * (0.4 + 0.6 * uFiber);
  real += vec3(0.20, 0.5, 0.8) * fres * 0.22;
  real = mix(real, vec3(0.10, 0.85, 1.0) * (0.55 + 0.45 * dif) + fres * vec3(0.3, 0.8, 1.0), uSel * 0.78);
  real *= mix(1.0, 0.55, uDim);

  // --- hologram: cyan fresnel glow, scan lines, sweep band, contour grid ("controlled wireframe") ---
  vec2 g = vUv * vec2(26.0, 20.0); vec2 w = fwidth(g);
  vec2 gl = abs(fract(g - 0.5) - 0.5) / max(w, vec2(0.0001));
  float grid = 1.0 - min(min(gl.x, gl.y), 1.0);
  float scan = 0.5 + 0.5 * sin(vY * 170.0 - uTime * 3.0);
  float sweep = smoothstep(0.985, 1.0, sin(vY * 2.3 - uTime * 0.9));
  vec3 hc = vec3(0.20, 0.82, 1.0);
  vec3 holo = hc * (0.16 + 0.5 * dif) + hc * fres * 1.1 + vec3(0.1, 0.35, 0.5) * scan * 0.15 + vec3(0.7, 0.95, 1.0) * sweep * 0.6 + hc * grid * 0.5 * uFiber;
  holo += uSel * vec3(0.5, 0.95, 1.0) * 0.7; holo *= mix(1.0, 0.5, uDim);
  float ah = 0.09 + 0.55 * fres + 0.10 * scan + 0.5 * sweep + 0.30 * grid * uFiber + 0.5 * uSel;
  ah = clamp(ah, 0.0, 0.92) * mix(1.0, 0.4, uDim) * uAlpha;

  gl_FragColor = vec4(mix(real, holo, uHolo), mix(1.0, ah, uHolo));
}`
const PVERT = /* glsl */ `
attribute float seed; uniform float uTime, uPx, uHolo; varying float vA;
void main(){
  float k = fract(uTime * 0.12 + seed);
  vec3 p = position + vec3(0.0, k * 0.14, 0.0) + normal * k * 0.03;
  vA = (1.0 - k) * sin(3.14159 * min(1.0, k * 4.0)) * uHolo;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = (2.2 + seed * 1.6) * uPx; gl_Position = projectionMatrix * mv;
}`
const PFRAG = /* glsl */ `precision mediump float; varying float vA; void main(){ vec2 c = gl_PointCoord - 0.5; float d = smoothstep(0.5, 0.0, length(c)); gl_FragColor = vec4(0.4, 0.9, 1.0, d * vA * 0.9); }`

const isMobile = () => /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) || window.matchMedia('(pointer: coarse)').matches
const DEFAULT_DIST = 3.7

export default function BodyScene({ mode, selected, peel, onSelect, command, onError }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const S = useRef<{ apply: (p: { mode: 'real' | 'holo'; selected: string | null; peel: boolean }) => void; run: (c: SceneCommand) => void } | null>(null)
  const sel = useRef(onSelect); sel.current = onSelect
  const last = useRef<number>(-1)

  useEffect(() => {
    const el = host.current; if (!el) return
    let renderer: THREE.WebGLRenderer
    const mobile = isMobile(), dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2)
    try { renderer = new THREE.WebGLRenderer({ antialias: dpr <= 1.5, alpha: true, powerPreference: 'high-performance' }) } catch (e) { onError('3D graphics (WebGL) are not available on this device or browser.'); return }
    renderer.setPixelRatio(dpr); renderer.setSize(el.clientWidth, el.clientHeight); renderer.setClearColor(0x000000, 0)
    el.appendChild(renderer.domElement); renderer.domElement.style.touchAction = 'none'; renderer.domElement.style.display = 'block'
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(30, el.clientWidth / Math.max(1, el.clientHeight), 0.1, 50)
    const home = new THREE.Vector3(0, FIGURE_CENTER_Y, 0)
    camera.position.set(0, FIGURE_CENTER_Y, DEFAULT_DIST)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.copy(home); controls.enableDamping = true; controls.dampingFactor = 0.09; controls.rotateSpeed = 0.9; controls.zoomSpeed = 0.8
    controls.minDistance = 0.9; controls.maxDistance = 6; controls.screenSpacePanning = true; controls.minPolarAngle = 0.25; controls.maxPolarAngle = Math.PI - 0.25
    controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }; controls.update()

    // ---- Build meshes ----
    const geos = buildAnatomy(); const shared = { uTime: { value: 0 }, uHolo: { value: 0 } }
    const meshes = new Map<string, THREE.Mesh>(); const mats: THREE.ShaderMaterial[] = []; const centers = new Map<string, THREE.Vector3>()
    const rig = new THREE.Group(); scene.add(rig)
    GROUP_DEFS.forEach((def, i) => {
      const g = geos.get(def.id)!; const hue = ((i * 37) % 11) / 90
      const m = new THREE.ShaderMaterial({
        vertexShader: VERT, fragmentShader: FRAG, transparent: false, depthWrite: true, side: THREE.FrontSide,
        uniforms: { ...shared, uSel: { value: 0 }, uDim: { value: 0 }, uFiber: { value: def.id === 'base' ? 0 : 1 }, uAlpha: { value: def.id === 'base' ? 0.55 : 1 }, uBase: { value: def.id === 'base' ? new THREE.Color(0.2, 0.25, 0.31) : new THREE.Color(0.66 + hue, 0.24 + hue * 0.3, 0.22) } }
      })
      mats.push(m); const mesh = new THREE.Mesh(g, m); mesh.userData.id = def.id; mesh.renderOrder = def.id === 'base' ? 0 : 1; mesh.frustumCulled = false
      rig.add(mesh); meshes.set(def.id, mesh)
      const c = new THREE.Vector3(); g.boundingBox!.getCenter(c); c.x = 0; centers.set(def.id, c)
    })
    // Floor rings
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x35d6ff, transparent: true, opacity: 0.28, depthWrite: false })
    const r1 = new THREE.Mesh(new THREE.RingGeometry(0.46, 0.475, 64), ringMat), r2 = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.628, 64), ringMat)
    ;[r1, r2].forEach(r => { r.rotation.x = -Math.PI / 2; r.position.y = 0.004; scene.add(r) })
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.6, 48), new THREE.MeshBasicMaterial({ color: 0x0a1626, transparent: true, opacity: 0.55, depthWrite: false }))
    disc.rotation.x = -Math.PI / 2; disc.position.y = 0.002; scene.add(disc)

    // Particles: random points on the body surface drifting upward (hologram only)
    const all = geos.get('base')!.getAttribute('position') as THREE.BufferAttribute, nrm = geos.get('base')!.getAttribute('normal') as THREE.BufferAttribute
    const N = mobile ? 260 : 520, pp = new Float32Array(N * 3), pn = new Float32Array(N * 3), ps = new Float32Array(N)
    for (let i = 0; i < N; i++) { const k = Math.floor(Math.random() * all.count); pp.set([all.getX(k), all.getY(k), all.getZ(k)], i * 3); pn.set([nrm.getX(k), nrm.getY(k), nrm.getZ(k)], i * 3); ps[i] = Math.random() }
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pp, 3)); pg.setAttribute('normal', new THREE.BufferAttribute(pn, 3)); pg.setAttribute('seed', new THREE.BufferAttribute(ps, 1))
    const pm = new THREE.ShaderMaterial({ vertexShader: PVERT, fragmentShader: PFRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime: shared.uTime, uHolo: shared.uHolo, uPx: { value: dpr } } })
    const points = new THREE.Points(pg, pm); points.frustumCulled = false; scene.add(points)

    // ---- State driven by React props ----
    let target = { mode: 'real' as 'real' | 'holo', selected: null as string | null, peel: false }
    let holoGoal = 0, needs = true
    const defs = new Map(GROUP_DEFS.map(d => [d.id, d]))
    const applyVisibility = () => {
      const holo = shared.uHolo.value > 0.5; const hidden = new Set<string>()
      const selDef = target.selected ? defs.get(target.selected) : undefined
      const showDeep = target.peel || holo
      meshes.forEach((m, id) => { const d = defs.get(id)!; m.visible = d.deep ? showDeep : true })
      if (target.peel || (selDef?.deep && !holo)) { meshes.forEach((m, id) => { const d = defs.get(id)!; if (d.deep) m.visible = true }); defs.forEach(d => { if (d.deep && d.covers) d.covers.forEach(c => hidden.add(c)) }) }
      // Selecting a deep muscle automatically peels the layer above it in realistic mode.
      if (selDef?.deep && !holo) { const m = meshes.get(selDef.id); if (m) m.visible = true; selDef.covers?.forEach(c => hidden.add(c)) }
      hidden.forEach(id => { const m = meshes.get(id); if (m) m.visible = false })
    }
    const applySelection = () => { meshes.forEach((m, id) => { const mat = m.material as THREE.ShaderMaterial; const on = target.selected === id; mat.uniforms.uSel.value = on ? 1 : 0; mat.uniforms.uDim.value = target.selected && !on && id !== 'base' ? 1 : target.selected && id === 'base' ? 0.4 : 0 }) }
    let wasHolo = false
    const setTransparency = () => {
      const t = shared.uHolo.value > 0.003
      mats.forEach(m => { m.transparent = t; m.depthWrite = !t || shared.uHolo.value < 0.35 && false })
      ringMat.opacity = 0.28 + 0.4 * shared.uHolo.value
    }
    S.current = {
      apply: p => { target = p; holoGoal = p.mode === 'holo' ? 1 : 0; applySelection(); applyVisibility(); needs = true },
      run: c => {
        needs = true
        if (c.type === 'reset') { tween(new THREE.Vector3(0, FIGURE_CENTER_Y, DEFAULT_DIST), home.clone()); return }
        const dist = camera.position.distanceTo(controls.target)
        if (c.type === 'view') { const v = { front: [0, 1], back: [0, -1], side: [1, 0] }[c.view]; tween(new THREE.Vector3(v[0] * dist, controls.target.y, v[1] * dist).add(new THREE.Vector3(0, 0, 0)), controls.target.clone()); return }
        if (c.type === 'focus') {
          const ctr = centers.get(c.id); if (!ctr) return; const m = muscleById(c.id)
          const t = new THREE.Vector3(0, ctr.y, 0); const d = Math.min(dist, 2.4)
          let dirZ = Math.sign(camera.position.z) || 1
          if (c.rotate && m) { if (m.side === 'back') dirZ = -1; else if (m.side === 'front') dirZ = 1 }
          const toRotate = c.rotate && m && m.side !== 'both' && Math.sign(camera.position.z || 1) !== dirZ
          const pos = toRotate || Math.abs(camera.position.x) < 0.3 ? new THREE.Vector3(0, ctr.y, dirZ * d) : camera.position.clone().sub(controls.target).setLength(d).add(t)
          tween(pos, t)
        }
      }
    }
    // Camera tween (ease in-out)
    let anim: null | { t0: number; dur: number; p0: THREE.Vector3; p1: THREE.Vector3; q0: THREE.Vector3; q1: THREE.Vector3 } = null
    function tween(p1: THREE.Vector3, q1: THREE.Vector3) { anim = { t0: performance.now(), dur: 450, p0: camera.position.clone(), p1, q0: controls.target.clone(), q1 } }

    // ---- Picking: tap/click without dragging selects the nearest muscle ----
    const ray = new THREE.Raycaster(), ptr = new THREE.Vector2(); let down: { x: number; y: number; t: number } | null = null
    const onDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY, t: performance.now() } }
    const onUp = (e: PointerEvent) => {
      if (!down) return; const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), dt = performance.now() - down.t; down = null
      if (moved > 7 || dt > 500) return
      const r = renderer.domElement.getBoundingClientRect(); ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ptr, camera)
      const vis = [...meshes.values()].filter(m => m.visible); const hit = ray.intersectObjects(vis, false)[0]
      const id = hit?.object.userData.id as string | undefined
      sel.current(id && defs.get(id)?.selectable ? id : null)
    }
    renderer.domElement.addEventListener('pointerdown', onDown); renderer.domElement.addEventListener('pointerup', onUp)
    controls.addEventListener('change', () => { needs = true })

    // ---- Render loop (draws only when something changed, except while the hologram animates) ----
    let raf = 0, lastT = 0, running = true; const clock = performance.now()
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop); if (!running) return
      const holoActive = shared.uHolo.value > 0.003 || holoGoal > 0
      if (!needs && !anim && !holoActive) { if (controls.update()) needs = true; else return }
      if (mobile && holoActive && now - lastT < 28) return // ~35 fps cap for the animated hologram on phones
      lastT = now; shared.uTime.value = (now - clock) / 1000
      if (anim) { const k = Math.min(1, (now - anim.t0) / anim.dur), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; camera.position.lerpVectors(anim.p0, anim.p1, e); controls.target.lerpVectors(anim.q0, anim.q1, e); if (k >= 1) anim = null }
      const h = shared.uHolo.value; if (h !== holoGoal) { const nh = h + Math.sign(holoGoal - h) * Math.min(Math.abs(holoGoal - h), 0.045); shared.uHolo.value = nh; setTransparency() }
      const isH = shared.uHolo.value > 0.5; if (isH !== wasHolo) { wasHolo = isH; applyVisibility() }
      controls.update(); renderer.render(scene, camera); needs = false
    }
    raf = requestAnimationFrame(loop)
    const resize = () => { const w = el.clientWidth, h = Math.max(1, el.clientHeight); camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h); needs = true }
    const ro = new ResizeObserver(resize); ro.observe(el)
    const vis = () => { running = document.visibilityState === 'visible'; needs = true }
    document.addEventListener('visibilitychange', vis)
    const lost = (e: Event) => { e.preventDefault(); onError('The 3D view was interrupted by the device. Reload the page to restore it.') }
    renderer.domElement.addEventListener('webglcontextlost', lost)
    S.current.apply({ mode: 'real', selected: null, peel: false })

    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); document.removeEventListener('visibilitychange', vis)
      renderer.domElement.removeEventListener('pointerdown', onDown); renderer.domElement.removeEventListener('pointerup', onUp); renderer.domElement.removeEventListener('webglcontextlost', lost)
      controls.dispose(); geos.forEach(g => g.dispose()); mats.forEach(m => m.dispose()); pg.dispose(); pm.dispose(); ringMat.dispose(); r1.geometry.dispose(); r2.geometry.dispose(); disc.geometry.dispose(); (disc.material as THREE.Material).dispose()
      renderer.dispose(); renderer.domElement.remove(); S.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { S.current?.apply({ mode, selected, peel }) }, [mode, selected, peel])
  useEffect(() => { if (command && command.n !== last.current) { last.current = command.n; S.current?.run(command) } }, [command])
  return <div ref={host} className="scene-host" />
}
