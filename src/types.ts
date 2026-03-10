export type NotationSystem = 'letters' | 'nashville' | 'uke-ascii' | 'guitar-ascii';
export type DiagramStyle = 'visual' | 'ascii' | 'none';
export type LayoutMode = 'dad' | 'condensed';
export type ChorusMode = 'full' | 'reference';
export type Instrument = 'ukulele' | 'guitar';

export interface ChordPosition {
  chord: string;
  position: number; // character index in the lyric line
}

export interface Line {
  lyrics: string;
  chords: ChordPosition[];
}

export interface Section {
  id: string;
  type: 'verse' | 'chorus' | 'bridge' | 'intro' | 'outro' | 'pre-chorus' | 'tag' | 'instrumental' | 'other';
  label: string;
  lines: Line[];
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  key: string;
  capo?: number;
  timeSignature?: string;
  tempo?: number;
  sections: Section[];
  createdAt: number;
  updatedAt: number;
}

export interface DisplayOptions {
  notation: NotationSystem;
  diagramStyle: DiagramStyle;
  layoutMode: LayoutMode;
  chorusMode: ChorusMode;
  instrument: Instrument;
  transposeSteps: number;
  showCapo: boolean;
}

export const DEFAULT_DISPLAY_OPTIONS: DisplayOptions = {
  notation: 'letters',
  diagramStyle: 'visual',
  layoutMode: 'dad',
  chorusMode: 'full',
  instrument: 'ukulele',
  transposeSteps: 0,
  showCapo: true,
};
