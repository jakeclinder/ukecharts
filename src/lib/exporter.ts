import { saveAs } from 'file-saver';
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
} from 'docx';
import type { Song, DisplayOptions } from '../types';
import { transposeSong } from './transpose';
import { convertChordNotation } from './transpose';

// ─── PDF ──────────────────────────────────────────────────────────────────────
// Uses the browser's native print dialog (choose "Save as PDF").
// This captures the exact visual output including SVG chord diagrams.

export function exportToPdf(): void {
  window.print();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Given a lyrics string and an approximate character position (in monospace ch
 * units, as stored by the drag handler), return the character index of the
 * nearest word start. This corrects the systematic offset that appears when the
 * user drags chords over proportional-font lyrics but positions are stored in
 * monospace units.
 */
function snapToWordStart(lyrics: string, approxPos: number): number {
  if (!lyrics) return approxPos;
  const wordStarts: number[] = [0];
  for (let i = 1; i < lyrics.length; i++) {
    if (lyrics[i] !== ' ' && lyrics[i - 1] === ' ') wordStarts.push(i);
  }
  return wordStarts.reduce((best, start) =>
    Math.abs(start - approxPos) < Math.abs(best - approxPos) ? start : best
  );
}

// ─── TXT ──────────────────────────────────────────────────────────────────────

export function exportToTxt(song: Song, options: DisplayOptions): void {
  const transposed = transposeSong(song, options.transposeSteps);
  const lines: string[] = [];

  lines.push(transposed.title);
  if (transposed.artist) lines.push(transposed.artist);
  lines.push(`Key: ${transposed.key}`);
  if (options.transposeSteps !== 0) {
    lines.push(`(Transposed ${options.transposeSteps > 0 ? '+' : ''}${options.transposeSteps} semitones)`);
  }
  lines.push('');


  let chorusShown = false;
  transposed.sections.forEach(section => {
    const isReference = options.chorusMode === 'reference' && section.type === 'chorus' && chorusShown;
    if (section.type === 'chorus') chorusShown = true;

    lines.push(`[${section.label}]`);

    if (isReference) {
      lines.push('(See chorus above)');
      lines.push('');
      return;
    }

    section.lines.forEach(line => {
      if (line.chords.length > 0) {
        // Build chord line aligned by character position.
        // Snap each position to the nearest word start for accurate TXT alignment.
        let chordLine = '';
        const sorted = [...line.chords].sort((a, b) => a.position - b.position);
        sorted.forEach(cp => {
          const label = convertChordNotation(cp.chord, options.notation, transposed.key);
          const pos = line.lyrics
            ? snapToWordStart(line.lyrics, Math.max(0, cp.position))
            : Math.max(0, cp.position);
          if (chordLine.length < pos) chordLine += ' '.repeat(pos - chordLine.length);
          if (chordLine.length > pos) chordLine += ' ';
          chordLine += label + ' ';
        });
        lines.push(chordLine.trimEnd());
      }

      if (line.lyrics) lines.push(line.lyrics);
    });

    lines.push('');
  });

  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  saveAs(blob, `${song.title || 'chart'}.txt`);
}

// ─── OnSong ───────────────────────────────────────────────────────────────────
// OnSong format: https://onsongapp.com/docs/features/formats/onsong/
// Chords are inline with lyrics using [ChordName] before the syllable.

export function exportToOnSong(song: Song, options: DisplayOptions): void {
  const transposed = transposeSong(song, options.transposeSteps);
  const outLines: string[] = [];

  // Header metadata
  outLines.push(transposed.title);
  if (transposed.artist) outLines.push(transposed.artist);
  outLines.push(`Key: ${transposed.key}`);
  if (transposed.capo && options.showCapo) outLines.push(`Capo: ${transposed.capo}`);
  if (transposed.tempo) outLines.push(`Tempo: ${transposed.tempo}`);
  if (transposed.timeSignature) outLines.push(`Time: ${transposed.timeSignature}`);
  outLines.push('');

  let chorusShown = false;
  transposed.sections.forEach(section => {
    const isReference = options.chorusMode === 'reference' && section.type === 'chorus' && chorusShown;
    if (section.type === 'chorus') chorusShown = true;

    outLines.push(`[${section.label}]`);

    if (isReference) {
      outLines.push('(See chorus above)');
      outLines.push('');
      return;
    }

    section.lines.forEach(line => {
      if (!line.lyrics && line.chords.length === 0) return;

      if (line.chords.length === 0) {
        outLines.push(line.lyrics);
        return;
      }

      if (!line.lyrics) {
        // Chords-only line — output space-separated chord names
        const chordNames = [...line.chords]
          .sort((a, b) => a.position - b.position)
          .map(cp => `[${convertChordNotation(cp.chord, options.notation, transposed.key)}]`)
          .join(' ');
        outLines.push(chordNames);
        return;
      }

      // Interleave [Chord] markers into the lyrics at the correct character positions.
      // Build in reverse order so insertions don't shift later indices.
      const sorted = [...line.chords]
        .sort((a, b) => a.position - b.position)
        .map(cp => ({
          label: convertChordNotation(cp.chord, options.notation, transposed.key),
          pos: snapToWordStart(line.lyrics, Math.max(0, cp.position)),
        }));

      let result = line.lyrics;
      for (let i = sorted.length - 1; i >= 0; i--) {
        const { label, pos } = sorted[i];
        const insertAt = Math.min(pos, result.length);
        result = result.slice(0, insertAt) + `[${label}]` + result.slice(insertAt);
      }
      outLines.push(result);
    });

    outLines.push('');
  });

  const blob = new Blob([outLines.join('\n')], { type: 'text/plain;charset=utf-8' });
  saveAs(blob, `${song.title || 'chart'}.onsong`);
}

// ─── DOCX ─────────────────────────────────────────────────────────────────────

export async function exportToDocx(song: Song, options: DisplayOptions): Promise<void> {
  const transposed = transposeSong(song, options.transposeSteps);
  const paragraphs: Paragraph[] = [];

  // Title
  paragraphs.push(new Paragraph({
    text: transposed.title,
    heading: HeadingLevel.HEADING_1,
  }));

  if (transposed.artist) {
    paragraphs.push(new Paragraph({ text: transposed.artist }));
  }

  paragraphs.push(new Paragraph({
    children: [
      new TextRun({ text: `Key: `, bold: true }),
      new TextRun({ text: transposed.key }),
      ...(options.transposeSteps !== 0 ? [
        new TextRun({ text: `  (transposed ${options.transposeSteps > 0 ? '+' : ''}${options.transposeSteps} semitones)`, italics: true, color: 'B45309' }),
      ] : []),
    ],
  }));

  paragraphs.push(new Paragraph({ text: '' }));

  // Sections
  let chorusShown = false;
  transposed.sections.forEach(section => {
    const isReference = options.chorusMode === 'reference' && section.type === 'chorus' && chorusShown;
    if (section.type === 'chorus') chorusShown = true;

    paragraphs.push(new Paragraph({
      text: section.label,
      heading: HeadingLevel.HEADING_2,
    }));

    if (isReference) {
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text: '(See chorus above)', italics: true, color: '888888' })],
      }));
      paragraphs.push(new Paragraph({ text: '' }));
      return;
    }

    section.lines.forEach(line => {
      if (line.chords.length > 0) {
        let chordLine = '';
        const sorted = [...line.chords].sort((a, b) => a.position - b.position);
        sorted.forEach(cp => {
          const label = convertChordNotation(cp.chord, options.notation, transposed.key);
          const pos = line.lyrics
            ? snapToWordStart(line.lyrics, Math.max(0, cp.position))
            : Math.max(0, cp.position);
          if (chordLine.length < pos) chordLine += ' '.repeat(pos - chordLine.length);
          if (chordLine.length > pos) chordLine += ' ';
          chordLine += label + ' ';
        });
        paragraphs.push(new Paragraph({
          children: [new TextRun({ text: chordLine.trimEnd(), font: 'Courier New', color: 'B45309', bold: true })],
        }));
      }

      if (line.lyrics) {
        paragraphs.push(new Paragraph({
          children: [new TextRun({ text: line.lyrics, font: 'Courier New' })],
        }));
      }
    });

    paragraphs.push(new Paragraph({ text: '' }));
  });

  const doc = new Document({ sections: [{ children: paragraphs }] });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${song.title || 'chart'}.docx`);
}
