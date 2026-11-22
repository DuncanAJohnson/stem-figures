// What the graphs of concentration against time share (Equilibrium Graph and
// Rate Law Graphs): the concentration and time units, the axis titles
// written from them, a species' formula with its digits lowered, the dashes
// that tell the species' lines apart, and placing a species' formula beside
// its line.

import type { Point } from '$shared/graph/grid'
import { DASHES, alongCurve, textWidth, type Box, type Spot, type placer } from '$shared/graph/labels'
import { textSpans, type Span } from '$shared/particles/key'
import { plainText } from '$shared/particles/keyText'

/** The units a concentration is given in, as written on the figure. */
export const CONC_UNITS = ['M', 'mol/L', 'mol dm⁻³'] as const
export type ConcUnit = (typeof CONC_UNITS)[number]

/** The units along the time axis, as written on the figure. */
export const TIME_UNITS = ['s', 'min', 'h'] as const
export type TimeUnit = (typeof TIME_UNITS)[number]

/** Each time unit in words, one and many, for the answer key. */
export const TIME_UNIT_NAMES: Record<TimeUnit, { one: string; many: string }> = {
  s: { one: 'second', many: 'seconds' },
  min: { one: 'minute', many: 'minutes' },
  h: { one: 'hour', many: 'hours' },
}

/**
 * A species' formula as key text ($shared/particles/keyText), the digits
 * after a letter or a bracket lowered: "N2O5" is "N_2O_5", "C6H12O6" is
 * "C_6H_{12}O_6". A number in front stays as it is ("2NO2" is "2NO_2"), and
 * so does a formula already written with _ or ^ ("Fe^{3+}").
 */
export function formulaMarkup(species: string) {
  const typed = species.trim()
  if (/[_^]/.test(typed)) return typed
  return typed.replace(/(?<=[A-Za-z)\]])\d+/g, (digits) => (digits.length === 1 ? `_${digits}` : `_{${digits}}`))
}

/** A species' formula in plain characters, for titles, answer keys and screen readers: "N₂O₅". */
export const formulaText = (species: string) => plainText(formulaMarkup(species))

/** A species' concentration as written: "[N₂O₅]". */
export const concentrationOf = (species: string) => `[${formulaText(species)}]`

/** The concentration axis's title: "[N₂O₅] (mol/L)" for one species, "Concentration (mol/L)" for several. */
export const concentrationTitle = (unit: ConcUnit = 'mol/L', species?: string) =>
  `${species?.trim() ? concentrationOf(species) : 'Concentration'} (${unit})`

/** The time axis's title: "Time (s)". */
export const timeTitle = (unit: TimeUnit) => `Time (${unit})`

/** Each species' dashes by its place in the list, so up to three lines read apart in black and white: solid, dashed, dotted. */
export const SPECIES_DASHES = DASHES

/** A species' formula beside its line: where it goes, and its pieces of text with the digits lowered. */
export type SpeciesLabel = Spot & { box: Box; spans: Span[]; text: string }

/**
 * A species' formula placed beside `pts`, the stretch of its line to label
 * (in figure units), where it touches nothing the placer knows of; it's
 * then in the way of later labels. Nothing when there's no stretch or name.
 */
export function placeSpeciesLabel(place: ReturnType<typeof placer>, pts: Point[], species: string, fs: number): SpeciesLabel | null {
  const markup = formulaMarkup(species)
  const spots = alongCurve(pts, fs)
  if (!markup || !spots.length) return null
  const spans = textSpans(markup, fs)
  const width = spans.reduce((w, span) => w + textWidth(span.text, span.size), 0) + 2
  return { ...place.place(spots, width, fs), spans, text: plainText(markup) }
}
