import type { MelodyDurationKey } from './harmony'

export const METER_IDS = ['3/4', '4/4', '6/8', '9/8', '12/8', '7/8', '5/8', '5/4'] as const
export type MeterId = (typeof METER_IDS)[number]

export type Meter = {
  id: MeterId
  numerator: number
  denominator: number
  /** Duración del compás en negras (1 = negra). */
  barBeats: number
}

export const METERS: Meter[] = [
  { id: '3/4', numerator: 3, denominator: 4, barBeats: 3 },
  { id: '4/4', numerator: 4, denominator: 4, barBeats: 4 },
  { id: '6/8', numerator: 6, denominator: 8, barBeats: 3 },
  { id: '9/8', numerator: 9, denominator: 8, barBeats: 4.5 },
  { id: '12/8', numerator: 12, denominator: 8, barBeats: 6 },
  { id: '7/8', numerator: 7, denominator: 8, barBeats: 3.5 },
  { id: '5/8', numerator: 5, denominator: 8, barBeats: 2.5 },
  { id: '5/4', numerator: 5, denominator: 4, barBeats: 5 },
]

export function meterById(id: MeterId): Meter {
  return METERS.find((meter) => meter.id === id) ?? METERS[1]!
}

const FIGURES = [
  { figure: 'eighth', beats: 0.5 },
  { figure: 'quarter', beats: 1 },
  { figure: 'dottedQuarter', beats: 1.5 },
  { figure: 'half', beats: 2 },
  { figure: 'dottedHalf', beats: 3 },
] as const satisfies readonly { figure: MelodyDurationKey; beats: number }[]

export type OpeningKind = 'tetic' | 'anacrusis' | 'acephalous'

export type Opening = {
  id: string
  kind: OpeningKind
  beats: number
  figure?: MelodyDurationKey
  label: string
}

export const OPENINGS: Opening[] = [
  { id: 'tetic', kind: 'tetic', beats: 0, label: 'Comienzo tético' },
  ...FIGURES.map((item) => ({
    id: `anacrusis-${item.figure}`,
    kind: 'anacrusis' as const,
    beats: item.beats,
    figure: item.figure,
    label:
      item.figure === 'eighth'
        ? 'Comienzo anacrúsico de corchea'
        : item.figure === 'quarter'
          ? 'Comienzo anacrúsico de negra'
          : item.figure === 'dottedQuarter'
            ? 'Comienzo anacrúsico de negra con punto'
            : item.figure === 'half'
              ? 'Comienzo anacrúsico de blanca'
              : 'Comienzo anacrúsico de blanca con punto',
  })),
  ...FIGURES.map((item) => ({
    id: `acephalous-${item.figure}`,
    kind: 'acephalous' as const,
    beats: item.beats,
    figure: item.figure,
    label:
      item.figure === 'eighth'
        ? 'Comienzo acéfalo de silencio de corchea'
        : item.figure === 'quarter'
          ? 'Comienzo acéfalo de silencio de negra'
          : item.figure === 'dottedQuarter'
            ? 'Comienzo acéfalo de silencio de negra con punto'
            : item.figure === 'half'
              ? 'Comienzo acéfalo de silencio de blanca'
              : 'Comienzo acéfalo de silencio de blanca con punto',
  })),
]

export type OpeningId = (typeof OPENINGS)[number]['id']

export function openingById(id: OpeningId): Opening {
  return OPENINGS.find((opening) => opening.id === id) ?? OPENINGS[0]!
}

export function openingFitsMeter(meter: Meter, opening: Opening): boolean {
  if (opening.kind === 'tetic') return true
  return opening.beats < meter.barBeats - 1e-9
}

export function firstBarBeats(meter: Meter, opening: Opening): number {
  if (opening.kind === 'anacrusis') return opening.beats
  return meter.barBeats
}

export function melodyLeadBeats(opening: Opening): number {
  return opening.kind === 'acephalous' ? opening.beats : 0
}

export function harmonyLeadBeats(opening: Opening): number {
  return opening.kind === 'anacrusis' ? opening.beats : 0
}

export function playbackOffsets(opening: Opening): { melody: number; harmony: number } {
  return {
    melody: melodyLeadBeats(opening),
    harmony: harmonyLeadBeats(opening),
  }
}
