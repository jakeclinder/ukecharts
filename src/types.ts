export type NotationSystem = 'letters' | 'nashville';
export type DiagramStyle = 'visual' | 'ascii' | 'none';
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
  folderId?: string;
  createdAt: number;
  updatedAt: number;
  parentId?: string;     // links a version to its original song
  versionName?: string;  // e.g. "Capo 2", "Key of G", "Simple version"
}

export interface Folder {
  id: string;
  name: string;
  createdAt: number;
}

export interface SongSet {
  id: string;
  name: string;
  songIds: string[];
  createdAt: number;
}

export interface DisplayOptions {
  notation: NotationSystem;
  diagramStyle: DiagramStyle;
  chorusMode: ChorusMode;
  instrument: Instrument;
  transposeSteps: number;
  showCapo: boolean;
}

export const DEFAULT_DISPLAY_OPTIONS: DisplayOptions = {
  notation: 'letters',
  diagramStyle: 'visual',
  chorusMode: 'full',
  instrument: 'ukulele',
  transposeSteps: 0,
  showCapo: true,
};
