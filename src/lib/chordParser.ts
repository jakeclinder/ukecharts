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

    // Empty line — flush pending chord if any, then signal section break
    if (!trimmed.trim()) {
      if (pendingChordLine !== null) {
        currentLines.push({ lyrics: '', chords: parseChordsFromLine(pendingChordLine) });
        pendingChordLine = null;
      }
      // Don't auto-flush section on blank lines (common in charts)
      continue;
    }

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

function detectKey(sections: Section[]): string {
  for (const section of sections) {
    for (const line of section.lines) {
      if (line.chords.length > 0) {
        return line.chords[0].chord;
      }
    }
  }
  return 'C';
}
