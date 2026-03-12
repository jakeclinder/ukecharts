-- Enable pgcrypto for gen_random_bytes
create extension if not exists pgcrypto;

-- Folders table
create table if not exists folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

alter table folders enable row level security;

create policy "Users can manage their own folders"
  on folders for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Songs table
create table if not exists songs (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  artist text not null default '',
  key text not null default 'C',
  capo int,
  time_signature text,
  tempo int,
  sections jsonb not null default '[]',
  folder_id uuid references folders(id) on delete set null,
  parent_id uuid references songs(id) on delete set null,
  version_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table songs enable row level security;

-- Users can CRUD their own songs
create policy "Users can manage their own songs"
  on songs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Anyone can select songs that have a share token
create policy "Anyone can view shared songs"
  on songs for select
  using (
    exists (
      select 1 from share_tokens
      where share_tokens.song_id = songs.id
    )
  );

-- Sets table
create table if not exists sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

alter table sets enable row level security;

create policy "Users can manage their own sets"
  on sets for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Set songs (ordered song references in a set)
create table if not exists set_songs (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references sets(id) on delete cascade,
  song_id uuid not null references songs(id) on delete cascade,
  position int not null default 0,
  unique(set_id, song_id)
);

alter table set_songs enable row level security;

create policy "Users can manage their own set songs"
  on set_songs for all
  using (
    exists (
      select 1 from sets
      where sets.id = set_songs.set_id
        and sets.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from sets
      where sets.id = set_songs.set_id
        and sets.user_id = auth.uid()
    )
  );

-- Share tokens table
create table if not exists share_tokens (
  id uuid primary key default gen_random_uuid(),
  token text unique not null default encode(gen_random_bytes(16), 'hex'),
  song_id uuid references songs(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table share_tokens enable row level security;

-- Anyone can read share tokens (needed for looking up shared songs)
create policy "Anyone can select share tokens"
  on share_tokens for select
  using (true);

-- Only owners can insert/delete their own share tokens
create policy "Users can manage their own share tokens"
  on share_tokens for insert
  with check (auth.uid() = created_by);

create policy "Users can delete their own share tokens"
  on share_tokens for delete
  using (auth.uid() = created_by);
