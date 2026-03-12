import { useState } from 'react';
import type { Song } from '../types';
import { Trash2, Music2, ChevronDown, ChevronRight, GitBranch } from 'lucide-react';

interface Props {
  songs: Song[];
  activeSongId: string | null;
  onSelect: (song: Song) => void;
  onDelete: (id: string) => void;
}

export function SongLibrary({ songs, activeSongId, onSelect, onDelete }: Props) {
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());

  if (songs.length === 0) {
    return (
      <div className="text-center py-8 text-stone-400">
        <Music2 size={32} className="mx-auto mb-2 opacity-40" />
        <p className="text-sm">No songs yet</p>
        <p className="text-xs mt-1">Import a chart to get started</p>
      </div>
    );
  }

  // Separate root songs (no parentId) from versions
  const rootSongs = songs.filter(s => !s.parentId);
  const versionsBySong: Record<string, Song[]> = {};
  songs.filter(s => s.parentId).forEach(s => {
    if (!versionsBySong[s.parentId!]) versionsBySong[s.parentId!] = [];
    versionsBySong[s.parentId!].push(s);
  });

  const toggleExpand = (id: string) => {
    setExpandedParents(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const renderSong = (song: Song, isVersion = false) => {
    const isActive = song.id === activeSongId;
    const versions = versionsBySong[song.id] ?? [];
    const hasVersions = versions.length > 0;
    const expanded = expandedParents.has(song.id);

    return (
      <div key={song.id}>
        <div
          onClick={() => onSelect(song)}
          className={`flex items-start justify-between px-3 py-2.5 rounded-lg cursor-pointer group transition-colors ${
            isVersion ? 'ml-3 pl-2.5 border-l-2 border-stone-200' : ''
          } ${
            isActive
              ? 'bg-amber-50 border border-amber-200'
              : 'hover:bg-stone-50 border border-transparent'
          }`}
        >
          <div className="min-w-0 flex-1 flex items-start gap-1.5">
            {isVersion && <GitBranch size={11} className="mt-1 flex-shrink-0 text-stone-300" />}
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-medium truncate ${isActive ? 'text-amber-800' : 'text-stone-800'}`}>
                {isVersion ? (song.versionName || 'Version') : (song.title || 'Untitled')}
              </p>
              {!isVersion && song.artist && (
                <p className="text-xs text-stone-400 truncate mt-0.5">{song.artist}</p>
              )}
              <p className="text-xs text-stone-300 mt-0.5">Key: {song.key}</p>
            </div>
          </div>

          <div className="flex items-center gap-0.5 ml-1 flex-shrink-0">
            {hasVersions && !isVersion && (
              <button
                onClick={e => { e.stopPropagation(); toggleExpand(song.id); }}
                className="p-1 rounded text-stone-300 hover:text-stone-600 transition-colors"
                title={expanded ? 'Hide versions' : 'Show versions'}
              >
                {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              </button>
            )}
            <button
              onClick={e => { e.stopPropagation(); onDelete(song.id); }}
              className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 text-stone-300 transition-all"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {/* Versions */}
        {hasVersions && expanded && (
          <div className="mt-0.5 space-y-0.5">
            {versions.map(v => renderSong(v, true))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-1">
      {rootSongs.map(song => renderSong(song))}
      {/* Orphaned versions (parent was deleted) */}
      {songs.filter(s => s.parentId && !rootSongs.find(r => r.id === s.parentId)).map(s => renderSong(s))}
    </div>
  );
}
