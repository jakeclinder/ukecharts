import { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, Music2, PanelLeft, RotateCcw, RotateCw, GitBranch, LogIn, LogOut, Cloud, CloudOff, Loader2 } from 'lucide-react';
import type { Song, DisplayOptions, Folder, SongSet } from './types';
import { DEFAULT_DISPLAY_OPTIONS } from './types';
import {
  loadSongs, upsertSong, deleteSong, loadOptions, saveOptions,
  loadFolders, saveFolders, upsertFolder as localUpsertFolder, deleteFolder as localDeleteFolder,
  loadSets, saveSets, upsertSet as localUpsertSet, deleteSet as localDeleteSet,
} from './lib/storage';
import { transposeSong } from './lib/transpose';
import { ChartDisplay } from './components/ChartDisplay';
import { OptionsPanel } from './components/OptionsPanel';
import { ImportModal } from './components/ImportModal';
import { Sidebar } from './components/Sidebar';
import { ExportMenu } from './components/ExportMenu';
import { SignInModal } from './components/SignInModal';
import { useAuth } from './contexts/AuthContext';
import { supabaseEnabled } from './lib/supabase';
import {
  fetchSongs, upsertCloudSong, deleteCloudSong,
  fetchFolders, upsertCloudFolder, deleteCloudFolder,
  fetchSets, upsertCloudSet, deleteCloudSet,
} from './lib/cloudStorage';

const OPTIONS_KEY = 'global';

function App() {
  const { user, loading: authLoading, signOut } = useAuth();

  const [songs, setSongs] = useState<Song[]>(() => loadSongs());
  const [folders, setFolders] = useState<Folder[]>(() => loadFolders());
  const [sets, setSets] = useState<SongSet[]>(() => loadSets());
  const [activeSong, setActiveSong] = useState<Song | null>(() => loadSongs()[0] ?? null);
  const [options, setOptions] = useState<DisplayOptions>(() =>
    loadOptions(OPTIONS_KEY, DEFAULT_DISPLAY_OPTIONS)
  );
  const [showImport, setShowImport] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const printRef = useRef<HTMLDivElement>(null!);
  const [past, setPast] = useState<Song[]>([]);
  const [future, setFuture] = useState<Song[]>([]);
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [versionNameInput, setVersionNameInput] = useState('');

  // ── Persist options ──────────────────────────────────────────────────────
  useEffect(() => { saveOptions(OPTIONS_KEY, options); }, [options]);

  // ── Cloud sync on sign-in ────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    setSyncing(true);
    Promise.all([
      fetchSongs(user.id),
      fetchFolders(user.id),
      fetchSets(user.id),
    ]).then(([cloudSongs, cloudFolders, cloudSets]) => {
      // Merge: cloud wins for same IDs (cloud is source of truth after sign-in)
      const local = loadSongs();
      const byId: Record<string, Song> = {};
      local.forEach(s => { byId[s.id] = s; });
      cloudSongs.forEach(s => { byId[s.id] = s; }); // cloud overwrites
      const merged = Object.values(byId).sort((a, b) => b.updatedAt - a.updatedAt);
      setSongs(merged);
      merged.forEach(s => upsertSong(s)); // persist locally too

      setFolders(cloudFolders);
      saveFolders(cloudFolders);

      setSets(cloudSets);
      saveSets(cloudSets);
    }).catch(console.error).finally(() => setSyncing(false));
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Helpers ──────────────────────────────────────────────────────────────
  const handleImport = useCallback((song: Song) => {
    const updated = upsertSong(song);
    setSongs(updated);
    setActiveSong(song);
    setShowImport(false);
    if (user) upsertCloudSong(song, user.id).catch(console.error);
  }, [user]);

  const handleDelete = useCallback((id: string) => {
    const updated = deleteSong(id);
    setSongs(updated);
    if (activeSong?.id === id) setActiveSong(updated[0] ?? null);
    if (user) deleteCloudSong(id).catch(console.error);
  }, [activeSong, user]);

  const handleTranspose = useCallback((steps: number) => {
    setOptions(o => ({ ...o, transposeSteps: steps }));
  }, []);

  const handleUpdateSong = useCallback((updated: Song) => {
    setPast(p => activeSong ? [...p.slice(-49), activeSong] : p);
    setFuture([]);
    const allSongs = upsertSong(updated);
    setSongs(allSongs);
    setActiveSong(updated);
    if (user) upsertCloudSong(updated, user.id).catch(console.error);
  }, [activeSong, user]);

  const handleUpdateKey = useCallback((key: string) => {
    if (!activeSong) return;
    handleUpdateSong({ ...activeSong, key });
  }, [activeSong, handleUpdateSong]);

  const handleUndo = useCallback(() => {
    if (past.length === 0 || !activeSong) return;
    const prev = past[past.length - 1];
    setPast(p => p.slice(0, -1));
    setFuture(f => [activeSong, ...f.slice(0, 49)]);
    setSongs(upsertSong(prev));
    setActiveSong(prev);
    if (user) upsertCloudSong(prev, user.id).catch(console.error);
  }, [past, activeSong, user]);

  const handleRedo = useCallback(() => {
    if (future.length === 0 || !activeSong) return;
    const next = future[0];
    setFuture(f => f.slice(1));
    setPast(p => [...p.slice(-49), activeSong]);
    setSongs(upsertSong(next));
    setActiveSong(next);
    if (user) upsertCloudSong(next, user.id).catch(console.error);
  }, [future, activeSong, user]);

  const handleSaveVersion = useCallback(() => {
    if (!activeSong || !versionNameInput.trim()) return;
    const rootId = activeSong.parentId ?? activeSong.id;
    const version: Song = {
      ...activeSong,
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      parentId: rootId,
      versionName: versionNameInput.trim(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const updated = upsertSong(version);
    setSongs(updated);
    setActiveSong(version);
    setShowVersionModal(false);
    setVersionNameInput('');
    if (user) upsertCloudSong(version, user.id).catch(console.error);
  }, [activeSong, versionNameInput, user]);

  // ── Folder handlers ──────────────────────────────────────────────────────
  const handleCreateFolder = useCallback((name: string) => {
    const folder: Folder = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name,
      createdAt: Date.now(),
    };
    const updated = localUpsertFolder(folder);
    setFolders(updated);
    if (user) upsertCloudFolder(folder, user.id).catch(console.error);
  }, [user]);

  const handleRenameFolder = useCallback((id: string, name: string) => {
    const folder = folders.find(f => f.id === id);
    if (!folder) return;
    const updated_folder = { ...folder, name };
    const updated = localUpsertFolder(updated_folder);
    setFolders(updated);
    if (user) upsertCloudFolder(updated_folder, user.id).catch(console.error);
  }, [folders, user]);

  const handleDeleteFolder = useCallback((id: string) => {
    // Unfile all songs in this folder
    const affected = songs.filter(s => s.folderId === id);
    let allSongs = songs;
    affected.forEach(s => {
      const updated = { ...s, folderId: undefined };
      allSongs = upsertSong(updated);
      if (user) upsertCloudSong(updated, user.id).catch(console.error);
    });
    setSongs(allSongs);

    const updated = localDeleteFolder(id);
    setFolders(updated);
    if (user) deleteCloudFolder(id).catch(console.error);
  }, [songs, user]);

  const handleMoveSongToFolder = useCallback((songId: string, folderId: string | null) => {
    const song = songs.find(s => s.id === songId);
    if (!song) return;
    const updated = { ...song, folderId: folderId ?? undefined, updatedAt: Date.now() };
    const allSongs = upsertSong(updated);
    setSongs(allSongs);
    if (activeSong?.id === songId) setActiveSong(updated);
    if (user) upsertCloudSong(updated, user.id).catch(console.error);
  }, [songs, activeSong, user]);

  // ── Set handlers ─────────────────────────────────────────────────────────
  const handleCreateSet = useCallback((name: string) => {
    const set: SongSet = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name,
      songIds: [],
      createdAt: Date.now(),
    };
    const updated = localUpsertSet(set);
    setSets(updated);
    if (user) upsertCloudSet(set, user.id).catch(console.error);
  }, [user]);

  const handleRenameSet = useCallback((id: string, name: string) => {
    const set = sets.find(s => s.id === id);
    if (!set) return;
    const updated_set = { ...set, name };
    const updated = localUpsertSet(updated_set);
    setSets(updated);
    if (user) upsertCloudSet(updated_set, user.id).catch(console.error);
  }, [sets, user]);

  const handleDeleteSet = useCallback((id: string) => {
    const updated = localDeleteSet(id);
    setSets(updated);
    if (user) deleteCloudSet(id).catch(console.error);
  }, [user]);

  const handleToggleSongInSet = useCallback((setId: string, songId: string, include: boolean) => {
    const set = sets.find(s => s.id === setId);
    if (!set) return;
    const songIds = include
      ? [...set.songIds.filter(id => id !== songId), songId]
      : set.songIds.filter(id => id !== songId);
    const updated_set = { ...set, songIds };
    const updated = localUpsertSet(updated_set);
    setSets(updated);
    if (user) upsertCloudSet(updated_set, user.id).catch(console.error);
  }, [sets, user]);

  // ── Keyboard shortcuts ───────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); handleUndo(); }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); handleRedo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleUndo, handleRedo]);

  const displayedKey = activeSong ? transposeSong(activeSong, options.transposeSteps).key : 'C';

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      {/* ── Top bar ── */}
      <header className="border-b border-stone-200 bg-white px-4 py-3 flex items-center gap-3">
        <button onClick={() => setSidebarOpen(o => !o)}
          className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500 hover:text-stone-800 transition-colors">
          <PanelLeft size={18} />
        </button>

        <div className="flex items-center gap-2 mr-auto">
          <Music2 size={20} className="text-amber-600" />
          <span className="font-bold text-stone-800 text-lg tracking-tight">UkeCharts</span>
        </div>

        {activeSong && (
          <div className="flex items-center gap-1">
            <button onClick={handleUndo} disabled={past.length === 0}
              className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500 disabled:opacity-30 disabled:cursor-not-allowed" title="Undo (Ctrl+Z)">
              <RotateCcw size={17} />
            </button>
            <button onClick={handleRedo} disabled={future.length === 0}
              className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500 disabled:opacity-30 disabled:cursor-not-allowed" title="Redo">
              <RotateCw size={17} />
            </button>
          </div>
        )}

        {activeSong && (
          <button onClick={() => { setVersionNameInput(''); setShowVersionModal(true); }}
            className="flex items-center gap-2 px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-600 text-sm font-medium rounded-xl transition-colors">
            <GitBranch size={14} />
            Save version
          </button>
        )}

        {activeSong && <ExportMenu song={activeSong} options={options} printRef={printRef} />}

        {/* ── Auth area ── */}
        {supabaseEnabled && (
          authLoading ? (
            <Loader2 size={16} className="text-stone-400 animate-spin" />
          ) : user ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-stone-500">
                {syncing
                  ? <Loader2 size={13} className="animate-spin text-amber-500" />
                  : <Cloud size={13} className="text-green-500" />}
                <span className="hidden sm:inline truncate max-w-[120px]">{user.email}</span>
              </div>
              <button onClick={signOut}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-stone-500 hover:bg-stone-100 rounded-xl transition-colors"
                title="Sign out">
                <LogOut size={14} />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </div>
          ) : (
            <button onClick={() => setShowSignIn(true)}
              className="flex items-center gap-2 px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-600 text-sm font-medium rounded-xl transition-colors">
              <LogIn size={14} />
              Sign in
            </button>
          )
        )}
        {supabaseEnabled && !user && !authLoading && (
          <div className="flex items-center gap-1 text-xs text-stone-400" title="Saving locally only">
            <CloudOff size={13} />
          </div>
        )}

        <button onClick={() => setShowImport(true)}
          className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-xl transition-colors">
          <Plus size={15} />
          Import chart
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Sidebar ── */}
        {sidebarOpen && (
          <aside className="w-64 border-r border-stone-200 bg-white flex flex-col flex-shrink-0">
            <div className="flex-1 overflow-y-auto p-3">
              <Sidebar
                songs={songs}
                folders={folders}
                sets={sets}
                activeSongId={activeSong?.id ?? null}
                onSelectSong={(song) => { setPast([]); setFuture([]); setActiveSong(song); }}
                onDeleteSong={handleDelete}
                onMoveSongToFolder={handleMoveSongToFolder}
                onCreateFolder={handleCreateFolder}
                onRenameFolder={handleRenameFolder}
                onDeleteFolder={handleDeleteFolder}
                onCreateSet={handleCreateSet}
                onRenameSet={handleRenameSet}
                onDeleteSet={handleDeleteSet}
                onToggleSongInSet={handleToggleSongInSet}
              />
            </div>
          </aside>
        )}

        {/* ── Main content ── */}
        <main className="flex-1 overflow-y-auto">
          {activeSong ? (
            <div className="flex gap-6 p-6 max-w-6xl mx-auto">
              <div className="flex-1 min-w-0" data-chart-column>
                <ChartDisplay
                  song={activeSong}
                  options={options}
                  printRef={printRef}
                  onUpdateSong={handleUpdateSong}
                />
              </div>
              <div className="w-60 flex-shrink-0" data-no-print>
                <OptionsPanel
                  options={options}
                  onChange={setOptions}
                  songKey={displayedKey}
                  originalKey={activeSong.key}
                  onTranspose={handleTranspose}
                  onUpdateKey={handleUpdateKey}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <Music2 size={48} className="text-amber-300 mb-4" />
              <h2 className="text-xl font-semibold text-stone-700 mb-2">No chart selected</h2>
              <p className="text-stone-400 mb-6 max-w-sm">
                Import a chart from a URL, paste text, or upload a file to get started.
              </p>
              <button onClick={() => setShowImport(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-xl transition-colors">
                <Plus size={16} />
                Import your first chart
              </button>
            </div>
          )}
        </main>
      </div>

      {/* ── Modals ── */}
      {showImport && <ImportModal onImport={handleImport} onClose={() => setShowImport(false)} />}
      {showSignIn && <SignInModal onClose={() => setShowSignIn(false)} />}

      {/* Save Version modal */}
      {showVersionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-80">
            <h3 className="font-semibold text-stone-800 mb-1">Save as Version</h3>
            <p className="text-sm text-stone-500 mb-4">
              Give this version a name (e.g. "Capo 2", "Key of G"). It will be saved as a copy linked to "{activeSong?.title}".
            </p>
            <input
              autoFocus
              type="text"
              value={versionNameInput}
              onChange={e => setVersionNameInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSaveVersion();
                if (e.key === 'Escape') setShowVersionModal(false);
              }}
              placeholder="Version name…"
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-400 mb-4"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowVersionModal(false)}
                className="px-4 py-2 text-sm text-stone-500 hover:bg-stone-100 rounded-lg transition-colors">
                Cancel
              </button>
              <button onClick={handleSaveVersion} disabled={!versionNameInput.trim()}
                className="px-4 py-2 text-sm bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg transition-colors disabled:opacity-40">
                Save version
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
