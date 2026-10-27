<script lang="ts">
  import NoteBoard from './lib/components/NoteBoard.svelte'
  import NoteFigure from './lib/components/NoteFigure.svelte'
  import Score from './lib/components/Score.svelte'
  import StaffScore from './lib/components/StaffScore.svelte'
  import SetupScreen from './lib/components/SetupScreen.svelte'
  import SubdivisionPicker from './lib/components/SubdivisionPicker.svelte'
  import { game } from './lib/game/state.svelte'
  import { playComposition, previewHarmony, previewMidi, setHarmonyVoice, setMelodyVoice, stopPlayback, TEMPO_MAX, TEMPO_MIN } from './lib/audio/engine'
  import {
    HARMONY_VOICE_OPTIONS,
    MELODY_VOICE_OPTIONS,
    type HarmonyVoiceId,
    type MelodyVoiceId,
  } from './lib/audio/voices'
  import {
    HARMONY_DURATION_BEATS,
    HARMONY_DURATION_LABELS,
    MELODY_DURATION_BEATS,
    MELODY_DURATION_LABELS,
    MELODY_OCTAVES,
    ROLE_LABELS,
    type HarmonyDurationKey,
    type MelodyDurationKey,
    type MelodyOctave,
  } from './lib/music/harmony'
  import { playbackOffsets } from './lib/music/meter'

  const harmonyKeys = Object.keys(HARMONY_DURATION_BEATS) as HarmonyDurationKey[]
  const melodyKeys = Object.keys(MELODY_DURATION_BEATS) as MelodyDurationKey[]

  let loadingHarmony = $state(false)
  let loadingMelody = $state(false)
  let showSubdivisions = $state(false)
  let roundModalButton = $state<HTMLButtonElement>()

  $effect(() => {
    if (game.phase !== 'melody' || game.activeSubdivision) showSubdivisions = false
  })

  $effect(() => {
    if (!game.roundNotice) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    roundModalButton?.focus()
    return () => {
      document.body.style.overflow = previousOverflow
    }
  })

  function chooseDuration(key: MelodyDurationKey) {
    if (game.activeSubdivision) return
    game.melodyDuration = key
    showSubdivisions = false
  }

  function startSubdivision(id: string) {
    if (game.startSubdivision(id)) showSubdivisions = false
  }

  function passToHarmony() {
    showSubdivisions = false
    game.passToHarmony()
  }

  async function onHarmonyVoice(event: Event) {
    const id = (event.currentTarget as HTMLSelectElement).value as HarmonyVoiceId
    game.harmonyVoice = id
    loadingHarmony = true
    try {
      await setHarmonyVoice(id)
      if (game.selectedHarmonyOption) {
        await previewHarmony(game.harmonyPreviewMidis())
      }
    } finally {
      loadingHarmony = false
    }
  }

  async function onMelodyVoice(event: Event) {
    const id = (event.currentTarget as HTMLSelectElement).value as MelodyVoiceId
    game.melodyVoice = id
    loadingMelody = true
    try {
      await setMelodyVoice(id)
      if (game.selectedMelodyNote) {
        await previewMidi(game.selectedMelodyNote.midi, true)
      }
    } finally {
      loadingMelody = false
    }
  }

  async function setMelodyOctave(octave: MelodyOctave) {
    game.melodyOctave = octave
    if (game.selectedMelodyNote) {
      await previewMidi(game.selectedMelodyNote.midi, true)
    }
  }

  async function listenPiece() {
    const offsets = playbackOffsets(game.opening)
    await playComposition({
      chords: game.closedChords,
      inProgress: game.inProgressChordForPreview(),
      melody: game.melody,
      bpm: game.tempoBpm,
      melodyOffsetBeats: offsets.melody,
      harmonyOffsetBeats: offsets.harmony,
    })
  }

  async function listenWithPendingMelody() {
    const offsets = playbackOffsets(game.opening)
    await playComposition({
      chords: game.closedChords,
      inProgress: game.inProgressChordForPreview(),
      melody: game.melody,
      pendingMelody: game.pendingMelodyNotes,
      bpm: game.tempoBpm,
      melodyOffsetBeats: offsets.melody,
      harmonyOffsetBeats: offsets.harmony,
    })
  }
</script>

{#if !game.started}
  <SetupScreen />
{:else}
<main>
  <header>
    <div>
      <p class="kicker">Juego de mesa</p>
      <h1>Rapsodia</h1>
    </div>
    <div
      class="turn"
      style="--player: {game.currentPlayer.color}; --ink: {game.currentPlayer.ink}"
    >
      <div class="round" aria-label="Ronda {game.roundNumber}">
        <span>Ronda</span>
        <strong>{game.roundNumber}</strong>
      </div>
      <div class="round meter-badge" aria-label="Compás {game.meterId}">
        <span>Compás</span>
        <strong>{game.meterId}</strong>
      </div>
      <span class="dot"></span>
      <div>
        <strong>{game.currentPlayer.name}</strong>
        <p>
          {game.phase === 'melody' ? 'Melodía' : 'Armonía'}
          · rol {ROLE_LABELS[game.role]}
        </p>
      </div>
    </div>
  </header>

  {#if game.roundNotice}
    <div class="round-modal-backdrop">
      <div class="round-modal" role="dialog" aria-modal="true" aria-labelledby="round-notice">
        <p class="kicker">Fin de ronda</p>
        <h2 id="round-notice">Antes de finalizar la ronda no olvides mover al director</h2>
        <button
          bind:this={roundModalButton}
          type="button"
          class="primary"
          onclick={() => game.dismissRoundNotice()}
        >
          Listo
        </button>
      </div>
    </div>
  {/if}

  <NoteBoard playerColor={game.currentPlayer.color} playerInk={game.currentPlayer.ink} />

  <section class="controls">
    <div class="row voices">
      <div class="group">
        <p>Sonido de melodía</p>
        <select class="combo" value={game.melodyVoice} disabled={loadingMelody} onchange={onMelodyVoice}>
          {#each MELODY_VOICE_OPTIONS as voice}
            <option value={voice.id}>{voice.label}</option>
          {/each}
        </select>
        {#if loadingMelody}
          <span class="hint">Cargando samples…</span>
        {/if}
      </div>
      <div class="group">
        <p>Sonido de armonía</p>
        <select class="combo" value={game.harmonyVoice} disabled={loadingHarmony} onchange={onHarmonyVoice}>
          {#each HARMONY_VOICE_OPTIONS as voice}
            <option value={voice.id}>{voice.label}</option>
          {/each}
        </select>
        {#if loadingHarmony}
          <span class="hint">Cargando samples…</span>
        {/if}
      </div>
    </div>
    <p class="hint">Samples: <a href="https://github.com/nbrosowsky/tonejs-instruments" target="_blank" rel="noreferrer">tonejs-instruments</a> (CC BY 3.0)</p>
    {#if game.phase === 'harmony' && game.role === 'seventh'}
      <div class="group">
        <p>Acorde</p>
        <div class="row">
          <button
            type="button"
            class:active={game.leaveChord}
            onclick={() => game.chooseLeaveChord()}
          >
            Dejar el acorde
          </button>
          {#each game.legalOptions as opt}
            <span class="hint">{opt.label}</span>
          {/each}
        </div>
      </div>
      <div class="group">
        <p>Duración de la armonía</p>
        <div class="row">
          {#each harmonyKeys as key}
            <button
              type="button"
              class:active={game.harmonyDuration === key}
              onclick={() => (game.harmonyDuration = key)}
            >
              {HARMONY_DURATION_LABELS[key]}
            </button>
          {/each}
        </div>
      </div>
    {/if}

    {#if game.phase === 'melody'}
      <div class="group">
        <p>Octava</p>
        <div class="row">
          {#each MELODY_OCTAVES as octave}
            <button
              type="button"
              class:active={game.melodyOctave === octave}
              onclick={() => setMelodyOctave(octave)}
            >
              8va {octave}
            </button>
          {/each}
        </div>
      </div>
      <div class="group">
        <p>Duración de la melodía</p>
        <div class="row">
          {#each melodyKeys as key}
            <button
              type="button"
              class="duration-pick"
              class:active={game.melodyDuration === key}
              disabled={!!game.activeSubdivision}
              aria-label={MELODY_DURATION_LABELS[key]}
              title={MELODY_DURATION_LABELS[key]}
              onclick={() => chooseDuration(key)}
            >
              <NoteFigure kind={key} size={26} />
            </button>
          {/each}
        </div>
      </div>
      <div class="group">
        <p>Subdivisión</p>
        {#if game.activeSubdivision}
          <div class="subdivision">
            <div class="row subdivision-head">
              <strong>{game.activeSubdivision.label}</strong>
              <span class="hint">
                {#if game.subdivisionComplete}
                  {game.subdivisionTotalParts} de {game.subdivisionTotalParts} notas
                {:else}
                  Nota {game.subdivisionEnteredCount + 1} de {game.subdivisionTotalParts}
                {/if}
              </span>
              <button type="button" class="quiet" onclick={() => game.cancelSubdivision()}>
                Cancelar subdivisión
              </button>
            </div>
            {#if game.subdivisionNotes.length > 0}
              <div class="row pending-slots">
                {#each game.subdivisionNotes as note, i}
                  <span class="slot">
                    <span class="slot-index">{i + 1}</span>
                    {note.label}
                    <NoteFigure kind={note.figure} size={16} />
                  </span>
                {/each}
              </div>
            {/if}
            {#if !game.subdivisionComplete}
              <p class="hint">Cargá todas las notas antes de confirmar la subdivisión.</p>
            {/if}
          </div>
        {:else if showSubdivisions}
          <SubdivisionPicker
            options={game.availableSubdivisions}
            onchoose={startSubdivision}
            oncancel={() => (showSubdivisions = false)}
          />
        {:else}
          <div class="row">
            <button
              type="button"
              disabled={game.availableSubdivisions.length === 0}
              title={game.availableSubdivisions.length === 0
                ? 'Esta figura no admite subdivisiones'
                : 'Ver las subdivisiones disponibles'}
              onclick={() => (showSubdivisions = true)}
            >
              Iniciar subdivisión
            </button>
            {#if game.availableSubdivisions.length === 0}
              <span class="hint">Esta figura no admite subdivisiones.</span>
            {/if}
          </div>
        {/if}
      </div>
    {/if}

    <p class="help">
      {#if game.phase === 'harmony' && game.role === 'root'}
        Elegí cualquier nota, escuchala y confirmá la armonía.
      {:else if game.phase === 'harmony' && game.role === 'third'}
        Elegí una tercera mayor o menor (arriba o abajo) de la primera nota.
      {:else if game.phase === 'harmony' && game.role === 'extremes'}
        Elegí una tercera hacia afuera desde el grave o el agudo del acorde.
      {:else if game.phase === 'harmony' && game.role === 'seventh'}
        Podés agregar una 7ma menor o mayor, otra tónica una tercera abajo (nuevo bajo), o dejar el acorde, y definir la duración.
      {:else if game.activeSubdivision}
        {#if game.subdivisionComplete}
          Revisá la subdivisión, escuchala si querés y confirmala para poder avanzar.
        {:else}
          Cargá las {game.subdivisionTotalParts} notas de la subdivisión antes de avanzar.
        {/if}
      {:else}
        Podés elegir octava y duración, iniciar una subdivisión, agregar una o varias notas de melodía, o pasar a componer la armonía.
      {/if}
    </p>

    <div class="row actions">
      {#if game.phase === 'harmony'}
        <button
          type="button"
          class="primary"
          disabled={!game.canConfirmHarmony()}
          onclick={() => game.confirmHarmony()}
        >
          Confirmar armonía / terminar turno
        </button>
      {:else}
        {#if game.activeSubdivision && game.subdivisionComplete}
          <button type="button" class="primary" onclick={() => game.confirmSubdivision()}>
            Confirmar subdivisión
          </button>
        {:else if game.activeSubdivision}
          <button
            type="button"
            class="primary"
            disabled={!game.canConfirmMelody()}
            onclick={() => game.confirmMelody()}
          >
            Agregar nota {game.subdivisionEnteredCount + 1} de {game.subdivisionTotalParts}
          </button>
        {:else}
          <button
            type="button"
            class="primary"
            disabled={!game.canConfirmMelody()}
            onclick={() => game.confirmMelody()}
          >
            Confirmar nota de melodía
          </button>
        {/if}
        <button
          type="button"
          class="primary ghost"
          disabled={!!game.activeSubdivision}
          onclick={passToHarmony}
        >
          Pasar a armonía
        </button>
      {/if}
      <button
        type="button"
        class="quiet"
        disabled={!game.canUndoMelody()}
        onclick={() => game.undoMelody()}
      >
        Deshacer nota
      </button>
      <button
        type="button"
        class="quiet"
        disabled={!game.canUndoHarmony()}
        onclick={() => game.undoHarmony()}
      >
        Deshacer armonía
      </button>
    </div>

    <div class="row actions playback">
      <div class="group tempo">
        <p>Tempo</p>
        <div class="row tempo-row">
          <input
            type="range"
            min={TEMPO_MIN}
            max={TEMPO_MAX}
            step="1"
            value={game.tempoBpm}
            aria-valuemin={TEMPO_MIN}
            aria-valuemax={TEMPO_MAX}
            aria-valuenow={game.tempoBpm}
            aria-label="Tempo en negras por minuto"
            oninput={(e) => {
              game.tempoBpm = Number((e.currentTarget as HTMLInputElement).value)
            }}
          />
          <span class="tempo-value">{game.tempoBpm} BPM</span>
        </div>
      </div>
      <button type="button" onclick={listenPiece}>Escuchar composición</button>
      <button
        type="button"
        disabled={game.pendingMelodyNotes.length === 0}
        onclick={listenWithPendingMelody}
      >
        Escuchar con melodía pendiente
      </button>
      <button type="button" class="quiet" onclick={stopPlayback}>Detener</button>
    </div>
  </section>

  <Score />
  <StaffScore />
</main>
{/if}
