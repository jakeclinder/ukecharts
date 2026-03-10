import { useMemo } from 'react';
import type { Song, Section, DisplayOptions } from '../types';
import { transposeSong } from '../lib/transpose';
import { convertChordNotation } from '../lib/transpose';
import { ChordDiagram } from './ChordDiagram';

interface Props {
  song: Song;
  options: DisplayOptions;
  printRef?: React.RefObject<HTMLDivElement>;
}

export function ChartDisplay({ song, options, printRef }: Props) {
  // Apply transposition
  const transposed = useMemo(
    () => transposeSong(song, options.transposeSteps),
    [song, options.transposeSteps]
  );

  // Collect unique chords for condensed view header
  const allChords = useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    transposed.sections.forEach(s => {
      s.lines.forEach(l => {
        l.chords.forEach(cp => {
          const displayed = convertChordNotation(cp.chord, options.notation, transposed.key);
          if (!seen.has(displayed)) {
            seen.add(displayed);
            result.push(cp.chord); // keep original for diagram lookup
          }
        });
      });
    });
    return result;
  }, [transposed, options.notation]);

  const sections = useMemo(() => {
    if (options.layoutMode === 'condensed' && options.chorusMode === 'reference') {
      // Show each unique section type once; subsequent choruses are replaced with a reference
      let chorusShown = false;
      return transposed.sections.map(s => {
        if (s.type === 'chorus') {
          if (!chorusShown) {
            chorusShown = true;
            return { section: s, isReference: false };
          }
          return { section: s, isReference: true };
        }
        return { section: s, isReference: false };
      });
    }
    return transposed.sections.map(s => ({ section: s, isReference: false }));
  }, [transposed, options]);

  return (
    <div ref={printRef} className="font-sans">
      {/* Song header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-900">{transposed.title}</h1>
        {transposed.artist && (
          <p className="text-stone-500 mt-0.5">{transposed.artist}</p>
        )}
        <div className="flex gap-4 mt-2 text-sm text-stone-500">
          <span>Key: <strong className="text-stone-700">{transposed.key}</strong></span>
          {options.transposeSteps !== 0 && (
            <span className="text-amber-600">
              ({options.transposeSteps > 0 ? '+' : ''}{options.transposeSteps} semitones from {song.key})
            </span>
          )}
          {transposed.capo && options.showCapo && (
            <span>Capo: <strong className="text-stone-700">{transposed.capo}</strong></span>
          )}
        </div>
      </div>

      {/* Condensed mode: chord grid at top */}
      {options.layoutMode === 'condensed' && options.diagramStyle !== 'none' && (
        <div className="mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-3">Chords Used</h2>
          <div className="flex flex-wrap gap-4">
            {allChords.map(chord => (
              <div key={chord} className="flex flex-col items-center">
                <ChordDiagram
                  chord={chord}
                  instrument={options.instrument}
                  style={options.diagramStyle}
                  size="sm"
                />
                {options.diagramStyle !== 'visual' && (
                  <span className="text-xs mt-1 font-medium text-stone-600">
                    {convertChordNotation(chord, options.notation, transposed.key)}
                  </span>
                )}
              </div>
            ))}
          </div>
          <div className="border-t border-stone-200 mt-6" />
        </div>
      )}

      {/* Sections */}
      <div className="space-y-8">
        {sections.map(({ section, isReference }, idx) => (
          <SectionBlock
            key={section.id + idx}
            section={section}
            isReference={isReference}
            options={options}
            songKey={transposed.key}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Section Block ────────────────────────────────────────────────────────────

interface SectionBlockProps {
  section: Section;
  isReference: boolean;
  options: DisplayOptions;
  songKey: string;
}

function SectionBlock({ section, isReference, options, songKey }: SectionBlockProps) {
  return (
    <div>
      <h2 className="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-2">
        {section.label}
      </h2>

      {isReference ? (
        <p className="text-stone-400 italic text-sm">(See {section.label} above)</p>
      ) : options.layoutMode === 'dad' ? (
        <DadLayout section={section} options={options} songKey={songKey} />
      ) : (
        <CondensedLayout section={section} options={options} songKey={songKey} />
      )}
    </div>
  );
}

// ─── Dad Layout ───────────────────────────────────────────────────────────────
// Chord diagrams positioned above the lyric they occur on, inline

function DadLayout({ section, options, songKey }: { section: Section; options: DisplayOptions; songKey: string }) {
  return (
    <div className="space-y-4">
      {section.lines.map((line, li) => {
        const hasChords = line.chords.length > 0;

        return (
          <div key={li}>
            {/* Chord diagrams row */}
            {hasChords && options.diagramStyle !== 'none' && (
              <div className="flex gap-3 mb-1 flex-wrap">
                {line.chords.map((cp, ci) => (
                  <div key={ci} className="flex flex-col items-center">
                    <ChordDiagram
                      chord={cp.chord}
                      instrument={options.instrument}
                      style={options.diagramStyle}
                      size="sm"
                    />
                    {options.diagramStyle === 'visual' && (
                      <span className="text-xs font-medium text-stone-500 mt-0.5">
                        {convertChordNotation(cp.chord, options.notation, songKey)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Inline chord names over lyrics */}
            {hasChords && options.diagramStyle === 'none' && (
              <ChordOverLyrics line={line} options={options} songKey={songKey} />
            )}

            {/* Lyrics */}
            {options.diagramStyle !== 'none' && line.lyrics && (
              <p className="text-stone-800 leading-relaxed">{line.lyrics || '\u00A0'}</p>
            )}

            {options.diagramStyle === 'none' && !hasChords && (
              <p className="text-stone-800 leading-relaxed">{line.lyrics || '\u00A0'}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Condensed Layout ─────────────────────────────────────────────────────────
// Just lyrics with chord markers above them (classic chart style)

function CondensedLayout({ section, options, songKey }: { section: Section; options: DisplayOptions; songKey: string }) {
  return (
    <div className="font-mono text-sm space-y-2">
      {section.lines.map((line, li) => (
        <div key={li}>
          {line.chords.length > 0 && (
            <ChordOverLyrics line={line} options={options} songKey={songKey} />
          )}
          {line.lyrics && (
            <div className="text-stone-800">{line.lyrics}</div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Chord Over Lyrics ────────────────────────────────────────────────────────
// Renders chords positioned above lyrics at the correct character positions

function ChordOverLyrics({ line, options, songKey }: { line: { lyrics: string; chords: { chord: string; position: number }[] }; options: DisplayOptions; songKey: string }) {
  const chords = line.chords;

  // Build the chord line by placing chord names at correct positions
  // We'll use a simple approach: build a string of spaces and insert chords
  let chordLine = '';
  const sortedChords = [...chords].sort((a, b) => a.position - b.position);

  for (const cp of sortedChords) {
    const label = convertChordNotation(cp.chord, options.notation, songKey);
    const pos = Math.max(0, cp.position);
    if (chordLine.length < pos) {
      chordLine += ' '.repeat(pos - chordLine.length);
    }
    chordLine += label + ' ';
  }

  return (
    <div className="font-mono text-sm">
      <div className="text-amber-700 font-semibold whitespace-pre">{chordLine}</div>
    </div>
  );
}
