import type { Song } from '../types';

/**
 * Returns the set of unique chord names that appear in the song,
 * ignoring duplicates and ignoring transposition (uses stored chord names).
 */
export function uniqueChords(song: Song): Set<string> {
  const seen = new Set<string>();
  for (const section of song.sections) {
    for (const line of section.lines) {
      for (const cp of line.chords) {
        seen.add(cp.chord);
      }
    }
  }
  return seen;
}

export function uniqueChordCount(song: Song): number {
  return uniqueChords(song).size;
}
