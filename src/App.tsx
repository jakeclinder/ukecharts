import { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, Music2, PanelLeft, RotateCcw, RotateCw, GitBranch } from 'lucide-react';
import type { Song, DisplayOptions } from './types';
import { DEFAULT_DISPLAY_OPTIONS } from './types';
import { loadSongs, upsertSong, deleteSong, loadOptions, saveOptions } from './lib/storage';
import { transposeSong } from './lib/transpose';
import { ChartDisplay } from './components/ChartDisplay';
import { OptionsPanel } from './components/OptionsPanel';
import { ImportModal } from './components/ImportModal';
import { SongLibrary } from './components/SongLibrary';
import { ExportMenu } from './components/ExportMenu';

const OPTIONS_KEY = 'global';

function App() {
  const [songs, setSongs] = useState<Song[]>(() => loadSongs());
  const [activeSong, setActiveSong] = useState<Song | null>(() => {
    const saved = loadSongs();
    return saved[0] ?? null;
  });
  const [options, setOptions] = useState<DisplayOptions>(() =>
    loadOptions(OPTIONS_KEY, DEFAULT_DISPLAY_OPTIONS)
  );
  const [showImport, setShowImport] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const printRef = useRef<HTMLDivElement>(null!);
  const [past, setPast] = useState<Song[]>([]);
  const [future, setFuture] = useState<Song[]>([]);
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [versionNameInput, setVersionNameInput] = useState('');

  // Persist options
  useEffect(() => {
    saveOptions(OPTIONS_KEY, options);
  }, [options]);

  const handleImport = useCallback((song: Song) => {
    const updated = upsertSong(song);
    setSongs(updated);
    setActiveSong(song);
    setShowImport(false);
  }, []);

  const handleDelete = useCallback((id: string) => {
    const updated = deleteSong(id);
    setSongs(updated);
    if (activeSong?.id === id) {
      setActiveSong(updated[0] ?? null);
    }
  }, [activeSong]);

  const handleTranspose = useCallback((steps: number) => {
    setOptions(o => ({ ...o, transposeSteps: steps }));
  }, []);

  const handleUpdateSong = useCallback((updated: Song) => {
    setPast(p => activeSong ? [...p.slice(-49), activeSong] : p);
    setFuture([]);
    const allSongs = upsertSong(updated);
    setSongs(allSongs);
    setActiveSong(updated);
  }, [activeSong]);

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
  }, [past, activeSong]);

  const handleRedo = useCallback(() => {
    if (future.length === 0 || !activeSong) return;
    const next = future[0];
    setFuture(f => f.slice(1));
    setPast(p => [...p.slice(-49), activeSong]);
    setSongs(upsertSong(next));
    setActiveSong(next);
  }, [future, activeSong]);

  const handleSaveVersion = useCallback(() => {
    if (!activeSong || !versionNameInput.trim()) return;
    // The root song to link to: if activeSong is already a version, link to its parent
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
  }, [activeSong, versionNameInput]);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleUndo, handleRedo]);

  // Compute the displayed key (after transposition) for the options panel
  const displayedKey = activeSong
    ? transposeSong(activeSong, options.transposeSteps).key
    : 'C';

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      {/* Top bar */}
      <header className="border-b border-stone-200 bg-white px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => setSidebarOpen(o => !o)}
          className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500 hover:text-stone-800 transition-colors"
          title="Toggle sidebar"
        >
          <PanelLeft size={18} />
        </button>

        <div className="flex items-center gap-2 mr-auto">
          <Music2 size={20} className="text-amber-600" />
          <span className="font-bold text-stone-800 text-lg tracking-tight">UkeCharts</span>
        </div>

        {activeSong && (
          <div className="flex items-center gap-1">
            <button
              onClick={handleUndo}
              disabled={past.length === 0}
              className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500 hover:text-stone-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="Undo (Ctrl+Z)"
            >
              <RotateCcw size={17} />
            </button>
            <button
              onClick={handleRedo}
              disabled={future.length === 0}
              className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500 hover:text-stone-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="Redo (Ctrl+Y / Ctrl+Shift+Z)"
            >
              <RotateCw size={17} />
            </button>
          </div>
        )}

        {activeSong && (
          <button
            onClick={() => { setVersionNameInput(''); setShowVersionModal(true); }}
            className="flex items-center gap-2 px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-600 text-sm font-medium rounded-xl transition-colors"
            title="Save current state as a named version"
          >
            <GitBranch size={14} />
            Save version
          </button>
        )}

        {activeSong && (
          <ExportMenu song={activeSong} options={options} printRef={printRef} />
        )}

        <button
          onClick={() => setShowImport(true)}
          className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-xl transition-colors"
        >
          <Plus size={15} />
          Import chart
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar — song library */}
        {sidebarOpen && (
          <aside className="w-60 border-r border-stone-200 bg-white flex flex-col flex-shrink-0">
            <div className="p-4 border-b border-stone-100">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-stone-400">
                My Charts
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              <SongLibrary
                songs={songs}
                activeSongId={activeSong?.id ?? null}
                onSelect={(song) => { setPast([]); setFuture([]); setActiveSong(song); }}
                onDelete={handleDelete}
              />
            </div>
          </aside>
        )}

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          {activeSong ? (
            <div className="flex gap-6 p-6 max-w-6xl mx-auto">
              {/* Chart */}
              <div className="flex-1 min-w-0" data-chart-column>
                <ChartDisplay
                  song={activeSong}
                  options={options}
                  printRef={printRef}
                  onUpdateSong={handleUpdateSong}
                />
              </div>

              {/* Options panel */}
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
              <button
                onClick={() => setShowImport(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-xl transition-colors"
              >
                <Plus size={16} />
                Import your first chart
              </button>
            </div>
          )}
        </main>
      </div>

      {/* Import modal */}
      {showImport && (
        <ImportModal onImport={handleImport} onClose={() => setShowImport(false)} />
      )}

      {/* Save Version modal */}
      {showVersionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-80">
            <h3 className="font-semibold text-stone-800 mb-1">Save as Version</h3>
            <p className="text-sm text-stone-500 mb-4">
              Give this version a name (e.g. "Capo 2", "Key of G", "Simple chords").
              It will be saved as a copy linked to "{activeSong?.title}".
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
              <button
                onClick={() => setShowVersionModal(false)}
                className="px-4 py-2 text-sm text-stone-500 hover:bg-stone-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveVersion}
                disabled={!versionNameInput.trim()}
                className="px-4 py-2 text-sm bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg transition-colors disabled:opacity-40"
              >
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
