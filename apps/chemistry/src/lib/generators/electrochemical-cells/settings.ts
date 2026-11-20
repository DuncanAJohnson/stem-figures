// Electrochemical Cells' settings, as they appear in the page address.

import { figureTextFields } from '$lib/shared/figureText'
import { bool, choice, defineSettings } from '$lib/shared/settings'
import { METALS, cellOf, voltageText, type Metal } from './cell'

/** What joins the two electrodes at the top. */
export const METERS = ['digital', 'dial', 'coil'] as const
export type Meter = (typeof METERS)[number]

export const cellSettings = defineSettings(
  {
    left: choice(METALS, 'Zn'),
    right: choice(METALS, 'Cu'),
    meter: choice(METERS, 'digital'),
    labels: bool(true),
    electrodes: bool(false),
    electronFlow: bool(false),
    ...figureTextFields(),
  },
  // Two of the same metal make no cell.
  (s) => (s.left === s.right ? { ...s, right: (s.left === 'Cu' ? 'Zn' : 'Cu') as Metal } : s),
)

export type CellSettings = typeof cellSettings.defaults

/** The answer key line, e.g. "Anode: Zn (−) · Cathode: Cu (+) · E°cell = 1.10 V". */
export function answerLine(s: CellSettings) {
  const cell = cellOf(s.left, s.right)
  return `Anode: ${s[cell.anode]} (−) · Cathode: ${s[cell.cathode]} (+) · E°cell = ${voltageText(cell.voltage)} V`
}
