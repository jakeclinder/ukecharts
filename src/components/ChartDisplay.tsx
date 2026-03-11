import { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import type { Song, Section, Line, ChordPosition, DisplayOptions } from '../types';
import { transposeSong, convertChordNotation } from '../lib/transpose';
import { ChordDiagram } from './ChordDiagram';

interface Props {
  song: Song;
  options: DisplayOptions;
  printRef?: React.RefObject<HTMLDivElement>;
  onUpdateSong?: (song: Song) => void;
}

export function ChartDisplay({ song, options, printRef, onUpdateSong }: Props) {
  const transposed = useMemo(
    () => transposeSong(song, options.transposeSteps),
    [song, options.transposeSteps]
  );

  const allChords = useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    transposed.sections.forEach(s => {
      s.lines.forEach(l => {
        l.chords.forEach(cp => {
          const displayed = convertChordNotation(cp.chord, options.notation, transposed.key);
          if (!seen.has(displayed)) {
            seen.add(displayed);
            result.push(cp.chord);
          }
        });
      });
    });
    return result;
  }, [transposed, options.notation]);

  const sections = useMemo(() => {
    if (options.layoutMode === 'condensed' && options.chorusMode === 'reference') {
      let chorusShown = false;
      return transposed.sections.map(s => {
        if (s.type === 'chorus') {
          if (!chorusShown) { chorusShown = true; return { section: s, isReference: false }; }
          return { section: s, isReference: true };
        }
        return { section: s, isReference: false };
      });
    }
    return transposed.sections.map(s => ({ section: s, isReference: false }));
  }, [transposed, options]);

  // Update a line in the original (pre-transposition) song.
  // We preserve original chord names and only update positions + lyrics.
  const handleUpdateLine = useCallback((sectionIdx: number, lineIdx: number, updatedLine: Line) => {
    if (!onUpdateSong) return;
    const originalLine = song.sections[sectionIdx]?.lines[lineIdx];
    if (!originalLine) return;
    const merged: Line = {
      lyrics: updatedLine.lyrics,
      chords: updatedLine.chords.map((cp, i) => ({
        chord: originalLine.chords[i]?.chord ?? cp.chord,
        position: cp.position,
      })),
    };
    onUpdateSong({
      ...song,
      updatedAt: Date.now(),
      sections: song.sections.map((s, si) =>
        si !== sectionIdx ? s : {
          ...s,
          lines: s.lines.map((l, li) => li !== lineIdx ? l : merged),
        }
      ),
    });
  }, [song, onUpdateSong]);

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
            sectionIdx={idx}
            isReference={isReference}
            options={options}
            songKey={transposed.key}
            onUpdateLine={onUpdateSong ? handleUpdateLine : undefined}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Section Block ────────────────────────────────────────────────────────────

interface SectionBlockProps {
  section: Section;
  sectionIdx: number;
  isReference: boolean;
  options: DisplayOptions;
  songKey: string;
  onUpdateLine?: (sectionIdx: number, lineIdx: number, updatedLine: Line) => void;
}

function SectionBlock({ section, sectionIdx, isReference, options, songKey, onUpdateLine }: SectionBlockProps) {
  const handleUpdateLine = useCallback((lineIdx: number, updatedLine: Line) => {
    onUpdateLine?.(sectionIdx, lineIdx, updatedLine);
  }, [sectionIdx, onUpdateLine]);

  return (
    <div>
      <h2 className="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-2">
        {section.label}
      </h2>
      {isReference ? (
        <p className="text-stone-400 italic text-sm">(See {section.label} above)</p>
      ) : options.layoutMode === 'dad' ? (
        <DadLayout
          section={section}
          options={options}
          songKey={songKey}
          onUpdateLine={onUpdateLine ? handleUpdateLine : undefined}
        />
      ) : (
        <CondensedLayout
          section={section}
          options={options}
          songKey={songKey}
          onUpdateLine={onUpdateLine ? handleUpdateLine : undefined}
        />
      )}
    </div>
  );
}

// ─── Dad Layout ───────────────────────────────────────────────────────────────

function DadLayout({
  section, options, songKey, onUpdateLine,
}: {
  section: Section;
  options: DisplayOptions;
  songKey: string;
  onUpdateLine?: (lineIdx: number, updatedLine: Line) => void;
}) {
  return (
    <div className="space-y-4">
      {section.lines.map((line, li) => {
        const hasChords = line.chords.length > 0;
        const handleUpdate = onUpdateLine ? (updated: Line) => onUpdateLine(li, updated) : undefined;

        return (
          <div key={li}>
            {/* Draggable chord diagrams row */}
            {hasChords && options.diagramStyle !== 'none' && (
              <DiagramRow
                line={line}
                options={options}
                songKey={songKey}
                onUpdateLine={handleUpdate}
              />
            )}

            {/* Draggable chord names row (diagram style: none) */}
            {hasChords && options.diagramStyle === 'none' && (
              <ChordOverLyrics
                line={line}
                options={options}
                songKey={songKey}
                onUpdateLine={handleUpdate}
              />
            )}

            {/* Lyrics */}
            {line.lyrics && (
              <EditableLyrics
                text={line.lyrics}
                onSave={handleUpdate ? (t) => handleUpdate({ ...line, lyrics: t }) : undefined}
                className="text-stone-800 leading-relaxed"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Condensed Layout ─────────────────────────────────────────────────────────

function CondensedLayout({
  section, options, songKey, onUpdateLine,
}: {
  section: Section;
  options: DisplayOptions;
  songKey: string;
  onUpdateLine?: (lineIdx: number, updatedLine: Line) => void;
}) {
  return (
    <div className="font-mono text-sm space-y-2">
      {section.lines.map((line, li) => {
        const handleUpdate = onUpdateLine ? (updated: Line) => onUpdateLine(li, updated) : undefined;
        return (
          <div key={li}>
            {line.chords.length > 0 && (
              <ChordOverLyrics
                line={line}
                options={options}
                songKey={songKey}
                onUpdateLine={handleUpdate}
              />
            )}
            {line.lyrics && (
              <EditableLyrics
                text={line.lyrics}
                onSave={handleUpdate ? (t) => handleUpdate({ ...line, lyrics: t }) : undefined}
                className="text-stone-800"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Diagram Row ──────────────────────────────────────────────────────────────
// Chord diagrams absolutely positioned at cp.position ch units — draggable.

function DiagramRow({
  line, options, songKey, onUpdateLine,
}: {
  line: Line;
  options: DisplayOptions;
  songKey: string;
  onUpdateLine?: (updatedLine: Line) => void;
}) {
  const lineRef = useRef(line);
  lineRef.current = line;
  const onUpdateLineRef = useRef(onUpdateLine);
  onUpdateLineRef.current = onUpdateLine;

  const measureRef = useRef<HTMLSpanElement>(null);
  const charWidthRef = useRef<number>(8.4);
  useEffect(() => {
    if (measureRef.current) charWidthRef.current = measureRef.current.getBoundingClientRect().width;
  });

  const handleMouseDown = useDragChords(lineRef, onUpdateLineRef, charWidthRef);

  const canDrag = !!onUpdateLine;
  // Height: ascii diagrams are taller than visual SVG diagrams
  const rowHeight = options.diagramStyle === 'ascii' ? '8.5rem' : '5.5rem';

  return (
    <div className="relative font-mono text-sm select-none mb-1" style={{ minHeight: rowHeight }}>
      {/* Char-width measurement span */}
      <span ref={measureRef} aria-hidden className="absolute opacity-0 pointer-events-none font-mono text-sm">X</span>

      {line.chords.map((cp, ci) => (
        <div
          key={ci}
          style={{ left: `${cp.position}ch`, top: 0, position: 'absolute' }}
          className={`flex flex-col items-center${canDrag ? ' cursor-grab active:cursor-grabbing' : ''}`}
          onMouseDown={canDrag ? (e) => handleMouseDown(e, ci) : undefined}
          title={canDrag ? 'Drag to reposition' : undefined}
        >
          <ChordDiagram
            chord={cp.chord}
            instrument={options.instrument}
            style={options.diagramStyle}
            size="sm"
          />
          {options.diagramStyle === 'visual' && (
            <span className="text-xs font-medium text-stone-500 mt-0.5 select-none">
              {convertChordNotation(cp.chord, options.notation, songKey)}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Shared drag hook ─────────────────────────────────────────────────────────
// Shared between ChordOverLyrics and DiagramRow.

function useDragChords(
  lineRef: React.MutableRefObject<Line>,
  onUpdateLineRef: React.MutableRefObject<((updated: Line) => void) | undefined>,
  charWidthRef: React.MutableRefObject<number>
) {
  const dragRef = useRef<{
    startX: number;
    originalChords: ChordPosition[];
    chordIdx: number;
  } | null>(null);

  return useCallback((e: React.MouseEvent, chordIdx: number) => {
    if (!onUpdateLineRef.current) return;
    e.preventDefault();
    dragRef.current = {
      startX: e.clientX,
      originalChords: lineRef.current.chords.map(cp => ({ ...cp })),
      chordIdx,
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current || !onUpdateLineRef.current) return;
      const { startX, originalChords, chordIdx } = dragRef.current;
      const delta = Math.round((e.clientX - startX) / (charWidthRef.current || 8.4));
      const newPos = Math.max(0, originalChords[chordIdx].position + delta);
      const newChords = originalChords.map((cp, i) =>
        i === chordIdx ? { ...cp, position: newPos } : cp
      );
      onUpdateLineRef.current({ ...lineRef.current, chords: newChords });
    };

    const handleMouseUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}

// ─── Chord Over Lyrics ────────────────────────────────────────────────────────
// Each chord rendered as an absolutely-positioned span (ch units = monospace chars).
// Drag left/right to reposition a chord over the lyrics.

function ChordOverLyrics({
  line, options, songKey, onUpdateLine,
}: {
  line: Line;
  options: DisplayOptions;
  songKey: string;
  onUpdateLine?: (updatedLine: Line) => void;
}) {
  const lineRef = useRef(line);
  lineRef.current = line;
  const onUpdateLineRef = useRef(onUpdateLine);
  onUpdateLineRef.current = onUpdateLine;

  const measureRef = useRef<HTMLSpanElement>(null);
  const charWidthRef = useRef<number>(8.4);
  useEffect(() => {
    if (measureRef.current) charWidthRef.current = measureRef.current.getBoundingClientRect().width;
  });

  const handleMouseDown = useDragChords(lineRef, onUpdateLineRef, charWidthRef);

  const sortedIndexedChords = useMemo(
    () => line.chords.map((cp, idx) => ({ cp, idx })).sort((a, b) => a.cp.position - b.cp.position),
    [line.chords]
  );

  const canDrag = !!onUpdateLine;

  return (
    <div className="font-mono text-sm relative select-none" style={{ height: '1.4em' }}>
      {/* Hidden span to measure actual character width */}
      <span
        ref={measureRef}
        aria-hidden
        className="absolute opacity-0 pointer-events-none font-mono text-sm"
      >
        X
      </span>

      {sortedIndexedChords.map(({ cp, idx }) => {
        const label = convertChordNotation(cp.chord, options.notation, songKey);
        return (
          <span
            key={idx}
            style={{ left: `${cp.position}ch`, top: 0 }}
            className={`absolute text-amber-700 font-semibold whitespace-nowrap${canDrag ? ' cursor-grab active:cursor-grabbing' : ''}`}
            onMouseDown={canDrag ? (e) => handleMouseDown(e, idx) : undefined}
            title={canDrag ? 'Drag to reposition' : undefined}
          >
            {label}
          </span>
        );
      })}
    </div>
  );
}

// ─── Editable Lyrics ──────────────────────────────────────────────────────────
// Click to edit a lyric line in place. Press Enter or click away to save.

function EditableLyrics({
  text,
  onSave,
  className,
}: {
  text: string;
  onSave?: (newText: string) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(text);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setValue(text);
  }, [text, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = useCallback(() => {
    setEditing(false);
    if (value !== text) onSave?.(value);
  }, [value, text, onSave]);

  if (!onSave) {
    return <p className={className}>{text || '\u00A0'}</p>;
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') { setValue(text); setEditing(false); }
        }}
        className={`${className} w-full bg-amber-50 border-b border-amber-300 outline-none`}
        style={{ fontFamily: 'inherit', fontSize: 'inherit' }}
      />
    );
  }

  return (
    <p
      className={`${className} cursor-text hover:bg-amber-50 rounded px-0.5 -mx-0.5 transition-colors`}
      onClick={() => setEditing(true)}
      title="Click to edit"
    >
      {text || '\u00A0'}
    </p>
  );
}
