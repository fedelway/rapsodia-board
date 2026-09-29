import {
  HARMONY_DURATION_BEATS,
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

export type TurnPhase = 'harmony' | 'melody'

export type PlayerId = 0 | 1 | 2 | 3

export const PLAYERS: { id: PlayerId; name: string; color: string; ink: string }[] = [
  { id: 0, name: 'Rojo', color: '#c0392b', ink: '#fff' },
  { id: 1, name: 'Azul', color: '#2471a3', ink: '#fff' },
  { id: 2, name: 'Verde', color: '#1e8449', ink: '#fff' },
  { id: 3, name: 'Amarillo', color: '#d4ac0d', ink: '#1a1200' },
]

export type ClosedChord = {
  notes: VoicedNote[]
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
  chordStartPlayer = $state<PlayerId>(0)
  roleIndex = $state(0)
  phase = $state<TurnPhase>('harmony')
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

  currentPlayerId = $derived<PlayerId>(
    ((this.chordStartPlayer + this.roleIndex) % 4) as PlayerId,
  )

  currentPlayer = $derived(PLAYERS[this.currentPlayerId]!)
  role = $derived<HarmonyRole>(roleAt(this.roleIndex))
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
      const notes = [...this.currentVoicing]
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
          durationBeats: HARMONY_DURATION_BEATS[this.harmonyDuration],
          durationKey: this.harmonyDuration,
        },
      ]
      this.currentVoicing = []
    } else if (this.selectedHarmonyOption && this.pick) {
      this.currentVoicing = [
        ...this.currentVoicing,
        {
          pc: this.selectedHarmonyOption.pc,
          midi: this.selectedHarmonyOption.midi,
          label: labelFromSelection(this.pick.letter, this.pick.accidental),
        },
      ]
    }
    this.pick = null
    this.leaveChord = false
    this.phase = 'melody'
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

  passTurn() {
    if (this.phase !== 'melody') return
    this.pick = null
    this.leaveChord = false
    if (this.roleIndex === 3) {
      this.chordStartPlayer = ((this.chordStartPlayer + 1) % 4) as PlayerId
      this.roleIndex = 0
    } else {
      this.roleIndex += 1
    }
    this.phase = 'harmony'
    this.harmonyDuration = 'bar'
  }

  inProgressChordForPreview(): ClosedChord | null {
    if (this.currentVoicing.length === 0) return null
    return {
      notes: this.currentVoicing,
      durationBeats: HARMONY_DURATION_BEATS.bar,
      durationKey: 'bar',
    }
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
      durationBeats: HARMONY_DURATION_BEATS.bar,
      durationKey: 'bar',
    }
  }
}

export const game = new GameState()
