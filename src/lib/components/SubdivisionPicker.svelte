<script lang="ts">
  import NoteFigure from './NoteFigure.svelte'
  import type { MelodySubdivision } from '../music/subdivisions'

  let {
    options,
    onchoose,
    oncancel,
  }: {
    options: { subdivision: MelodySubdivision; fits: boolean }[]
    onchoose: (id: string) => void
    oncancel: () => void
  } = $props()
</script>

<div class="picker">
  <div class="head">
    <p>Elegí una subdivisión</p>
    <button type="button" class="quiet" onclick={oncancel}>Cerrar</button>
  </div>

  <div class="options">
    {#each options as { subdivision, fits }}
      {@const tuplet = subdivision.parts.find((part) => part.tuplet)?.tuplet}
      <button
        type="button"
        class="option"
        disabled={!fits}
        title={fits ? subdivision.label : `${subdivision.label} · No entra en el compás actual`}
        aria-label="{subdivision.label}{fits ? '' : ', no entra en el compás actual'}"
        onclick={() => onchoose(subdivision.id)}
      >
        <span class="glyphs">
          {#each subdivision.parts as part}
            <NoteFigure kind={part.figure} size={22} />
          {/each}
          {#if tuplet}
            <span class="tuplet" title={tuplet.numNotes === 3 ? 'Tresillo' : 'Dosillo'}>
              {tuplet.numNotes}
            </span>
          {/if}
        </span>
        <span class="text">
          <strong>{subdivision.label}</strong>
          {#if !fits}
            <em>No entra en el compás actual</em>
          {:else if tuplet}
            <em>{tuplet.numNotes === 3 ? 'Tresillo' : 'Dosillo'}</em>
          {/if}
        </span>
      </button>
    {/each}
  </div>
</div>

<style>
  .picker {
    border: 1px solid var(--border);
    border-radius: 12px;
    background: color-mix(in srgb, var(--panel) 82%, #000 18%);
    padding: 12px;
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 10px;
  }

  .head p {
    margin: 0;
    font-size: 0.9rem;
    font-weight: 650;
    color: var(--text-h);
  }

  .options {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 8px;
  }

  .option {
    font: inherit;
    display: flex;
    align-items: center;
    gap: 10px;
    text-align: left;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: #2a2833;
    color: var(--text-h);
    padding: 8px 10px;
    cursor: pointer;
  }

  .option:hover:not(:disabled) {
    border-color: color-mix(in srgb, var(--text-h) 45%, var(--border));
  }

  .option:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .glyphs {
    position: relative;
    display: inline-flex;
    align-items: flex-end;
    gap: 1px;
    min-width: 58px;
  }

  .tuplet {
    position: absolute;
    right: -2px;
    top: -4px;
    font-size: 0.62rem;
    font-weight: 800;
    line-height: 1;
    padding: 1px 3px;
    border-radius: 4px;
    background: color-mix(in srgb, var(--text-h) 18%, transparent);
  }

  .text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .text strong {
    font-size: 0.88rem;
    font-weight: 600;
    line-height: 1.2;
  }

  .text em {
    font-style: normal;
    font-size: 0.75rem;
    opacity: 0.68;
  }

  .quiet {
    font: inherit;
    border: none;
    background: transparent;
    color: inherit;
    opacity: 0.75;
    cursor: pointer;
    padding: 2px 4px;
  }

  .quiet:hover {
    opacity: 1;
  }
</style>
