<script lang="ts">
  // The Lever Generator: the class and the two arms, the load, the labels and
  // the figure's options down the left, the figure on the right. Settings live
  // in the page address.
  import { Scale, SlidersHorizontal, Tag, Type, Weight } from '@lucide/svelte'
  import Choice from '$lib/shared/Choice.svelte'
  import HelpTip from '$lib/shared/HelpTip.svelte'
  import LabelField from '$lib/shared/LabelField.svelte'
  import type { Label } from '$lib/shared/label'
  import Section from '$lib/shared/Section.svelte'
  import FigureTextSettings from '$shared/FigureTextSettings.svelte'
  import GeneratorPage from '$shared/GeneratorPage.svelte'
  import { generatorState } from '$shared/generatorState.svelte'
  import Lever from './Lever.svelte'
  import { drawnArms } from './lever'
  import { CLASSES, G, answerLines, armsSuit, comesOutEven, exact, leverOf, leverSettings, sig3, valueTexts, type LeverClass } from './settings'

  const gen = generatorState(leverSettings, 'lever', { history: 'physicsfigures.lever.history', presets: 'physicsfigures.lever.presets' })
  const s = gen.s
  const clean = $derived(gen.snapshot())
  let svg = $state<SVGSVGElement>()

  const MIDDLE: Record<LeverClass, string> = {
    '1': 'The fulcrum is between the load and the effort, as on a seesaw or a crowbar.',
    '2': 'The load is between the fulcrum and the effort, as on a wheelbarrow. The effort is farther from the fulcrum than the load.',
    '3': 'The effort is between the fulcrum and the load, as on tweezers or a fishing rod. The load is farther from the fulcrum than the effort.',
  }

  /** Changing to a class the arms don't suit swaps the two arms. */
  function setClass(c: LeverClass) {
    if (!armsSuit(c, clean.effortArm, clean.loadArm)) [s.effortArm, s.loadArm] = [clean.loadArm, clean.effortArm]
    s.class = c
  }

  const sums = $derived(leverOf(clean))
  const values = $derived(valueTexts(clean))
  const arms = $derived(drawnArms(clean))
  /** Typed arms that don't suit the class are drawn the other way round. */
  const swapped = $derived(typeof s.effortArm === 'number' && typeof s.loadArm === 'number' && !armsSuit(clean.class, s.effortArm, s.loadArm))
  const sameArms = $derived(clean.class !== '1' && clean.effortArm === clean.loadArm)

  const shown = (l: Label, value = '') => (l.mode === 'text' ? l.text.trim() || value : l.mode === 'blank' ? 'blank' : '')
  const leverSummary = $derived(`Class ${clean.class} · effort arm ${values.effortArm} · load arm ${values.loadArm}`)
  const loadSummary = $derived(`${values.load}${sums.mass || clean.loadShown === 'block' ? ' block' : ' arrow'} · effort ${values.effort}`)
  const labelsSummary = $derived(
    [
      shown(clean.loadLabel, values.load),
      shown(clean.effortLabel, values.effort),
      ...(clean.arms ? [shown(clean.effortArmLabel, values.effortArm), shown(clean.loadArmLabel, values.loadArm)] : []),
    ]
      .filter(Boolean)
      .join(' · ') || 'no values',
  )
  const namesSummary = $derived([shown(clean.effortName), shown(clean.loadName), shown(clean.fulcrumName)].filter(Boolean).join(' · ') || 'none')
  const textSummary = $derived(
    [clean.titleMode === 'text' && clean.title ? `“${clean.title}”` : 'No title', clean.answerKey ? 'answer key' : 'no answer key'].join(', '),
  )
  const figureSummary = $derived([clean.mirror ? 'mirrored' : '', clean.color ? 'color' : 'black and white'].filter(Boolean).join(' · '))
</script>

<GeneratorPage name="Lever Generator" filename="lever" {gen} {svg} bind:labelSize={s.labelSize}>
  {#snippet settings()}
    <Section title="Lever" icon={Scale} summary={leverSummary}>
      <div class="chips" role="radiogroup" aria-label="Lever class">
        {#each CLASSES as c (c)}
          <button type="button" role="radio" aria-checked={clean.class === c} class="chip" class:on={clean.class === c} onclick={() => setClass(c)}>Class {c}</button>
        {/each}
      </div>
      <p class="note below">{MIDDLE[clean.class]}</p>
      <div class="field-row">
        <label class="field">
          Effort arm
          <input type="number" min="0.1" max="999" step="any" bind:value={s.effortArm} />
        </label>
        <label class="field">
          Load arm
          <input type="number" min="0.1" max="999" step="any" bind:value={s.loadArm} />
        </label>
      </div>
      <div class="field">
        Measured in
        <Choice name="Length unit" options={[['cm', 'cm'], ['m', 'm'], ['in', 'in'], ['ft', 'ft']] as const} bind:value={s.lengthUnit} />
      </div>
      <p class="note">Each arm is the distance from the fulcrum. The beam is drawn to scale.</p>
      {#if swapped}
        <p class="note warning" role="status">
          On a class {clean.class} lever the {clean.class === '2' ? 'effort' : 'load'} is farther from the fulcrum, so the two arms are drawn the other way
          round: effort arm {values.effortArm}, load arm {values.loadArm}.
        </p>
      {:else if sameArms}
        <p class="note warning" role="status">
          With equal arms the load and the effort would be at the same place, so they are drawn apart, not to scale.
        </p>
      {:else if !arms.toScale}
        <p class="note warning" role="status">
          {clean.class === '1' ? 'The shorter arm is' : 'The two arms are'} drawn {clean.class === '1' ? 'longer than to scale' : 'further apart than to scale'}, so
          its label and dimension line fit.
        </p>
      {/if}
    </Section>

    <Section title="Load" icon={Weight} summary={loadSummary}>
      <div class="head-row">
        <span class="field-name">Load</span>
        <HelpTip id="lever-effort-tip" label="How the effort is worked out">
          The lever is ideal: it balances, and the beam has no weight. So the effort is the load’s weight × the load arm ÷ the effort arm. A load in kg or g
          weighs its mass × {G} N/kg.
        </HelpTip>
      </div>
      <div class="field-row">
        <label class="field">
          <span class="visually-hidden">Load</span>
          <input type="number" min="0.1" max="9999" step="any" bind:value={s.load} />
        </label>
        <div class="field">
          <Choice name="Load unit" options={[['N', 'N'], ['lb', 'lb'], ['kg', 'kg'], ['g', 'g']] as const} bind:value={s.loadUnit} />
        </div>
      </div>
      <p class="note effort" role="status">
        {#if sums.mass}{values.load} weighs {exact(sums.weight)} N.{/if}
        Effort: <strong>{values.effort}</strong>{comesOutEven(sums.effort) ? '' : ', rounded to 3 significant figures'}. Mechanical advantage:
        <strong>{sig3(sums.advantage)}</strong>{comesOutEven(sums.advantage) ? '' : ' (rounded)'}.
      </p>
      {#if sums.mass}
        <p class="note">A load in {clean.loadUnit} is a mass, so it is drawn as a block.</p>
      {:else}
        <div class="field">
          Drawn as
          <Choice name="Load drawn as" options={[['block', 'Block'], ['arrow', 'Force arrow']] as const} bind:value={s.loadShown} />
        </div>
      {/if}
    </Section>

    <Section title="Values" icon={Tag} summary={labelsSummary}>
      <p class="note">Leave a label empty to show its value. Type ? or a symbol, or pick a blank line, for the one students are to find.</p>
      <div class="field">Load <LabelField name="Load label" bind:label={s.loadLabel} placeholder={values.load} /></div>
      <div class="field">Effort <LabelField name="Effort label" bind:label={s.effortLabel} placeholder={values.effort} /></div>
      <label class="check"><input type="checkbox" bind:checked={s.arms} /> Mark the two arms</label>
      {#if clean.arms}
        <div class="field">Effort arm <LabelField name="Effort arm label" bind:label={s.effortArmLabel} placeholder={values.effortArm} /></div>
        <div class="field">Load arm <LabelField name="Load arm label" bind:label={s.loadArmLabel} placeholder={values.loadArm} /></div>
      {:else}
        <p class="note">No distances are drawn, for “which class is this?” questions.</p>
      {/if}
    </Section>

    <Section title="Names" icon={Type} summary={namesSummary}>
      <div class="field">Effort <LabelField name="Effort name" bind:label={s.effortName} placeholder="Effort" /></div>
      <div class="field">Load <LabelField name="Load name" bind:label={s.loadName} placeholder="Load" /></div>
      <div class="field">Fulcrum <LabelField name="Fulcrum name" bind:label={s.fulcrumName} placeholder="Fulcrum" /></div>
    </Section>

    <Section title="Title and answer key" icon={Type} summary={textSummary}>
      <FigureTextSettings bind:titleMode={s.titleMode} bind:title={s.title} bind:answerKey={s.answerKey} answer={answerLines(clean).join(' · ')} />
    </Section>

    <Section title="Figure" icon={SlidersHorizontal} summary={figureSummary}>
      <label class="check"><input type="checkbox" bind:checked={s.mirror} /> Mirror (flip left to right)</label>
      <label class="check"><input type="checkbox" bind:checked={s.color} /> Color (for slides)</label>
    </Section>
  {/snippet}

  {#snippet figure()}
    <Lever settings={clean} bind:svg />
  {/snippet}
</GeneratorPage>

<style>
  .head-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.45rem; }
  .field-name { font-weight: 600; font-size: 0.88rem; }
  .below { margin-top: 0.6rem; }
  .effort { color: var(--ink); }
  .warning { color: var(--ink); background: #fffbeb; border-left: 3px solid var(--amber); border-radius: 6px; padding: 0.5rem 0.7rem; margin: 0.5rem 0 0; }
</style>
