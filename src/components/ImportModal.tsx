import { useState, useRef } from 'react';
import { X, Link, FileText, Upload, Loader2 } from 'lucide-react';
import { fetchChartFromUrl, readFileAsText, readPdfAsText, guessMetaFromUrl } from '../lib/importer';
import { parseChartText } from '../lib/chordParser';
import type { Song } from '../types';

interface Props {
  onImport: (song: Song) => void;
  onClose: () => void;
}

type Tab = 'url' | 'paste' | 'file';

export function ImportModal({ onImport, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('paste');
  const [url, setUrl] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUrlFetch = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError('');
    try {
      const text = await fetchChartFromUrl(url.trim());
      const meta = guessMetaFromUrl(url.trim());
      const song = parseChartText(text, title || meta.title, artist || meta.artist);
      onImport(song);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to fetch URL. Try pasting the text instead.');
    } finally {
      setLoading(false);
    }
  };

  const handlePaste = () => {
    if (!pasteText.trim()) return;
    const song = parseChartText(pasteText, title || 'Untitled', artist);
    onImport(song);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError('');
    try {
      const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';
      const text = isPdf ? await readPdfAsText(file) : await readFileAsText(file);
      const nameWithoutExt = file.name.replace(/\.[^.]+$/, '');
      const song = parseChartText(text, title || nameWithoutExt, artist);
      onImport(song);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to read file.');
    } finally {
      setLoading(false);
    }
  };

  const tabStyle = (t: Tab) =>
    `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
      tab === t ? 'bg-amber-600 text-white' : 'text-stone-600 hover:bg-stone-100'
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-stone-100">
          <h2 className="font-semibold text-stone-900 text-lg">Import Chart</h2>
          <button onClick={onClose} className="p-1 hover:bg-stone-100 rounded-lg text-stone-400 hover:text-stone-700">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Meta fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-stone-500 block mb-1">Title (optional)</label>
              <input
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="Song title"
                value={title}
                onChange={e => setTitle(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-stone-500 block mb-1">Artist (optional)</label>
              <input
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="Artist name"
                value={artist}
                onChange={e => setArtist(e.target.value)}
              />
            </div>
          </div>

          {/* Tab selector */}
          <div className="flex gap-1 bg-stone-50 rounded-xl p-1">
            <button onClick={() => setTab('paste')} className={tabStyle('paste')}>
              <span className="flex items-center gap-1.5"><FileText size={14} /> Paste text</span>
            </button>
            <button onClick={() => setTab('url')} className={tabStyle('url')}>
              <span className="flex items-center gap-1.5"><Link size={14} /> From URL</span>
            </button>
            <button onClick={() => setTab('file')} className={tabStyle('file')}>
              <span className="flex items-center gap-1.5"><Upload size={14} /> Upload file</span>
            </button>
          </div>

          {/* Tab content */}
          {tab === 'paste' && (
            <div className="space-y-3">
              <textarea
                className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                rows={10}
                placeholder={"Paste chord chart here...\n\nExample:\n[Verse 1]\nG         C\nSomewhere over the rainbow\nAm        F\nWay up high"}
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
              />
              <button
                onClick={handlePaste}
                disabled={!pasteText.trim()}
                className="w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white font-medium py-2.5 rounded-xl transition-colors"
              >
                Import
              </button>
            </div>
          )}

          {tab === 'url' && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-stone-500 block mb-1">Chart URL</label>
                <input
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="https://tabs.ultimate-guitar.com/..."
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleUrlFetch()}
                />
              </div>
              <p className="text-xs text-stone-400">
                Works best with plain text chart sites. Some sites (e.g. Ultimate Guitar) may block fetching — paste the text instead if it fails.
              </p>
              <button
                onClick={handleUrlFetch}
                disabled={!url.trim() || loading}
                className="w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white font-medium py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {loading && <Loader2 size={16} className="animate-spin" />}
                {loading ? 'Fetching...' : 'Fetch & Import'}
              </button>
            </div>
          )}

          {tab === 'file' && (
            <div className="space-y-3">
              <div
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${loading ? 'border-amber-400 bg-amber-50 cursor-wait' : 'border-stone-200 cursor-pointer hover:border-amber-400 hover:bg-amber-50'}`}
                onClick={() => !loading && fileRef.current?.click()}
              >
                {loading
                  ? <Loader2 size={24} className="mx-auto text-amber-500 mb-2 animate-spin" />
                  : <Upload size={24} className="mx-auto text-stone-400 mb-2" />
                }
                <p className="text-sm text-stone-500">{loading ? 'Reading file…' : 'Click to choose a file'}</p>
                <p className="text-xs text-stone-400 mt-1">.txt, .text, .pdf files supported</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".txt,.text,.md,.pdf"
                  className="hidden"
                  onChange={handleFile}
                />
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
