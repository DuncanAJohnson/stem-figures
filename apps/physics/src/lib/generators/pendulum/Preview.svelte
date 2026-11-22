<script lang="ts">
  // The Pendulum Generator's picture on the directory: its default figure,
  // the Swing with its path, angle, length and height, drawn by the same code
  // the generator uses.
  import Pendulum from './Pendulum.svelte'
  import { pendulumSettings } from './settings'
</script>

<Pendulum settings={pendulumSettings.defaults} />
