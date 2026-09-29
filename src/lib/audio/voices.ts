import mapsFile from './instrument-maps.json'

export const SAMPLE_BASE_URL =
  'https://cdn.jsdelivr.net/gh/nbrosowsky/tonejs-instruments@master/samples/'

export type SampleInstrumentId = keyof typeof mapsFile.maps
export type HarmonyVoiceId = SampleInstrumentId
export type MelodyVoiceId = SampleInstrumentId

const LABELS: Record<SampleInstrumentId, string> = {
  'bass-electric': 'Bajo eléctrico',
  bassoon: 'Fagot',
  cello: 'Cello',
  clarinet: 'Clarinete',
  contrabass: 'Contrabajo',
  flute: 'Flauta',
  'french-horn': 'Corno',
  'guitar-acoustic': 'Guitarra acústica',
  'guitar-electric': 'Guitarra eléctrica',
  'guitar-nylon': 'Guitarra criolla',
  harmonium: 'Armonio',
  harp: 'Arpa',
  organ: 'Órgano',
  piano: 'Piano',
  saxophone: 'Saxofón',
  trombone: 'Trombón',
  trumpet: 'Trompeta',
  tuba: 'Tuba',
  violin: 'Violín',
  xylophone: 'Xilófono',
}

export const SAMPLE_INSTRUMENTS: { id: SampleInstrumentId; label: string }[] = (
  mapsFile.list as SampleInstrumentId[]
).map((id) => ({ id, label: LABELS[id] }))

export const HARMONY_VOICE_OPTIONS = SAMPLE_INSTRUMENTS
export const MELODY_VOICE_OPTIONS = SAMPLE_INSTRUMENTS

export function sampleUrlsFor(id: SampleInstrumentId): Record<string, string> {
  const raw = mapsFile.maps[id]
  const keys = Object.keys(raw)
  let step = 1
  if (keys.length >= 17) step = 2
  if (keys.length >= 33) step = 4
  if (keys.length >= 49) step = 6
  const urls: Record<string, string> = {}
  keys.forEach((note, index) => {
    if (index % step !== 0) return
    urls[note] = String(raw[note as keyof typeof raw]).replace('.[mp3|ogg]', '.mp3')
  })
  return urls
}
