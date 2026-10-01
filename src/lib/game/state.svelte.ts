import {
  harmonyDurationBeats,
  legalHarmonyOptions,
  roleAt,
  type HarmonyDurationKey,
  type HarmonyRole,
  type LegalOption,
  type MelodyDurationKey,
  type MelodyOctave,
  type VoicedNote,
  MELODY_DURATION_BEATS,
} from '../music/harmony'
import {
  labelFromSelection,
  midiAtOctave,
  pitchClassFromLetter,
  type Accidental,
  type Letter,
} from '../music/pitch'
import type { HarmonyVoiceId, MelodyVoiceId } from '../audio/voices'
import {
  meterById,
  openingById,
  openingFitsMeter,
  type MeterId,
  type OpeningId,
} from '../music/meter'

export type TurnPhase = 'harmony' | 'melody'

export type PlayerId = 0 | 1 | 2 | 3

export const PLAYERS: { id: PlayerId; name: string; color: string; ink: string }[] = [
  { id: 0, name: 'Azul', color: '#2471a3', ink: '#fff' },
  { id: 1, name: 'Verde', color: '#1e8449', ink: '#fff' },
  { id: 2, name: 'Rojo', color: '#c0392b', ink: '#fff' },
  { id: 3, name: 'Amarillo', color: '#d4ac0d', ink: '#1a1200' },
]

export function turnOrderFrom(start: PlayerId) {
  return [0, 1, 2, 3].map((offset) => PLAYERS[((start + offset) % 4) as PlayerId]!)
}

export type ClosedChord = {
  notes: VoicedNote[]
  triad: VoicedNote[]
  durationBeats: number
  durationKey: HarmonyDurationKey
}

export type MelodyNote = {
  pc: number
  midi: number
  label: string
  durationBeats: number
  durationKey: MelodyDurationKey
}

export type NotePick = {
  letter: Letter
  accidental: Accidental
}

class GameState {
  started = $state(false)
  chordStartPlayer = $state<PlayerId>(0)
  roleIndex = $state(0)
  phase = $state<TurnPhase>('melody')
  currentVoicing = $state<VoicedNote[]>([])
  closedChords = $state<ClosedChord[]>([])
  melody = $state<MelodyNote[]>([])
  pick = $state<NotePick | null>(null)
  leaveChord = $state(false)
  harmonyDuration = $state<HarmonyDurationKey>('bar')
  melodyDuration = $state<MelodyDurationKey>('quarter')
  melodyOctave = $state<MelodyOctave>(5)
  harmonyVoice = $state<HarmonyVoiceId>('piano')
  melodyVoice = $state<MelodyVoiceId>('flute')
  tempoBpm = $state(120)
  meterId = $state<MeterId>('4/4')
  openingId = $state<OpeningId>('tetic')
  melodyStartLength = $state(0)
  lastHarmonyKind = $state<'add' | 'close' | null>(null)
  melodyByTurn = $state<number[]>([])

  currentPlayerId = $derived<PlayerId>(
    ((this.chordStartPlayer + this.roleIndex) % 4) as PlayerId,
  )

  currentPlayer = $derived(PLAYERS[this.currentPlayerId]!)
  role = $derived<HarmonyRole>(roleAt(this.roleIndex))
  roundNumber = $derived(Math.floor(this.melodyByTurn.length / 4) + 1)
  meter = $derived(meterById(this.meterId))
  opening = $derived(openingById(this.openingId))
  barBeats = $derived(this.meter.barBeats)
  legalOptions = $derived(legalHarmonyOptions(this.role, this.currentVoicing))

  selectedHarmonyOption = $derived.by((): LegalOption | undefined => {
    if (!this.pick || this.phase !== 'harmony') return undefined
    const pc = pitchClassFromLetter(this.pick.letter, this.pick.accidental)
    return this.legalOptions.find((o) => o.pc === pc)
  })

  selectedMelodyNote = $derived.by((): MelodyNote | undefined => {
    if (!this.pick || this.phase !== 'melody') return undefined
    const pc = pitchClassFromLetter(this.pick.letter, this.pick.accidental)
    return {
      pc,
      midi: midiAtOctave(pc, this.melodyOctave),
      label: labelFromSelection(this.pick.letter, this.pick.accidental),
      durationBeats: MELODY_DURATION_BEATS[this.melodyDuration],
      durationKey: this.melodyDuration,
    }
  })

  startGame(startingPlayer: PlayerId, meterId: MeterId = '4/4', openingId: OpeningId = 'tetic') {
    this.chordStartPlayer = startingPlayer
    this.roleIndex = 0
    this.phase = 'melody'
    this.currentVoicing = []
    this.closedChords = []
    this.melody = []
    this.pick = null
    this.leaveChord = false
    this.harmonyDuration = 'bar'
    this.melodyStartLength = 0
    this.lastHarmonyKind = null
    this.melodyByTurn = []
    this.meterId = meterId
    const opening = openingById(openingId)
    this.openingId = openingFitsMeter(meterById(meterId), opening) ? openingId : 'tetic'
    this.started = true
  }

  isPitchLegal(letter: Letter, accidental: Accidental): boolean {
    if (this.phase === 'melody') return true
    const pc = pitchClassFromLetter(letter, accidental)
    return this.legalOptions.some((o) => o.pc === pc)
  }

  selectPitch(letter: Letter, accidental: Accidental) {
    if (!this.isPitchLegal(letter, accidental)) return
    this.leaveChord = false
    this.pick = { letter, accidental }
  }

  canConfirmHarmony(): boolean {
    if (this.phase !== 'harmony') return false
    if (this.role === 'seventh') {
      if (this.leaveChord) return true
      return this.selectedHarmonyOption !== undefined
    }
    return this.selectedHarmonyOption !== undefined
  }

  canConfirmMelody(): boolean {
    return this.phase === 'melody' && this.selectedMelodyNote !== undefined
  }

  confirmHarmony() {
    if (!this.canConfirmHarmony()) return
    if (this.role === 'seventh') {
      const triad = [...this.currentVoicing]
      const notes = [...triad]
      if (!this.leaveChord && this.selectedHarmonyOption) {
        const opt = this.selectedHarmonyOption
        notes.push({
          pc: opt.pc,
          midi: opt.midi,
          label: this.pick
            ? labelFromSelection(this.pick.letter, this.pick.accidental)
            : opt.label,
        })
      }
      this.closedChords = [
        ...this.closedChords,
        {
          notes,
          triad,
          durationBeats: harmonyDurationBeats(this.harmonyDuration, this.barBeats),
          durationKey: this.harmonyDuration,
        },
      ]
      this.currentVoicing = []
      this.lastHarmonyKind = 'close'
    } else if (this.selectedHarmonyOption && this.pick) {
      this.currentVoicing = [
        ...this.currentVoicing,
        {
          pc: this.selectedHarmonyOption.pc,
          midi: this.selectedHarmonyOption.midi,
          label: labelFromSelection(this.pick.letter, this.pick.accidental),
        },
      ]
      this.lastHarmonyKind = 'add'
    }
    this.pick = null
    this.leaveChord = false
    this.endTurn()
  }

  confirmMelody() {
    const note = this.selectedMelodyNote
    if (!note) return
    this.melody = [...this.melody, note]
    this.pick = null
  }

  chooseLeaveChord() {
    if (this.role !== 'seventh' || this.phase !== 'harmony') return
    this.leaveChord = true
    this.pick = null
  }

  passToHarmony() {
    if (this.phase !== 'melody') return
    this.pick = null
    this.phase = 'harmony'
  }

  endTurn() {
    const added = this.melody.length - this.melodyStartLength
    this.melodyByTurn = [...this.melodyByTurn, added]
    this.melodyStartLength = this.melody.length
    if (this.roleIndex === 3) {
      this.chordStartPlayer = ((this.chordStartPlayer + 1) % 4) as PlayerId
      this.roleIndex = 0
    } else {
      this.roleIndex += 1
    }
    this.harmonyDuration = 'bar'
    this.phase = 'melody'
  }

  dropMelodyOfLastTurn() {
    const added = this.melodyByTurn[this.melodyByTurn.length - 1]
    if (added === undefined) {
      this.melodyStartLength = this.melody.length
      return
    }
    this.melodyByTurn = this.melodyByTurn.slice(0, -1)
    if (added > 0) this.melody = this.melody.slice(0, -added)
    this.melodyStartLength = this.melody.length
  }

  canUndoMelody(): boolean {
    if (this.phase !== 'melody') return false
    if (this.pick) return true
    return this.melody.length > this.melodyStartLength
  }

  canUndoHarmony(): boolean {
    if (this.phase === 'harmony' && (this.pick || this.leaveChord)) return true
    if (this.phase === 'harmony') return true
    if (this.phase !== 'melody') return false
    if (this.pick) return false
    if (this.melody.length > this.melodyStartLength) return false
    return this.melodyByTurn.length > 0
  }

  undoMelody() {
    if (this.phase !== 'melody') return
    if (this.pick) {
      this.pick = null
      return
    }
    if (this.melody.length <= this.melodyStartLength) return
    this.melody = this.melody.slice(0, -1)
    this.pick = null
  }

  undoHarmony() {
    if (this.phase === 'harmony' && (this.pick || this.leaveChord)) {
      this.pick = null
      this.leaveChord = false
      return
    }

    if (this.phase === 'harmony') {
      this.pick = null
      this.leaveChord = false
      this.phase = 'melody'
      return
    }

    if (this.phase !== 'melody' || !this.canUndoHarmony()) return

    const added = this.melodyByTurn[this.melodyByTurn.length - 1]
    if (added === undefined) return
    this.melodyByTurn = this.melodyByTurn.slice(0, -1)
    this.melodyStartLength = this.melody.length - added
    this.pick = null
    this.leaveChord = false
    this.lastHarmonyKind = null

    if (this.roleIndex > 0) {
      this.currentVoicing = this.currentVoicing.slice(0, -1)
      this.roleIndex -= 1
      this.phase = 'harmony'
      return
    }

    const chord = this.closedChords[this.closedChords.length - 1]
    if (!chord) return
    this.closedChords = this.closedChords.slice(0, -1)
    this.chordStartPlayer = ((this.chordStartPlayer + 3) % 4) as PlayerId
    this.roleIndex = 3
    this.currentVoicing = [...chord.triad]
    this.harmonyDuration = chord.durationKey
    this.phase = 'harmony'
  }

  inProgressChordForPreview(): ClosedChord | null {
    if (this.currentVoicing.length === 0) return null
    return {
      notes: this.currentVoicing,
      triad: this.currentVoicing,
      durationBeats: harmonyDurationBeats('bar', this.barBeats),
      durationKey: 'bar' as const,
    }
  }

  harmonyPreviewMidis(): number[] {
    const midis = this.currentVoicing.map((n) => n.midi)
    if (this.selectedHarmonyOption) midis.push(this.selectedHarmonyOption.midi)
    return midis
  }

  pendingHarmonyNote(): VoicedNote | undefined {
    if (this.phase !== 'harmony' || !this.selectedHarmonyOption || !this.pick) return undefined
    return {
      pc: this.selectedHarmonyOption.pc,
      midi: this.selectedHarmonyOption.midi,
      label: labelFromSelection(this.pick.letter, this.pick.accidental),
    }
  }

  assembledHarmonyForScore(): ClosedChord | null {
    if (this.currentVoicing.length < 3) return null
    return {
      notes: this.currentVoicing,
      triad: this.currentVoicing,
      durationBeats: harmonyDurationBeats('bar', this.barBeats),
      durationKey: 'bar',
    }
  }
}

export const game = new GameState()
