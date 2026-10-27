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
  melodyLeadBeats,
  meterById,
  openingById,
  openingFitsMeter,
  remainingMeasureBeats,
  type MeterId,
  type OpeningId,
} from '../music/meter'
import {
  MELODY_SUBDIVISIONS,
  subdivisionBeats,
  subdivisionById,
  subdivisionHasTuplet,
  type MelodyFigure,
  type MelodySubdivision,
  type TupletSpec,
} from '../music/subdivisions'

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
  figure: MelodyFigure
  /** Identifica todas las notas de una misma subdivisión. */
  groupId?: string
  tuplet?: TupletSpec
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
  activeSubdivision = $state<MelodySubdivision | null>(null)
  subdivisionNotes = $state<MelodyNote[]>([])
  subdivisionGroupId = $state<string | null>(null)
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
  /** Recordatorio para mover al director al cerrar la ronda. */
  roundNotice = $state(false)
  private subdivisionSerial = 0

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
    const base = {
      pc,
      midi: midiAtOctave(pc, this.melodyOctave),
      label: labelFromSelection(this.pick.letter, this.pick.accidental),
    }

    if (this.activeSubdivision) {
      const part = this.activeSubdivision.parts[this.subdivisionNotes.length]
      if (!part) return undefined
      return {
        ...base,
        durationBeats: part.beats,
        durationKey: this.activeSubdivision.parent,
        figure: part.figure,
        groupId: this.subdivisionGroupId ?? undefined,
        tuplet: part.tuplet,
      }
    }

    return {
      ...base,
      durationBeats: MELODY_DURATION_BEATS[this.melodyDuration],
      durationKey: this.melodyDuration,
      figure: this.melodyDuration,
    }
  })

  subdivisionTotalParts = $derived(this.activeSubdivision?.parts.length ?? 0)
  subdivisionEnteredCount = $derived(this.subdivisionNotes.length)
  subdivisionComplete = $derived(
    !!this.activeSubdivision &&
      this.subdivisionNotes.length >= this.activeSubdivision.parts.length,
  )

  availableSubdivisions = $derived(
    (MELODY_SUBDIVISIONS[this.melodyDuration] ?? []).map((subdivision) => ({
      subdivision,
      fits: this.subdivisionFits(subdivision),
    })),
  )

  pendingMelodyNotes = $derived.by((): MelodyNote[] => {
    const notes = [...this.subdivisionNotes]
    const selected = this.selectedMelodyNote
    if (selected) notes.push(selected)
    return notes
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
    this.activeSubdivision = null
    this.subdivisionNotes = []
    this.subdivisionGroupId = null
    this.harmonyDuration = 'bar'
    this.melodyStartLength = 0
    this.lastHarmonyKind = null
    this.melodyByTurn = []
    this.roundNotice = false
    this.subdivisionSerial = 0
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

  canConfirmSubdivision(): boolean {
    return this.phase === 'melody' && this.subdivisionComplete
  }

  /** Los tresillos/dosillos no se pueden partir entre compases. */
  subdivisionFits(subdivision: MelodySubdivision): boolean {
    if (!subdivisionHasTuplet(subdivision)) return true
    const committed = this.melody.reduce((sum, note) => sum + note.durationBeats, 0)
    const pending = this.subdivisionNotes.reduce((sum, note) => sum + note.durationBeats, 0)
    const before = melodyLeadBeats(this.opening) + committed + pending
    const room = remainingMeasureBeats(before, this.meter, this.opening)
    return subdivisionBeats(subdivision) <= room + 1e-9
  }

  startSubdivision(id: string): boolean {
    if (this.phase !== 'melody' || this.activeSubdivision) return false
    const subdivision = subdivisionById(id)
    if (!subdivision || subdivision.parent !== this.melodyDuration) return false
    if (!this.subdivisionFits(subdivision)) return false
    this.activeSubdivision = subdivision
    this.subdivisionNotes = []
    this.subdivisionGroupId = `subdivision-${this.subdivisionSerial}`
    this.subdivisionSerial += 1
    this.pick = null
    return true
  }

  cancelSubdivision() {
    if (!this.activeSubdivision) return
    this.activeSubdivision = null
    this.subdivisionNotes = []
    this.subdivisionGroupId = null
    this.pick = null
  }

  confirmSubdivision() {
    if (!this.canConfirmSubdivision() || !this.activeSubdivision) return
    const parts = this.activeSubdivision.parts
    if (this.subdivisionNotes.length !== parts.length) return
    this.melody = [...this.melody, ...this.subdivisionNotes]
    this.activeSubdivision = null
    this.subdivisionNotes = []
    this.subdivisionGroupId = null
    this.pick = null
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
    if (this.activeSubdivision) {
      if (this.subdivisionComplete) return
      this.subdivisionNotes = [...this.subdivisionNotes, note]
      this.pick = null
      return
    }
    this.melody = [...this.melody, note]
    this.pick = null
  }

  chooseLeaveChord() {
    if (this.role !== 'seventh' || this.phase !== 'harmony') return
    this.leaveChord = true
    this.pick = null
  }

  passToHarmony() {
    if (this.phase !== 'melody' || this.activeSubdivision) return
    this.pick = null
    this.phase = 'harmony'
  }

  endTurn() {
    const added = this.melody.length - this.melodyStartLength
    this.melodyByTurn = [...this.melodyByTurn, added]
    this.melodyStartLength = this.melody.length
    this.activeSubdivision = null
    this.subdivisionNotes = []
    this.subdivisionGroupId = null
    const finishedRound = this.roleIndex === 3
    if (finishedRound) {
      this.chordStartPlayer = ((this.chordStartPlayer + 1) % 4) as PlayerId
      this.roleIndex = 0
      this.roundNotice = true
    } else {
      this.roleIndex += 1
    }
    this.harmonyDuration = 'bar'
    this.phase = 'melody'
  }

  dismissRoundNotice() {
    this.roundNotice = false
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
    if (this.activeSubdivision) return true
    return this.melody.length > this.melodyStartLength
  }

  canUndoHarmony(): boolean {
    if (this.phase === 'harmony' && (this.pick || this.leaveChord)) return true
    if (this.phase === 'harmony') return true
    if (this.phase !== 'melody') return false
    if (this.activeSubdivision) return false
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
    if (this.activeSubdivision) {
      if (this.subdivisionNotes.length > 0) {
        this.subdivisionNotes = this.subdivisionNotes.slice(0, -1)
      } else {
        this.cancelSubdivision()
      }
      return
    }
    if (this.melody.length <= this.melodyStartLength) return
    const last = this.melody[this.melody.length - 1]
    if (last?.groupId) {
      let cut = this.melody.length
      while (cut > this.melodyStartLength && this.melody[cut - 1]?.groupId === last.groupId) {
        cut -= 1
      }
      this.melody = this.melody.slice(0, Math.max(cut, this.melodyStartLength))
    } else {
      this.melody = this.melody.slice(0, -1)
    }
    this.pick = null
  }

  undoHarmony() {
    if (this.activeSubdivision) return
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
    this.roundNotice = false
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
