// Electrochemical Cells' settings, as they appear in the page address.

import { figureTextFields } from '$lib/shared/figureText'
import { bool, choice, defineSettings, number } from '$lib/shared/settings'
import { METALS, cellOf, voltageText, type Metal } from './cell'

/** What joins the two electrodes at the top. */
export const METERS = ['digital', 'dial', 'coil'] as const
export type Meter = (typeof METERS)[number]

/** Where E°cell comes from: the two metals' standard reduction potentials, or a number the teacher types. */
export const READINGS = ['table', 'typed'] as const
export type Reading = (typeof READINGS)[number]

export const cellSettings = defineSettings(
  {
    left: choice(METALS, 'Zn'),
    right: choice(METALS, 'Cu'),
    meter: choice(METERS, 'digital'),
    reading: choice(READINGS, 'table'),
    /** the teacher's own E°cell, in volts, when reading is typed */
    voltage: number({ min: 0, max: 9.99, fallback: 1.1 }),
    labels: bool(true),
    electrodes: bool(false),
    electronFlow: bool(false),
    ...figureTextFields(),
  },
  // Two of the same metal make no cell.
  (s) => (s.left === s.right ? { ...s, right: (s.left === 'Cu' ? 'Zn' : 'Cu') as Metal } : s),
)

export type CellSettings = typeof cellSettings.defaults

/** E°cell as the figure shows it, in volts to 0.01: the table's, or the teacher's own. */
export function cellVoltage(s: CellSettings) {
  return s.reading === 'typed' ? Math.round(s.voltage * 100) / 100 : cellOf(s.left, s.right).voltage
}

/** The answer key line, e.g. "Anode: Zn (−) · Cathode: Cu (+) · E°cell = 1.10 V". */
export function answerLine(s: CellSettings) {
  const cell = cellOf(s.left, s.right)
  return `Anode: ${s[cell.anode]} (−) · Cathode: ${s[cell.cathode]} (+) · E°cell = ${voltageText(cellVoltage(s))} V`
}
