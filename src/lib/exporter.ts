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
        // Build chord line aligned by character position
        let chordLine = '';
        const sorted = [...line.chords].sort((a, b) => a.position - b.position);
        sorted.forEach(cp => {
          const label = convertChordNotation(cp.chord, options.notation, transposed.key);
          const pos = Math.max(0, cp.position);
          if (chordLine.length < pos) chordLine += ' '.repeat(pos - chordLine.length);
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
          const pos = Math.max(0, cp.position);
          if (chordLine.length < pos) chordLine += ' '.repeat(pos - chordLine.length);
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
