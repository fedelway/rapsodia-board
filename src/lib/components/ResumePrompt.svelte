<script lang="ts">
  import { PLAYERS, type PlayerId } from '../game/state.svelte'
  import type { SavedGame } from '../game/persistence'

  let {
    save,
    onresume,
    onrestart,
  }: { save: SavedGame; onresume: () => void; onrestart: () => void } = $props()

  const turnEnds = $derived(save.moves.filter((move) => move.action === 'turn-end'))
  const turns = $derived(turnEnds.length)
  const round = $derived(turnEnds[turnEnds.length - 1]?.round ?? 1)
  const player = $derived(
    PLAYERS[((save.state.chordStartPlayer + save.state.roleIndex) % 4) as PlayerId],
  )
  const phase = $derived(save.state.phase === 'melody' ? 'melodía' : 'armonía')
  const when = $derived.by(() => {
    const date = new Date(save.createdAt)
    if (Number.isNaN(date.getTime())) return 'fecha desconocida'
    return date.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
  })

  let resumeButton = $state<HTMLButtonElement>()

  $effect(() => {
    resumeButton?.focus()
  })
</script>

<section class="resume">
  <p class="kicker">Sesión anterior</p>
  <h1>Partida guardada</h1>
  <p class="lead">Creada el {when} · retomala tal como la dejaste.</p>

  <dl class="summary">
    <div>
      <dt>Ronda</dt>
      <dd>{round}</dd>
    </div>
    <div>
      <dt>Turno</dt>
      <dd>{player?.name} · {phase}</dd>
    </div>
    <div>
      <dt>Turnos jugados</dt>
      <dd>{turns}</dd>
    </div>
  </dl>

  <div class="actions">
    <button
      bind:this={resumeButton}
      type="button"
      class="primary"
      onclick={onresume}>Retomar partida</button>
    <button type="button" class="ghost" onclick={onrestart}>Empezar de nuevo</button>
  </div>
  <p class="note">El guardado vive en este navegador y se actualiza solo.</p>
</section>

<style>
  .resume {
    max-width: 640px;
    margin: 8vh auto 0;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 18px;
    padding: 28px 24px 24px;
    text-align: left;
  }

  .kicker {
    margin: 0;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    font-size: 0.72rem;
    opacity: 0.7;
  }

  h1 {
    margin: 8px 0 12px;
    font-size: 1.85rem;
  }

  .lead {
    margin: 0 0 20px;
    opacity: 0.9;
  }

  .summary {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
    margin: 0 0 8px;
  }

  .summary div {
    padding: 12px 14px;
    background: #2a2833;
    border: 1px solid var(--border);
    border-radius: 12px;
  }

  dt {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    opacity: 0.65;
  }

  dd {
    margin: 6px 0 0;
    font-weight: 650;
    font-size: 1.02rem;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 22px;
  }

  button {
    font: inherit;
    font-weight: 650;
    border-radius: 10px;
    padding: 12px 18px;
    cursor: pointer;
  }

  .primary {
    flex: 1 1 220px;
    border: none;
    background: #efe7d8;
    color: #1a1612;
  }

  .ghost {
    flex: 1 1 180px;
    background: transparent;
    color: var(--text-h);
    border: 1px solid color-mix(in srgb, var(--text-h) 35%, transparent);
  }

  .ghost:hover {
    background: color-mix(in srgb, var(--text-h) 10%, transparent);
  }

  .note {
    margin: 16px 0 0;
    font-size: 0.82rem;
    opacity: 0.6;
  }
</style>
