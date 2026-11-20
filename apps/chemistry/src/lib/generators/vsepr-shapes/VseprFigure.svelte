<script lang="ts">
  // The VSEPR Shapes figure: the molecule drawn wedge-and-dash or
  // ball-and-stick, back to front, with its bond angle arcs, brackets and
  // the lines under it. With `onturn`, dragging it turns the molecule.
  import FigureFrame from '$lib/shared/FigureFrame.svelte'
  import { atomColor, lightness, shade } from './colors'
  import { ANGLE_FONT, LINE_FONT, SYMBOL_FONT, layoutFigure, type Piece, type Point } from './layout'
  import type { Found, VseprSettings } from './settings'

  interface Props {
    settings: VseprSettings
    found: Found
    svg?: SVGSVGElement
    /** the view after dragging the figure to turn it */
    onturn?: (yaw: number, pitch: number) => void
  }
  let { settings: s, found, svg = $bindable(), onturn }: Props = $props()

  const INK = '#111'
  const ball = $derived(s.style === 'ball-and-stick')
  /** The view while the figure is being dragged, kept here until it's let go
   *  so the page address isn't rewritten on every move. */
  let live = $state<{ yaw: number; pitch: number } | null>(null)
  const layout = $derived(found.ok ? layoutFigure(live ? { ...s, ...live } : s, found.structure, found.shape) : undefined)
  const colors = $derived(
    layout && ball ? [...new Set(layout.pieces.flatMap((p) => (p.kind === 'atom' ? [atomColor(p.element, s.grayscale)] : [])))] : [],
  )
  const gradientId = (hex: string) => `vsepr-${hex.slice(1)}`

  const label = $derived.by(() => {
    if (!found.ok) return 'No VSEPR shape'
    const sh = found.shape
    const how = ball ? 'ball-and-stick model' : 'wedge-and-dash drawing'
    const words = [`A ${how} of ${found.name}`]
    if (s.question) words.push('with its shape to name')
    else words.push(`${sh.name}${sh.electronGeometry !== sh.name ? `, with ${sh.electronGeometry} electron geometry` : ''}`)
    if (s.lonePairs !== 'none' && sh.e) words.push(`${sh.e} lone ${sh.e === 1 ? 'pair' : 'pairs'} on the central atom`)
    return words.join(', ')
  })

  // Lines along a bond, side by side for a double or triple bond.
  function offsets(order: number, gap: number) {
    return Array.from({ length: Math.max(1, order) }, (_, i) => (i - (Math.max(1, order) - 1) / 2) * gap)
  }

  /** A bond's ends trimmed to the circles' edges, as seen, for wedge-and-dash. */
  function trimmed(b: Extract<Piece, { kind: 'bond' }>, r: number): [Point, Point] | undefined {
    const [x1, y1] = b.from
    const [x2, y2] = b.to
    const len = Math.hypot(x2 - x1, y2 - y1)
    if (len <= 2 * r + 2) return undefined
    const ux = (x2 - x1) / len
    const uy = (y2 - y1) / len
    return [
      [x1 + ux * (r + 2), y1 + uy * (r + 2)],
      [x2 - ux * (r + 2), y2 - uy * (r + 2)],
    ]
  }

  const across = (a: Point, b: Point): Point => {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
    return [-(b[1] - a[1]) / len, (b[0] - a[0]) / len]
  }

  function wedge(a: Point, b: Point, width: number) {
    const [nx, ny] = across(a, b)
    return `M${a[0]} ${a[1]} L${b[0] + nx * width} ${b[1] + ny * width} L${b[0] - nx * width} ${b[1] - ny * width} Z`
  }

  function hashes(a: Point, b: Point, width: number) {
    const [nx, ny] = across(a, b)
    const len = Math.hypot(b[0] - a[0], b[1] - a[1])
    const n = Math.max(3, Math.round(len / 5))
    return Array.from({ length: n }, (_, i) => {
      const t = (i + 0.5) / n
      const x = a[0] + (b[0] - a[0]) * t
      const y = a[1] + (b[1] - a[1]) * t
      const w = 1 + (width - 1) * t
      return `M${x + nx * w} ${y + ny * w} L${x - nx * w} ${y - ny * w}`
    }).join(' ')
  }

  const shifted = (p: Point, n: Point, k: number): Point => [p[0] + n[0] * k, p[1] + n[1] * k]

  // Dragging turns the molecule: across turns it round, up and down tips it.
  let dragging: { x: number; y: number } | undefined
  const wrap = (a: number) => ((((Math.round(a) + 180) % 360) + 360) % 360) - 180
  function down(e: PointerEvent) {
    if (!onturn) return
    dragging = { x: e.clientX, y: e.clientY }
    live = { yaw: s.yaw, pitch: s.pitch }
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
  }
  function move(e: PointerEvent) {
    if (!dragging || !live) return
    const dx = e.clientX - dragging.x
    const dy = e.clientY - dragging.y
    dragging = { x: e.clientX, y: e.clientY }
    live = { yaw: wrap(live.yaw + dx * 0.6), pitch: Math.max(-90, Math.min(90, Math.round(live.pitch - dy * 0.6))) }
  }
  function up() {
    if (live && (live.yaw !== s.yaw || live.pitch !== s.pitch)) onturn?.(live.yaw, live.pitch)
    dragging = undefined
    live = null
  }
</script>

<FigureFrame bind:svg width={layout?.width ?? 320} height={layout?.height ?? 120} {label} title={s.titleMode === 'text' ? s.title : ''} answerKey={layout?.key.join('\n') ?? ''}>
  {#if layout}
    {#if colors.length}
      <defs>
        {#each colors as c (c)}
          <radialGradient id={gradientId(c)} cx="0.36" cy="0.32" r="0.72">
            <stop offset="0" stop-color={shade(c, 0.75)} />
            <stop offset="0.45" stop-color={c} />
            <stop offset="1" stop-color={shade(c, -0.45)} />
          </radialGradient>
        {/each}
      </defs>
    {/if}
    {#if onturn}
      <rect
        data-no-export
        width={layout.width}
        height={layout.height}
        fill="transparent"
        style="cursor: grab; touch-action: none"
        role="presentation"
        onpointerdown={down}
        onpointermove={move}
        onpointerup={up}
        onpointercancel={up}
      />
    {/if}
    <g pointer-events="none">
      {#each layout.pieces as p, i (i)}
        {#if p.kind === 'atom'}
          {#if ball}
            {@const fill = atomColor(p.element, s.grayscale)}
            <circle cx={p.x} cy={p.y} r={p.r} fill="url(#{gradientId(fill)})" stroke={shade(fill, -0.55)} stroke-width="1" />
            {#if s.symbols}
              <text
                x={p.x}
                y={p.y}
                dy="0.35em"
                text-anchor="middle"
                font-size={Math.min(SYMBOL_FONT, p.r * 0.95)}
                font-weight="700"
                fill={lightness(fill) > 0.55 ? INK : '#fff'}>{p.element}</text
              >
            {/if}
          {:else}
            <circle cx={p.x} cy={p.y} r={p.r} fill="#fff" stroke={INK} stroke-width="1.5" />
            <text x={p.x} y={p.y} dy="0.35em" text-anchor="middle" font-size={p.element.length > 1 ? SYMBOL_FONT - 2 : SYMBOL_FONT} fill={INK}>{p.element}</text>
          {/if}
        {:else if p.kind === 'bond'}
          {#if ball}
            {@const n = across(p.from, p.to)}
            {@const w = (p.order === 1 ? 8 : p.order === 2 ? 5.5 : 4.2) * p.width}
            {#each offsets(p.order, w + 2.5) as k (k)}
              {@const a = shifted(p.from, n, k)}
              {@const b = shifted(p.to, n, k)}
              <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={s.grayscale ? '#8a8a8a' : '#8f8f8f'} stroke-width={w} />
              <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#d9d9d9" stroke-width={w * 0.35} transform="translate({-n[0] * w * 0.18} {-n[1] * w * 0.18})" />
            {/each}
          {:else}
            {@const ends = trimmed(p, 17)}
            {#if ends}
              {@const [a, b] = ends}
              {@const n = across(a, b)}
              {#if p.depth === 'plane'}
                {#each offsets(p.order, 5) as k (k)}
                  {@const a2 = shifted(a, n, k)}
                  {@const b2 = shifted(b, n, k)}
                  <line x1={a2[0]} y1={a2[1]} x2={b2[0]} y2={b2[1]} stroke={INK} stroke-width="2" stroke-linecap="round" />
                {/each}
              {:else}
                {#if p.depth === 'wedge'}
                  <path d={wedge(a, b, 5.5)} fill={INK} />
                {:else}
                  <path d={hashes(a, b, 5.5)} stroke={INK} stroke-width="1.6" fill="none" />
                {/if}
                {#each offsets(p.order - 1, 5) as k, j (j)}
                  {#if p.order > 1}
                    {@const a2 = shifted(a, n, 9 + k)}
                    {@const b2 = shifted(b, n, 9 + k)}
                    <line x1={a2[0]} y1={a2[1]} x2={b2[0]} y2={b2[1]} stroke={INK} stroke-width="1.6" stroke-linecap="round" />
                  {/if}
                {/each}
              {/if}
            {/if}
          {/if}
        {:else if p.kind === 'lobe'}
          <ellipse
            cx={p.x}
            cy={p.y}
            rx={p.rx}
            ry={p.ry}
            transform="rotate({p.angle} {p.x} {p.y})"
            fill={ball ? (s.grayscale ? '#ececec' : '#e3ebf7') : '#fff'}
            fill-opacity={ball ? 0.9 : 1}
            stroke={ball ? (s.grayscale ? '#8a8a8a' : '#7f93b8') : INK}
            stroke-width="1.4"
          />
          {#each p.dots as [x, y], j (j)}<circle cx={x} cy={y} r="2.6" fill={INK} />{/each}
        {:else}
          {#each p.dots as [x, y], j (j)}<circle cx={x} cy={y} r="2.4" fill={INK} />{/each}
        {/if}
      {/each}
      {#each layout.arcs as a, i (i)}
        <path d={a.path} fill="none" stroke={INK} stroke-width="1.4" />
        <text
          x={a.at[0]}
          y={a.at[1]}
          text-anchor="middle"
          font-size={ANGLE_FONT}
          fill={INK}
          stroke="#fff"
          stroke-width="4"
          paint-order="stroke"
          stroke-linejoin="round">{a.label}</text
        >
      {/each}
      {#if layout.brackets}
        {@const b = layout.brackets}
        <path d="M{b.left + 8} {b.top} H{b.left} V{b.bottom} H{b.left + 8}" fill="none" stroke={INK} stroke-width="2" />
        <path d="M{b.right - 8} {b.top} H{b.right} V{b.bottom} H{b.right - 8}" fill="none" stroke={INK} stroke-width="2" />
        <text x={b.right + 4} y={b.top + 12} font-size="18" fill={INK}>{b.charge}</text>
      {/if}
      {#each layout.lines as l, i (i)}
        <text x={layout.width / 2} y={l.y} text-anchor="middle" font-size={LINE_FONT} fill={INK}>{l.text}</text>
      {/each}
    </g>
  {:else}
    <text x="160" y="60" dy="0.35em" text-anchor="middle" font-size="16" fill="#666">No shape to draw</text>
  {/if}
</FigureFrame>
