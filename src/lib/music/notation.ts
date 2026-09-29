import type { ClosedChord, MelodyNote } from '../game/state.svelte'
import { americanChordSymbol, closedChordCaption, type VoicedNote } from './harmony'

const BEATS_PER_BAR = 4
const UNITS = [4, 2, 1, 0.5] as const
const PREVIEW_STYLE = { fillStyle: '#d35400', strokeStyle: '#d35400' }

export type ScoreEvent = {
  keys: string[]
  beats: number
  rest?: boolean
  preview?: boolean
  previewIndex?: number
  symbol?: string
}

function largestFit(beats: number): number {
  for (const unit of UNITS) {
    if (unit <= beats + 1e-9) return unit
  }
  return 0.5
}

function vexDuration(beats: number): string {
  if (beats >= 4) return 'w'
  if (beats >= 2) return 'h'
  if (beats >= 1) return 'q'
  return '8'
}

export function vexPitch(midi: number, label: string): string {
  const octave = Math.floor(midi / 12) - 1
  const letter = label.match(/[A-G]/i)?.[0]?.toUpperCase()
  if (!letter) {
    const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    return `${names[midi % 12]}${octave}`
  }
  let acc = ''
  if (/[♯#]/.test(label)) acc = '#'
  else if (/[♭]/.test(label) || /[A-G]b/.test(label)) acc = 'b'
  return `${letter}${acc}${octave}`
}

function eventSum(events: ScoreEvent[]): number {
  return events.reduce((sum, event) => sum + event.beats, 0)
}

function padWithRests(events: ScoreEvent[], totalBeats: number): ScoreEvent[] {
  const sum = eventSum(events)
  if (sum >= totalBeats - 1e-9) return events
  return [...events, { keys: ['B4'], beats: totalBeats - sum, rest: true }]
}

function copyMeta(event: ScoreEvent, beats: number): ScoreEvent {
  return {
    keys: event.keys,
    beats,
    rest: event.rest,
    preview: event.preview,
    previewIndex: event.previewIndex,
    symbol: event.symbol,
  }
}

export function toMeasures(events: ScoreEvent[]): ScoreEvent[][] {
  const measures: ScoreEvent[][] = [[]]
  let used = 0

  const push = (event: ScoreEvent) => {
    const last = measures[measures.length - 1]!
    last.push(event)
    used += event.beats
    if (used >= BEATS_PER_BAR - 1e-9) {
      measures.push([])
      used = 0
    }
  }

  for (const event of events) {
    let remaining = event.beats
    while (remaining > 1e-6) {
      const room = BEATS_PER_BAR - used
      if (room <= 1e-6) {
        measures.push([])
        used = 0
        continue
      }
      const chunk = largestFit(Math.min(remaining, room))
      push(copyMeta(event, chunk))
      remaining -= chunk
    }
  }

  if (used > 1e-6) {
    let rest = BEATS_PER_BAR - used
    while (rest > 1e-6) {
      const chunk = largestFit(rest)
      push({ keys: ['B4'], beats: chunk, rest: true })
      rest -= chunk
    }
  }

  if (measures[measures.length - 1]?.length === 0) measures.pop()
  if (measures.length === 0) {
    return [[{ keys: ['B4'], beats: 4, rest: true }]]
  }
  return measures
}

function toEasyScore(events: ScoreEvent[]): string {
  return events
    .map((event) => {
      const duration = vexDuration(event.beats)
      if (event.rest) return `B4/${duration}/r`
      if (event.keys.length > 1) return `(${event.keys.join(' ')})/${duration}`
      return `${event.keys[0]}/${duration}`
    })
    .join(', ')
}

function notesToEvent(
  notes: VoicedNote[],
  beats: number,
  withTones: boolean,
): ScoreEvent | null {
  if (notes.length === 0) return null
  return {
    keys: [...notes]
      .sort((a, b) => a.midi - b.midi)
      .map((note) => vexPitch(note.midi, note.label)),
    beats,
    symbol: withTones ? closedChordCaption(notes) : americanChordSymbol(notes),
  }
}

export function chordsToEvents(
  chords: ClosedChord[],
  assembled?: ClosedChord | null,
): ScoreEvent[] {
  const events: ScoreEvent[] = []
  for (const chord of chords) {
    const event = notesToEvent(chord.notes, chord.durationBeats, true)
    if (event) events.push(event)
  }
  if (assembled && assembled.notes.length >= 3) {
    const event = notesToEvent(assembled.notes, assembled.durationBeats, false)
    if (event) events.push(event)
  }
  return events
}

export function melodyToEvents(notes: MelodyNote[], pending?: MelodyNote | null): ScoreEvent[] {
  const events: ScoreEvent[] = notes.map((note) => ({
    keys: [vexPitch(note.midi, note.label)],
    beats: note.durationBeats,
  }))
  if (pending) {
    events.push({
      keys: [vexPitch(pending.midi, pending.label)],
      beats: pending.durationBeats,
      preview: true,
    })
  }
  return events
}

function paintPreview(
  notes: { isRest?: () => boolean; setStyle: (style: typeof PREVIEW_STYLE) => unknown; setKeyStyle?: (index: number, style: typeof PREVIEW_STYLE) => unknown }[],
  events: ScoreEvent[],
) {
  notes.forEach((note, index) => {
    const event = events[index]
    if (!event || event.rest || note.isRest?.()) return
    if (event.preview) {
      note.setStyle(PREVIEW_STYLE)
      return
    }
    if (event.previewIndex !== undefined) {
      note.setKeyStyle?.(event.previewIndex, PREVIEW_STYLE)
    }
  })
}

export async function renderStaff(
  el: HTMLElement,
  input: {
    chords: ClosedChord[]
    assembledHarmony?: ClosedChord | null
    melody: MelodyNote[]
    pendingMelody?: MelodyNote | null
    width: number
  },
  cancelled?: () => boolean,
) {
  const { Factory, BarlineType } = await import('vexflow')
  if (cancelled?.()) return
  const width = Math.max(el.clientWidth || input.width, 560)
  const harmonyEvents = chordsToEvents(input.chords, input.assembledHarmony)
  const melodyEvents = melodyToEvents(input.melody, input.pendingMelody)
  const total = Math.max(eventSum(harmonyEvents), eventSum(melodyEvents), BEATS_PER_BAR)
  const harmonyMeasures = toMeasures(padWithRests(harmonyEvents, total))
  const melodyMeasures = toMeasures(padWithRests(melodyEvents, total))
  const measureCount = Math.max(harmonyMeasures.length, melodyMeasures.length, 1)

  const innerWidth = Math.floor(width) - 24
  const measuresPerLine = innerWidth >= 920 ? 4 : innerWidth >= 700 ? 3 : 2
  const lineCount = Math.ceil(measureCount / measuresPerLine)
  const systemHeight = 118
  const height = 16 + lineCount * systemHeight

  el.replaceChildren()
  if (!el.id) el.id = `rapsodia-staff-${Math.random().toString(36).slice(2, 9)}`

  const vf = new Factory({
    renderer: {
      elementId: el.id,
      width: Math.floor(width),
      height,
      background: '#f4eee3',
    },
  })
  const score = vf.EasyScore()

  for (let i = 0; i < measureCount; i += 1) {
    const col = i % measuresPerLine
    const line = Math.floor(i / measuresPerLine)
    const isLast = i === measureCount - 1
    const colsOnLine = line === lineCount - 1 ? measureCount - line * measuresPerLine : measuresPerLine
    const measureWidth = Math.floor(innerWidth / colsOnLine)
    const system = vf.System({
      x: 12 + col * measureWidth,
      y: 22 + line * systemHeight,
      width: measureWidth,
    })
    const melodyEventsInBar = melodyMeasures[i] ?? [{ keys: ['B4'], beats: 4, rest: true }]
    const harmonyEventsInBar = harmonyMeasures[i] ?? [{ keys: ['B4'], beats: 4, rest: true }]
    const melodyNotes = score.notes(toEasyScore(melodyEventsInBar), { stem: 'up' })
    paintPreview(melodyNotes, melodyEventsInBar)

    const chordText = harmonyEventsInBar.map((event) => {
      const textNote = vf.TextNote({
        text: event.rest || !event.symbol ? '' : event.symbol,
        duration: vexDuration(event.beats),
        font: { family: 'Georgia, Times, serif', size: 14, weight: 'bold' },
      })
      textNote.setLine(-1)
      if (event.preview && event.symbol) {
        textNote.setStyle(PREVIEW_STYLE)
      }
      return textNote
    })

    const stave = system.addStave({
      voices: [score.voice(melodyNotes), vf.Voice().addTickables(chordText)],
    })
    if (col === 0) stave.addClef('treble')
    if (i === 0) stave.addTimeSignature('4/4')
    stave.setMeasure(i + 1)
    stave.setBegBarType(col === 0 ? BarlineType.SINGLE : BarlineType.NONE)
    stave.setEndBarType(isLast ? BarlineType.END : BarlineType.SINGLE)
  }

  vf.draw()
}
