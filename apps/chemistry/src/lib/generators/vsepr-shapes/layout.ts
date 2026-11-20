// A VSEPR figure laid out on the page: the shape turned to the teacher's
// view and projected, as pieces drawn back to front (atoms, bonds, lone
// pairs), then the bond angle arcs, brackets and the lines under it. Pure
// numbers, so the Svelte component only draws them.

import { ELEMENTS } from '../lewis-structures/elements'
import { textWidth } from '../lewis-structures/drawing'
import { chargeText } from '../lewis-structures/formula'
import type { Structure } from '../lewis-structures/structure'
import type { Vec, VseprShape } from './shape'
import { angleLabels, labelLines, type VseprSettings } from './settings'

export const SYMBOL_FONT = 18
export const ANGLE_FONT = 15
export const LINE_FONT = 17
const LINE_H = 26
const DOT_GAP = 3.6

/** A bond that leaves the page by more than this (as the sine of its angle
 *  to the page) is a wedge or a dash. */
export const OUT_OF_PAGE = 0.42

export type Point = [number, number]

export type Piece =
  | { kind: 'atom'; z: number; x: number; y: number; r: number; element: string; central: boolean }
  | { kind: 'bond'; z: number; from: Point; to: Point; order: number; depth: 'plane' | 'wedge' | 'dash'; width: number }
  | { kind: 'lobe'; z: number; x: number; y: number; rx: number; ry: number; angle: number; dots: Point[] }
  | { kind: 'dots'; z: number; dots: Point[] }

export interface Arc {
  path: string
  label: string
  at: Point
}

export interface Layout {
  width: number
  height: number
  pieces: Piece[]
  arcs: Arc[]
  brackets?: { left: number; right: number; top: number; bottom: number; charge: string }
  lines: { text: string; y: number }[]
  key: string[]
  /** where the drawing's middle is, for turning it by dragging */
  center: Point
}

interface Look {
  bond: number
  /** drawn as textbooks do, with a bond that leaves the page kept nearly
   *  full length rather than foreshortened */
  schematic: boolean
  radius: (element: string, central: boolean) => number
  /** a little perspective, so farther atoms look smaller */
  perspective: number
}

const LOOKS: Record<VseprSettings['style'], Look> = {
  'wedge-and-dash': { bond: 82, schematic: true, radius: () => 17, perspective: 0 },
  'ball-and-stick': {
    bond: 96,
    schematic: false,
    radius: (el) => (el === 'H' ? 14 : ELEMENTS[el].period <= 2 ? 20 : 24),
    perspective: 1 / 600,
  },
}

const deg = Math.PI / 180

/** Turns a direction by the teacher's view: round the page's up-down axis
 *  (yaw), then tipped toward or away from the viewer (pitch). */
export function turn([x, y, z]: Vec, yaw: number, pitch: number): Vec {
  const a = yaw * deg
  const b = pitch * deg
  const x1 = x * Math.cos(a) + z * Math.sin(a)
  const z1 = -x * Math.sin(a) + z * Math.cos(a)
  return [x1, y * Math.cos(b) - z1 * Math.sin(b), y * Math.sin(b) + z1 * Math.cos(b)]
}

const scale = (v: Vec, k: number): Vec => [v[0] * k, v[1] * k, v[2] * k]
const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const norm = (v: Vec) => scale(v, 1 / Math.hypot(...v))
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]

/** Two unit vectors at right angles to `u` and each other. */
function across(u: Vec): [Vec, Vec] {
  const helper: Vec = Math.abs(u[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]
  const p = norm(cross(u, helper))
  return [p, cross(u, p)]
}

/** The directions of an outer atom's lone pairs: pointing away from the
 *  central atom, spread round the bond as a tetrahedron's corners are. */
function outerPairDirs(away: Vec, n: number): Vec[] {
  if (n === 1) return [away]
  const [p, q] = across(away)
  const cone = Math.cos(70.5 * deg)
  const side = Math.sin(70.5 * deg)
  return Array.from({ length: n }, (_, i) => {
    const t = (i / n) * 2 * Math.PI + Math.PI / 2
    return norm(add(scale(away, cone), add(scale(p, side * Math.cos(t)), scale(q, side * Math.sin(t)))))
  })
}

export function layoutFigure(s: VseprSettings, structure: Structure, shape: VseprShape): Layout {
  const look = LOOKS[s.style]
  const view = (v: Vec) => turn(v, s.yaw, s.pitch)
  /** A point in 3D (bond lengths from the central atom, as seen) on the page. */
  const project = (p: Vec): Point => {
    if (look.schematic) {
      // as far out as a bond 1.7 times less foreshortened, up to its full length
      const len = Math.hypot(...p)
      const m = Math.hypot(p[0], p[1])
      if (m < 1e-9) return [0, 0]
      const k = (Math.min(1, (1.7 * m) / len) * len) / m
      return [p[0] * k, p[1] * k]
    }
    const k = 1 / (1 - p[2] * look.perspective)
    return [p[0] * k, p[1] * k]
  }
  const sizeAt = (z: number) => 1 / (1 - z * look.perspective)

  const pieces: Piece[] = []
  const centralEl = structure.atoms[shape.central].element
  const rc = look.radius(centralEl, true)
  pieces.push({ kind: 'atom', z: 0, x: 0, y: 0, r: rc, element: centralEl, central: true })

  /** Two dots (or one) side by side across a direction, centered on a point. */
  const pairAt = (at: Point, along: Point, electrons: number): Point[] => {
    const len = Math.hypot(...along)
    const [ux, uy] = len < 0.15 ? [1, 0] : [along[0] / len, along[1] / len]
    if (electrons === 1) return [at]
    return [
      [at[0] - uy * DOT_GAP, at[1] + ux * DOT_GAP],
      [at[0] + uy * DOT_GAP, at[1] - ux * DOT_GAP],
    ]
  }

  for (const g of shape.atoms) {
    const u = view(g.dir)
    const el = structure.atoms[g.atom].element
    const centerZ = u[2] * look.bond
    const r = look.radius(el, false) * sizeAt(centerZ)
    const c = scale(u, look.bond)
    const [x, y] = project(c)
    pieces.push({ kind: 'atom', z: centerZ, x, y, r, element: el, central: false })

    // From the central atom's surface to the outer atom's, as seen.
    const from = project(scale(u, s.style === 'ball-and-stick' ? rc * 0.6 : 0))
    const to = project(scale(u, look.bond - (s.style === 'ball-and-stick' ? r * 0.6 : 0)))
    const depth = u[2] > OUT_OF_PAGE ? 'wedge' : u[2] < -OUT_OF_PAGE ? 'dash' : 'plane'
    pieces.push({ kind: 'bond', z: centerZ / 2, from, to, order: g.order, depth, width: sizeAt(centerZ / 2) })

    if (s.outerPairs) {
      const lone = structure.atoms[g.atom].lone
      const dirs = outerPairDirs(u, Math.ceil(lone / 2))
      dirs.forEach((d, i) => {
        const p = add(c, scale(d, r + 7))
        const at = project(p)
        const electrons = i < Math.floor(lone / 2) ? 2 : 1
        pieces.push({ kind: 'dots', z: p[2] + (d[2] > 0 ? r : 0), dots: pairAt(at, [d[0], d[1]], electrons) })
      })
    }
  }

  if (s.lonePairs !== 'none')
    for (const g of shape.lone) {
      const u = view(g.dir)
      const along: Point = [u[0], u[1]]
      if (s.lonePairs === 'dots') {
        const p = scale(u, rc + 8)
        pieces.push({ kind: 'dots', z: p[2] + (u[2] > 0 ? rc : 0), dots: pairAt(project(p), along, g.electrons) })
        continue
      }
      // A balloon: an ellipsoid along the lone pair, seen from the front.
      const long = look.bond * 0.36
      const wide = look.bond * 0.2
      const mid = scale(u, rc * 0.9 + long)
      const [x, y] = project(mid)
      const m = Math.hypot(u[0], u[1])
      const k = sizeAt(mid[2])
      pieces.push({
        kind: 'lobe',
        z: mid[2] + (u[2] > 0 ? rc : 0),
        x,
        y,
        rx: Math.max(wide, Math.hypot(long * m, wide * Math.sqrt(1 - Math.min(1, m * m)))) * k,
        ry: wide * k,
        angle: m < 0.05 ? 0 : Math.atan2(u[1], u[0]) / deg,
        dots: pairAt([x, y], along, g.electrons),
      })
    }

  pieces.sort((a, b) => a.z - b.z)

  // Bond angle arcs: for each kind of angle, the pair of bonds it looks
  // clearest between from this view, with its label clear of the atoms,
  // lone pairs and the other labels.
  const arcs: Arc[] = []
  if (s.bondAngles) {
    const labels = angleLabels(shape, s.angles).map((l) => (s.question ? '____' : l))
    const radius = rc + look.bond * 0.28
    /** What a label mustn't sit on: atoms other than the central one, and lone pairs, as circles. */
    const blockers = pieces.flatMap((p): [number, number, number][] =>
      p.kind === 'atom' && !p.central ? [[p.x, p.y, p.r]] : p.kind === 'lobe' ? [[p.x, p.y, (p.rx + p.ry) / 2]] : [],
    )
    const taken: [number, number, number, number][] = []
    const hits = (box: [number, number, number, number]) => {
      const [x0, y0, x1, y1] = box
      let n = 0
      for (const [cx, cy, r] of blockers) {
        const dx = Math.max(x0 - cx, 0, cx - x1)
        const dy = Math.max(y0 - cy, 0, cy - y1)
        if (dx * dx + dy * dy < r * r) n++
      }
      for (const [a0, b0, a1, b1] of taken) if (x0 < a1 && a0 < x1 && y0 < b1 && b0 < y1) n++
      return n
    }
    shape.angles.forEach((a, i) => {
      let best: { score: number; arc: Arc; box: [number, number, number, number] } | undefined
      const labelW = textWidth(labels[i], ANGLE_FONT)
      for (const [p, q] of a.pairs) {
        const u = view(shape.atoms[p].dir)
        const v = view(shape.atoms[q].dir)
        // An axis to swing round: across both bonds, or, for a straight
        // line, over or under it (across it when it points up).
        const swings: Vec[] = []
        if (dot(u, v) < -0.999) {
          const up: Vec = [0, -1, 0]
          const off = add(up, scale(u, -dot(up, u)))
          const w = Math.hypot(...off) > 0.2 ? norm(off) : norm(add([1, 0, 0], scale(u, -u[0])))
          swings.push(w, scale(w, -1))
        } else swings.push(norm(add(v, scale(u, -dot(u, v)))))
        const angle = Math.acos(Math.max(-1, Math.min(1, dot(u, v))))
        for (const w of swings) {
          const steps = 24
          const pts: Point[] = []
          for (let t = 0; t <= steps; t++) {
            const th = (angle * t) / steps
            pts.push(project(scale(add(scale(u, Math.cos(th)), scale(w, Math.sin(th))), radius)))
          }
          let seen = 0
          for (let t = 1; t < pts.length; t++) seen += Math.hypot(pts[t][0] - pts[t - 1][0], pts[t][1] - pts[t - 1][1])
          const mid = add(scale(u, Math.cos(angle / 2)), scale(w, Math.sin(angle / 2)))
          const labelDir = project(scale(mid, 1))
          const ml = Math.hypot(...labelDir) || 1
          const [lx, ly] = [labelDir[0] / ml, labelDir[1] / ml]
          // out past the arc by half the label's width or height, whichever it points along
          const out = Math.hypot(...project(scale(mid, radius))) + 7 + Math.abs(lx) * (labelW / 2) + Math.abs(ly) * (ANGLE_FONT / 2)
          const at: Point = [lx * out, ly * out + ANGLE_FONT * 0.35]
          const box: [number, number, number, number] = [at[0] - labelW / 2, at[1] - ANGLE_FONT * 0.8, at[0] + labelW / 2, at[1] + 2]
          // face-on arcs are clearest; a label on an atom or lone pair is worst
          const score = seen / (radius * angle) - hits(box)
          const arc = { path: 'M' + pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' L'), label: labels[i], at }
          if (!best || score > best.score + 1e-6) best = { score, arc, box }
        }
      }
      if (best) {
        arcs.push(best.arc)
        taken.push(best.box)
      }
    })
  }

  // How far the drawing reaches, to size the figure round it.
  let [minX, minY, maxX, maxY] = [-rc, -rc, rc, rc]
  const reach = (x: number, y: number, r = 0) => {
    minX = Math.min(minX, x - r)
    maxX = Math.max(maxX, x + r)
    minY = Math.min(minY, y - r)
    maxY = Math.max(maxY, y + r)
  }
  for (const p of pieces) {
    if (p.kind === 'atom') reach(p.x, p.y, p.r + 1)
    else if (p.kind === 'lobe') reach(p.x, p.y, Math.max(p.rx, p.ry) + 1)
    else if (p.kind === 'dots') for (const [x, y] of p.dots) reach(x, y, 3)
  }
  for (const a of arcs) {
    const w = textWidth(a.label, ANGLE_FONT) / 2
    reach(a.at[0] - w, a.at[1] - ANGLE_FONT)
    reach(a.at[0] + w, a.at[1] + 4)
  }

  const charge = structure.charge
  const PAD = 6
  const BRACKET = 14
  const chargeW = charge ? textWidth(chargeText(charge), 18) + 4 : 0
  const left = -minX + PAD + (charge ? BRACKET : 0)
  const top = -minY + PAD + (charge ? 8 : 0)
  const drawW = maxX - minX
  const drawH = maxY - minY
  const brackets = charge
    ? { left: left + minX - BRACKET + 4, right: left + maxX + BRACKET - 4, top: top + minY - 6, bottom: top + maxY + 6, charge: chargeText(charge) }
    : undefined
  const bodyW = drawW + 2 * PAD + (charge ? 2 * BRACKET + chargeW : 0)
  const bodyH = drawH + 2 * PAD + (charge ? 16 : 0)

  const { under, key } = labelLines(s, shape)
  const linesW = Math.max(0, ...under.map((t) => textWidth(t, LINE_FONT)))
  const width = Math.max(bodyW, linesW + 8)
  const shift = (width - bodyW) / 2
  const lines = under.map((text, i) => ({ text, y: bodyH + 14 + LINE_FONT + i * LINE_H }))
  const height = bodyH + (under.length ? 14 + under.length * LINE_H : 0)

  const move = (p: Point): Point => [p[0] + left + shift, p[1] + top]
  const moved = pieces.map((p): Piece => {
    if (p.kind === 'atom') {
      const [x, y] = move([p.x, p.y])
      return { ...p, x, y }
    }
    if (p.kind === 'bond') return { ...p, from: move(p.from), to: move(p.to) }
    if (p.kind === 'lobe') {
      const [x, y] = move([p.x, p.y])
      return { ...p, x, y, dots: p.dots.map(move) }
    }
    return { ...p, dots: p.dots.map(move) }
  })
  const movedArcs = arcs.map((a) => ({
    ...a,
    path: a.path.replace(/(-?[\d.]+) (-?[\d.]+)/g, (_, x, y) => `${(Number(x) + left + shift).toFixed(1)} ${(Number(y) + top).toFixed(1)}`),
    at: move(a.at),
  }))
  return {
    width,
    height,
    pieces: moved,
    arcs: movedArcs,
    brackets: brackets && { ...brackets, left: brackets.left + shift, right: brackets.right + shift },
    lines,
    key,
    center: move([0, 0]),
  }
}
