import { useState } from 'react';
import { Download, FileText, File, Loader2, Music } from 'lucide-react';
import type { Song, DisplayOptions } from '../types';
import { exportToPdf, exportToTxt, exportToDocx, exportToOnSong } from '../lib/exporter';

interface Props {
  song: Song;
  options: DisplayOptions;
  printRef: React.RefObject<HTMLDivElement>;
}

export function ExportMenu({ song, options }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  const handle = async (type: 'pdf' | 'txt' | 'docx' | 'onsong') => {
    setLoading(type);
    setOpen(false);
    try {
      if (type === 'pdf') {
        exportToPdf();
        setLoading(null);
        return;
      } else if (type === 'txt') {
        exportToTxt(song, options);
      } else if (type === 'onsong') {
        exportToOnSong(song, options);
      } else {
        await exportToDocx(song, options);
      }
    } catch (e) {
      console.error('Export failed:', e);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        disabled={!!loading}
        className="flex items-center gap-2 px-4 py-2 bg-stone-800 hover:bg-stone-900 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
      >
        {loading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
        {loading ? `Exporting…` : 'Export'}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-20 bg-white border border-stone-200 rounded-xl shadow-lg overflow-hidden min-w-[180px]">
            <button
              onClick={() => handle('pdf')}
              className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-stone-700 hover:bg-stone-50 transition-colors"
            >
              <File size={15} className="text-red-500" />
              Export as PDF
            </button>
            <button
              onClick={() => handle('txt')}
              className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-stone-700 hover:bg-stone-50 transition-colors"
            >
              <FileText size={15} className="text-stone-500" />
              Export as TXT
            </button>
            <button
              onClick={() => handle('docx')}
              className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-stone-700 hover:bg-stone-50 transition-colors"
            >
              <FileText size={15} className="text-blue-500" />
              Export as DOCX
            </button>
            <button
              onClick={() => handle('onsong')}
              className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-stone-700 hover:bg-stone-50 transition-colors"
            >
              <Music size={15} className="text-amber-500" />
              Export as OnSong
            </button>
          </div>
        </>
      )}
    </div>
  );
}
