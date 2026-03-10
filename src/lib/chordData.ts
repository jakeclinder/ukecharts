/**
 * Chord fingering data for ukulele and guitar.
 * Format: [string1, string2, string3, string4] for uke (GCEA)
 *         [string1..string6] for guitar (EADGBE)
 * Values: fret number, -1 = muted (x), 0 = open
 * barre: optional barre fret
 * fingers: optional finger numbers
 */

export interface ChordFingering {
  frets: number[];         // fret positions per string (low to high)
  barre?: number;          // barre fret if applicable
  baseFret?: number;       // fret offset (for high-position chords)
  fingers?: number[];
  muted?: number[];        // string indices that are muted
}

// Ukulele chord library (GCEA tuning, 4 strings)
export const UKE_CHORDS: Record<string, ChordFingering> = {
  'C':    { frets: [0, 0, 0, 3] },
  'Cm':   { frets: [0, 3, 3, 3] },
  'C7':   { frets: [0, 0, 0, 1] },
  'Cmaj7':{ frets: [0, 0, 0, 2] },
  'C#':   { frets: [1, 1, 1, 4] },
  'Db':   { frets: [1, 1, 1, 4] },
  'D':    { frets: [2, 2, 2, 0] },
  'Dm':   { frets: [2, 2, 1, 0] },
  'D7':   { frets: [2, 2, 2, 3] },
  'D#':   { frets: [3, 3, 3, 1] },
  'Eb':   { frets: [3, 3, 3, 1] },
  'E':    { frets: [4, 4, 4, 2] },
  'Em':   { frets: [0, 4, 3, 2] },
  'E7':   { frets: [1, 2, 0, 2] },
  'F':    { frets: [2, 0, 1, 0] },
  'Fm':   { frets: [1, 0, 1, 3] },
  'F7':   { frets: [2, 3, 1, 3] },
  'Fmaj7':{ frets: [2, 4, 1, 3] },
  'F#':   { frets: [3, 1, 2, 1] },
  'Gb':   { frets: [3, 1, 2, 1] },
  'G':    { frets: [0, 2, 3, 2] },
  'Gm':   { frets: [0, 2, 3, 1] },
  'G7':   { frets: [0, 2, 1, 2] },
  'Gmaj7':{ frets: [0, 2, 2, 2] },
  'G#':   { frets: [5, 3, 4, 3] },
  'Ab':   { frets: [5, 3, 4, 3] },
  'A':    { frets: [2, 1, 0, 0] },
  'Am':   { frets: [2, 0, 0, 0] },
  'A7':   { frets: [0, 1, 0, 0] },
  'Amaj7':{ frets: [1, 1, 0, 0] },
  'A#':   { frets: [3, 2, 1, 1] },
  'Bb':   { frets: [3, 2, 1, 1] },
  'Bbm':  { frets: [3, 1, 1, 1] },
  'B':    { frets: [4, 3, 2, 2] },
  'Bm':   { frets: [4, 2, 2, 2] },
  'B7':   { frets: [2, 3, 2, 2] },
};

// Guitar chord library (EADGBE tuning, 6 strings)
export const GUITAR_CHORDS: Record<string, ChordFingering> = {
  'C':    { frets: [-1, 3, 2, 0, 1, 0], muted: [0] },
  'Cm':   { frets: [-1, 3, 5, 5, 4, 3], muted: [0] },
  'C7':   { frets: [-1, 3, 2, 3, 1, 0], muted: [0] },
  'Cmaj7':{ frets: [-1, 3, 2, 0, 0, 0], muted: [0] },
  'D':    { frets: [-1, -1, 0, 2, 3, 2], muted: [0, 1] },
  'Dm':   { frets: [-1, -1, 0, 2, 3, 1], muted: [0, 1] },
  'D7':   { frets: [-1, -1, 0, 2, 1, 2], muted: [0, 1] },
  'E':    { frets: [0, 2, 2, 1, 0, 0] },
  'Em':   { frets: [0, 2, 2, 0, 0, 0] },
  'E7':   { frets: [0, 2, 0, 1, 0, 0] },
  'F':    { frets: [1, 3, 3, 2, 1, 1], barre: 1 },
  'Fm':   { frets: [1, 3, 3, 1, 1, 1], barre: 1 },
  'G':    { frets: [3, 2, 0, 0, 0, 3] },
  'Gm':   { frets: [3, 5, 5, 3, 3, 3], barre: 3 },
  'G7':   { frets: [3, 2, 0, 0, 0, 1] },
  'A':    { frets: [-1, 0, 2, 2, 2, 0], muted: [0] },
  'Am':   { frets: [-1, 0, 2, 2, 1, 0], muted: [0] },
  'A7':   { frets: [-1, 0, 2, 0, 2, 0], muted: [0] },
  'B':    { frets: [-1, 2, 4, 4, 4, 2], muted: [0] },
  'Bm':   { frets: [-1, 2, 4, 4, 3, 2], barre: 2, muted: [0] },
  'B7':   { frets: [-1, 2, 1, 2, 0, 2], muted: [0] },
  'Bb':   { frets: [-1, 1, 3, 3, 3, 1], barre: 1, muted: [0] },
  'Bbm':  { frets: [-1, 1, 3, 3, 2, 1], barre: 1, muted: [0] },
  'F#':   { frets: [2, 4, 4, 3, 2, 2], barre: 2 },
  'Gb':   { frets: [2, 4, 4, 3, 2, 2], barre: 2 },
  'Ab':   { frets: [4, 6, 6, 5, 4, 4], barre: 4 },
};

export function getChordFingering(chord: string, instrument: 'ukulele' | 'guitar'): ChordFingering | null {
  // Strip slash bass note for lookup
  const root = chord.split('/')[0];
  const db = instrument === 'ukulele' ? UKE_CHORDS : GUITAR_CHORDS;

  // Direct lookup
  if (db[root]) return db[root];

  // Try enharmonic equivalents
  const enharmonics: Record<string, string> = {
    'C#': 'Db', 'Db': 'C#', 'D#': 'Eb', 'Eb': 'D#',
    'F#': 'Gb', 'Gb': 'F#', 'G#': 'Ab', 'Ab': 'G#',
    'A#': 'Bb', 'Bb': 'A#',
  };
  const rootNote = root.match(/^([A-G][b#]?)/)?.[1];
  const suffix = root.slice(rootNote?.length ?? 0);
  if (rootNote && enharmonics[rootNote]) {
    const alt = enharmonics[rootNote] + suffix;
    if (db[alt]) return db[alt];
  }

  return null;
}

/**
 * Generate ASCII diagram for a chord
 */
export function chordToAscii(chord: string, instrument: 'ukulele' | 'guitar'): string {
  const fingering = getChordFingering(chord, instrument);
  if (!fingering) return chord;

  const strings = fingering.frets;
  const numStrings = strings.length;
  const baseFret = fingering.baseFret ?? 1;
  const maxFret = Math.max(...strings.filter(f => f >= 0), baseFret + 3);
  const numFrets = Math.min(maxFret - baseFret + 1, 5);

  // Header line with open/muted markers
  const headerParts = strings.map(f => {
    if (f === -1) return 'x';
    if (f === 0) return 'o';
    return ' ';
  });

  let result = `${chord}\n`;
  result += headerParts.join(' ') + '\n';
  result += (baseFret > 1 ? `${baseFret}fr` : '') + '\n';

  // Fret grid
  for (let fret = baseFret; fret < baseFret + numFrets; fret++) {
    const row = strings.map(f => {
      if (f === fret) return '●';
      return '|';
    });
    result += row.join('') + '\n';
    result += '-'.repeat(numStrings * 2 - 1) + '\n';
  }

  return result;
}
