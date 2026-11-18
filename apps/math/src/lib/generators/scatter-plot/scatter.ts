// Lays out a scatter plot as plain numbers for ScatterPlot.svelte to draw, on
// the shared graph grid ($shared/graph). Both axes run along the grid's
// edges, numbered here rather than by the grid, so an axis that starts past
// 0 can begin with a block holding a zig-zag break, its first number after
// it. The line of best fit (or the teacher's own) runs across the graph past
// the breaks, with its equation and r placed where they touch no point.

import { LABEL_SCALE } from '$shared/labelSize'
import type { Axis, GridSettings } from '$shared/graph/axes'
import { CELL, clipPath, layoutGrid, pathOf, round, type Point } from '$shared/graph/grid'
import { placer, textWidth, type Box } from '$shared/graph/labels'
import { numberText } from '$shared/graph/numbering'
import { describeCorrelation } from '$lib/stats/regression'
import { correlationText, equationText, readScatter, type AxisRange, type Settings } from './settings'

const BASE_FS = 14 // the grid's number size, at medium labels
const DOT = 4.5 // a dot's radius
const ARM = 5 // half a cross's width

export type Text = { x: number; y: number; text: string; anchor: 'start' | 'middle' | 'end' }

/** Which of an axis's block lines are numbered: every `every`th, counting from 0 when it's on the axis; never the break's. */
function numbered(a: AxisRange, every: number): { i: number; text: string }[] {
  if (!every) return []
  const first = a.broken ? 1 : 0
  const zero = -a.axisStart / a.step
  const z = Math.round(zero)
  const ref = Math.abs(zero - z) < 1e-9 && z >= first && z <= a.blocks ? z : first
  const out: { i: number; text: string }[] = []
  for (let i = first; i <= a.blocks; i++) {
    if ((i - ref) % every === 0) out.push({ i, text: numberText(a.axisStart + i * a.step, a.numbering) })
  }
  return out
}

/** A zig-zag across an axis, in the middle of its first block: a white cover over the axis, and the zig-zag on it. */
function zigzag(c: number, at: number, across: 'x' | 'y') {
  const a = Math.min(9, CELL * 0.3)
  const flip = (p: Point): Point => (across === 'x' ? p : { x: p.y, y: p.x })
  const pts = [
    { x: c - a, y: at },
    { x: c - a / 2, y: at - 6 },
    { x: c, y: at + 6 },
    { x: c + a / 2, y: at - 6 },
    { x: c + a, y: at },
  ].map(flip)
  const cover = across === 'x' ? { x: round(c - a), y: round(at - 3), w: round(2 * a), h: 6 } : { x: round(at - 3), y: round(c - a), w: 6, h: round(2 * a) }
  return { cover, path: pathOf(pts) }
}

export function buildScatter(s: Settings) {
  const read = readScatter(s)
  const fs = BASE_FS * LABEL_SCALE[s.labelSize]
  const { x, y } = read

  const xMarks = numbered(x, s.xEvery)
  const yMarks = numbered(y, s.yEvery)
  const yNumW = yMarks.length ? Math.max(...yMarks.map((t) => textWidth(t.text, fs))) + 8 : 0

  const grid: GridSettings = {
    xEvery: 0,
    yEvery: 0,
    title: s.title,
    titleMode: s.titleMode,
    xTitle: s.xTitle,
    xTitleMode: s.xTitleMode,
    yTitle: s.yTitle,
    yTitleMode: s.yTitleMode,
    xLabel: '',
    xLabelMode: 'none',
    yLabel: '',
    yLabelMode: 'none',
    xStartCap: 'none',
    xEndCap: 'none',
    yStartCap: 'none',
    yEndCap: 'none',
    minor: s.minor,
    labelSize: s.labelSize,
  }
  const xAxis: Axis = { start: x.axisStart, step: x.step, blocks: x.blocks, numbering: x.numbering }
  const yAxis: Axis = { start: y.axisStart, step: y.step, blocks: y.blocks, numbering: y.numbering }
  const laid = layoutGrid(grid, { x: xAxis, y: yAxis }, { edges: true, room: { x: xMarks.length ? fs + 8 : 0, y: yNumW } })
  const { px } = laid
  const box = laid.grid
  const axisY = laid.xAxis.y
  const axisX = laid.yAxis.x

  // The numbers: x under the x-axis, y left of the y-axis. Where both have a
  // number at the corner, the same one (0) is written once, tucked into the
  // corner as the grid writes it; with different ones, the y-axis's is
  // lifted clear of the x-axis's.
  const numbers: (Text & { anchor: 'middle' | 'end' })[] = []
  const xCorner = xMarks.find((t) => t.i === 0)
  const yCorner = yMarks.find((t) => t.i === 0)
  const both = !!xCorner && !!yCorner
  const once = both && xCorner!.text === yCorner!.text
  for (const t of xMarks) {
    const at = round(box.x + t.i * CELL)
    const corner = once && t === xCorner
    numbers.push({ x: corner ? round(at - 8) : at, y: round(axisY + fs + 6), text: t.text, anchor: corner ? 'end' : 'middle' })
  }
  for (const t of yMarks) {
    const at = box.y + box.h - t.i * CELL
    if (once && t === yCorner) continue
    numbers.push({ x: round(axisX - 6), y: round(both && t === yCorner ? at - 5 : at + fs * 0.35), text: t.text, anchor: 'end' })
  }

  const zigs = [
    x.broken ? zigzag(px({ x: x.axisStart + x.step / 2, y: 0 }).x, axisY, 'x') : null,
    y.broken ? zigzag(px({ x: 0, y: y.axisStart + y.step / 2 }).y, axisX, 'y') : null,
  ].filter((z) => z !== null)

  // The points, on the drawing.
  const points = read.points.map((p) => {
    const q = px(p)
    return { x: round(q.x), y: round(q.y) }
  })

  // The line, across the graph past the breaks.
  const edges = { x0: x.start, x1: x.end, y0: y.start, y1: y.end }
  let fitPath: string | null = null
  let fitPts: Point[] = []
  if (read.line) {
    const { slope, intercept } = read.line
    const run = clipPath([{ x: x.start, y: slope * x.start + intercept }, { x: x.end, y: slope * x.end + intercept }], edges)[0]
    if (run) {
      fitPts = run.map(px)
      fitPath = pathOf(fitPts)
    }
  }

  // The equation and r, one under the other, placed inside the graph where
  // they touch no point and keep off the line: the top corners first.
  const place = placer({ x0: box.x + 2, y0: box.y + 2, x1: box.x + box.w - 2, y1: box.y + box.h - 2 })
  if (fitPts.length) place.line(fitPts)
  for (const p of points) place.box({ x0: p.x - DOT - 2, y0: p.y - DOT - 2, x1: p.x + DOT + 2, y1: p.y + DOT + 2 })

  const BLANK_W = fs * 5
  type Line = { text: string; blank: boolean }
  const lines: Line[] = []
  if (read.line && s.equation === 'text') lines.push({ text: equationText(read.line, s.places), blank: false })
  if (read.line && s.equation === 'blank') lines.push({ text: 'y =', blank: true })
  const rText = correlationText(s, read.r)
  if (rText) lines.push({ text: rText, blank: false })
  if (s.r === 'blank' && read.points.length > 1) lines.push({ text: 'r =', blank: true })

  const labels: Text[] = []
  // A white panel behind them, so gridlines don't run through the text or the blank lines.
  let panel: { x: number; y: number; w: number; h: number } | null = null
  const blanks: { x1: number; y1: number; x2: number; y2: number }[] = []
  if (lines.length) {
    const lineH = fs * 1.35
    const widthOf = (l: Line) => textWidth(l.text, fs) + (l.blank ? fs * 0.4 + BLANK_W : 0)
    const w = Math.max(...lines.map(widthOf))
    const h = lineH * (lines.length - 1) + fs * 1.1
    const m = fs * 0.6
    const corners = [
      { x: box.x + m, y: box.y + m },
      { x: box.x + box.w - m - w, y: box.y + m },
      { x: box.x + box.w - m - w, y: box.y + box.h - m - h },
      { x: box.x + m, y: box.y + box.h - m - h },
    ]
    // Then beside the line's middle, above and below.
    if (fitPts.length) {
      const mid = { x: (fitPts[0].x + fitPts[1].x) / 2, y: (fitPts[0].y + fitPts[1].y) / 2 }
      corners.push({ x: mid.x - w / 2, y: mid.y - h - fs }, { x: mid.x - w / 2, y: mid.y + fs })
    }
    const options = corners.map((c) => ({ ...c, box: { x0: c.x, y0: c.y, x1: c.x + w, y1: c.y + h } as Box }))
    const at = place.choose(options)
    const pad = fs * 0.3
    panel = { x: round(at.x - pad), y: round(at.y - pad), w: round(w + 2 * pad), h: round(h + 2 * pad) }
    lines.forEach((l, k) => {
      const baseline = at.y + fs * 0.85 + k * lineH
      labels.push({ x: round(at.x), y: round(baseline), text: l.text, anchor: 'start' })
      if (l.blank) {
        const x1 = at.x + textWidth(l.text, fs) + fs * 0.4
        blanks.push({ x1: round(x1), y1: round(baseline), x2: round(x1 + BLANK_W), y2: round(baseline) })
      }
    })
  }

  const description = [
    `Scatter plot of ${read.points.length} ${read.points.length === 1 ? 'point' : 'points'}`,
    `x from ${numberText(x.start, x.numbering)} to ${numberText(x.end, x.numbering)}`,
    `y from ${numberText(y.start, y.numbering)} to ${numberText(y.end, y.numbering)}`,
    read.line && (s.fit === 'best' ? `line of best fit ${equationText(read.line, s.places)}` : `line ${equationText(read.line, s.places)}`),
    read.r !== null && read.points.length > 2 && s.r !== 'none' && s.r !== 'blank' ? describeCorrelation(read.r) : '',
  ].filter(Boolean).join(', ')

  // Wide enough for the last number under the axis.
  const last = numbers.filter((t) => t.anchor === 'middle').at(-1)
  const width = Math.max(laid.width, last ? last.x + textWidth(last.text, fs) / 2 + 14 : 0)

  return {
    read,
    grid,
    layout: { ...laid, numbers, width: round(width) },
    fs,
    points,
    dot: DOT,
    arm: ARM,
    fit: fitPath,
    zigs,
    labels,
    blanks,
    panel,
    description,
  }
}
