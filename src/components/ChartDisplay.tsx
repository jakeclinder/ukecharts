import { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import type { Song, Section, Line, ChordPosition, DisplayOptions } from '../types';
import { transposeSong, convertChordNotation, transposeChord, preferFlats } from '../lib/transpose';
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


  const sections = useMemo(() => {
    if (options.chorusMode === 'reference') {
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

  // ── helpers ──────────────────────────────────────────────────────────────
  const updateSong = useCallback((
    sectionIdx: number,
    mapLines: (lines: Line[]) => Line[]
  ) => {
    if (!onUpdateSong) return;
    onUpdateSong({
      ...song,
      updatedAt: Date.now(),
      sections: song.sections.map((s, si) =>
        si !== sectionIdx ? s : { ...s, lines: mapLines(s.lines) }
      ),
    });
  }, [song, onUpdateSong]);

  // Update a line: preserve original chord names, only allow position changes.
  const handleUpdateLine = useCallback((sectionIdx: number, lineIdx: number, updatedLine: Line) => {
    const originalLine = song.sections[sectionIdx]?.lines[lineIdx];
    if (!originalLine) return;
    const merged: Line = {
      lyrics: updatedLine.lyrics,
      chords: updatedLine.chords.map((cp, i) => ({
        chord: originalLine.chords[i]?.chord ?? cp.chord,
        position: cp.position,
      })),
    };
    updateSong(sectionIdx, lines => lines.map((l, li) => li !== lineIdx ? l : merged));
  }, [song, updateSong]);

  // Replace all lines in a section (section-level lyrics textarea).
  const handleUpdateSection = useCallback((sectionIdx: number, newLines: Line[]) => {
    const originalSection = song.sections[sectionIdx];
    if (!originalSection) return;
    const merged = newLines.map((line, i) => ({
      lyrics: line.lyrics,
      chords: originalSection.lines[i]?.chords ?? [],
    }));
    updateSong(sectionIdx, () => merged);
  }, [song, updateSong]);

  // Add a chord typed in the current (possibly transposed) key → store in original key.
  const handleAddChord = useCallback((sectionIdx: number, lineIdx: number, chord: string) => {
    const useFlats = preferFlats(song.key.replace(/m.*$/, ''));
    const originalChord = options.transposeSteps !== 0
      ? transposeChord(chord, -options.transposeSteps, useFlats)
      : chord;
    updateSong(sectionIdx, lines =>
      lines.map((l, li) =>
        li !== lineIdx ? l : { ...l, chords: [...l.chords, { chord: originalChord, position: 0 }] }
      )
    );
  }, [song, options.transposeSteps, updateSong]);

  // Remove a chord by index.
  const handleRemoveChord = useCallback((sectionIdx: number, lineIdx: number, chordIdx: number) => {
    updateSong(sectionIdx, lines =>
      lines.map((l, li) =>
        li !== lineIdx ? l : { ...l, chords: l.chords.filter((_, i) => i !== chordIdx) }
      )
    );
  }, [updateSong]);

  // Move a chord from one line to another (or reposition within same line).
  const handleMoveChord = useCallback((
    sectionIdx: number,
    fromLine: number,
    chordIdx: number,
    toLine: number,
    newPosition: number,
  ) => {
    const originalSection = song.sections[sectionIdx];
    if (!originalSection) return;
    const srcLine = originalSection.lines[fromLine];
    const dstLine = originalSection.lines[toLine];
    if (!srcLine || !dstLine) return;
    const movingChord = srcLine.chords[chordIdx];
    if (!movingChord) return;

    updateSong(sectionIdx, lines =>
      lines.map((l, li) => {
        if (li === fromLine && li === toLine) {
          // Same line — just update position
          return {
            ...l,
            chords: l.chords.map((cp, i) =>
              i === chordIdx ? { ...cp, position: newPosition } : cp
            ),
          };
        }
        if (li === fromLine) {
          return { ...l, chords: l.chords.filter((_, i) => i !== chordIdx) };
        }
        if (li === toLine) {
          return {
            ...l,
            chords: [...l.chords, { chord: movingChord.chord, position: newPosition }]
              .sort((a, b) => a.position - b.position),
          };
        }
        return l;
      })
    );
  }, [song, updateSong]);

  const handleAddLine = useCallback((sectionIdx: number) => {
    updateSong(sectionIdx, lines => [...lines, { lyrics: '', chords: [] }]);
  }, [updateSong]);

  const handleDeleteLine = useCallback((sectionIdx: number, lineIdx: number) => {
    updateSong(sectionIdx, lines => lines.filter((_, i) => i !== lineIdx));
  }, [updateSong]);

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
            onUpdateSection={onUpdateSong ? handleUpdateSection : undefined}
            onAddChord={onUpdateSong ? handleAddChord : undefined}
            onRemoveChord={onUpdateSong ? handleRemoveChord : undefined}
            onMoveChord={onUpdateSong ? handleMoveChord : undefined}
            onAddLine={onUpdateSong ? handleAddLine : undefined}
            onDeleteLine={onUpdateSong ? handleDeleteLine : undefined}
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
  onUpdateSection?: (sectionIdx: number, newLines: Line[]) => void;
  onAddChord?: (sectionIdx: number, lineIdx: number, chord: string) => void;
  onRemoveChord?: (sectionIdx: number, lineIdx: number, chordIdx: number) => void;
  onMoveChord?: (sectionIdx: number, fromLine: number, chordIdx: number, toLine: number, pos: number) => void;
  onAddLine?: (sectionIdx: number) => void;
  onDeleteLine?: (sectionIdx: number, lineIdx: number) => void;
}

function SectionBlock({
  section, sectionIdx, isReference, options, songKey,
  onUpdateLine, onUpdateSection, onAddChord, onRemoveChord, onMoveChord, onAddLine, onDeleteLine,
}: SectionBlockProps) {
  const [editingLyrics, setEditingLyrics] = useState(false);

  // Curry sectionIdx out so layouts get simpler (lineIdx, ...) signatures.
  const updateLine = onUpdateLine
    ? (li: number, l: Line) => onUpdateLine(sectionIdx, li, l)
    : undefined;
  const addChord = onAddChord
    ? (li: number, ch: string) => onAddChord(sectionIdx, li, ch)
    : undefined;
  const removeChord = onRemoveChord
    ? (li: number, ci: number) => onRemoveChord(sectionIdx, li, ci)
    : undefined;
  const moveChord = onMoveChord
    ? (fromLine: number, ci: number, toLine: number, pos: number) =>
        onMoveChord(sectionIdx, fromLine, ci, toLine, pos)
    : undefined;
  const addLine = onAddLine ? () => onAddLine(sectionIdx) : undefined;
  const deleteLine = onDeleteLine ? (li: number) => onDeleteLine(sectionIdx, li) : undefined;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-stone-400">
          {section.label}
        </h2>
        {onUpdateSection && !isReference && !editingLyrics && (
          <button
            data-no-print
            onClick={() => setEditingLyrics(true)}
            className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
          >
            edit lyrics
          </button>
        )}
      </div>

      {isReference ? (
        <p className="text-stone-400 italic text-sm">(See {section.label} above)</p>
      ) : editingLyrics ? (
        <SectionLyricsTextarea
          section={section}
          onSave={(newLines) => {
            onUpdateSection?.(sectionIdx, newLines);
            setEditingLyrics(false);
          }}
          onCancel={() => setEditingLyrics(false)}
        />
      ) : (
        <DadLayout
          section={section}
          options={options}
          songKey={songKey}
          onUpdateLine={updateLine}
          onAddChord={addChord}
          onRemoveChord={removeChord}
          onMoveChord={moveChord}
          onAddLine={addLine}
          onDeleteLine={deleteLine}
        />
      )}
    </div>
  );
}

// ─── Section Lyrics Textarea ──────────────────────────────────────────────────

function SectionLyricsTextarea({
  section, onSave, onCancel,
}: {
  section: Section;
  onSave: (newLines: Line[]) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(
    () => section.lines.map(l => l.lyrics).join('\n')
  );
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
  };

  const handleSave = () => {
    const newLyrics = value.split('\n');
    const newLines: Line[] = newLyrics.map((lyrics, i) => ({
      lyrics,
      chords: section.lines[i]?.chords ?? [],
    }));
    onSave(newLines);
  };

  return (
    <div>
      <textarea
        ref={ref}
        value={value}
        onChange={handleChange}
        onKeyDown={e => { if (e.key === 'Escape') onCancel(); }}
        className="w-full bg-amber-50 border border-amber-300 rounded-lg px-3 py-2 outline-none resize-none font-mono text-sm text-stone-800 leading-relaxed"
        style={{ minHeight: '4rem', overflow: 'hidden' }}
      />
      <div className="flex gap-2 mt-1.5">
        <button
          onClick={handleSave}
          className="text-xs px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition-colors"
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="text-xs px-3 py-1.5 text-stone-500 hover:bg-stone-100 rounded-lg transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Shared drag state ────────────────────────────────────────────────────────

type DragState = {
  fromLine: number;
  fromChordIdx: number;
  chord: string;       // chord name being dragged
  targetLine: number;
  targetPosition: number; // ch units in target line
  startX: number;
  originalPosition: number;
} | null;

// Shared hook: manages cross-line chord drag for both DadLayout and CondensedLayout.
function useLayoutDrag(
  sectionRef: React.MutableRefObject<Section>,
  lineRefs: React.MutableRefObject<(HTMLDivElement | null)[]>,
  charWidthRef: React.MutableRefObject<number>,
  onUpdateLine?: (lineIdx: number, line: Line) => void,
  onMoveChord?: (fromLine: number, chordIdx: number, toLine: number, pos: number) => void,
) {
  const [dragState, setDragState] = useState<DragState>(null);
  const dragStateRef = useRef<DragState>(null);

  const handleChordMouseDown = useCallback((lineIdx: number, chordIdx: number, e: React.MouseEvent) => {
    e.preventDefault();
    if (!onUpdateLine && !onMoveChord) return;

    const line = sectionRef.current.lines[lineIdx];
    const cp = line?.chords[chordIdx];
    if (!cp) return;

    const initial: DragState = {
      fromLine: lineIdx,
      fromChordIdx: chordIdx,
      chord: cp.chord,
      targetLine: lineIdx,
      targetPosition: cp.position,
      startX: e.clientX,
      originalPosition: cp.position,
    };
    dragStateRef.current = initial;
    setDragState(initial);

    const charWidth = charWidthRef.current || 8.4;

    const handleMouseMove = (mv: MouseEvent) => {
      if (!dragStateRef.current) return;
      const ds = dragStateRef.current;

      // Determine which line the mouse is over
      let targetLine = ds.fromLine;
      for (let i = 0; i < lineRefs.current.length; i++) {
        const rect = lineRefs.current[i]?.getBoundingClientRect();
        if (rect && mv.clientY >= rect.top && mv.clientY <= rect.bottom) {
          targetLine = i;
          break;
        }
      }

      let targetPosition: number;
      if (targetLine === ds.fromLine) {
        const delta = Math.round((mv.clientX - ds.startX) / charWidth);
        targetPosition = Math.max(0, ds.originalPosition + delta);
      } else {
        const rect = lineRefs.current[targetLine]?.getBoundingClientRect();
        targetPosition = rect ? Math.max(0, Math.round((mv.clientX - rect.left) / charWidth)) : 0;
      }

      const next: DragState = { ...ds, targetLine, targetPosition };
      dragStateRef.current = next;
      setDragState(next);
    };

    const handleMouseUp = () => {
      if (!dragStateRef.current) return;
      const ds = dragStateRef.current;

      if (ds.targetLine === ds.fromLine) {
        // Same-line reposition
        if (onUpdateLine) {
          const line = sectionRef.current.lines[ds.fromLine];
          const newChords = line.chords.map((c, i) =>
            i === ds.fromChordIdx ? { ...c, position: ds.targetPosition } : c
          );
          onUpdateLine(ds.fromLine, { ...line, chords: newChords });
        }
      } else {
        // Cross-line move
        onMoveChord?.(ds.fromLine, ds.fromChordIdx, ds.targetLine, ds.targetPosition);
      }

      dragStateRef.current = null;
      setDragState(null);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [sectionRef, lineRefs, charWidthRef, onUpdateLine, onMoveChord]); // eslint-disable-line react-hooks/exhaustive-deps

  return { dragState, handleChordMouseDown };
}

// ─── Dad Layout ───────────────────────────────────────────────────────────────

function DadLayout({
  section, options, songKey,
  onUpdateLine, onAddChord, onRemoveChord, onMoveChord, onAddLine, onDeleteLine,
}: {
  section: Section;
  options: DisplayOptions;
  songKey: string;
  onUpdateLine?: (lineIdx: number, updatedLine: Line) => void;
  onAddChord?: (lineIdx: number, chord: string) => void;
  onRemoveChord?: (lineIdx: number, chordIdx: number) => void;
  onMoveChord?: (fromLine: number, chordIdx: number, toLine: number, pos: number) => void;
  onAddLine?: () => void;
  onDeleteLine?: (lineIdx: number) => void;
}) {
  const sectionRef = useRef(section);
  sectionRef.current = section;
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);
  const measureRef = useRef<HTMLSpanElement>(null);
  const charWidthRef = useRef<number>(8.4);

  useEffect(() => {
    if (measureRef.current) charWidthRef.current = measureRef.current.getBoundingClientRect().width;
  });

  const { dragState, handleChordMouseDown } = useLayoutDrag(
    sectionRef, lineRefs, charWidthRef, onUpdateLine, onMoveChord
  );

  const canEdit = !!(onUpdateLine || onAddChord || onRemoveChord || onMoveChord);

  return (
    <div className="space-y-4">
      {/* Single char-width measurement span */}
      <span ref={measureRef} aria-hidden className="absolute opacity-0 pointer-events-none font-mono text-sm">X</span>

      {section.lines.map((line, li) => {
        const isEmpty = !line.lyrics && line.chords.length === 0;
        const hasPreview = dragState?.targetLine === li;
        // Hide empty lines unless a chord is being dragged to them.
        if (isEmpty && !hasPreview) {
          // Still register the ref as null so drag detection skips it.
          lineRefs.current[li] = null;
          return null;
        }

        const handleUpdate = onUpdateLine ? (updated: Line) => onUpdateLine(li, updated) : undefined;

        return (
          <div key={li} ref={el => { lineRefs.current[li] = el; }} className="group/line relative pr-7">
            {/* Delete line button */}
            {onDeleteLine && (
              <button
                data-no-print
                onClick={() => onDeleteLine(li)}
                className="absolute right-0 top-1 text-stone-300 hover:text-red-500 transition-colors opacity-0 group-hover/line:opacity-100 text-base leading-none"
                title="Delete line"
              >
                ×
              </button>
            )}

            {/* Diagram row */}
            {options.diagramStyle !== 'none' && (
              <DiagramRow
                line={line}
                lineIdx={li}
                options={options}
                dragState={dragState}
                canEdit={canEdit}
                onChordMouseDown={canEdit ? handleChordMouseDown : undefined}
                onRemoveChord={onRemoveChord ? (ci) => onRemoveChord(li, ci) : undefined}
                onAddChord={onAddChord ? (chord) => onAddChord(li, chord) : undefined}
              />
            )}

            {/* Chord-name-only row (diagram style: none) */}
            {options.diagramStyle === 'none' && (
              <ChordOverLyrics
                line={line}
                lineIdx={li}
                options={options}
                songKey={songKey}
                dragState={dragState}
                canEdit={canEdit}
                onChordMouseDown={canEdit ? handleChordMouseDown : undefined}
                onRemoveChord={onRemoveChord ? (ci) => onRemoveChord(li, ci) : undefined}
                onAddChord={onAddChord ? (chord) => onAddChord(li, chord) : undefined}
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

      {/* Add line button */}
      {onAddLine && (
        <button
          data-no-print
          onClick={onAddLine}
          className="text-xs text-stone-400 hover:text-amber-600 transition-colors mt-1"
        >
          + add line
        </button>
      )}
    </div>
  );
}

// ─── Diagram Row ──────────────────────────────────────────────────────────────
// Chord diagrams absolutely positioned at cp.position ch units.
// Drag is managed by the parent layout via onChordMouseDown.

function DiagramRow({
  line, lineIdx, options,
  dragState, canEdit,
  onChordMouseDown, onRemoveChord, onAddChord,
}: {
  line: Line;
  lineIdx: number;
  options: DisplayOptions;
  dragState: DragState;
  canEdit: boolean;
  onChordMouseDown?: (lineIdx: number, chordIdx: number, e: React.MouseEvent) => void;
  onRemoveChord?: (chordIdx: number) => void;
  onAddChord?: (chord: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [addInput, setAddInput] = useState('');

  const rowHeight = options.diagramStyle === 'ascii' ? '12rem' : '5.5rem';

  // Build display list: hide the chord being dragged away from this line,
  // and show the drag preview when the cursor is over this line.
  type DisplayChord = ChordPosition & { originalIdx: number; isPreview?: boolean };
  const displayChords: DisplayChord[] = [
    ...line.chords
      .map((cp, i) => ({ ...cp, originalIdx: i }))
      .filter(cp => !(dragState?.fromLine === lineIdx && dragState.fromChordIdx === cp.originalIdx)),
    ...(dragState?.targetLine === lineIdx
      ? [{ chord: dragState.chord, position: dragState.targetPosition, originalIdx: -1, isPreview: true }]
      : []),
  ];

  const hasContent = displayChords.length > 0 || adding;
  if (!hasContent && !canEdit) return null;

  const handleAdd = () => {
    const trimmed = addInput.trim();
    if (trimmed) {
      onAddChord?.(trimmed);
      setAddInput('');
      setAdding(false);
    }
  };

  return (
    <div className="flex items-start mb-1">
      {/* Chord diagram area */}
      <div className="relative flex-1 font-mono text-sm select-none" style={{ minHeight: rowHeight }}>
        {displayChords.map((cp) => (
          <div
            key={cp.isPreview ? 'preview' : cp.originalIdx}
            style={{ left: `${cp.position}ch`, top: 0, position: 'absolute' }}
            className={`flex flex-col items-center group${cp.isPreview ? ' opacity-50 pointer-events-none' : ''}${!cp.isPreview && onChordMouseDown ? ' cursor-grab active:cursor-grabbing' : ''}`}
            onMouseDown={!cp.isPreview && onChordMouseDown
              ? (e) => onChordMouseDown(lineIdx, cp.originalIdx, e)
              : undefined}
            title={!cp.isPreview && onChordMouseDown ? 'Drag to reposition or move to another line' : undefined}
          >
            {/* Delete button — shown on hover */}
            {!cp.isPreview && onRemoveChord && (
              <button
                onMouseDown={e => e.stopPropagation()}
                onClick={() => onRemoveChord(cp.originalIdx)}
                className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 hover:bg-red-600 text-white rounded-full text-xs leading-none items-center justify-center z-10 hidden group-hover:flex"
                title="Remove chord"
              >
                ×
              </button>
            )}
            <ChordDiagram
              chord={cp.chord}
              instrument={options.instrument}
              style={options.diagramStyle}
              size="sm"
            />
          </div>
        ))}
      </div>

      {/* Add-chord control */}
      {onAddChord && (
        <div data-no-print className="ml-3 flex items-start" style={{ paddingTop: '0.25rem' }}>
          {adding ? (
            <div className="flex items-center gap-1">
              <input
                autoFocus
                value={addInput}
                onChange={e => setAddInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleAdd();
                  if (e.key === 'Escape') { setAdding(false); setAddInput(''); }
                }}
                placeholder="G7, Am…"
                className="w-18 text-xs border border-amber-300 rounded px-1.5 py-0.5 outline-none bg-amber-50 font-mono"
                style={{ width: '5rem' }}
              />
              <button onClick={handleAdd} className="text-xs text-amber-600 hover:text-amber-800 font-medium">add</button>
              <button onClick={() => { setAdding(false); setAddInput(''); }} className="text-xs text-stone-400 hover:text-stone-600">✕</button>
            </div>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="text-xs text-stone-400 hover:text-amber-600 transition-colors whitespace-nowrap"
              title="Add a chord to this line"
            >
              + chord
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Chord Over Lyrics ────────────────────────────────────────────────────────
// Chord names as absolutely-positioned spans (ch units). Drag managed by parent.

function ChordOverLyrics({
  line, lineIdx, options, songKey,
  dragState, canEdit,
  onChordMouseDown, onRemoveChord, onAddChord,
}: {
  line: Line;
  lineIdx: number;
  options: DisplayOptions;
  songKey: string;
  dragState: DragState;
  canEdit: boolean;
  onChordMouseDown?: (lineIdx: number, chordIdx: number, e: React.MouseEvent) => void;
  onRemoveChord?: (chordIdx: number) => void;
  onAddChord?: (chord: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [addInput, setAddInput] = useState('');

  // Build display list, same logic as DiagramRow.
  type DisplayChord = ChordPosition & { originalIdx: number; isPreview?: boolean };
  const displayChords: DisplayChord[] = [
    ...line.chords
      .map((cp, i) => ({ ...cp, originalIdx: i }))
      .filter(cp => !(dragState?.fromLine === lineIdx && dragState.fromChordIdx === cp.originalIdx))
      .sort((a, b) => a.position - b.position),
    ...(dragState?.targetLine === lineIdx
      ? [{ chord: dragState.chord, position: dragState.targetPosition, originalIdx: -1, isPreview: true }]
      : []),
  ];

  const hasChords = displayChords.length > 0;
  if (!hasChords && !canEdit) return null;

  const handleAdd = () => {
    const trimmed = addInput.trim();
    if (trimmed) {
      onAddChord?.(trimmed);
      setAddInput('');
      setAdding(false);
    }
  };

  return (
    <div className="flex items-center">
      {/* Chord names row */}
      <div className="relative flex-1 font-mono text-sm select-none" style={{ height: '1.5em' }}>
        {displayChords.map((cp) => {
          const label = convertChordNotation(cp.chord, options.notation, songKey);
          return (
            <span
              key={cp.isPreview ? 'preview' : cp.originalIdx}
              style={{ left: `${cp.position}ch`, top: 0 }}
              className={`absolute group${cp.isPreview ? ' opacity-50' : ' text-amber-700 font-semibold whitespace-nowrap'}${!cp.isPreview && onChordMouseDown ? ' cursor-grab active:cursor-grabbing' : ''}`}
              onMouseDown={!cp.isPreview && onChordMouseDown
                ? (e) => onChordMouseDown(lineIdx, cp.originalIdx, e)
                : undefined}
              title={!cp.isPreview && onChordMouseDown ? 'Drag to reposition or move to another line' : undefined}
            >
              {label}
              {!cp.isPreview && onRemoveChord && (
                <button
                  onMouseDown={e => e.stopPropagation()}
                  onClick={() => onRemoveChord(cp.originalIdx)}
                  className="ml-0.5 text-red-400 hover:text-red-600 text-xs hidden group-hover:inline"
                  title="Remove chord"
                >
                  ×
                </button>
              )}
            </span>
          );
        })}
      </div>

      {/* Add-chord control */}
      {onAddChord && (
        <div className="ml-2 flex items-center">
          {adding ? (
            <div className="flex items-center gap-1">
              <input
                autoFocus
                value={addInput}
                onChange={e => setAddInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleAdd();
                  if (e.key === 'Escape') { setAdding(false); setAddInput(''); }
                }}
                placeholder="G7, Am…"
                className="text-xs border border-amber-300 rounded px-1.5 py-0.5 outline-none bg-amber-50 font-mono"
                style={{ width: '5rem' }}
              />
              <button onClick={handleAdd} className="text-xs text-amber-600 hover:text-amber-800 font-medium">add</button>
              <button onClick={() => { setAdding(false); setAddInput(''); }} className="text-xs text-stone-400">✕</button>
            </div>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="text-xs text-stone-400 hover:text-amber-600 transition-colors"
            >
              + chord
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Editable Lyrics ──────────────────────────────────────────────────────────

function EditableLyrics({
  text, onSave, className,
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
