import type { Song, Folder, SongSet } from '../types';

const SONGS_KEY = 'ukecharts_songs';
const OPTIONS_KEY = 'ukecharts_options';
const FOLDERS_KEY = 'ukecharts_folders';
const SETS_KEY = 'ukecharts_sets';

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

// ── Folders ─────────────────────────────────────────────────────────────────

export function loadFolders(): Folder[] {
  try {
    const raw = localStorage.getItem(FOLDERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveFolders(folders: Folder[]): void {
  localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
}

export function upsertFolder(folder: Folder): Folder[] {
  const folders = loadFolders();
  const idx = folders.findIndex(f => f.id === folder.id);
  if (idx >= 0) {
    folders[idx] = folder;
  } else {
    folders.push(folder);
  }
  saveFolders(folders);
  return folders;
}

export function deleteFolder(id: string): Folder[] {
  const folders = loadFolders().filter(f => f.id !== id);
  saveFolders(folders);
  return folders;
}

// ── Sets ─────────────────────────────────────────────────────────────────────

export function loadSets(): SongSet[] {
  try {
    const raw = localStorage.getItem(SETS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveSets(sets: SongSet[]): void {
  localStorage.setItem(SETS_KEY, JSON.stringify(sets));
}

export function upsertSet(set: SongSet): SongSet[] {
  const sets = loadSets();
  const idx = sets.findIndex(s => s.id === set.id);
  if (idx >= 0) {
    sets[idx] = set;
  } else {
    sets.push(set);
  }
  saveSets(sets);
  return sets;
}

export function deleteSet(id: string): SongSet[] {
  const sets = loadSets().filter(s => s.id !== id);
  saveSets(sets);
  return sets;
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
