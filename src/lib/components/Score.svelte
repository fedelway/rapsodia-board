<script lang="ts">
  import { game } from '../game/state.svelte'
  import {
    americanChordSymbol,
    closedChordCaption,
    HARMONY_DURATION_LABELS,
    MELODY_DURATION_LABELS,
  } from '../music/harmony'
  import { scientificOctave } from '../music/pitch'

  const pendingHarmony = $derived(game.pendingHarmonyNote())
  const pendingMelody = $derived(game.selectedMelodyNote)
  const assembled = $derived(game.currentVoicing.length >= 3 ? americanChordSymbol(game.currentVoicing) : '')
</script>

<section class="score">
  <div>
    <h2>Armonía</h2>
    {#if game.closedChords.length === 0 && game.currentVoicing.length === 0 && !pendingHarmony}
      <p class="empty">Todavía no hay acordes.</p>
    {:else}
      <ol>
        {#each game.closedChords as chord, i}
          <li>
            <span class="idx">{i + 1}.</span>
            {closedChordCaption(chord.notes)}
            <em>{HARMONY_DURATION_LABELS[chord.durationKey]}</em>
          </li>
        {/each}
        {#if assembled}
          <li class="open">
            <span class="idx">●</span>
            {assembled}
          </li>
        {/if}
        {#if game.currentVoicing.length > 0 || pendingHarmony}
          <li class="open">
            <span class="idx">…</span>
            {game.currentVoicing.map((n) => n.label).join(' · ') || '—'}
            {#if pendingHarmony}
              <span class="preview"> + {pendingHarmony.label}</span>
            {/if}
            <em>en construcción</em>
          </li>
        {/if}
      </ol>
    {/if}
  </div>
  <div>
    <h2>Melodía</h2>
    {#if game.melody.length === 0 && !pendingMelody}
      <p class="empty">Todavía no hay notas de melodía.</p>
    {:else}
      <ol>
        {#each game.melody as note, i}
          <li>
            <span class="idx">{i + 1}.</span>
            {note.label}{scientificOctave(note.midi)}
            <em>{MELODY_DURATION_LABELS[note.durationKey]}</em>
          </li>
        {/each}
        {#if pendingMelody}
          <li class="preview">
            <span class="idx">+</span>
            {pendingMelody.label}{scientificOctave(pendingMelody.midi)}
            <em>{MELODY_DURATION_LABELS[pendingMelody.durationKey]} · prueba</em>
          </li>
        {/if}
      </ol>
    {/if}
  </div>
</section>

<style>
  .score {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    text-align: left;
  }

  h2 {
    font-size: 1.05rem;
    margin: 0 0 8px;
  }

  ol {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 0.95rem;
  }

  .idx {
    display: inline-block;
    min-width: 1.6em;
    opacity: 0.6;
  }

  em {
    font-style: normal;
    opacity: 0.7;
    margin-left: 8px;
    font-size: 0.85rem;
  }

  .open {
    color: var(--text-h);
  }

  .preview {
    color: #e67e22;
  }

  .empty {
    opacity: 0.65;
    font-size: 0.92rem;
  }

  @media (max-width: 720px) {
    .score {
      grid-template-columns: 1fr;
    }
  }
</style>
