export const PITCH_CLASS_COUNT = 12

export const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const
export type Letter = (typeof LETTERS)[number]

export type Accidental = 'flat' | 'natural' | 'sharp'

export const ACCIDENTALS: Accidental[] = ['flat', 'natural', 'sharp']

export const ACCIDENTAL_SYMBOL: Record<Accidental, string> = {
  flat: '♭',
  natural: '♮',
  sharp: '♯',
}

const NATURAL_PC: Record<Letter, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
}

export const SHARP_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']
export const FLAT_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B']

export function wrapPc(n: number): number {
  return ((n % PITCH_CLASS_COUNT) + PITCH_CLASS_COUNT) % PITCH_CLASS_COUNT
}

export function pitchClassFromLetter(letter: Letter, accidental: Accidental): number {
  const delta = accidental === 'flat' ? -1 : accidental === 'sharp' ? 1 : 0
  return wrapPc(NATURAL_PC[letter] + delta)
}

export function displayName(pc: number, preferFlat = false): string {
  return preferFlat ? FLAT_NAMES[wrapPc(pc)] : SHARP_NAMES[wrapPc(pc)]
}

export function labelFromSelection(letter: Letter, accidental: Accidental): string {
  if (accidental === 'natural') return letter
  return `${letter}${ACCIDENTAL_SYMBOL[accidental]}`
}

/** C4 = 60 */
export const C4_MIDI = 60
export const C5_MIDI = 72

/** C4 = 60 → octava científica 4 */
export function midiAtOctave(pc: number, octave: number): number {
  return (octave + 1) * 12 + wrapPc(pc)
}

export function scientificOctave(midi: number): number {
  return Math.floor(midi / 12) - 1
}

export function pitchClassOfMidi(midi: number): number {
  return wrapPc(midi)
}

export function midiInOctaveC4(pc: number): number {
  return midiAtOctave(pc, 4)
}

export function midiInOctaveC5(pc: number): number {
  return midiAtOctave(pc, 5)
}

export function midiForPcAtOrAbove(pc: number, minMidi: number): number {
  let midi = minMidi
  const target = wrapPc(pc)
  while (pitchClassOfMidi(midi) !== target) midi += 1
  return midi
}

export function midiForPcAtOrBelow(pc: number, maxMidi: number): number {
  let midi = maxMidi
  const target = wrapPc(pc)
  while (pitchClassOfMidi(midi) !== target) midi -= 1
  return midi
}
