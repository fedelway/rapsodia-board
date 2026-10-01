<script lang="ts">
  import NoteBoard from './lib/components/NoteBoard.svelte'
  import NoteFigure from './lib/components/NoteFigure.svelte'
  import Score from './lib/components/Score.svelte'
  import StaffScore from './lib/components/StaffScore.svelte'
  import SetupScreen from './lib/components/SetupScreen.svelte'
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
      pendingMelody: game.selectedMelodyNote ?? null,
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
              aria-label={MELODY_DURATION_LABELS[key]}
              title={MELODY_DURATION_LABELS[key]}
              onclick={() => (game.melodyDuration = key)}
            >
              <NoteFigure kind={key} size={26} />
            </button>
          {/each}
        </div>
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
      {:else}
        Podés elegir octava y duración, agregar una o varias notas de melodía, o pasar a componer la armonía.
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
        <button
          type="button"
          class="primary"
          disabled={!game.canConfirmMelody()}
          onclick={() => game.confirmMelody()}
        >
          Confirmar nota de melodía
        </button>
        <button type="button" class="primary ghost" onclick={() => game.passToHarmony()}>
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
        disabled={!game.selectedMelodyNote}
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
