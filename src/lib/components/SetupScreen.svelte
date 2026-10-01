<script lang="ts">
  import { game, PLAYERS, turnOrderFrom, type PlayerId } from '../game/state.svelte'
  import {
    METERS,
    OPENINGS,
    meterById,
    openingById,
    openingFitsMeter,
    type MeterId,
    type OpeningId,
  } from '../music/meter'
  import NoteFigure from './NoteFigure.svelte'

  let chosen = $state<PlayerId>(0)
  let meterId = $state<MeterId>('4/4')
  let openingId = $state<OpeningId>('tetic')
  const preview = $derived(turnOrderFrom(chosen))
  const meter = $derived(meterById(meterId))
  const anacrusis = $derived(OPENINGS.filter((opening) => opening.kind === 'anacrusis'))
  const acephalous = $derived(OPENINGS.filter((opening) => opening.kind === 'acephalous'))

  function chooseMeter(id: MeterId) {
    meterId = id
    if (!openingFitsMeter(meterById(id), openingById(openingId))) openingId = 'tetic'
  }
</script>

<section class="setup">
  <p class="kicker">Antes de empezar</p>
  <h1>Condiciones iniciales</h1>
  <p class="lead">
    El ciclo de la ronda es siempre <strong>azul → verde → rojo → amarillo</strong>.
    Elegí quién abre la partida; el resto sigue ese círculo.
  </p>

  <p class="label">¿Qué color empieza?</p>
  <div class="colors">
    {#each PLAYERS as player}
      <button
        type="button"
        class="color"
        class:active={chosen === player.id}
        style="--player: {player.color}; --ink: {player.ink}"
        onclick={() => (chosen = player.id)}
      >
        {player.name}
      </button>
    {/each}
  </div>

  <p class="label">Orden de esta ronda</p>
  <ol class="order">
    {#each preview as player, i}
      <li style="--player: {player.color}; --ink: {player.ink}">
        <span class="n">{i + 1}</span>
        {player.name}
      </li>
    {/each}
  </ol>

  <p class="label">Tipo de compás</p>
  <div class="chips">
    {#each METERS as item}
      <button
        type="button"
        class="chip"
        class:active={meterId === item.id}
        onclick={() => chooseMeter(item.id)}
      >
        {item.id}
      </button>
    {/each}
  </div>

  <p class="label">Tipo de comienzo</p>
  <div class="chips">
    <button
      type="button"
      class="chip wide"
      class:active={openingId === 'tetic'}
      onclick={() => (openingId = 'tetic')}
    >
      Comienzo tético
    </button>
  </div>
  <p class="sub">Anacrúsico</p>
  <div class="chips">
    {#each anacrusis as item}
      {@const fits = openingFitsMeter(meter, item)}
      <button
        type="button"
        class="chip figure"
        class:active={openingId === item.id}
        disabled={!fits}
        title={item.label}
        aria-label={item.label}
        onclick={() => (openingId = item.id)}
      >
        <NoteFigure kind={item.figure!} size={22} />
      </button>
    {/each}
  </div>
  <p class="sub">Acéfalo (silencio)</p>
  <div class="chips">
    {#each acephalous as item}
      {@const fits = openingFitsMeter(meter, item)}
      <button
        type="button"
        class="chip figure"
        class:active={openingId === item.id}
        disabled={!fits}
        title={item.label}
        aria-label={item.label}
        onclick={() => (openingId = item.id)}
      >
        <NoteFigure kind={item.figure!} size={22} asRest />
      </button>
    {/each}
  </div>

  <button type="button" class="primary" onclick={() => game.startGame(chosen, meterId, openingId)}>
    Empezar partida
  </button>
</section>

<style>
  .setup {
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
    margin: 0 0 22px;
    opacity: 0.9;
  }

  .label {
    margin: 0 0 10px;
    font-size: 0.82rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    opacity: 0.7;
  }

  .sub {
    margin: 12px 0 8px;
    font-size: 0.78rem;
    opacity: 0.65;
  }

  .colors {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-bottom: 22px;
  }

  .color {
    font: inherit;
    font-weight: 650;
    border: 2px solid transparent;
    border-radius: 12px;
    padding: 14px 12px;
    background: var(--player);
    color: var(--ink);
    cursor: pointer;
  }

  .color.active {
    outline: 3px solid var(--text-h);
    outline-offset: 2px;
  }

  .order {
    list-style: none;
    margin: 0 0 24px;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .order li {
    display: flex;
    align-items: center;
    gap: 10px;
    background: color-mix(in srgb, var(--player) 88%, #000 12%);
    color: var(--ink);
    border-radius: 10px;
    padding: 8px 12px;
    font-weight: 650;
  }

  .n {
    opacity: 0.75;
    min-width: 1.2em;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 4px;
  }

  .chip {
    font: inherit;
    border: 1px solid var(--border);
    background: #2a2833;
    color: var(--text-h);
    border-radius: 10px;
    padding: 8px 12px;
    cursor: pointer;
  }

  .chip.wide {
    font-weight: 650;
  }

  .chip.figure {
    min-width: 52px;
    min-height: 52px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 4px 8px;
  }

  .chip.active {
    background: #efe7d8;
    color: #1a1612;
    border-color: #efe7d8;
  }

  .chip:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .primary {
    font: inherit;
    font-weight: 650;
    width: 100%;
    border: none;
    border-radius: 10px;
    padding: 12px 16px;
    margin-top: 18px;
    background: #efe7d8;
    color: #1a1612;
    cursor: pointer;
  }
</style>
