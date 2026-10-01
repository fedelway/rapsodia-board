<script lang="ts">
  import { game } from '../game/state.svelte'
  import { previewHarmony, previewMidi } from '../audio/engine'
  import {
    ACCIDENTALS,
    ACCIDENTAL_SYMBOL,
    LETTERS,
    type Accidental,
    type Letter,
  } from '../music/pitch'

  let { playerColor, playerInk }: { playerColor: string; playerInk: string } = $props()

  function isSelected(letter: Letter, accidental: Accidental) {
    return game.pick?.letter === letter && game.pick?.accidental === accidental
  }

  async function onPick(letter: Letter, accidental: Accidental) {
    if (!game.isPitchLegal(letter, accidental)) return
    game.selectPitch(letter, accidental)
    if (game.phase === 'melody' && game.selectedMelodyNote) {
      await previewMidi(game.selectedMelodyNote.midi, true)
    } else if (game.phase === 'harmony') {
      await previewHarmony(game.harmonyPreviewMidis())
    }
  }
</script>

<div class="board" style="--player: {playerColor}; --ink: {playerInk}">
  {#each LETTERS as letter}
    <article class="card">
      <div class="accidentals">
        {#each ACCIDENTALS as accidental}
          {@const legal = game.isPitchLegal(letter, accidental)}
          {@const selected = isSelected(letter, accidental)}
          <button
            type="button"
            class="acc"
            class:legal
            class:selected
            disabled={!legal}
            aria-label="{letter} {accidental}"
            onclick={() => onPick(letter, accidental)}
          >
            {ACCIDENTAL_SYMBOL[accidental]}
          </button>
        {/each}
      </div>
      <button
        type="button"
        class="letter"
        class:legal={game.isPitchLegal(letter, 'natural')}
        class:selected={isSelected(letter, 'natural')}
        disabled={!game.isPitchLegal(letter, 'natural')}
        onclick={() => onPick(letter, 'natural')}
      >
        {letter}
      </button>
    </article>
  {/each}
</div>

<style>
  .board {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 12px;
  }

  .card {
    background: color-mix(in srgb, var(--player) 88%, #000 12%);
    border-radius: 16px;
    padding: 10px 8px 12px;
    box-shadow: 0 8px 20px color-mix(in srgb, var(--player) 35%, transparent);
    border: 1px solid color-mix(in srgb, #fff 22%, var(--player));
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-height: 148px;
  }

  .accidentals {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 4px;
  }

  .acc,
  .letter {
    font: inherit;
    cursor: pointer;
    border: 1px solid transparent;
    color: var(--ink);
  }

  .acc {
    border-radius: 8px;
    padding: 6px 0;
    font-size: 1.05rem;
    background: color-mix(in srgb, #fff 18%, transparent);
  }

  .acc:disabled,
  .letter:disabled {
    opacity: 0.28;
    cursor: not-allowed;
  }

  .acc.selected,
  .letter.selected {
    background: #fff;
    color: #111;
    border-color: #fff;
  }

  .letter {
    flex: 1;
    border-radius: 12px;
    font-size: 2rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    background: color-mix(in srgb, #000 18%, var(--player));
  }

  @media (max-width: 720px) {
    .board {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }

    .letter {
      font-size: 1.6rem;
    }
  }
</style>
