import type { Song, Section, Line, ChordPosition } from '../types';

/**
 * Detect if a line is primarily a chord line (most tokens are valid chords)
 */
function isChordLine(line: string): boolean {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;
  const chordTokens = tokens.filter(t => /^[A-G][b#]?(?:maj|min|m|M|dim|aug|sus|add)?(?:\d+)?(?:\/[A-G][b#]?)?$/.test(t));
  return chordTokens.length / tokens.length >= 0.6;
}

/**
 * Parse chords and their positions from a chord line
 */
function parseChordsFromLine(chordLine: string): ChordPosition[] {
  const chords: ChordPosition[] = [];
  let match: RegExpExecArray | null;
  const regex = /([A-G][b#]?(?:maj|min|m|M|dim|aug|sus|add)?(?:\d+)?(?:\/[A-G][b#]?)?)/g;
  while ((match = regex.exec(chordLine)) !== null) {
    chords.push({ chord: match[1], position: match.index });
  }
  return chords;
}

/**
 * Detect the likely section type from a label string
 */
function detectSectionType(label: string): Section['type'] {
  const l = label.toLowerCase();
  if (l.includes('chorus')) return 'chorus';
  if (l.includes('verse')) return 'verse';
  if (l.includes('bridge')) return 'bridge';
  if (l.includes('intro')) return 'intro';
  if (l.includes('outro') || l.includes('outro')) return 'outro';
  if (l.includes('pre') && l.includes('chorus')) return 'pre-chorus';
  if (l.includes('tag')) return 'tag';
  if (l.includes('instrumental') || l.includes('solo')) return 'instrumental';
  return 'other';
}

/**
 * Detect if a line is a section header like [Chorus], [Verse 1], etc.
 */
function parseSectionHeader(line: string): string | null {
  const match = line.match(/^\[([^\]]+)\]$/) || line.match(/^((?:Verse|Chorus|Bridge|Intro|Outro|Pre-Chorus|Tag|Instrumental)\s*\d*)\s*[:\-]?\s*$/i);
  return match ? match[1].trim() : null;
}

let sectionCounter = 0;
function makeSection(label: string, lines: Line[]): Section {
  return {
    id: `section-${++sectionCounter}`,
    type: detectSectionType(label),
    label,
    lines,
  };
}

/**
 * Main parser: takes raw chart text and returns a Song object
 */
export function parseChartText(text: string, title = 'Untitled', artist = ''): Song {
  sectionCounter = 0;
  const rawLines = text.replace(/\r\n/g, '\n').split('\n');

  // Try to extract title/artist from first few lines if not provided
  let titleGuess = title;
  let artistGuess = artist;
  let startIndex = 0;

  if (title === 'Untitled') {
    for (let i = 0; i < Math.min(5, rawLines.length); i++) {
      const line = rawLines[i].trim();
      if (!line) continue;
      const artistMatch = line.match(/^(?:artist|by)[:\-\s]+(.+)$/i);
      const titleMatch = line.match(/^(?:title|song)[:\-\s]+(.+)$/i);
      if (titleMatch) { titleGuess = titleMatch[1].trim(); startIndex = i + 1; }
      else if (artistMatch) { artistGuess = artistMatch[1].trim(); startIndex = i + 1; }
      else if (i === 0 && !isChordLine(line) && !parseSectionHeader(line)) {
        titleGuess = line;
        startIndex = 1;
        if (rawLines[1]?.trim() && !isChordLine(rawLines[1]) && !parseSectionHeader(rawLines[1])) {
          artistGuess = rawLines[1].trim();
          startIndex = 2;
        }
      }
    }
  }

  const sections: Section[] = [];
  let currentLabel = 'Verse 1';
  let currentLines: Line[] = [];
  let pendingChordLine: string | null = null;

  const flushSection = () => {
    if (currentLines.length > 0) {
      sections.push(makeSection(currentLabel, currentLines));
      currentLines = [];
    }
  };

  for (let i = startIndex; i < rawLines.length; i++) {
    const raw = rawLines[i];
    const trimmed = raw.trimEnd();

    // Section header
    const header = parseSectionHeader(trimmed.trim());
    if (header) {
      if (pendingChordLine !== null) {
        currentLines.push({ lyrics: '', chords: parseChordsFromLine(pendingChordLine) });
        pendingChordLine = null;
      }
      flushSection();
      currentLabel = header;
      continue;
    }

    // Empty line — let any pending chord line carry over to the next lyric line.
    if (!trimmed.trim()) continue;

    if (isChordLine(trimmed)) {
      // If we already have a pending chord line (two consecutive chord lines), flush the first
      if (pendingChordLine !== null) {
        currentLines.push({ lyrics: '', chords: parseChordsFromLine(pendingChordLine) });
      }
      pendingChordLine = trimmed;
    } else {
      // This is a lyric line
      const chords = pendingChordLine !== null ? parseChordsFromLine(pendingChordLine) : [];
      currentLines.push({ lyrics: trimmed, chords });
      pendingChordLine = null;
    }
  }

  // Flush any remaining
  if (pendingChordLine !== null) {
    currentLines.push({ lyrics: '', chords: parseChordsFromLine(pendingChordLine) });
  }
  flushSection();

  // If we got no sections, wrap everything in a single section
  if (sections.length === 0) {
    sections.push(makeSection('Verse 1', []));
  }

  // Detect key from first chord in song
  const key = detectKey(sections);

  return {
    id: crypto.randomUUID(),
    title: titleGuess,
    artist: artistGuess,
    key,
    sections,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// Semitone index for root notes
const ROOT_INDEX: Record<string, number> = {
  'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
  'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
  'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11,
};
const MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11];
const MINOR_INTERVALS = [0, 2, 3, 5, 7, 8, 10];
// Prefer flat spellings for these roots
const FLAT_ROOTS: Record<number, string> = { 1: 'Db', 3: 'Eb', 6: 'Gb', 8: 'Ab', 10: 'Bb' };
const SHARP_ROOTS: Record<number, string> = { 1: 'C#', 3: 'D#', 6: 'F#', 8: 'G#', 10: 'A#' };
const NATURAL_ROOTS: Record<number, string> = { 0: 'C', 2: 'D', 4: 'E', 5: 'F', 7: 'G', 9: 'A', 11: 'B' };

function detectKey(sections: Section[]): string {
  // Collect all chords and the first chord
  const allChords: { root: string; isMinor: boolean }[] = [];
  let firstChord: { root: string; isMinor: boolean } | null = null;

  for (const section of sections) {
    for (const line of section.lines) {
      for (const cp of line.chords) {
        const m = cp.chord.match(/^([A-G][b#]?)(m(?!aj)|min)?/);
        if (!m) continue;
        const entry = { root: m[1], isMinor: !!m[2] };
        allChords.push(entry);
        if (!firstChord) firstChord = entry;
      }
    }
  }

  if (allChords.length === 0) return 'C';

  // Score each of 24 possible keys (12 major + 12 minor)
  let bestScore = -1;
  let bestKey = firstChord ? firstChord.root + (firstChord.isMinor ? 'm' : '') : 'C';

  for (let tonic = 0; tonic < 12; tonic++) {
    for (const [intervals, isMinorKey] of [[MAJOR_INTERVALS, false], [MINOR_INTERVALS, true]] as [number[], boolean][]) {
      const scale = new Set(intervals.map(i => (tonic + i) % 12));
      let score = 0;
      for (const ch of allChords) {
        const rootIdx = ROOT_INDEX[ch.root];
        if (rootIdx === undefined) continue;
        if (scale.has(rootIdx)) score += 2;
        // Bonus: tonic chord matches key quality
        if (rootIdx === tonic && ch.isMinor === isMinorKey) score += 3;
      }
      // Bonus: first chord is the tonic
      if (firstChord) {
        const firstIdx = ROOT_INDEX[firstChord.root];
        if (firstIdx === tonic && firstChord.isMinor === isMinorKey) score += 5;
      }

      if (score > bestScore) {
        bestScore = score;
        // Prefer flat or sharp spelling based on key conventions
        const useFlatKeys = new Set([5, 10, 3, 8, 1, 6]); // F Bb Eb Ab Db Gb
        const rootName = NATURAL_ROOTS[tonic] ??
          (useFlatKeys.has(tonic) ? FLAT_ROOTS[tonic] : SHARP_ROOTS[tonic]) ?? 'C';
        bestKey = rootName + (isMinorKey ? 'm' : '');
      }
    }
  }

  return bestKey;
}
