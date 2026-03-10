import type { Song } from '../types';
import { Trash2, Music2 } from 'lucide-react';

interface Props {
  songs: Song[];
  activeSongId: string | null;
  onSelect: (song: Song) => void;
  onDelete: (id: string) => void;
}

export function SongLibrary({ songs, activeSongId, onSelect, onDelete }: Props) {
  if (songs.length === 0) {
    return (
      <div className="text-center py-8 text-stone-400">
        <Music2 size={32} className="mx-auto mb-2 opacity-40" />
        <p className="text-sm">No songs yet</p>
        <p className="text-xs mt-1">Import a chart to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {songs.map(song => (
        <div
          key={song.id}
          onClick={() => onSelect(song)}
          className={`flex items-start justify-between px-3 py-2.5 rounded-lg cursor-pointer group transition-colors ${
            song.id === activeSongId
              ? 'bg-amber-50 border border-amber-200'
              : 'hover:bg-stone-50 border border-transparent'
          }`}
        >
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-medium truncate ${song.id === activeSongId ? 'text-amber-800' : 'text-stone-800'}`}>
              {song.title || 'Untitled'}
            </p>
            {song.artist && (
              <p className="text-xs text-stone-400 truncate mt-0.5">{song.artist}</p>
            )}
            <p className="text-xs text-stone-300 mt-0.5">Key: {song.key}</p>
          </div>
          <button
            onClick={e => { e.stopPropagation(); onDelete(song.id); }}
            className="ml-2 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 text-stone-300 transition-all flex-shrink-0"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
