import * as Tone from 'tone'
import type { ClosedChord, MelodyNote } from '../game/state.svelte'
import {
  sampleUrlsFor,
  SAMPLE_BASE_URL,
  type HarmonyVoiceId,
  type MelodyVoiceId,
  type SampleInstrumentId,
} from './voices'

const DEFAULT_BPM = 120
export const TEMPO_MIN = 40
export const TEMPO_MAX = 200

function clampBpm(bpm: number) {
  return Math.min(TEMPO_MAX, Math.max(TEMPO_MIN, bpm))
}

type ScheduledSource = {
  stop(time?: unknown): unknown
  onended: () => void
}

/**
 * Sampler que recuerda las fuentes de audio que programa.
 *
 * `triggerAttackRelease` borra la lista interna de Tone en cuanto agenda el
 * release, así que `releaseAll()` no puede cortar las notas futuras. Guardando
 * las fuentes podemos detener todo (lo que suena y lo que está por sonar)
 * al pulsar "Detener" o al volver a pedir la reproducción.
 */
class CancellableSampler extends Tone.Sampler {
  private scheduled = new Set<ScheduledSource>()

  override triggerAttack(
    notes: Parameters<Tone.Sampler['triggerAttack']>[0],
    time?: Parameters<Tone.Sampler['triggerAttack']>[1],
    velocity?: Parameters<Tone.Sampler['triggerAttack']>[2],
  ) {
    super.triggerAttack(notes, time, velocity)
    const internals = this as unknown as {
      _activeSources: Map<number, ScheduledSource[]>
    }
    internals._activeSources.forEach((sources) => {
      sources.forEach((source) => {
        if (this.scheduled.has(source)) return
        this.scheduled.add(source)
        const ended = source.onended
        source.onended = () => {
          this.scheduled.delete(source)
          ended()
        }
      })
    })
    return this
  }

  /** Corta de inmediato todo lo programado, incluidas notas que aún no empezaron. */
  cancel(time?: Tone.Unit.Time) {
    const at = time ?? Tone.now()
    this.scheduled.forEach((source) => {
      try {
        source.stop(at)
      } catch {
        // La fuente ya había terminado.
      }
    })
    this.scheduled.clear()
  }
}

type CacheEntry = {
  sampler: CancellableSampler
  refs: number
  ready: Promise<CancellableSampler>
}

const cache = new Map<SampleInstrumentId, CacheEntry>()

let harmonySampler: CancellableSampler | null = null
let melodySampler: CancellableSampler | null = null
let started = false
let harmonyVoiceId: HarmonyVoiceId = 'piano'
let melodyVoiceId: MelodyVoiceId = 'flute'
/** Identifica la reproducción vigente para descartar pedidos que quedaron atrás. */
let playbackRun = 0

function midiToNote(midi: number): string {
  return Tone.Frequency(midi, 'midi').toNote()
}

function acquire(id: SampleInstrumentId): Promise<CancellableSampler> {
  const existing = cache.get(id)
  if (existing) {
    existing.refs += 1
    return existing.ready
  }

  const urls = sampleUrlsFor(id)
  const sampler = new CancellableSampler({
    urls,
    baseUrl: `${SAMPLE_BASE_URL}${id}/`,
    attack: 0,
    release: 0.08,
    curve: 'linear',
    volume: -6,
  }).toDestination()

  const ready = Tone.loaded().then(() => sampler)
  const entry: CacheEntry = { sampler, refs: 1, ready }
  cache.set(id, entry)
  return ready
}

function release(id: SampleInstrumentId) {
  const entry = cache.get(id)
  if (!entry) return
  entry.refs -= 1
  if (entry.refs > 0) return
  entry.sampler.dispose()
  cache.delete(id)
}

async function ensureStarted() {
  if (!started) {
    await Tone.start()
    started = true
  }
  if (!harmonySampler) harmonySampler = await acquire(harmonyVoiceId)
  if (!melodySampler) {
    melodySampler = await acquire(melodyVoiceId)
  }
}

export async function setHarmonyVoice(id: HarmonyVoiceId) {
  if (id === harmonyVoiceId && harmonySampler) return
  const previous = harmonyVoiceId
  harmonyVoiceId = id
  if (!started) return
  stopPlayback()
  const next = await acquire(id)
  if (previous !== id) release(previous)
  harmonySampler = next
}

export async function setMelodyVoice(id: MelodyVoiceId) {
  if (id === melodyVoiceId && melodySampler) return
  const previous = melodyVoiceId
  melodyVoiceId = id
  if (!started) return
  stopPlayback()
  const next = await acquire(id)
  if (previous !== id) release(previous)
  melodySampler = next
}

export async function previewMidi(midi: number, asMelody = false) {
  await ensureStarted()
  const dur = 0.55
  const time = Tone.now()
  const note = midiToNote(midi)
  if (asMelody) melodySampler!.triggerAttackRelease(note, dur, time)
  else harmonySampler!.triggerAttackRelease(note, dur, time)
}

export async function previewHarmony(midis: number[]) {
  await ensureStarted()
  if (midis.length === 0) return
  harmonySampler!.releaseAll()
  const notes = midis.map(midiToNote)
  const dur = midis.length > 1 ? 0.9 : 0.55
  harmonySampler!.triggerAttackRelease(notes, dur, Tone.now())
}

export function stopPlayback() {
  playbackRun += 1
  silencePlayback()
}

function silencePlayback() {
  harmonySampler?.cancel()
  melodySampler?.cancel()
}

export type PlayRequest = {
  chords: ClosedChord[]
  inProgress: ClosedChord | null
  melody: MelodyNote[]
  pendingMelody?: MelodyNote[] | null
  bpm?: number
  melodyOffsetBeats?: number
  harmonyOffsetBeats?: number
}

export async function playComposition(req: PlayRequest) {
  const run = ++playbackRun
  await ensureStarted()
  // Otra reproducción o "Detener" se pidió mientras cargaban los samples.
  if (run !== playbackRun) return
  silencePlayback()
  if (harmonySampler) {
    harmonySampler.release = 0.08
    harmonySampler.curve = 'linear'
  }
  if (melodySampler) {
    melodySampler.release = 0.08
    melodySampler.curve = 'linear'
  }
  const bpm = clampBpm(req.bpm ?? DEFAULT_BPM)
  Tone.getTransport().bpm.value = bpm
  const quarter = Tone.Time('4n').toSeconds()
  const start = Tone.now() + 0.05
  const chords: ClosedChord[] = [...req.chords]
  if (req.inProgress && req.inProgress.notes.length > 0) {
    chords.push(req.inProgress)
  }

  let t = start + Math.max(0, req.harmonyOffsetBeats ?? 0) * quarter
  for (const chord of chords) {
    const dur = chord.durationBeats * quarter
    const notes = chord.notes.map((n) => midiToNote(n.midi))
    if (notes.length > 0) {
      harmonySampler!.triggerAttackRelease(notes, dur, t)
    }
    t += dur
  }

  let tm = start + Math.max(0, req.melodyOffsetBeats ?? 0) * quarter
  const melody = [...req.melody, ...(req.pendingMelody ?? [])]
  for (const note of melody) {
    const dur = note.durationBeats * quarter
    melodySampler!.triggerAttackRelease(midiToNote(note.midi), dur, tm)
    tm += dur
  }
}
