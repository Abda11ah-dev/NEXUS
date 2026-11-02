// Procedural anatomical body (adult male, ~1.8 m tall, A-pose).
//
// HONEST NOTE: this is a hand-built procedural model, not a scanned or licensed medical asset.
// Muscles are lofted/wrapped surfaces placed at anatomically plausible positions and sizes so the
// selected muscle always appears where the real muscle sits. For higher fidelity, replace this file's
// output with a licensed GLB (see README "3D body" section).
//
// Coordinates: +y up, +z toward the front of the body, +x is the body's LEFT (viewer's right from the front).
// Every "right side" part is defined once and mirrored to the other side.
import * as THREE from 'three'

type V3 = [number, number, number]
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

interface Part { pos: number[]; uv: number[]; tend: number[]; idx: number[]; seams: [number, number][] }

/** Collects many surface pieces into ONE geometry per muscle group (fewer draw calls = faster on phones). */
class Builder {
  pos: number[] = []; uv: number[] = []; tend: number[] = []; idx: number[] = []; seams: [number, number][] = []
  add(p: Part, mirror: boolean) {
    const base = this.pos.length / 3
    for (let i = 0; i < p.pos.length; i += 3) this.pos.push(mirror ? -p.pos[i] : p.pos[i], p.pos[i + 1], p.pos[i + 2])
    this.uv.push(...p.uv); this.tend.push(...p.tend)
    for (let i = 0; i < p.idx.length; i += 3) mirror ? this.idx.push(base + p.idx[i], base + p.idx[i + 2], base + p.idx[i + 1]) : this.idx.push(base + p.idx[i], base + p.idx[i + 1], base + p.idx[i + 2])
    for (const [a, b] of p.seams) this.seams.push([base + a, base + b])
  }
  geometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2))
    g.setAttribute('tend', new THREE.Float32BufferAttribute(this.tend, 1))
    g.setIndex(this.idx); g.computeVertexNormals()
    // Average the normals where a closed ring meets itself so there is no visible seam line.
    const n = g.getAttribute('normal') as THREE.BufferAttribute
    for (const [a, b] of this.seams) {
      const x = n.getX(a) + n.getX(b), y = n.getY(a) + n.getY(b), z = n.getZ(a) + n.getZ(b), l = Math.hypot(x, y, z) || 1
      n.setXYZ(a, x / l, y / l, z / l); n.setXYZ(b, x / l, y / l, z / l)
    }
    g.computeBoundingBox(); g.computeBoundingSphere()
    return g
  }
}

const arr = (a: number[], t: number) => { const f = clamp(t, 0, 1) * (a.length - 1), i = Math.min(a.length - 2, Math.floor(f)); return lerp(a[i], a[i + 1], f - i) }

/** A muscle/limb built by sweeping an ellipse along a smooth path (width w, depth d at each path point). */
let CUR_K = 1
function loft(path: V3[], w0: number[], d0: number[], o: { rings?: number; seg?: number; taper?: number; tendon?: number; k?: number } = {}): Part {
  const kk = (o.k ?? 1) * CUR_K, w = w0.map(v => v * kk), d = d0.map(v => v * kk)
  const rings = o.rings ?? 14, seg = o.seg ?? 12, taper = o.taper ?? 0.45, tendon = o.tendon ?? 0.14
  const curve = new THREE.CatmullRomCurve3(path.map(p => new THREE.Vector3(...p)), false, 'centripetal')
  const part: Part = { pos: [], uv: [], tend: [], idx: [], seams: [] }
  const Z = new THREE.Vector3(0, 0, 1), Y = new THREE.Vector3(0, 1, 0)
  for (let i = 0; i <= rings; i++) {
    const t = i / rings, p = curve.getPoint(t), T = curve.getTangent(t).normalize()
    let n1 = new THREE.Vector3().crossVectors(T, Z); if (n1.lengthSq() < 1e-4) n1 = new THREE.Vector3().crossVectors(T, Y)
    n1.normalize(); const n2 = new THREE.Vector3().crossVectors(n1, T).normalize()
    const f = taper > 0 ? Math.max(0.02, Math.pow(Math.sin(Math.PI * clamp(t, 0, 1)), taper)) : (i === 0 || i === rings ? 0.3 : 1)
    const wi = arr(w, t) * f, di = arr(d, t) * f
    const tm = tendon >= 1 ? 1 : clamp(1 - Math.min(t, 1 - t) / Math.max(tendon, 1e-3), 0, 1)
    for (let j = 0; j <= seg; j++) {
      const a = (j / seg) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a)
      part.pos.push(p.x + n1.x * wi * c + n2.x * di * s, p.y + n1.y * wi * c + n2.y * di * s, p.z + n1.z * wi * c + n2.z * di * s)
      part.uv.push(t, j / seg); part.tend.push(tm)
    }
    part.seams.push([i * (seg + 1), i * (seg + 1) + seg])
  }
  for (let i = 0; i < rings; i++) for (let j = 0; j < seg; j++) {
    const a = i * (seg + 1) + j, b = a + 1, c = a + seg + 1, e = c + 1
    part.idx.push(a, c, b, b, c, e)
  }
  return part
}

// ---------- Torso: an elliptical shell whose size changes with height ----------
// Rows: [height y, half-width a, half-depth FRONT, half-depth BACK]
const TORSO: number[][] = [
  [0.78, 0.10, 0.06, 0.07], [0.86, 0.155, 0.09, 0.105], [0.93, 0.170, 0.095, 0.115], [1.00, 0.163, 0.09, 0.105], [1.08, 0.148, 0.088, 0.088],
  [1.16, 0.155, 0.098, 0.094], [1.24, 0.172, 0.108, 0.098], [1.32, 0.182, 0.115, 0.102], [1.40, 0.185, 0.108, 0.100], [1.46, 0.160, 0.085, 0.085],
  [1.50, 0.075, 0.07, 0.07], [1.54, 0.058, 0.062, 0.062]
]
function tor(y: number): { a: number; bf: number; bb: number } {
  const t = TORSO, yy = clamp(y, t[0][0], t[t.length - 1][0]); let i = 0
  while (i < t.length - 2 && yy > t[i + 1][0]) i++
  const p0 = t[Math.max(0, i - 1)], p1 = t[i], p2 = t[i + 1], p3 = t[Math.min(t.length - 1, i + 2)]
  const u = (yy - p1[0]) / (p2[0] - p1[0]), u2 = u * u, u3 = u2 * u
  const h = (k: number) => 0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * u + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * u2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * u3)
  return { a: h(1), bf: h(2), bb: h(3) }
}
/** Point on the torso surface at height y and angle th (0 = +x side, +PI/2 = front, -PI/2 = back), pushed outward by `off`. */
function torsoPoint(y: number, th: number, off: number): V3 {
  const { a, bf, bb } = tor(y), c = Math.cos(th), s = Math.sin(th), b = s >= 0 ? bf : bb
  const x = a * c, z = b * s
  const nx = x / (a * a), nz = z / (b * b), l = Math.hypot(nx, nz) || 1
  return [x + (nx / l) * off, y, z + (nz / l) * off]
}
/** Angle for a given x on the front (side='f') or back ('b') of the torso at height y. */
const tx = (y: number, x: number, side: 'f' | 'b'): number => { const th = Math.acos(clamp(x / tor(y).a, -0.999, 0.999)); return side === 'f' ? th : -th }

interface Row { y: number; t0: number; t1: number; th: number }
/** A flat muscle sheet wrapped onto the torso. `rowFn(t)` describes each row: height, angle range and thickness. */
function patch(rowFn: (t: number) => Row, o: { rows?: number; cols?: number; closed?: boolean } = {}): Part {
  const R = o.rows ?? 28, C = o.cols ?? 14
  const part: Part = { pos: [], uv: [], tend: [], idx: [], seams: [] }
  for (let i = 0; i <= R; i++) {
    const t = i / R, r = rowFn(t)
    let t0 = r.t0, t1 = r.t1; if (t0 > t1) [t0, t1] = [t1, t0]
    for (let j = 0; j <= C; j++) {
      const s = j / C, th = lerp(t0, t1, s), prof = o.closed ? 0 : Math.pow(Math.sin(Math.PI * s), 0.55)
      part.pos.push(...torsoPoint(r.y, th, r.th * prof)); part.uv.push(t, s); part.tend.push(0)
    }
    if (o.closed) part.seams.push([i * (C + 1), i * (C + 1) + C])
  }
  for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) { const a = i * (C + 1) + j, b = a + 1, c = a + C + 1, e = c + 1; part.idx.push(a, c, b, b, c, e) }
  return part
}
/** Build rowFn from anchor rows [y, lateral/first angle, medial/second angle, thickness], interpolated linearly. */
const anchors = (a: number[][]) => (t: number): Row => {
  const f = clamp(t, 0, 1) * (a.length - 1), i = Math.min(a.length - 2, Math.floor(f)), u = f - i
  const p = a[i], q = a[i + 1]
  return { y: lerp(p[0], q[0], u), t0: lerp(p[1], q[1], u), t1: lerp(p[2], q[2], u), th: lerp(p[3], q[3], u) }
}

export interface GroupDef { id: string; selectable: boolean; deep?: boolean; covers?: string[] }
export const GROUP_DEFS: GroupDef[] = [
  { id: 'base', selectable: false }, { id: 'pectoralis', selectable: true }, { id: 'deltoids', selectable: true }, { id: 'biceps', selectable: true },
  { id: 'triceps', selectable: true }, { id: 'forearms', selectable: true }, { id: 'trapezius', selectable: true }, { id: 'lats', selectable: true },
  { id: 'rhomboids', selectable: true, deep: true, covers: ['trapezius'] }, { id: 'rotator', selectable: true }, { id: 'abs', selectable: true },
  { id: 'obliques', selectable: true }, { id: 'internalObliques', selectable: true, deep: true, covers: ['obliques'] }, { id: 'erectors', selectable: true },
  { id: 'glutes', selectable: true }, { id: 'quadriceps', selectable: true }, { id: 'hamstrings', selectable: true }, { id: 'adductors', selectable: true },
  { id: 'gastrocnemius', selectable: true }, { id: 'soleus', selectable: true, deep: true, covers: ['gastrocnemius'] }, { id: 'tibialis', selectable: true }
]

export function buildAnatomy(): Map<string, THREE.BufferGeometry> {
  const B = new Map<string, Builder>(); GROUP_DEFS.forEach(g => B.set(g.id, new Builder()))
  const GROUP_K: Record<string, number> = { deltoids: 1.15, biceps: 1.2, triceps: 1.2, forearms: 1.18, quadriceps: 1.15, hamstrings: 1.15, adductors: 1.1, gastrocnemius: 1.25, soleus: 1.2, tibialis: 1.2 }
  const put = (id: string, make: Part | (() => Part), mirror = true) => { CUR_K = GROUP_K[id] ?? 1; const p = typeof make === 'function' ? make() : make; CUR_K = 1; const b = B.get(id)!; b.add(p, false); if (mirror) b.add(p, true) }
  const mid = (id: string, p: Part) => B.get(id)!.add(p, false)

  // --- Base shell (the "underlying mass": torso, neck, head, limbs, hands, feet) ---
  mid('base', patch(t => ({ y: lerp(0.78, 1.54, t), t0: -Math.PI, t1: Math.PI, th: 0 }), { rows: 34, cols: 32, closed: true }))
  mid('base', loft([[0, 1.50, 0], [0, 1.58, 0.008], [0, 1.64, 0.012]], [0.052, 0.05, 0.048], [0.058, 0.056, 0.054], { taper: 0, rings: 5, k: 1.15 }))
  mid('base', loft([[0, 1.60, 0], [0, 1.66, 0.012], [0, 1.72, 0.014], [0, 1.77, 0.008], [0, 1.80, 0]], [0.058, 0.082, 0.088, 0.076, 0.02], [0.07, 0.1, 0.106, 0.09, 0.02], { taper: 0.3, rings: 14, seg: 16, k: 1.1 }))
  put('base', () => loft([[0.215, 1.43, 0], [0.2425, 1.287, 0], [0.268, 1.145, 0]], [0.042, 0.038, 0.031], [0.042, 0.038, 0.031], { taper: 0.1, rings: 8, k: 1.15 }))
  put('base', () => loft([[0.268, 1.145, 0], [0.28, 1.09, 0], [0.30, 1.0, 0], [0.322, 0.90, 0]], [0.03, 0.034, 0.025, 0.016], [0.03, 0.032, 0.025, 0.014], { taper: 0.1, rings: 8, k: 1.15 }))
  put('base', () => loft([[0.322, 0.905, 0], [0.328, 0.85, 0], [0.334, 0.79, 0]], [0.021, 0.025, 0.011], [0.011, 0.014, 0.008], { taper: 0.35, rings: 6, k: 1.3 }))
  put('base', () => loft([[0.095, 0.93, 0], [0.095, 0.80, 0], [0.097, 0.65, 0], [0.098, 0.50, 0.01]], [0.078, 0.074, 0.06, 0.046], [0.08, 0.076, 0.062, 0.048], { taper: 0.05, rings: 10, k: 1.06 }))
  put('base', () => loft([[0.098, 0.50, 0.01], [0.099, 0.40, 0], [0.10, 0.28, -0.005], [0.10, 0.16, -0.008], [0.10, 0.085, -0.01]], [0.042, 0.046, 0.037, 0.026, 0.023], [0.044, 0.048, 0.037, 0.026, 0.024], { taper: 0.05, rings: 10, k: 1.18 }))
  put('base', () => loft([[0.10, 0.075, -0.045], [0.10, 0.05, 0.02], [0.10, 0.032, 0.12], [0.098, 0.02, 0.20]], [0.028, 0.038, 0.038, 0.018], [0.035, 0.04, 0.025, 0.012], { taper: 0.3, rings: 8, k: 1.15 }))
  put('base', () => loft([[0.098, 0.525, 0.05], [0.098, 0.475, 0.05]], [0.024, 0.024], [0.012, 0.012], { taper: 0.5, rings: 3 }))
  put('base', () => loft([[0.012, 1.456, 0.075], [0.09, 1.472, 0.07], [0.185, 1.468, 0.03]], [0.008, 0.009, 0.008], [0.009, 0.01, 0.008], { taper: 0.4, rings: 8, seg: 8 }))
  put('base', () => loft([[0.05, 1.605, -0.015], [0.03, 1.555, 0.03], [0.012, 1.50, 0.062]], [0.012, 0.012, 0.01], [0.012, 0.012, 0.01], { taper: 0.4, rings: 6, seg: 8 }))

  // --- Chest ---
  put('pectoralis', patch(t => { const r = anchors([[1.245, 1.0, 0, 0.004], [1.275, 0.62, 0, 0.016], [1.31, 0.42, 0, 0.022], [1.345, 0.30, 0, 0.02], [1.375, 0.20, 0, 0.014], [1.405, 0.12, 0, 0.006]])(t)
    const medX = [0.06, 0.015, 0.012, 0.013, 0.05, 0.10]; const f = clamp(t, 0, 1) * 5, i = Math.min(4, Math.floor(f)); const x = lerp(medX[i], medX[i + 1], f - i)
    return { ...r, t1: tx(r.y, x, 'f') } }, { rows: 30, cols: 16 }))
  // --- Abdomen ---
  put('abs', patch(t => { const y = lerp(0.95, 1.262, t); const g = [1.085, 1.14, 1.195].reduce((s, yi) => s + Math.exp(-(((y - yi) / 0.0065) ** 2)), 0)
    const env = y < 1.0 ? lerp(0.004, 0.016, (y - 0.95) / 0.05) : y > 1.25 ? lerp(0.016, 0.004, (y - 1.25) / 0.012) : 0.016
    return { y, t0: tx(y, 0.066, 'f'), t1: tx(y, 0.008, 'f'), th: env * (1 - 0.65 * Math.min(1, g)) } }, { rows: 70, cols: 8 }))
  const oblq = (th: number) => (t: number): Row => { const r = anchors([[1.0, 0.5, 0, th * 0.4], [1.06, 0.15, 0, th * 0.85], [1.14, -0.05, 0, th], [1.22, 0.0, 0, th * 0.85], [1.27, 0.35, 0, th * 0.4]])(t); return { ...r, t1: tx(r.y, 0.072, 'f') } }
  put('obliques', patch(oblq(0.014), { rows: 24, cols: 12 }))
  put('internalObliques', patch(t => { const r = oblq(0.008)(t); return { ...r, y: lerp(r.y, 1.13, 0.0) } }, { rows: 18, cols: 10 }))
  // --- Back ---
  put('lats', patch(t => { const r = anchors([[1.01, -0.75, 0, 0.004], [1.07, -0.35, 0, 0.01], [1.14, -0.12, 0, 0.013], [1.22, 0.02, 0, 0.013], [1.30, 0.04, 0, 0.012], [1.36, -0.02, 0, 0.01], [1.40, -0.12, 0, 0.004]])(t)
    const mx = [0.085, 0.075, 0.07, 0.075, 0.085, 0.115, 0.15]; const f = clamp(t, 0, 1) * 6, i = Math.min(5, Math.floor(f)); return { ...r, t0: tx(r.y, lerp(mx[i], mx[i + 1], f - i), 'b') } }, { rows: 28, cols: 14 }))
  put('trapezius', patch(t => { const r = anchors([[1.17, 0, 0, 0.004], [1.23, 0, 0, 0.012], [1.30, 0, 0, 0.016], [1.37, 0, 0, 0.016], [1.43, 0, 0, 0.014], [1.47, 0, 0, 0.012], [1.50, 0, 0, 0.008]])(t)
    const lx = [0.03, 0.055, 0.085, 0.15, 0.168, 0.14, 0.05]; const f = clamp(t, 0, 1) * 6, i = Math.min(5, Math.floor(f)); return { ...r, t0: tx(r.y, 0.01, 'b'), t1: tx(r.y, lerp(lx[i], lx[i + 1], f - i), 'b') } }, { rows: 30, cols: 14 }))
  put('trapezius', () => loft([[0.025, 1.585, -0.045], [0.07, 1.53, -0.045], [0.15, 1.468, -0.035]], [0.012, 0.02, 0.012], [0.012, 0.016, 0.012], { rings: 8, seg: 8, taper: 0.4 }))
  put('rhomboids', patch(t => { const r = anchors([[1.32, 0, 0, 0.003], [1.36, 0, 0, 0.008], [1.41, 0, 0, 0.008], [1.45, 0, 0, 0.003]])(t)
    const lx = [0.04, 0.075, 0.08, 0.05]; const f = clamp(t, 0, 1) * 3, i = Math.min(2, Math.floor(f)); return { ...r, t0: tx(r.y, 0.015, 'b'), t1: tx(r.y, lerp(lx[i], lx[i + 1], f - i), 'b') } }, { rows: 12, cols: 8 }))
  put('rotator', patch(t => { const r = anchors([[1.33, 0, 0, 0.004], [1.37, 0, 0, 0.013], [1.41, 0, 0, 0.012], [1.44, 0, 0, 0.004]])(t)
    return { ...r, t0: tx(r.y, 0.12, 'b'), t1: tx(r.y, 0.168, 'b') } }, { rows: 10, cols: 8 }))
  put('erectors', patch(t => { const r = anchors([[0.95, 0, 0, 0.006], [0.99, 0, 0, 0.016], [1.08, 0, 0, 0.02], [1.16, 0, 0, 0.02], [1.20, 0, 0, 0.006]])(t)
    return { ...r, t0: tx(r.y, 0.012, 'b'), t1: tx(r.y, 0.068, 'b') } }, { rows: 20, cols: 8 }))
  // --- Glutes (max + medius) ---
  put('glutes', patch(t => { const r = anchors([[0.835, 0, 0, 0.006], [0.87, 0, 0, 0.026], [0.92, 0, 0, 0.034], [0.97, 0, 0, 0.026], [1.01, 0, 0, 0.012]])(t)
    const lx = [0.12, 0.15, 0.163, 0.16, 0.13]; const f = clamp(t, 0, 1) * 4, i = Math.min(3, Math.floor(f)); return { ...r, t0: tx(r.y, 0.008, 'b'), t1: tx(r.y, lerp(lx[i], lx[i + 1], f - i), 'b') } }, { rows: 20, cols: 12 }))
  put('glutes', patch(t => { const r = anchors([[1.0, -0.55, 0.25, 0.003], [1.03, -0.5, 0.2, 0.014], [1.08, -0.35, 0.1, 0.008]])(t); return r }, { rows: 8, cols: 10 }))

  // --- Arm ---
  put('deltoids', () => loft([[0.185, 1.462, 0.035], [0.215, 1.43, 0.055], [0.245, 1.345, 0.04]], [0.015, 0.022, 0.016], [0.022, 0.03, 0.02], { rings: 10, tendon: 0.2 }))
  put('deltoids', () => loft([[0.19, 1.468, 0], [0.25, 1.43, 0], [0.262, 1.34, 0]], [0.016, 0.024, 0.018], [0.03, 0.04, 0.026], { rings: 10, tendon: 0.2 }))
  put('deltoids', () => loft([[0.185, 1.462, -0.035], [0.215, 1.43, -0.055], [0.245, 1.345, -0.04]], [0.015, 0.022, 0.016], [0.022, 0.03, 0.02], { rings: 10, tendon: 0.2 }))
  put('biceps', () => loft([[0.205, 1.385, 0.035], [0.232, 1.29, 0.045], [0.262, 1.18, 0.032]], [0.02, 0.033, 0.02], [0.02, 0.03, 0.018], { rings: 12, tendon: 0.22 }))
  put('triceps', () => loft([[0.208, 1.385, -0.035], [0.238, 1.285, -0.04], [0.262, 1.18, -0.03]], [0.025, 0.036, 0.022], [0.02, 0.03, 0.018], { rings: 12, tendon: 0.22 }))
  put('forearms', () => loft([[0.272, 1.14, 0.02], [0.288, 1.07, 0.025], [0.318, 0.93, 0.012]], [0.025, 0.032, 0.012], [0.02, 0.026, 0.01], { rings: 12, tendon: 0.3 }))
  put('forearms', () => loft([[0.275, 1.14, -0.018], [0.292, 1.07, -0.02], [0.322, 0.93, -0.01]], [0.025, 0.032, 0.012], [0.02, 0.026, 0.01], { rings: 12, tendon: 0.3 }))
  // --- Leg ---
  put('quadriceps', () => loft([[0.098, 0.88, 0.075], [0.10, 0.74, 0.082], [0.10, 0.58, 0.068], [0.10, 0.51, 0.05]], [0.022, 0.03, 0.026, 0.012], [0.014, 0.022, 0.018, 0.01], { rings: 14, tendon: 0.22 }))
  put('quadriceps', () => loft([[0.15, 0.86, 0.01], [0.152, 0.72, 0.02], [0.14, 0.58, 0.03], [0.125, 0.52, 0.03]], [0.025, 0.04, 0.032, 0.015], [0.035, 0.045, 0.034, 0.016], { rings: 14, tendon: 0.2 }))
  put('quadriceps', () => loft([[0.05, 0.76, 0.05], [0.045, 0.65, 0.05], [0.058, 0.56, 0.04], [0.07, 0.51, 0.035]], [0.015, 0.026, 0.026, 0.014], [0.02, 0.03, 0.028, 0.014], { rings: 12, tendon: 0.16 }))
  put('hamstrings', () => loft([[0.125, 0.88, -0.06], [0.128, 0.72, -0.062], [0.118, 0.58, -0.05], [0.112, 0.50, -0.035]], [0.022, 0.032, 0.026, 0.012], [0.02, 0.03, 0.026, 0.012], { rings: 14, tendon: 0.22 }))
  put('hamstrings', () => loft([[0.085, 0.88, -0.065], [0.08, 0.72, -0.066], [0.085, 0.58, -0.05], [0.09, 0.50, -0.035]], [0.022, 0.03, 0.022, 0.012], [0.02, 0.03, 0.024, 0.012], { rings: 14, tendon: 0.22 }))
  put('adductors', () => loft([[0.05, 0.88, 0.015], [0.045, 0.76, 0.02], [0.06, 0.62, 0], [0.075, 0.55, -0.005]], [0.016, 0.026, 0.02, 0.01], [0.03, 0.045, 0.035, 0.015], { rings: 12, tendon: 0.18 }))
  put('gastrocnemius', () => loft([[0.088, 0.50, -0.04], [0.09, 0.42, -0.058], [0.092, 0.33, -0.05], [0.097, 0.24, -0.03]], [0.022, 0.03, 0.022, 0.008], [0.02, 0.032, 0.022, 0.01], { rings: 12, tendon: 0.2 }))
  put('gastrocnemius', () => loft([[0.118, 0.50, -0.04], [0.118, 0.43, -0.055], [0.115, 0.34, -0.045], [0.105, 0.25, -0.03]], [0.02, 0.026, 0.02, 0.008], [0.02, 0.028, 0.02, 0.01], { rings: 12, tendon: 0.2 }))
  put('gastrocnemius', () => loft([[0.10, 0.26, -0.03], [0.10, 0.15, -0.022], [0.10, 0.09, -0.018]], [0.012, 0.009, 0.01], [0.01, 0.008, 0.012], { rings: 6, seg: 8, tendon: 1, taper: 0.1 }))
  put('soleus', () => loft([[0.105, 0.46, -0.03], [0.108, 0.36, -0.04], [0.104, 0.26, -0.035], [0.101, 0.18, -0.025]], [0.03, 0.04, 0.03, 0.014], [0.018, 0.026, 0.02, 0.012], { rings: 12, tendon: 0.2 }))
  put('tibialis', () => loft([[0.115, 0.46, 0.04], [0.108, 0.34, 0.045], [0.102, 0.22, 0.035], [0.099, 0.14, 0.02]], [0.012, 0.018, 0.012, 0.007], [0.012, 0.016, 0.012, 0.007], { rings: 12, tendon: 0.25 }))

  const out = new Map<string, THREE.BufferGeometry>(); B.forEach((b, id) => out.set(id, b.geometry())); return out
}
export const FIGURE_CENTER_Y = 0.92
