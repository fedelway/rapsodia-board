import type { ClosedChord, MelodyNote } from '../game/state.svelte'
import { americanChordSymbol, closedChordCaption, type VoicedNote } from './harmony'
import { firstBarBeats, harmonyLeadBeats, melodyLeadBeats, type Meter, type Opening } from './meter'

const UNITS = [6, 4, 3, 2, 1.5, 1, 0.75, 0.5, 0.25] as const
const PREVIEW_STYLE = { fillStyle: '#d35400', strokeStyle: '#d35400' }

export type ScoreEvent = {
  keys: string[]
  beats: number
  rest?: boolean
  preview?: boolean
  previewIndex?: number
  symbol?: string
  tieToNext?: boolean
}

function largestFit(beats: number): number {
  for (const unit of UNITS) {
    if (unit <= beats + 1e-9) return unit
  }
  return 0.25
}

function vexDurationParts(beats: number): { duration: string; dots: number } {
  if (beats >= 6 - 1e-9) return { duration: 'w', dots: 1 }
  if (beats >= 4 - 1e-9) return { duration: 'w', dots: 0 }
  if (beats >= 3 - 1e-9) return { duration: 'h', dots: 1 }
  if (beats >= 2 - 1e-9) return { duration: 'h', dots: 0 }
  if (beats >= 1.5 - 1e-9) return { duration: 'q', dots: 1 }
  if (beats >= 1 - 1e-9) return { duration: 'q', dots: 0 }
  if (beats >= 0.75 - 1e-9) return { duration: '8', dots: 1 }
  if (beats >= 0.5 - 1e-9) return { duration: '8', dots: 0 }
  return { duration: '16', dots: 0 }
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

function copyMeta(event: ScoreEvent, beats: number, opts?: { symbol?: string; tieToNext?: boolean }): ScoreEvent {
  return {
    keys: event.keys,
    beats,
    rest: event.rest,
    preview: event.preview,
    previewIndex: event.previewIndex,
    symbol: opts?.symbol,
    tieToNext: opts?.tieToNext,
  }
}

function barCapacity(index: number, barBeats: number, first: number): number {
  return index === 0 ? first : barBeats
}

export function toMeasures(events: ScoreEvent[], barBeats: number, first: number): ScoreEvent[][] {
  const measures: ScoreEvent[][] = [[]]
  let used = 0
  let index = 0
  const cap = () => barCapacity(index, barBeats, first)

  const push = (event: ScoreEvent) => {
    const last = measures[measures.length - 1]!
    last.push(event)
    used += event.beats
    if (used >= cap() - 1e-9) {
      measures.push([])
      index += 1
      used = 0
    }
  }

  for (const event of events) {
    let remaining = event.beats
    let firstPart = true
    while (remaining > 1e-6) {
      const room = cap() - used
      if (room <= 1e-6) {
        measures.push([])
        index += 1
        used = 0
        continue
      }
      const chunk = largestFit(Math.min(remaining, room))
      remaining -= chunk
      push(
        copyMeta(event, chunk, {
          symbol: firstPart ? event.symbol : undefined,
          tieToNext: !event.rest && remaining > 1e-6,
        }),
      )
      firstPart = false
    }
  }

  if (used > 1e-6) {
    let rest = cap() - used
    while (rest > 1e-6) {
      const chunk = largestFit(rest)
      push({ keys: ['B4'], beats: chunk, rest: true })
      rest -= chunk
    }
  }

  if (measures[measures.length - 1]?.length === 0) measures.pop()
  if (measures.length === 0) {
    return [[{ keys: ['B4'], beats: first, rest: true }]]
  }
  return measures
}

function paddedLength(content: number, barBeats: number, first: number, anacrusis: boolean): number {
  if (anacrusis) {
    const after = Math.max(0, content - first)
    const full = Math.max(1, Math.ceil(after / barBeats - 1e-9))
    return first + full * barBeats
  }
  if (content <= first + 1e-9) return first
  const after = content - first
  const full = Math.max(1, Math.ceil(after / barBeats - 1e-9))
  return first + full * barBeats
}

function prependLeadRest(events: ScoreEvent[], beats: number): ScoreEvent[] {
  if (beats <= 1e-9) return events
  return [{ keys: ['B4'], beats, rest: true }, ...events]
}

function vexVoiceTime(quarterBeats: number, meter: Meter, isFullBar: boolean): string {
  if (isFullBar) return meter.id
  const eighths = Math.max(1, Math.round(quarterBeats * 2))
  if (meter.denominator === 4 && Math.abs(quarterBeats - Math.round(quarterBeats)) < 1e-9) {
    return `${Math.round(quarterBeats)}/4`
  }
  return `${eighths}/8`
}

function toEasyScore(events: ScoreEvent[]): string {
  return events
    .map((event) => {
      const { duration, dots } = vexDurationParts(event.beats)
      const dotted = dots > 0 ? '.' : ''
      if (event.rest) return `B4/${duration}/r${dotted}`
      if (event.keys.length > 1) return `(${event.keys.join(' ')})/${duration}${dotted}`
      return `${event.keys[0]}/${duration}${dotted}`
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
    meter: Meter
    opening: Opening
    width: number
  },
  cancelled?: () => boolean,
) {
  const { Factory, BarlineType } = await import('vexflow')
  if (cancelled?.()) return
  const width = Math.max(el.clientWidth || input.width, 560)
  const barBeats = input.meter.barBeats
  const first = firstBarBeats(input.meter, input.opening)
  const harmonyEvents = prependLeadRest(
    chordsToEvents(input.chords, input.assembledHarmony),
    harmonyLeadBeats(input.opening),
  )
  const melodyEvents = prependLeadRest(
    melodyToEvents(input.melody, input.pendingMelody),
    melodyLeadBeats(input.opening),
  )
  const total = paddedLength(
    Math.max(eventSum(harmonyEvents), eventSum(melodyEvents)),
    barBeats,
    first,
    input.opening.kind === 'anacrusis',
  )
  const harmonyMeasures = toMeasures(padWithRests(harmonyEvents, total), barBeats, first)
  const melodyMeasures = toMeasures(padWithRests(melodyEvents, total), barBeats, first)
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
  const placedMelody: { note: ReturnType<typeof score.notes>[number]; event: ScoreEvent; measure: number }[] = []

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
    const fallbackBeats = barCapacity(i, barBeats, first)
    const fallback = [{ keys: ['B4'], beats: fallbackBeats, rest: true }]
    const melodyEventsInBar = melodyMeasures[i] ?? fallback
    const harmonyEventsInBar = harmonyMeasures[i] ?? fallback
    const measureBeats = eventSum(melodyEventsInBar)
    const time = vexVoiceTime(measureBeats, input.meter, Math.abs(measureBeats - barBeats) < 1e-9)
    score.set({ time })
    const melodyNotes = score.notes(toEasyScore(melodyEventsInBar), { stem: 'up' })
    paintPreview(melodyNotes, melodyEventsInBar)
    melodyEventsInBar.forEach((event, index) => {
      const note = melodyNotes[index]
      if (note) placedMelody.push({ note, event, measure: i })
    })

    const chordText = harmonyEventsInBar.map((event) => {
      const { duration, dots } = vexDurationParts(event.beats)
      const textNote = vf.TextNote({
        text: event.rest || !event.symbol ? ' ' : event.symbol,
        duration,
        dots,
        font: { family: 'Georgia, Times, serif', size: 14, weight: 'bold' },
      })
      textNote.setLine(-1)
      if (event.preview && event.symbol) {
        textNote.setStyle(PREVIEW_STYLE)
      }
      return textNote
    })

    const stave = system.addStave({
      voices: [score.voice(melodyNotes, { time }), vf.Voice({ time }).addTickables(chordText)],
    })
    if (col === 0) stave.addClef('treble')
    if (i === 0) stave.addTimeSignature(input.meter.id)
    stave.setMeasure(input.opening.kind === 'anacrusis' ? i : i + 1)
    const startBarAfterPickup = input.opening.kind === 'anacrusis' && i === 0
    stave.setBegBarType(col === 0 && !startBarAfterPickup ? BarlineType.SINGLE : BarlineType.NONE)
    stave.setEndBarType(isLast ? BarlineType.END : BarlineType.SINGLE)
  }

  for (let i = 0; i < placedMelody.length - 1; i += 1) {
    const from = placedMelody[i]!
    const to = placedMelody[i + 1]!
    if (!from.event.tieToNext || from.event.rest || to.event.rest) continue
    const indexes = from.event.keys.map((_, keyIndex) => keyIndex)
    const sameLine =
      Math.floor(from.measure / measuresPerLine) === Math.floor(to.measure / measuresPerLine)
    if (sameLine) {
      vf.StaveTie({ from: from.note, to: to.note, firstIndexes: indexes, lastIndexes: indexes })
    } else {
      vf.StaveTie({ from: from.note, to: null, firstIndexes: indexes, lastIndexes: indexes })
      vf.StaveTie({ from: null, to: to.note, firstIndexes: indexes, lastIndexes: indexes })
    }
  }

  vf.draw()
}
