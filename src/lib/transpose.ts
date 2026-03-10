import type { Song, Section, Line, ChordPosition, NotationSystem } from '../types';

const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLATS  = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

// Enharmonic equivalents for lookup
const NOTE_TO_INDEX: Record<string, number> = {
  'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
  'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
  'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11,
};

// Keys that prefer flats
const FLAT_KEYS = new Set(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm']);

function preferFlats(key: string): boolean {
  const root = key.replace(/m.*$/, '');
  return FLAT_KEYS.has(root) || root.includes('b');
}

export function transposeNote(note: string, steps: number, useFlats: boolean): string {
  const idx = NOTE_TO_INDEX[note];
  if (idx === undefined) return note;
  const newIdx = ((idx + steps) % 12 + 12) % 12;
  return useFlats ? FLATS[newIdx] : SHARPS[newIdx];
}

/**
 * Parse a chord string into root + suffix
 * e.g. "Am7" → { root: "A", suffix: "m7" }
 *      "F#maj7/C#" → { root: "F#", suffix: "maj7", bass: "C#" }
 */
function parseChord(chord: string): { root: string; suffix: string; bass?: string } | null {
  const match = chord.match(/^([A-G][b#]?)(.*?)(?:\/([A-G][b#]?))?$/);
  if (!match) return null;
  return { root: match[1], suffix: match[2] || '', bass: match[3] };
}

export function transposeChord(chord: string, steps: number, useFlats: boolean): string {
  if (steps === 0) return chord;
  const parsed = parseChord(chord);
  if (!parsed) return chord;
  const newRoot = transposeNote(parsed.root, steps, useFlats);
  const newBass = parsed.bass ? transposeNote(parsed.bass, steps, useFlats) : undefined;
  return newRoot + parsed.suffix + (newBass ? `/${newBass}` : '');
}

function transposeChordPositions(chords: ChordPosition[], steps: number, useFlats: boolean): ChordPosition[] {
  return chords.map(cp => ({
    ...cp,
    chord: transposeChord(cp.chord, steps, useFlats),
  }));
}

function transposeLine(line: Line, steps: number, useFlats: boolean): Line {
  return {
    ...line,
    chords: transposeChordPositions(line.chords, steps, useFlats),
  };
}

function transposeSection(section: Section, steps: number, useFlats: boolean): Section {
  return {
    ...section,
    lines: section.lines.map(l => transposeLine(l, steps, useFlats)),
  };
}

export function transposeSong(song: Song, steps: number): Song {
  const useFlats = preferFlats(transposeNote(song.key.replace(/m.*$/, ''), steps, true));
  return {
    ...song,
    key: transposeChord(song.key, steps, useFlats),
    sections: song.sections.map(s => transposeSection(s, steps, useFlats)),
    updatedAt: Date.now(),
  };
}

// Nashville Number System mapping
// Maps scale degree (0=1, 2=2, 4=3, 5=4, 7=5, 9=6, 11=7) to Nashville numbers
const MAJOR_SCALE_INTERVALS = [0, 2, 4, 5, 7, 9, 11];
const NASHVILLE_NUMERALS = ['1', '2', '3', '4', '5', '6', '7'];

export function chordToNashville(chord: string, key: string): string {
  const parsed = parseChord(chord);
  if (!parsed) return chord;

  const keyRoot = key.replace(/m.*$/, '');
  const keyIdx = NOTE_TO_INDEX[keyRoot];
  const chordIdx = NOTE_TO_INDEX[parsed.root];
  if (keyIdx === undefined || chordIdx === undefined) return chord;

  const interval = ((chordIdx - keyIdx) % 12 + 12) % 12;
  const degreeIndex = MAJOR_SCALE_INTERVALS.indexOf(interval);

  // Handle chromatic chords (not in major scale)
  if (degreeIndex === -1) {
    // Find nearest degree and mark as flat/sharp
    const semitoneAbove = MAJOR_SCALE_INTERVALS.findIndex(i => i > interval);
    if (semitoneAbove !== -1) {
      return `b${NASHVILLE_NUMERALS[semitoneAbove]}${parsed.suffix}`;
    }
    return chord; // fallback
  }

  const numeral = NASHVILLE_NUMERALS[degreeIndex];
  const bassBass = parsed.bass ? `/${chordToNashville(parsed.bass, key)}` : '';
  return `${numeral}${parsed.suffix}${bassBass}`;
}

export function convertChordNotation(chord: string, notation: NotationSystem, key: string): string {
  if (notation === 'nashville') {
    return chordToNashville(chord, key);
  }
  // For uke-ascii, guitar-ascii, letters — the chord name itself is correct;
  // diagram rendering handles the visual difference
  return chord;
}
