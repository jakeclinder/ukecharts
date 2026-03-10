import type { Song } from '../types';

const SONGS_KEY = 'ukecharts_songs';
const OPTIONS_KEY = 'ukecharts_options';

export function loadSongs(): Song[] {
  try {
    const raw = localStorage.getItem(SONGS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveSongs(songs: Song[]): void {
  localStorage.setItem(SONGS_KEY, JSON.stringify(songs));
}

export function upsertSong(song: Song): Song[] {
  const songs = loadSongs();
  const idx = songs.findIndex(s => s.id === song.id);
  if (idx >= 0) {
    songs[idx] = song;
  } else {
    songs.unshift(song);
  }
  saveSongs(songs);
  return songs;
}

export function deleteSong(id: string): Song[] {
  const songs = loadSongs().filter(s => s.id !== id);
  saveSongs(songs);
  return songs;
}

export function loadOptions<T>(key: string, defaults: T): T {
  try {
    const raw = localStorage.getItem(`${OPTIONS_KEY}_${key}`);
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
  } catch {
    return defaults;
  }
}

export function saveOptions<T>(key: string, opts: T): void {
  localStorage.setItem(`${OPTIONS_KEY}_${key}`, JSON.stringify(opts));
}
