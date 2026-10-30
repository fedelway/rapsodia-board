import { SAMPLE_INSTRUMENTS, type SampleInstrumentId } from '../audio/voices'
import {
  HARMONY_DURATION_BEATS,
  MELODY_DURATION_BEATS,
  MELODY_OCTAVES,
  type HarmonyDurationKey,
  type MelodyDurationKey,
  type MelodyOctave,
  type VoicedNote,
} from '../music/harmony'
import {
  METERS,
  OPENINGS,
  openingById,
  openingFitsMeter,
  type MeterId,
  type OpeningId,
} from '../music/meter'
import {
  MELODY_FIGURE_BEATS,
  subdivisionById,
  type MelodyFigure,
  type TupletSpec,
} from '../music/subdivisions'
import type { ClosedChord, MelodyNote, PlayerId, TurnPhase } from './state.svelte'

export const SAVE_KEY = 'rapsodia.save.v1'
export const BACKUP_KEY = 'rapsodia.save.backup'
export const SAVE_VERSION = 1

/** Estado completo de la partida, sin valores derivados ni selecciones transitorias. */
export type GameSnapshot = {
  started: boolean
  chordStartPlayer: PlayerId
  roleIndex: number
  phase: TurnPhase
  currentVoicing: VoicedNote[]
  closedChords: ClosedChord[]
  melody: MelodyNote[]
  melodyByTurn: number[]
  melodyStartLength: number
  harmonyDuration: HarmonyDurationKey
  melodyDuration: MelodyDurationKey
  melodyOctave: MelodyOctave
  harmonyVoice: SampleInstrumentId
  melodyVoice: SampleInstrumentId
  tempoBpm: number
  meterId: MeterId
  openingId: OpeningId
  lastHarmonyKind: 'add' | 'close' | null
  roundNotice: boolean
  subdivisionSerial: number
  activeSubdivisionId: string | null
  subdivisionNotes: MelodyNote[]
  subdivisionGroupId: string | null
}

export type MoveAction =
  | 'start-game'
  | 'melody-note'
  | 'subdivision-start'
  | 'subdivision-confirm'
  | 'subdivision-cancel'
  | 'harmony-add'
  | 'harmony-close'
  | 'pass-to-harmony'
  | 'undo-melody'
  | 'undo-harmony'
  | 'turn-end'

/** Entrada legible del registro de movimientos. */
export type MoveEntry = {
  at: string
  round: number
  player: string
  action: MoveAction
  detail: string
  note?: string
  figure?: string
  beats?: number
  duration?: string
  chord?: string
  role?: string
}

export type SavedGame = {
  version: number
  createdAt: string
  updatedAt: string
  state: GameSnapshot
  moves: MoveEntry[]
}

const HARMONY_DURATION_KEYS = Object.keys(HARMONY_DURATION_BEATS) as HarmonyDurationKey[]
const MELODY_DURATION_KEYS = Object.keys(MELODY_DURATION_BEATS) as MelodyDurationKey[]
const FIGURE_KEYS = Object.keys(MELODY_FIGURE_BEATS) as MelodyFigure[]
const METER_IDS = METERS.map((meter) => meter.id)
const OPENING_IDS = OPENINGS.map((opening) => opening.id)
const VOICE_IDS = SAMPLE_INSTRUMENTS.map((instrument) => instrument.id)
const ACTIONS: MoveAction[] = [
  'start-game',
  'melody-note',
  'subdivision-start',
  'subdivision-confirm',
  'subdivision-cancel',
  'harmony-add',
  'harmony-close',
  'pass-to-harmony',
  'undo-melody',
  'undo-harmony',
  'turn-end',
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function intInRange(value: unknown, min: number, max: number): number | null {
  const number = finiteNumber(value)
  if (number === null || !Number.isInteger(number)) return null
  return number >= min && number <= max ? number : null
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  if (typeof value !== 'string') return null
  return (allowed as readonly string[]).includes(value) ? (value as T) : null
}

function readArray<T>(value: unknown, readItem: (item: unknown) => T | null): T[] | null {
  if (!Array.isArray(value)) return null
  const items: T[] = []
  for (const item of value) {
    const parsed = readItem(item)
    if (parsed === null) return null
    items.push(parsed)
  }
  return items
}

function readVoicedNote(value: unknown): VoicedNote | null {
  if (!isRecord(value)) return null
  const pc = intInRange(value.pc, 0, 11)
  const midi = intInRange(value.midi, 0, 127)
  const label = typeof value.label === 'string' ? value.label : null
  if (pc === null || midi === null || label === null) return null
  return { pc, midi, label }
}

function readTuplet(value: unknown): TupletSpec | null {
  if (!isRecord(value)) return null
  const numNotes = intInRange(value.numNotes, 2, 12)
  const notesOccupied = intInRange(value.notesOccupied, 1, 12)
  if (numNotes === null || notesOccupied === null) return null
  return { numNotes, notesOccupied }
}

function readMelodyNote(value: unknown): MelodyNote | null {
  if (!isRecord(value)) return null
  const pc = intInRange(value.pc, 0, 11)
  const midi = intInRange(value.midi, 0, 127)
  const durationBeats = finiteNumber(value.durationBeats)
  const durationKey = oneOf(value.durationKey, MELODY_DURATION_KEYS)
  const figure = oneOf(value.figure, FIGURE_KEYS)
  if (
    pc === null ||
    midi === null ||
    durationBeats === null ||
    durationBeats <= 0 ||
    durationKey === null ||
    figure === null
  ) {
    return null
  }
  const label = typeof value.label === 'string' ? value.label : '?'
  const note: MelodyNote = { pc, midi, label, durationBeats, durationKey, figure }
  if (typeof value.groupId === 'string') note.groupId = value.groupId
  if (value.tuplet !== undefined) {
    const tuplet = readTuplet(value.tuplet)
    if (!tuplet) return null
    note.tuplet = tuplet
  }
  return note
}

function readChord(value: unknown): ClosedChord | null {
  if (!isRecord(value)) return null
  const notes = readArray(value.notes, readVoicedNote)
  const triad = readArray(value.triad, readVoicedNote)
  const durationBeats = finiteNumber(value.durationBeats)
  const durationKey = oneOf(value.durationKey, HARMONY_DURATION_KEYS)
  if (
    !notes ||
    !triad ||
    durationBeats === null ||
    durationBeats <= 0 ||
    durationKey === null
  ) {
    return null
  }
  return { notes, triad, durationBeats, durationKey }
}

function readMove(value: unknown): MoveEntry | null {
  if (!isRecord(value)) return null
  const at = typeof value.at === 'string' ? value.at : null
  const round = intInRange(value.round, 0, 9999)
  const player = typeof value.player === 'string' ? value.player : null
  const action = oneOf(value.action, ACTIONS)
  const detail = typeof value.detail === 'string' ? value.detail : null
  if (at === null || round === null || player === null || action === null || detail === null) {
    return null
  }
  const move: MoveEntry = { at, round, player, action, detail }
  if (typeof value.note === 'string') move.note = value.note
  if (typeof value.figure === 'string') move.figure = value.figure
  if (typeof value.duration === 'string') move.duration = value.duration
  if (typeof value.chord === 'string') move.chord = value.chord
  if (typeof value.role === 'string') move.role = value.role
  const beats = finiteNumber(value.beats)
  if (beats !== null) move.beats = beats
  return move
}

function highestSubdivisionId(melody: MelodyNote[]): number {
  return melody.reduce((max, note) => {
    const match = note.groupId?.match(/^subdivision-(\d+)$/)
    if (!match) return max
    return Math.max(max, Number(match[1]) + 1)
  }, 0)
}

export function readSnapshot(value: unknown): GameSnapshot | null {
  if (!isRecord(value) || value.started !== true) return null

  const chordStartPlayer = intInRange(value.chordStartPlayer, 0, 3) as PlayerId | null
  const roleIndex = intInRange(value.roleIndex, 0, 3)
  const phase = oneOf(value.phase, ['harmony', 'melody'] as const)
  const currentVoicing = readArray(value.currentVoicing, readVoicedNote)
  const closedChords = readArray(value.closedChords, readChord)
  const melody = readArray(value.melody, readMelodyNote)
  const melodyByTurn = readArray(value.melodyByTurn, (item) => intInRange(item, 0, 9999))
  const harmonyDuration = oneOf(value.harmonyDuration, HARMONY_DURATION_KEYS)
  const melodyDuration = oneOf(value.melodyDuration, MELODY_DURATION_KEYS)
  const octave = intInRange(value.melodyOctave, 3, 6)
  const melodyOctave =
    octave !== null && (MELODY_OCTAVES as readonly number[]).includes(octave)
      ? (octave as MelodyOctave)
      : null
  const meterId = oneOf(value.meterId, METER_IDS)
  const openingId = oneOf(value.openingId, OPENING_IDS)

  if (
    chordStartPlayer === null ||
    roleIndex === null ||
    phase === null ||
    !currentVoicing ||
    !closedChords ||
    !melody ||
    !melodyByTurn ||
    harmonyDuration === null ||
    melodyDuration === null ||
    melodyOctave === null ||
    meterId === null ||
    openingId === null
  ) {
    return null
  }

  const melodyStartLength = Math.min(
    intInRange(value.melodyStartLength, 0, melody.length) ?? melody.length,
    melody.length,
  )
  const lastHarmonyKind =
    value.lastHarmonyKind === 'add' || value.lastHarmonyKind === 'close'
      ? value.lastHarmonyKind
      : null
  const roundNotice = value.roundNotice === true
  const tempo = finiteNumber(value.tempoBpm)
  const tempoBpm = tempo === null ? 120 : Math.min(200, Math.max(40, Math.round(tempo)))
  const harmonyVoice = oneOf(value.harmonyVoice, VOICE_IDS) ?? 'piano'
  const melodyVoice = oneOf(value.melodyVoice, VOICE_IDS) ?? 'flute'

  const activeSubdivisionId =
    typeof value.activeSubdivisionId === 'string' ? value.activeSubdivisionId : null
  const subdivision = activeSubdivisionId ? subdivisionById(activeSubdivisionId) : undefined
  const keepSubdivision = subdivision !== undefined && subdivision.parent === melodyDuration
  const subdivisionNotes = keepSubdivision
    ? (readArray(value.subdivisionNotes, readMelodyNote) ?? [])
    : []
  const serial = intInRange(value.subdivisionSerial, 0, 999999)
  const subdivisionSerial = serial ?? highestSubdivisionId([...melody, ...subdivisionNotes])
  const subdivisionGroupId = keepSubdivision
    ? typeof value.subdivisionGroupId === 'string'
      ? value.subdivisionGroupId
      : `subdivision-${subdivisionSerial}`
    : null

  const opening = openingById(openingId)

  return {
    started: true,
    chordStartPlayer,
    roleIndex,
    phase,
    currentVoicing,
    closedChords,
    melody,
    melodyByTurn,
    melodyStartLength,
    harmonyDuration,
    melodyDuration,
    melodyOctave,
    harmonyVoice,
    melodyVoice,
    tempoBpm,
    meterId,
    openingId: openingFitsMeter(METERS.find((meter) => meter.id === meterId)!, opening)
      ? openingId
      : 'tetic',
    lastHarmonyKind,
    roundNotice,
    subdivisionSerial,
    activeSubdivisionId: keepSubdivision ? subdivision.id : null,
    subdivisionNotes,
    subdivisionGroupId,
  }
}

export function parseSave(raw: string | null): SavedGame | null {
  if (!raw) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!isRecord(parsed)) return null
  if (parsed.version !== SAVE_VERSION) return null
  const createdAt = typeof parsed.createdAt === 'string' ? parsed.createdAt : null
  const state = readSnapshot(parsed.state)
  const moves = readArray(parsed.moves, readMove)
  if (createdAt === null || !state || !moves) return null
  const updatedAt = typeof parsed.updatedAt === 'string' ? parsed.updatedAt : createdAt
  return { version: SAVE_VERSION, createdAt, updatedAt, state, moves }
}

function hasStorage(): boolean {
  return typeof localStorage !== 'undefined'
}

/** Lee el guardado local. Si está corrupto, lo respalda y lo descarta. */
export function readSave(): SavedGame | null {
  if (!hasStorage()) return null
  let raw: string | null = null
  try {
    raw = localStorage.getItem(SAVE_KEY)
  } catch {
    return null
  }
  if (!raw) return null
  const save = parseSave(raw)
  if (save) return save
  try {
    localStorage.setItem(BACKUP_KEY, raw)
    localStorage.removeItem(SAVE_KEY)
  } catch {
    // Sin espacio o almacenamiento bloqueado: se ignora el guardado.
  }
  return null
}

export function writeSave(save: SavedGame) {
  if (!hasStorage()) return
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save, null, 2))
  } catch {
    // Cuota llena o almacenamiento bloqueado: no interrumpimos la partida.
  }
}

export function clearSave() {
  if (!hasStorage()) return
  try {
    localStorage.removeItem(SAVE_KEY)
  } catch {
    // Nada que borrar.
  }
}
