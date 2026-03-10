import { getChordFingering } from '../lib/chordData';
import type { Instrument, DiagramStyle } from '../types';

interface Props {
  chord: string;
  instrument: Instrument;
  style: DiagramStyle;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE = { sm: 48, md: 64, lg: 80 };

export function ChordDiagram({ chord, instrument, style, size = 'md' }: Props) {
  if (style === 'none') return null;

  const fingering = getChordFingering(chord, instrument);

  if (style === 'ascii' || !fingering) {
    return <AsciiDiagram chord={chord} instrument={instrument} />;
  }

  return <SvgDiagram chord={chord} fingering={fingering} instrument={instrument} px={SIZE[size]} />;
}

// ─── SVG Diagram ─────────────────────────────────────────────────────────────

interface SvgProps {
  chord: string;
  fingering: ReturnType<typeof getChordFingering>;
  instrument: Instrument;
  px: number;
}

function SvgDiagram({ chord, fingering, instrument, px }: SvgProps) {
  if (!fingering) return null;

  const numStrings = instrument === 'ukulele' ? 4 : 6;
  const numFrets = 5;

  const padTop = 24;   // space for chord name
  const padLeft = 12;
  const padRight = 8;
  const padBottom = 8;

  const w = px;
  const gridW = w - padLeft - padRight;
  const gridH = px * 0.9;
  const h = padTop + gridH + padBottom;

  const stringSpacing = gridW / (numStrings - 1);
  const fretSpacing = gridH / numFrets;

  const baseFret = fingering.baseFret ?? 1;
  const frets = fingering.frets;

  // Collect dots
  const dots: { x: number; y: number; open: boolean; muted: boolean; fret: number }[] = [];
  frets.forEach((f, si) => {
    const x = padLeft + si * stringSpacing;
    if (f === -1) {
      dots.push({ x, y: padTop - 6, open: false, muted: true, fret: -1 });
    } else if (f === 0) {
      dots.push({ x, y: padTop - 6, open: true, muted: false, fret: 0 });
    } else {
      const relFret = f - baseFret + 1;
      const y = padTop + (relFret - 0.5) * fretSpacing;
      dots.push({ x, y, open: false, muted: false, fret: f });
    }
  });

  const dotR = Math.max(4, stringSpacing * 0.28);

  return (
    <div className="flex flex-col items-center">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
        {/* Chord name */}
        <text x={w / 2} y={14} textAnchor="middle" fontSize={11} fontWeight="600" fill="#1c1917">
          {chord}
        </text>

        {/* Nut or base fret indicator */}
        {baseFret === 1 ? (
          <rect x={padLeft} y={padTop} width={gridW} height={3} fill="#1c1917" rx={1} />
        ) : (
          <text x={padLeft - 4} y={padTop + fretSpacing * 0.6} textAnchor="end" fontSize={9} fill="#57534e">
            {baseFret}fr
          </text>
        )}

        {/* Fret lines */}
        {Array.from({ length: numFrets + 1 }).map((_, fi) => (
          <line
            key={fi}
            x1={padLeft} y1={padTop + fi * fretSpacing}
            x2={padLeft + gridW} y2={padTop + fi * fretSpacing}
            stroke="#d6d3d1" strokeWidth={1}
          />
        ))}

        {/* String lines */}
        {Array.from({ length: numStrings }).map((_, si) => (
          <line
            key={si}
            x1={padLeft + si * stringSpacing} y1={padTop}
            x2={padLeft + si * stringSpacing} y2={padTop + gridH}
            stroke="#a8a29e" strokeWidth={1.2}
          />
        ))}

        {/* Barre */}
        {fingering.barre && (
          <rect
            x={padLeft}
            y={padTop + (fingering.barre - baseFret + 0.5) * fretSpacing - dotR}
            width={gridW}
            height={dotR * 2}
            rx={dotR}
            fill="#292524"
            opacity={0.85}
          />
        )}

        {/* Dots */}
        {dots.map((d, i) => (
          d.open ? (
            <circle key={i} cx={d.x} cy={d.y} r={dotR * 0.85} stroke="#292524" strokeWidth={1.5} fill="none" />
          ) : d.muted ? (
            <g key={i}>
              <line x1={d.x - dotR * 0.6} y1={d.y - dotR * 0.6} x2={d.x + dotR * 0.6} y2={d.y + dotR * 0.6} stroke="#ef4444" strokeWidth={1.5} />
              <line x1={d.x + dotR * 0.6} y1={d.y - dotR * 0.6} x2={d.x - dotR * 0.6} y2={d.y + dotR * 0.6} stroke="#ef4444" strokeWidth={1.5} />
            </g>
          ) : (
            <circle key={i} cx={d.x} cy={d.y} r={dotR} fill="#292524" />
          )
        ))}
      </svg>
    </div>
  );
}

// ─── ASCII Diagram ────────────────────────────────────────────────────────────

function AsciiDiagram({ chord, instrument }: { chord: string; instrument: Instrument }) {
  const fingering = getChordFingering(chord, instrument);
  if (!fingering) {
    return <span className="font-mono text-xs bg-stone-100 px-1 py-0.5 rounded">{chord}</span>;
  }

  const numStrings = fingering.frets.length;
  const baseFret = fingering.baseFret ?? 1;
  const frets = fingering.frets;
  const numFrets = 4;

  // Header: open (o), muted (x), or blank
  const header = frets.map(f => f === -1 ? 'x' : f === 0 ? 'o' : ' ').join(' ');

  // Grid rows
  const rows: string[] = [];
  for (let fret = baseFret; fret < baseFret + numFrets; fret++) {
    const row = frets.map(f => f === fret ? '●' : '|').join('');
    rows.push(row);
    rows.push('─'.repeat(numStrings));
  }

  const lines = [chord, header, baseFret > 1 ? `${baseFret}fr` : '─'.repeat(numStrings * 2 - 1), ...rows];

  return (
    <pre className="font-mono text-xs leading-tight bg-stone-100 rounded px-2 py-1 whitespace-pre">
      {lines.join('\n')}
    </pre>
  );
}
