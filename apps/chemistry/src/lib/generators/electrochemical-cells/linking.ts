// Electrochemical Cells' address parameters, for /linking and /llms.txt.

import { describeLinking } from '$lib/linking/define'
import { figureTextDocs } from '$lib/linking/common'
import { METALS, METAL_INFO } from './cell'
import { cellSettings } from './settings'

const metalWords = METALS.map((m) => `${m}: ${METAL_INFO[m].name} in ${METAL_INFO[m].ion}`).join('; ')

export const cellLinking = describeLinking(cellSettings, {
  id: 'electrochemical-cells',
  summary:
    'A galvanic (voltaic) cell: two beakers, each a metal electrode in a 1 M solution of its own ion, joined by a salt bridge, with wires from the electrodes to a digital voltmeter, a dial voltmeter or a coil of wire.',
  notes: [
    'The metal with the lower standard reduction potential is the anode, wherever it is. A voltmeter’s + terminal is wired to the cathode, so it reads the standard cell potential, E°cell = E°cathode − E°anode, e.g. 1.10 V for Zn and Cu.',
    'left and right must be different metals: when they are the same, right becomes Cu (or Zn if both are Cu).',
  ],
  params: {
    left: { what: 'The left electrode’s metal, standing in a solution of its own ion.', values: metalWords },
    right: { what: 'The right electrode’s metal.', values: 'As for left' },
    meter: { what: 'What the wires from the electrodes meet at the top.', values: 'digital: a digital voltmeter showing E°cell; dial: a 0–4 V dial voltmeter; coil: a coil of wire, with no reading' },
    labels: { what: 'Names the metals, their solutions (e.g. Cu²⁺(aq)) and the salt bridge. Off leaves them for students to label.' },
    electrodes: { what: 'Writes “Anode (−)” and “Cathode (+)” under the beakers.' },
    electronFlow: { what: 'Draws arrows marked e⁻ along the wire, from the anode to the cathode.' },
    ...figureTextDocs('Anode: Zn (−) · Cathode: Cu (+) · E°cell = 1.10 V'),
  },
  examples: [
    { shows: 'A zinc–copper cell with a digital voltmeter reading 1.10 V, its anode, cathode and electron flow labeled.', settings: { electrodes: true, electronFlow: true } },
    { shows: 'A magnesium–silver cell with a dial voltmeter reading 3.17 V.', settings: { left: 'Mg', right: 'Ag', meter: 'dial' } },
    { shows: 'An unlabeled copper–nickel cell joined by a coil of wire, with the answer key.', settings: { left: 'Cu', right: 'Ni', meter: 'coil', labels: false, answerKey: true } },
  ],
})
