import { describe, expect, it } from 'vitest'
import { INK_HEX, mixedHex, rfText } from './inks'
import { PX, chromatogramLayout, spread } from './layout'
import { answerLines, chromatographySettings as def } from './settings'

const settings = (query: string) => def.fromParams(new URLSearchParams(query))

describe('Chromatography settings', () => {
  it('reads and writes the samples in the address', () => {
    const s = settings('samples=X:red-3.2,blue-6_Red:red-3.2')
    expect(s.samples).toEqual([
      { name: 'X', spots: [{ color: 'red', distance: 3.2 }, { color: 'blue', distance: 6 }] },
      { name: 'Red', spots: [{ color: 'red', distance: 3.2 }] },
    ])
    expect(settings(def.toQuery(s))).toEqual(s)
  })

  it('keeps the defaults for samples it can’t read', () => {
    for (const bad of ['', 'A', 'A:teal-3', 'A:blue-x', 'A:', 'A:blue-1_B:'])
      expect(settings(`samples=${encodeURIComponent(bad)}`).samples, bad).toEqual(def.defaults.samples)
  })

  it('keeps every spot at or below the solvent front', () => {
    const s = settings('front=5&samples=A:blue-7.3,red-0')
    expect(s.samples[0].spots.map((p) => p.distance)).toEqual([5, 0])
  })

  it('gives each spot’s Rf in the answer key', () => {
    expect(answerLines(def.defaults)[0]).toBe('A: blue Rf = 0.70, yellow Rf = 0.30')
    expect(rfText(4.4, 8)).toBe('0.55')
  })
})

describe('mixing an ink before it separates', () => {
  it('is the one color of a one-color ink', () => {
    expect(mixedHex([{ color: 'red', distance: 3 }])).toBe(INK_HEX.red)
  })

  it('darkens as dyes are added, like paint', () => {
    const lightness = (hex: string) => [1, 3, 5].reduce((sum, i) => sum + parseInt(hex.slice(i, i + 2), 16), 0)
    const green = mixedHex([{ color: 'blue', distance: 5 }, { color: 'yellow', distance: 2 }])
    const black = mixedHex([{ color: 'blue', distance: 5 }, { color: 'yellow', distance: 2 }, { color: 'red', distance: 4 }])
    expect(lightness(green)).toBeLessThan(lightness(INK_HEX.blue))
    expect(lightness(black)).toBeLessThan(lightness(green))
  })
})

describe('Chromatography layout', () => {
  it('draws each spot its distance above the origin line, to scale', () => {
    const l = chromatogramLayout(def.defaults)
    expect(l.originY - l.frontY).toBe(8 * PX)
    expect(l.originY - l.lanes[0].spots[0].y).toBeCloseTo(5.6 * PX)
  })

  it('keeps the solvent below the origin line', () => {
    for (const show of ['after', 'both'] as const) {
      const l = chromatogramLayout({ ...def.defaults, show })
      for (const p of l.panels) expect(p.waterY!).toBeGreaterThan(p.paperY + l.originY)
    }
  })

  it('shows a second paper, before, only when asked', () => {
    expect(chromatogramLayout(def.defaults).panels.map((p) => p.stage)).toEqual(['after'])
    expect(chromatogramLayout({ ...def.defaults, show: 'both' }).panels.map((p) => p.stage)).toEqual(['before', 'after'])
  })

  it('draws the paper alone without the setup', () => {
    const l = chromatogramLayout({ ...def.defaults, setup: false })
    expect(l.panels[0].beaker).toBeNull()
    expect(l.width).toBe(l.paperW)
  })

  it('gives each measurement its own column, and none to a spot that stayed put', () => {
    const s = settings('measurements=1&samples=A:blue-5,red-0,yellow-2')
    const l = chromatogramLayout(s)
    const [blue, red, yellow] = l.lanes[0].spots
    expect(red.arrowX).toBeNull()
    expect(yellow.arrowX!).toBeLessThan(blue.arrowX!)
    expect(l.frontArrowX).not.toBeNull()
    expect(chromatogramLayout(def.defaults).lanes[0].spots.every((p) => p.arrowX === null)).toBe(true)
  })

  it('spaces part labels so their words don’t overlap', () => {
    const l = chromatogramLayout({ ...def.defaults, labels: true })
    expect(l.labels.map((p) => p.text)).toContain('Water (solvent)')
    for (let i = 1; i < l.labels.length; i++) expect(l.labels[i].textY - l.labels[i - 1].textY).toBeGreaterThanOrEqual(18.99)
    expect(spread([10, 12, 14], 10)).toEqual([2, 12, 22])
  })
})
