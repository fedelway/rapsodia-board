import type { MelodyDurationKey } from './harmony'

/** Figuras que puede tener una nota de melodía, incluidas las subdivisiones. */
export type MelodyFigure =
  | 'sixteenth'
  | 'eighth'
  | 'dottedEighth'
  | 'quarter'
  | 'dottedQuarter'
  | 'half'
  | 'dottedHalf'
  | 'whole'

export type TupletSpec = {
  /** Cantidad de notas del grupo. */
  numNotes: number
  /** Cantidad de figuras base que ocupa el grupo. */
  notesOccupied: number
}

export type SubdivisionPart = {
  figure: MelodyFigure
  /** Duración en negras. */
  beats: number
  tuplet?: TupletSpec
}

export type MelodySubdivision = {
  id: string
  parent: MelodyDurationKey
  label: string
  parts: SubdivisionPart[]
}

export const MELODY_FIGURE_LABELS: Record<MelodyFigure, string> = {
  sixteenth: 'Semicorchea',
  eighth: 'Corchea',
  dottedEighth: 'Corchea con puntillo',
  quarter: 'Negra',
  dottedQuarter: 'Negra con punto',
  half: 'Blanca',
  dottedHalf: 'Blanca con punto',
  whole: 'Redonda',
}

export const MELODY_FIGURE_BEATS: Record<MelodyFigure, number> = {
  sixteenth: 0.25,
  eighth: 0.5,
  dottedEighth: 0.75,
  quarter: 1,
  dottedQuarter: 1.5,
  half: 2,
  dottedHalf: 3,
  whole: 4,
}

export const MELODY_FIGURE_VEX: Record<MelodyFigure, { duration: string; dots: number }> = {
  sixteenth: { duration: '16', dots: 0 },
  eighth: { duration: '8', dots: 0 },
  dottedEighth: { duration: '8', dots: 1 },
  quarter: { duration: 'q', dots: 0 },
  dottedQuarter: { duration: 'q', dots: 1 },
  half: { duration: 'h', dots: 0 },
  dottedHalf: { duration: 'h', dots: 1 },
  whole: { duration: 'w', dots: 0 },
}

const TRIPLET: TupletSpec = { numNotes: 3, notesOccupied: 2 }
const DUPLET: TupletSpec = { numNotes: 2, notesOccupied: 3 }

const eighthTriplet: SubdivisionPart = { figure: 'eighth', beats: 1 / 3, tuplet: TRIPLET }
const quarterTriplet: SubdivisionPart = { figure: 'quarter', beats: 2 / 3, tuplet: TRIPLET }
const eighthDuplet: SubdivisionPart = { figure: 'eighth', beats: 0.75, tuplet: DUPLET }

/**
 * Subdivisiones disponibles por duración padre.
 * La suma de los beats de cada subdivisión siempre coincide con la duración padre.
 */
export const MELODY_SUBDIVISIONS: Record<MelodyDurationKey, MelodySubdivision[]> = {
  eighth: [
    {
      id: 'eighth-two-sixteenths',
      parent: 'eighth',
      label: 'Dos semicorcheas',
      parts: [
        { figure: 'sixteenth', beats: 0.25 },
        { figure: 'sixteenth', beats: 0.25 },
      ],
    },
  ],
  quarter: [
    {
      id: 'quarter-eighth-triplet',
      parent: 'quarter',
      label: 'Tresillo de corcheas',
      parts: [eighthTriplet, eighthTriplet, eighthTriplet],
    },
    {
      id: 'quarter-sixteenth-eighth-sixteenth',
      parent: 'quarter',
      label: 'Semicorchea – corchea – semicorchea',
      parts: [
        { figure: 'sixteenth', beats: 0.25 },
        { figure: 'eighth', beats: 0.5 },
        { figure: 'sixteenth', beats: 0.25 },
      ],
    },
    {
      id: 'quarter-eighth-sixteenth-sixteenth',
      parent: 'quarter',
      label: 'Corchea – semicorchea – semicorchea',
      parts: [
        { figure: 'eighth', beats: 0.5 },
        { figure: 'sixteenth', beats: 0.25 },
        { figure: 'sixteenth', beats: 0.25 },
      ],
    },
    {
      id: 'quarter-sixteenth-sixteenth-eighth',
      parent: 'quarter',
      label: 'Semicorchea – semicorchea – corchea',
      parts: [
        { figure: 'sixteenth', beats: 0.25 },
        { figure: 'sixteenth', beats: 0.25 },
        { figure: 'eighth', beats: 0.5 },
      ],
    },
    {
      id: 'quarter-dotted-eighth-sixteenth',
      parent: 'quarter',
      label: 'Corchea con puntillo – semicorchea',
      parts: [
        { figure: 'dottedEighth', beats: 0.75 },
        { figure: 'sixteenth', beats: 0.25 },
      ],
    },
    {
      id: 'quarter-sixteenth-dotted-eighth',
      parent: 'quarter',
      label: 'Semicorchea – corchea con puntillo',
      parts: [
        { figure: 'sixteenth', beats: 0.25 },
        { figure: 'dottedEighth', beats: 0.75 },
      ],
    },
  ],
  dottedQuarter: [
    {
      id: 'dotted-quarter-eighth-duplet',
      parent: 'dottedQuarter',
      label: 'Dosillo de corcheas',
      parts: [eighthDuplet, eighthDuplet],
    },
  ],
  half: [
    {
      id: 'half-quarter-triplet',
      parent: 'half',
      label: 'Tresillo de negras',
      parts: [quarterTriplet, quarterTriplet, quarterTriplet],
    },
  ],
  dottedHalf: [],
  whole: [],
}

const SUBDIVISIONS_BY_ID = new Map(
  Object.values(MELODY_SUBDIVISIONS)
    .flat()
    .map((subdivision) => [subdivision.id, subdivision]),
)

export function subdivisionById(id: string): MelodySubdivision | undefined {
  return SUBDIVISIONS_BY_ID.get(id)
}

export function subdivisionsForDuration(key: MelodyDurationKey): MelodySubdivision[] {
  return MELODY_SUBDIVISIONS[key] ?? []
}

export function subdivisionBeats(subdivision: MelodySubdivision): number {
  return subdivision.parts.reduce((sum, part) => sum + part.beats, 0)
}

export function subdivisionHasTuplet(subdivision: MelodySubdivision): boolean {
  return subdivision.parts.some((part) => part.tuplet !== undefined)
}

export function tupletName(tuplet?: TupletSpec): string | undefined {
  if (!tuplet) return undefined
  if (tuplet.numNotes === 3) return 'tresillo'
  if (tuplet.numNotes === 2) return 'dosillo'
  return `${tuplet.numNotes}`
}

export function figureLabel(figure: MelodyFigure, tuplet?: TupletSpec): string {
  const base = MELODY_FIGURE_LABELS[figure]
  const name = tupletName(tuplet)
  return name ? `${base} (${name})` : base
}
