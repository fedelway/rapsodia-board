import * as Tone from 'tone'
import type { ClosedChord, MelodyNote } from '../game/state.svelte'
import {
  sampleUrlsFor,
  SAMPLE_BASE_URL,
  type HarmonyVoiceId,
  type MelodyVoiceId,
  type SampleInstrumentId,
} from './voices'

const BPM = 120
const SEC_PER_BEAT = 60 / BPM

type CacheEntry = {
  sampler: Tone.Sampler
  refs: number
  ready: Promise<Tone.Sampler>
}

const cache = new Map<SampleInstrumentId, CacheEntry>()

let harmonySampler: Tone.Sampler | null = null
let melodySampler: Tone.Sampler | null = null
let started = false
let harmonyVoiceId: HarmonyVoiceId = 'piano'
let melodyVoiceId: MelodyVoiceId = 'flute'

function midiToNote(midi: number): string {
  return Tone.Frequency(midi, 'midi').toNote()
}

function acquire(id: SampleInstrumentId): Promise<Tone.Sampler> {
  const existing = cache.get(id)
  if (existing) {
    existing.refs += 1
    return existing.ready
  }

  const urls = sampleUrlsFor(id)
  const sampler = new Tone.Sampler({
    urls,
    baseUrl: `${SAMPLE_BASE_URL}${id}/`,
    release: 0.85,
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

export function stopPlayback() {
  harmonySampler?.releaseAll()
  melodySampler?.releaseAll()
}

export type PlayRequest = {
  chords: ClosedChord[]
  inProgress: ClosedChord | null
  melody: MelodyNote[]
  pendingMelody?: MelodyNote | null
}

export async function playComposition(req: PlayRequest) {
  await ensureStarted()
  stopPlayback()
  const now = Tone.now() + 0.05
  const chords: ClosedChord[] = [...req.chords]
  if (req.inProgress && req.inProgress.notes.length > 0) {
    chords.push(req.inProgress)
  }

  let t = now
  for (const chord of chords) {
    const dur = Math.max(chord.durationBeats * SEC_PER_BEAT, 0.2)
    const notes = chord.notes.map((n) => midiToNote(n.midi))
    if (notes.length > 0) {
      harmonySampler!.triggerAttackRelease(notes, dur, t)
    }
    t += dur
  }

  let tm = now
  const melody = [...req.melody]
  if (req.pendingMelody) melody.push(req.pendingMelody)
  for (const note of melody) {
    const dur = Math.max(note.durationBeats * SEC_PER_BEAT, 0.1)
    melodySampler!.triggerAttackRelease(midiToNote(note.midi), dur, tm)
    tm += dur
  }
}
