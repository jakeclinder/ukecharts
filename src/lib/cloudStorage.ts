import { supabase } from './supabase';
import type { Song, Folder, SongSet } from '../types';

function client() {
  if (!supabase) throw new Error('Supabase not configured');
  return supabase;
}

// ── Songs ──────────────────────────────────────────────────────────────────

function dbRowToSong(row: Record<string, unknown>): Song {
  return {
    id: row.id as string,
    title: (row.title as string) ?? '',
    artist: (row.artist as string) ?? '',
    key: (row.key as string) ?? 'C',
    capo: row.capo as number | undefined,
    timeSignature: row.time_signature as string | undefined,
    tempo: row.tempo as number | undefined,
    sections: (row.sections as Song['sections']) ?? [],
    folderId: row.folder_id as string | undefined,
    parentId: row.parent_id as string | undefined,
    versionName: row.version_name as string | undefined,
    createdAt: new Date(row.created_at as string).getTime(),
    updatedAt: new Date(row.updated_at as string).getTime(),
  };
}

function songToDbRow(song: Song, userId: string): Record<string, unknown> {
  return {
    id: song.id,
    user_id: userId,
    title: song.title,
    artist: song.artist,
    key: song.key,
    capo: song.capo ?? null,
    time_signature: song.timeSignature ?? null,
    tempo: song.tempo ?? null,
    sections: song.sections,
    folder_id: song.folderId ?? null,
    parent_id: song.parentId ?? null,
    version_name: song.versionName ?? null,
    updated_at: new Date(song.updatedAt).toISOString(),
    created_at: new Date(song.createdAt).toISOString(),
  };
}

export async function fetchSongs(userId: string): Promise<Song[]> {
  const { data, error } = await client()
    .from('songs')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(dbRowToSong);
}

export async function upsertCloudSong(song: Song, userId: string): Promise<void> {
  const { error } = await client()
    .from('songs')
    .upsert(songToDbRow(song, userId), { onConflict: 'id' });

  if (error) throw error;
}

export async function deleteCloudSong(id: string): Promise<void> {
  const { error } = await client()
    .from('songs')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ── Folders ────────────────────────────────────────────────────────────────

function dbRowToFolder(row: Record<string, unknown>): Folder {
  return {
    id: row.id as string,
    name: row.name as string,
    createdAt: new Date(row.created_at as string).getTime(),
  };
}

export async function fetchFolders(userId: string): Promise<Folder[]> {
  const { data, error } = await client()
    .from('folders')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []).map(dbRowToFolder);
}

export async function upsertCloudFolder(folder: Folder, userId: string): Promise<void> {
  const { error } = await client()
    .from('folders')
    .upsert(
      {
        id: folder.id,
        user_id: userId,
        name: folder.name,
        created_at: new Date(folder.createdAt).toISOString(),
      },
      { onConflict: 'id' }
    );

  if (error) throw error;
}

export async function deleteCloudFolder(id: string): Promise<void> {
  const { error } = await client()
    .from('folders')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ── Sets ───────────────────────────────────────────────────────────────────

export async function fetchSets(userId: string): Promise<SongSet[]> {
  const { data: setsData, error: setsError } = await client()
    .from('sets')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (setsError) throw setsError;

  const { data: setSongsData, error: setSongsError } = await client()
    .from('set_songs')
    .select('*')
    .order('position', { ascending: true });

  if (setSongsError) throw setSongsError;

  return (setsData ?? []).map((s) => {
    const songs = (setSongsData ?? [])
      .filter((ss: Record<string, unknown>) => ss.set_id === s.id)
      .sort((a: Record<string, unknown>, b: Record<string, unknown>) => (a.position as number) - (b.position as number))
      .map((ss: Record<string, unknown>) => ss.song_id as string);

    return {
      id: s.id as string,
      name: s.name as string,
      songIds: songs,
      createdAt: new Date(s.created_at as string).getTime(),
    };
  });
}

export async function upsertCloudSet(set: SongSet, userId: string): Promise<void> {
  const db = client();

  // Upsert the set record
  const { error: setError } = await db
    .from('sets')
    .upsert(
      {
        id: set.id,
        user_id: userId,
        name: set.name,
        created_at: new Date(set.createdAt).toISOString(),
      },
      { onConflict: 'id' }
    );

  if (setError) throw setError;

  // Replace all set_songs for this set
  const { error: deleteError } = await db
    .from('set_songs')
    .delete()
    .eq('set_id', set.id);

  if (deleteError) throw deleteError;

  if (set.songIds.length > 0) {
    const rows = set.songIds.map((songId, idx) => ({
      set_id: set.id,
      song_id: songId,
      position: idx,
    }));

    const { error: insertError } = await db.from('set_songs').insert(rows);
    if (insertError) throw insertError;
  }
}

export async function deleteCloudSet(id: string): Promise<void> {
  const { error } = await client()
    .from('sets')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ── Share tokens ───────────────────────────────────────────────────────────

export async function createShareToken(songId: string, userId: string): Promise<string> {
  const { data, error } = await client()
    .from('share_tokens')
    .insert({ song_id: songId, created_by: userId })
    .select('token')
    .single();

  if (error) throw error;
  return data.token as string;
}

export async function fetchSharedSong(token: string): Promise<Song | null> {
  const { data: tokenData, error: tokenError } = await client()
    .from('share_tokens')
    .select('song_id')
    .eq('token', token)
    .maybeSingle();

  if (tokenError) throw tokenError;
  if (!tokenData) return null;

  const { data: songData, error: songError } = await client()
    .from('songs')
    .select('*')
    .eq('id', tokenData.song_id)
    .maybeSingle();

  if (songError) throw songError;
  if (!songData) return null;

  return dbRowToSong(songData as Record<string, unknown>);
}
