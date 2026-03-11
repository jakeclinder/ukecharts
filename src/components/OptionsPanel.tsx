import type { DisplayOptions, NotationSystem, DiagramStyle, LayoutMode, ChorusMode, Instrument } from '../types';
import { ChevronDown, ChevronUp, Music, AlignLeft, Image, Repeat2 } from 'lucide-react';

interface Props {
  options: DisplayOptions;
  onChange: (options: DisplayOptions) => void;
  songKey: string;
  onTranspose: (steps: number) => void;
}

function set<K extends keyof DisplayOptions>(opts: DisplayOptions, key: K, val: DisplayOptions[K]): DisplayOptions {
  return { ...opts, [key]: val };
}

function OptionGroup({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="border-b border-stone-200 pb-4 mb-4 last:border-0 last:mb-0 last:pb-0">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-stone-400 mb-3">
        {icon}
        {label}
      </div>
      {children}
    </div>
  );
}

function ToggleGroup<T extends string>({
  options, value, onChange, labels,
}: {
  options: T[];
  value: T;
  onChange: (v: T) => void;
  labels?: Record<T, string>;
}) {
  return (
    <div className="flex flex-col gap-1">
      {options.map(opt => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`text-left text-sm px-3 py-1.5 rounded-md transition-colors ${
            value === opt
              ? 'bg-amber-600 text-white font-medium'
              : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          {labels ? labels[opt] : opt}
        </button>
      ))}
    </div>
  );
}

export function OptionsPanel({ options, onChange, songKey, onTranspose }: Props) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-5 text-sm shadow-sm sticky top-4">
      <h2 className="font-semibold text-stone-800 mb-5 text-base">Display Options</h2>

      {/* Instrument */}
      <OptionGroup label="Instrument" icon={<Music size={12} />}>
        <ToggleGroup<Instrument>
          options={['ukulele', 'guitar']}
          value={options.instrument}
          onChange={v => onChange(set(options, 'instrument', v))}
          labels={{ ukulele: 'Ukulele', guitar: 'Guitar' }}
        />
      </OptionGroup>

      {/* Chord notation */}
      <OptionGroup label="Chord Notation" icon={<AlignLeft size={12} />}>
        <ToggleGroup<NotationSystem>
          options={['letters', 'nashville']}
          value={options.notation}
          onChange={v => onChange(set(options, 'notation', v))}
          labels={{
            letters: 'Letter Names',
            nashville: 'Nashville  (1, 4, 5)',
          }}
        />
      </OptionGroup>

      {/* Diagram style */}
      <OptionGroup label="Chord Diagrams" icon={<Image size={12} />}>
        <ToggleGroup<DiagramStyle>
          options={['visual', 'ascii', 'none']}
          value={options.diagramStyle}
          onChange={v => onChange(set(options, 'diagramStyle', v))}
          labels={{
            visual: 'Visual (fretboard)',
            ascii: 'ASCII / text',
            none: 'None (chords over lyrics)',
          }}
        />
      </OptionGroup>

      {/* Layout */}
      <OptionGroup label="Layout" icon={<AlignLeft size={12} />}>
        <ToggleGroup<LayoutMode>
          options={['dad', 'condensed']}
          value={options.layoutMode}
          onChange={v => onChange(set(options, 'layoutMode', v))}
          labels={{
            dad: 'Full (diagrams over lyrics)',
            condensed: 'Condensed (chords at top)',
          }}
        />
      </OptionGroup>

      {/* Chorus mode */}
      <OptionGroup label="Chorus Display" icon={<Repeat2 size={12} />}>
        <ToggleGroup<ChorusMode>
          options={['full', 'reference']}
          value={options.chorusMode}
          onChange={v => onChange(set(options, 'chorusMode', v))}
          labels={{
            full: 'Write out every chorus',
            reference: 'Reference after first',
          }}
        />
      </OptionGroup>

      {/* Transpose */}
      <OptionGroup label="Transpose" icon={<ChevronUp size={12} />}>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onTranspose(options.transposeSteps - 1)}
            className="w-8 h-8 rounded-lg border border-stone-200 flex items-center justify-center hover:bg-stone-100 text-stone-700 font-bold"
          >
            <ChevronDown size={16} />
          </button>
          <div className="flex-1 text-center">
            <div className="font-semibold text-stone-800">{songKey}</div>
            <div className="text-xs text-stone-400">
              {options.transposeSteps === 0
                ? 'Original key'
                : `${options.transposeSteps > 0 ? '+' : ''}${options.transposeSteps} semitones`}
            </div>
          </div>
          <button
            onClick={() => onTranspose(options.transposeSteps + 1)}
            className="w-8 h-8 rounded-lg border border-stone-200 flex items-center justify-center hover:bg-stone-100 text-stone-700 font-bold"
          >
            <ChevronUp size={16} />
          </button>
        </div>
        {options.transposeSteps !== 0 && (
          <button
            onClick={() => onTranspose(0)}
            className="mt-2 w-full text-xs text-stone-400 hover:text-stone-700 hover:bg-stone-50 rounded py-1"
          >
            Reset to original key
          </button>
        )}
      </OptionGroup>
    </div>
  );
}
