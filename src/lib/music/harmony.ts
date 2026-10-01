import {
  midiInOctaveC4,
  midiForPcAtOrAbove,
  midiForPcAtOrBelow,
  pitchClassOfMidi,
  wrapPc,
  displayName,
} from './pitch'

export type HarmonyRole = 'root' | 'third' | 'extremes' | 'seventh'

export const ROLE_LABELS: Record<HarmonyRole, string> = {
  root: 'raíz',
  third: 'tercera',
  extremes: 'extremos',
  seventh: '7ma, bajo y duración',
}

export const HARMONY_ROLES: HarmonyRole[] = ['root', 'third', 'extremes', 'seventh']

export function roleAt(roleIndex: number): HarmonyRole {
  return HARMONY_ROLES[roleIndex] ?? 'root'
}

export type VoicedNote = {
  pc: number
  midi: number
  label: string
}

export type LegalOption = VoicedNote

const THIRD_DELTAS = [3, 4, -3, -4] as const

export function legalRootOptions(): LegalOption[] {
  return Array.from({ length: 12 }, (_, pc) => ({
    pc,
    midi: midiInOctaveC4(pc),
    label: displayName(pc),
  }))
}

export function legalThirdOptions(root: VoicedNote): LegalOption[] {
  const byPc = new Map<number, LegalOption>()
  for (const delta of THIRD_DELTAS) {
    const midi = root.midi + delta
    const pc = pitchClassOfMidi(midi)
    if (!byPc.has(pc)) {
      byPc.set(pc, { pc, midi, label: displayName(pc, delta < 0) })
    }
  }
  return [...byPc.values()]
}

export function legalExtremeOptions(voicing: VoicedNote[]): LegalOption[] {
  if (voicing.length === 0) return []
  const midis = voicing.map((n) => n.midi)
  const minMidi = Math.min(...midis)
  const maxMidi = Math.max(...midis)
  const taken = new Set(voicing.map((n) => n.pc))
  const candidates: { midi: number; preferFlat: boolean }[] = [
    { midi: minMidi - 3, preferFlat: false },
    { midi: minMidi - 4, preferFlat: true },
    { midi: maxMidi + 3, preferFlat: false },
    { midi: maxMidi + 4, preferFlat: false },
  ]
  const byPc = new Map<number, LegalOption>()
  for (const { midi, preferFlat } of candidates) {
    const pc = pitchClassOfMidi(midi)
    if (taken.has(pc) || byPc.has(pc)) continue
    byPc.set(pc, { pc, midi, label: displayName(pc, preferFlat) })
  }
  return [...byPc.values()]
}

/** Fundamental: primero tríada mayor/menor con 5ª justa; después dim/aum. */
export function detectTriadRoot(pcs: number[]): number {
  const unique = [...new Set(pcs.map(wrapPc))]
  if (unique.length === 0) return 0
  if (unique.length === 1) return unique[0]!

  const intervalsFrom = (start: number) => new Set(unique.map((pc) => wrapPc(pc - start)))

  const pick = (ok: (iv: Set<number>) => boolean) => unique.find((start) => ok(intervalsFrom(start)))

  const withPerfectFifth = pick((iv) => (iv.has(3) || iv.has(4)) && iv.has(7))
  if (withPerfectFifth !== undefined) return withPerfectFifth

  const diminished = pick((iv) => iv.has(3) && iv.has(6))
  if (diminished !== undefined) return diminished

  const augmented = pick((iv) => iv.has(4) && iv.has(8))
  if (augmented !== undefined) return augmented

  return unique[0]!
}

function americanRootName(pc: number, notes: VoicedNote[]): string {
  const match = notes.find((note) => note.pc === pc)
  if (match) {
    return match.label
      .replace(/\s*\(.*\)\s*/g, '')
      .replaceAll('♯', '#')
      .replaceAll('♭', 'b')
  }
  return displayName(pc).replaceAll('♯', '#').replaceAll('♭', 'b')
}

/** Con 4 notas, si el grave forma 7ma, esa es la tónica (Bø7, no Dm6). */
export function detectChordRoot(notes: VoicedNote[]): number {
  const unique = [...new Set(notes.map((note) => wrapPc(note.pc)))]
  if (unique.length < 3) return notes[0]?.pc ?? 0
  if (unique.length >= 4) {
    const lowestPc = pitchClassOfMidi(Math.min(...notes.map((note) => note.midi)))
    const fromBass = new Set(unique.map((pc) => wrapPc(pc - lowestPc)))
    if (fromBass.has(10) || fromBass.has(11)) return lowestPc
    const seventhRoot = unique.find((start) => {
      const iv = new Set(unique.map((pc) => wrapPc(pc - start)))
      return (iv.has(3) || iv.has(4)) && (iv.has(10) || iv.has(11))
    })
    if (seventhRoot !== undefined) return seventhRoot
  }
  return detectTriadRoot(unique)
}

export function americanChordSymbol(notes: VoicedNote[]): string {
  if (notes.length === 0) return ''
  const unique = [...new Set(notes.map((note) => note.pc))]
  const root = unique.length >= 3 ? detectChordRoot(notes) : notes[0]!.pc
  const iv = new Set(unique.map((pc) => wrapPc(pc - root)))
  const name = americanRootName(root, notes)

  const minor = iv.has(3)
  const major = iv.has(4)
  const dim5 = iv.has(6)
  const perf5 = iv.has(7)
  const aug5 = iv.has(8)
  const dim7 = iv.has(9)
  const min7 = iv.has(10)
  const maj7 = iv.has(11)

  let quality = ''
  if (minor && dim5 && !perf5) quality = 'dim'
  else if (major && aug5 && !perf5) quality = '+'
  else if (minor) quality = 'm'

  let extension = ''
  if (maj7) extension = quality === 'm' ? '(maj7)' : 'maj7'
  else if (min7) {
    if (quality === 'dim') {
      quality = 'm'
      extension = '7b5'
    } else if (quality === '+') {
      extension = '7#5'
    } else {
      extension = '7'
    }
  } else if (dim7 && quality === 'dim') {
    extension = '7'
  }

  if (unique.length === 2 && !perf5 && !dim5 && !aug5) {
    if (minor) return `${name}m`
    if (major) return name
  }

  return `${name}${quality}${extension}`
}

export function closedChordCaption(notes: VoicedNote[]): string {
  const symbol = americanChordSymbol(notes)
  const tones = notes.map((note) => note.label).join(' ')
  return `${symbol} (${tones})`
}

export function legalSeventhOptions(voicing: VoicedNote[]): LegalOption[] {
  if (voicing.length === 0) return []
  const pcs = voicing.map((n) => n.pc)
  const root = detectTriadRoot(pcs)
  const taken = new Set(pcs)
  const minMidi = Math.min(...voicing.map((n) => n.midi))
  const maxMidi = Math.max(...voicing.map((n) => n.midi))
  const rootName = americanRootName(root, voicing)
  const preferFlat = /b|♭/i.test(rootName)
  const options: LegalOption[] = []
  for (const interval of [10, 11] as const) {
    const pc = wrapPc(root + interval)
    if (taken.has(pc)) continue
    const midi = midiForPcAtOrAbove(pc, maxMidi + 1)
    const tone = displayName(pc, preferFlat)
    options.push({
      pc,
      midi,
      label: interval === 10 ? `${tone} (7m)` : `${tone} (7M)`,
    })
  }
  for (const { delta, preferFlatBass } of [
    { delta: 3, preferFlatBass: false },
    { delta: 4, preferFlatBass: true },
  ] as const) {
    const pc = wrapPc(root - delta)
    if (taken.has(pc) || options.some((option) => option.pc === pc)) continue
    const midi = midiForPcAtOrBelow(pc, minMidi - 1)
    const tone = displayName(pc, preferFlatBass)
    options.push({
      pc,
      midi,
      label: `${tone} (bajo)`,
    })
  }
  return options
}

export function legalHarmonyOptions(role: HarmonyRole, voicing: VoicedNote[]): LegalOption[] {
  switch (role) {
    case 'root':
      return legalRootOptions()
    case 'third':
      return voicing[0] ? legalThirdOptions(voicing[0]) : []
    case 'extremes':
      return legalExtremeOptions(voicing)
    case 'seventh':
      return legalSeventhOptions(voicing)
  }
}

export const HARMONY_DURATION_BEATS = {
  halfBar: 2,
  bar: 4,
  twoBars: 8,
} as const

export type HarmonyDurationKey = keyof typeof HARMONY_DURATION_BEATS

export function harmonyDurationBeats(key: HarmonyDurationKey, barBeats: number): number {
  if (key === 'halfBar') return barBeats / 2
  if (key === 'twoBars') return barBeats * 2
  return barBeats
}

export const HARMONY_DURATION_LABELS: Record<HarmonyDurationKey, string> = {
  halfBar: 'Medio compás',
  bar: '1 compás',
  twoBars: '2 compases',
}

export const MELODY_DURATION_BEATS = {
  eighth: 0.5,
  quarter: 1,
  dottedQuarter: 1.5,
  half: 2,
  dottedHalf: 3,
  whole: 4,
} as const

export type MelodyDurationKey = keyof typeof MELODY_DURATION_BEATS

export const MELODY_OCTAVES = [3, 4, 5, 6] as const
export type MelodyOctave = (typeof MELODY_OCTAVES)[number]

export const MELODY_DURATION_LABELS: Record<MelodyDurationKey, string> = {
  eighth: 'Corchea',
  quarter: 'Negra',
  dottedQuarter: 'Negra con punto',
  half: 'Blanca',
  dottedHalf: 'Blanca con punto',
  whole: 'Redonda',
}
