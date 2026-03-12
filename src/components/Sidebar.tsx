import { useState, useRef, useEffect } from 'react';
import type { Song, Folder, SongSet } from '../types';
import {
  Music2, Trash2, ChevronDown, ChevronRight, GitBranch,
  FolderOpen, Folder as FolderIcon, ListMusic, Plus, Check,
  Pencil, X,
} from 'lucide-react';

interface Props {
  songs: Song[];
  folders: Folder[];
  sets: SongSet[];
  activeSongId: string | null;
  onSelectSong: (song: Song) => void;
  onDeleteSong: (id: string) => void;
  onMoveSongToFolder: (songId: string, folderId: string | null) => void;
  onCreateFolder: (name: string) => void;
  onRenameFolder: (id: string, name: string) => void;
  onDeleteFolder: (id: string) => void;
  onCreateSet: (name: string) => void;
  onRenameSet: (id: string, name: string) => void;
  onDeleteSet: (id: string) => void;
  onToggleSongInSet: (setId: string, songId: string, include: boolean) => void;
}

// ─── Inline rename input ──────────────────────────────────────────────────────

function InlineEdit({ value, onSave, onCancel }: { value: string; onSave: (v: string) => void; onCancel: () => void }) {
  const [v, setV] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.select(); }, []);
  return (
    <input
      ref={ref}
      value={v}
      onChange={e => setV(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'Enter') onSave(v.trim() || value);
        if (e.key === 'Escape') onCancel();
      }}
      onBlur={() => onSave(v.trim() || value)}
      className="flex-1 text-xs bg-white border border-amber-400 rounded px-1 py-0.5 outline-none"
      onClick={e => e.stopPropagation()}
    />
  );
}

// ─── Main Sidebar ─────────────────────────────────────────────────────────────

export function Sidebar({
  songs, folders, sets, activeSongId,
  onSelectSong, onDeleteSong, onMoveSongToFolder,
  onCreateFolder, onRenameFolder, onDeleteFolder,
  onCreateSet, onRenameSet, onDeleteSet,
  onToggleSongInSet,
}: Props) {
  const [foldersOpen, setFoldersOpen] = useState(true);
  const [setsOpen, setSetsOpen] = useState(true);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [expandedSets, setExpandedSets] = useState<Set<string>>(new Set());
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
  const [renamingSet, setRenamingSet] = useState<string | null>(null);
  const [addingFolder, setAddingFolder] = useState(false);
  const [addingSet, setAddingSet] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newSetName, setNewSetName] = useState('');
  const [expandedVersions, setExpandedVersions] = useState<Set<string>>(new Set());

  const toggleFolder = (id: string) =>
    setExpandedFolders(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleSet = (id: string) =>
    setExpandedSets(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleVersions = (id: string) =>
    setExpandedVersions(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // Root songs = songs with no parentId
  const rootSongs = songs.filter(s => !s.parentId);
  const versionMap: Record<string, Song[]> = {};
  songs.filter(s => s.parentId).forEach(s => {
    if (!versionMap[s.parentId!]) versionMap[s.parentId!] = [];
    versionMap[s.parentId!].push(s);
  });

  // Songs with no folder (show in "My Charts")
  const unfiledSongs = rootSongs.filter(s => !s.folderId);

  const renderSong = (song: Song, indent = false, isVersion = false) => {
    const isActive = song.id === activeSongId;
    const versions = versionMap[song.id] ?? [];
    const versionsExpanded = expandedVersions.has(song.id);

    return (
      <div key={song.id}>
        <div
          onClick={() => onSelectSong(song)}
          className={`flex items-start justify-between px-2 py-2 rounded-lg cursor-pointer group transition-colors ${
            indent ? 'ml-3' : ''
          } ${isVersion ? 'pl-1.5 border-l-2 border-stone-200 ml-3' : ''} ${
            isActive ? 'bg-amber-50 border border-amber-200' : 'hover:bg-stone-50 border border-transparent'
          }`}
        >
          <div className="min-w-0 flex-1 flex items-start gap-1.5">
            {isVersion && <GitBranch size={10} className="mt-1 flex-shrink-0 text-stone-300" />}
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-medium truncate ${isActive ? 'text-amber-800' : 'text-stone-800'}`}>
                {isVersion ? (song.versionName || 'Version') : (song.title || 'Untitled')}
              </p>
              {!isVersion && song.artist && <p className="text-xs text-stone-400 truncate">{song.artist}</p>}
              <p className="text-xs text-stone-300">Key: {song.key}</p>
            </div>
          </div>

          <div className="flex items-center gap-0.5 ml-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            {/* Versions chevron */}
            {!isVersion && versions.length > 0 && (
              <button
                onClick={e => { e.stopPropagation(); toggleVersions(song.id); }}
                className="p-1 rounded text-stone-300 hover:text-stone-600"
                title="Show versions"
              >
                {versionsExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </button>
            )}
            {/* Move to folder (root songs only) */}
            {!isVersion && folders.length > 0 && <FolderMenu song={song} folders={folders} onMove={fid => onMoveSongToFolder(song.id, fid)} />}
            {/* Add to set */}
            {!isVersion && sets.length > 0 && <SetMenu song={song} sets={sets} onToggle={(sid, inc) => onToggleSongInSet(sid, song.id, inc)} />}
            {/* Delete */}
            {!isVersion && (
              <button
                onClick={e => { e.stopPropagation(); onDeleteSong(song.id); }}
                className="p-1 rounded text-stone-300 hover:text-red-500 hover:bg-red-50"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Versions */}
        {!isVersion && versionsExpanded && versions.map(v => renderSong(v, false, true))}
      </div>
    );
  };

  if (songs.length === 0 && folders.length === 0 && sets.length === 0) {
    return (
      <div className="text-center py-8 text-stone-400">
        <Music2 size={32} className="mx-auto mb-2 opacity-40" />
        <p className="text-sm">No songs yet</p>
        <p className="text-xs mt-1">Import a chart to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── My Charts ── */}
      <section>
        <p className="text-xs font-semibold uppercase tracking-widest text-stone-400 px-2 mb-1.5">My Charts</p>
        <div className="space-y-0.5">
          {unfiledSongs.length > 0
            ? unfiledSongs.map(s => renderSong(s))
            : <p className="text-xs text-stone-300 px-2 py-1">No unfiled charts</p>
          }
        </div>
      </section>

      {/* ── Folders ── */}
      <section>
        <div className="flex items-center justify-between px-2 mb-1">
          <button
            onClick={() => setFoldersOpen(o => !o)}
            className="flex items-center gap-1 text-xs font-semibold uppercase tracking-widest text-stone-400 hover:text-stone-600 transition-colors"
          >
            {foldersOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            Folders {folders.length > 0 && <span className="text-stone-300 normal-case font-normal tracking-normal">({folders.length})</span>}
          </button>
          <button
            onClick={() => { setAddingFolder(true); setNewFolderName(''); }}
            className="p-0.5 rounded text-stone-300 hover:text-amber-600 transition-colors"
            title="New folder"
          >
            <Plus size={13} />
          </button>
        </div>

        {foldersOpen && (
          <div className="space-y-1">
            {/* New folder input */}
            {addingFolder && (
              <div className="flex items-center gap-1 px-2 py-1">
                <FolderIcon size={13} className="text-stone-300 flex-shrink-0" />
                <input
                  autoFocus
                  value={newFolderName}
                  onChange={e => setNewFolderName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newFolderName.trim()) { onCreateFolder(newFolderName.trim()); setAddingFolder(false); }
                    if (e.key === 'Escape') setAddingFolder(false);
                  }}
                  onBlur={() => { if (newFolderName.trim()) onCreateFolder(newFolderName.trim()); setAddingFolder(false); }}
                  placeholder="Folder name…"
                  className="flex-1 text-xs border border-amber-300 rounded px-1.5 py-1 outline-none"
                />
              </div>
            )}

            {folders.map(folder => {
              const folderSongs = rootSongs.filter(s => s.folderId === folder.id);
              const isExpanded = expandedFolders.has(folder.id);

              return (
                <div key={folder.id}>
                  <div className="flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-stone-50 group cursor-pointer"
                    onClick={() => toggleFolder(folder.id)}
                  >
                    {isExpanded ? <FolderOpen size={13} className="text-amber-500 flex-shrink-0" /> : <FolderIcon size={13} className="text-amber-400 flex-shrink-0" />}
                    {renamingFolder === folder.id ? (
                      <InlineEdit
                        value={folder.name}
                        onSave={name => { onRenameFolder(folder.id, name); setRenamingFolder(null); }}
                        onCancel={() => setRenamingFolder(null)}
                      />
                    ) : (
                      <span className="flex-1 text-xs font-medium text-stone-700 truncate">{folder.name}</span>
                    )}
                    <span className="text-xs text-stone-300 mr-1">{folderSongs.length}</span>
                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5">
                      <button onClick={e => { e.stopPropagation(); setRenamingFolder(folder.id); }}
                        className="p-0.5 rounded text-stone-300 hover:text-stone-600" title="Rename">
                        <Pencil size={11} />
                      </button>
                      <button onClick={e => { e.stopPropagation(); onDeleteFolder(folder.id); }}
                        className="p-0.5 rounded text-stone-300 hover:text-red-500" title="Delete folder">
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="ml-2 space-y-0.5 border-l border-stone-100 pl-1">
                      {folderSongs.length > 0
                        ? folderSongs.map(s => renderSong(s, true))
                        : <p className="text-xs text-stone-300 px-3 py-1">Empty</p>
                      }
                    </div>
                  )}
                </div>
              );
            })}

            {folders.length === 0 && !addingFolder && (
              <p className="text-xs text-stone-300 px-2 py-1">No folders yet</p>
            )}
          </div>
        )}
      </section>

      {/* ── Sets ── */}
      <section>
        <div className="flex items-center justify-between px-2 mb-1">
          <button
            onClick={() => setSetsOpen(o => !o)}
            className="flex items-center gap-1 text-xs font-semibold uppercase tracking-widest text-stone-400 hover:text-stone-600 transition-colors"
          >
            {setsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            Sets {sets.length > 0 && <span className="text-stone-300 normal-case font-normal tracking-normal">({sets.length})</span>}
          </button>
          <button
            onClick={() => { setAddingSet(true); setNewSetName(''); }}
            className="p-0.5 rounded text-stone-300 hover:text-amber-600 transition-colors"
            title="New set"
          >
            <Plus size={13} />
          </button>
        </div>

        {setsOpen && (
          <div className="space-y-1">
            {/* New set input */}
            {addingSet && (
              <div className="flex items-center gap-1 px-2 py-1">
                <ListMusic size={13} className="text-stone-300 flex-shrink-0" />
                <input
                  autoFocus
                  value={newSetName}
                  onChange={e => setNewSetName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newSetName.trim()) { onCreateSet(newSetName.trim()); setAddingSet(false); }
                    if (e.key === 'Escape') setAddingSet(false);
                  }}
                  onBlur={() => { if (newSetName.trim()) onCreateSet(newSetName.trim()); setAddingSet(false); }}
                  placeholder="Set name…"
                  className="flex-1 text-xs border border-amber-300 rounded px-1.5 py-1 outline-none"
                />
              </div>
            )}

            {sets.map(set => {
              const setSongs = set.songIds.map(id => songs.find(s => s.id === id)).filter(Boolean) as Song[];
              const isExpanded = expandedSets.has(set.id);

              return (
                <div key={set.id}>
                  <div className="flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-stone-50 group cursor-pointer"
                    onClick={() => toggleSet(set.id)}
                  >
                    <ListMusic size={13} className="text-stone-400 flex-shrink-0" />
                    {renamingSet === set.id ? (
                      <InlineEdit
                        value={set.name}
                        onSave={name => { onRenameSet(set.id, name); setRenamingSet(null); }}
                        onCancel={() => setRenamingSet(null)}
                      />
                    ) : (
                      <span className="flex-1 text-xs font-medium text-stone-700 truncate">{set.name}</span>
                    )}
                    <span className="text-xs text-stone-300 mr-1">{setSongs.length}</span>
                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5">
                      <button onClick={e => { e.stopPropagation(); setRenamingSet(set.id); }}
                        className="p-0.5 rounded text-stone-300 hover:text-stone-600" title="Rename">
                        <Pencil size={11} />
                      </button>
                      <button onClick={e => { e.stopPropagation(); onDeleteSet(set.id); }}
                        className="p-0.5 rounded text-stone-300 hover:text-red-500" title="Delete set">
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="ml-2 space-y-0.5 border-l border-stone-100 pl-1">
                      {setSongs.length > 0 ? setSongs.map((s, i) => (
                        <div key={s.id}
                          onClick={() => onSelectSong(s)}
                          className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer group transition-colors ${
                            s.id === activeSongId ? 'bg-amber-50 text-amber-800' : 'hover:bg-stone-50 text-stone-700'
                          }`}
                        >
                          <span className="text-xs text-stone-300 w-4 flex-shrink-0 text-right">{i + 1}.</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium truncate">{s.title || 'Untitled'}</p>
                            <p className="text-xs text-stone-300">Key: {s.key}</p>
                          </div>
                          <button
                            onClick={e => { e.stopPropagation(); onToggleSongInSet(set.id, s.id, false); }}
                            className="p-0.5 rounded text-stone-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                            title="Remove from set"
                          >
                            <X size={11} />
                          </button>
                        </div>
                      )) : (
                        <p className="text-xs text-stone-300 px-3 py-1">
                          Empty — hover a song and click <ListMusic size={10} className="inline" /> to add
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {sets.length === 0 && !addingSet && (
              <p className="text-xs text-stone-300 px-2 py-1">No sets yet</p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

// ─── Small popup menus ────────────────────────────────────────────────────────

function FolderMenu({ song, folders, onMove }: { song: Song; folders: Folder[]; onMove: (id: string | null) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        className="p-1 rounded text-stone-300 hover:text-amber-600" title="Move to folder">
        <FolderIcon size={12} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={e => { e.stopPropagation(); setOpen(false); }} />
          <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-stone-200 rounded-xl shadow-lg py-1 min-w-[140px]">
            <button onClick={e => { e.stopPropagation(); onMove(null); setOpen(false); }}
              className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-stone-50 ${!song.folderId ? 'text-amber-700 font-medium' : 'text-stone-600'}`}>
              {!song.folderId ? <Check size={11} /> : <span className="w-[11px]" />}
              No folder
            </button>
            {folders.map(f => (
              <button key={f.id} onClick={e => { e.stopPropagation(); onMove(f.id); setOpen(false); }}
                className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-stone-50 truncate ${song.folderId === f.id ? 'text-amber-700 font-medium' : 'text-stone-600'}`}>
                {song.folderId === f.id ? <Check size={11} className="flex-shrink-0" /> : <span className="w-[11px]" />}
                <span className="truncate">{f.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SetMenu({ song, sets, onToggle }: { song: Song; sets: SongSet[]; onToggle: (setId: string, include: boolean) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        className="p-1 rounded text-stone-300 hover:text-amber-600" title="Add to / remove from set">
        <ListMusic size={12} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={e => { e.stopPropagation(); setOpen(false); }} />
          <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-stone-200 rounded-xl shadow-lg py-1 min-w-[140px]">
            {sets.map(set => {
              const inSet = set.songIds.includes(song.id);
              return (
                <button key={set.id} onClick={e => { e.stopPropagation(); onToggle(set.id, !inSet); }}
                  className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-stone-50 ${inSet ? 'text-amber-700 font-medium' : 'text-stone-600'}`}>
                  {inSet ? <Check size={11} className="flex-shrink-0" /> : <span className="w-[11px]" />}
                  <span className="truncate">{set.name}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
