export const DROPBOX_APP_KEY = import.meta.env.VITE_DROPBOX_APP_KEY as string | undefined;
export const dropboxEnabled = Boolean(DROPBOX_APP_KEY);

// Songs are saved to this path inside the Dropbox app folder
const FILE_PATH = '/charts.json';
const REDIRECT_URI = `${window.location.origin}${window.location.pathname}`;

// ── localStorage keys ─────────────────────────────────────────────────────────

const TOKEN_KEY    = 'ukecharts_dropbox_token';
const REFRESH_KEY  = 'ukecharts_dropbox_refresh';
const VERIFIER_KEY = 'ukecharts_dropbox_verifier';

export function getDropboxToken(): string | null   { return localStorage.getItem(TOKEN_KEY); }
export function getDropboxRefresh(): string | null { return localStorage.getItem(REFRESH_KEY); }
export function isDropboxConnected(): boolean      { return Boolean(getDropboxToken() || getDropboxRefresh()); }

function setDropboxToken(token: string)    { localStorage.setItem(TOKEN_KEY, token); }
function setDropboxRefresh(token: string)  { localStorage.setItem(REFRESH_KEY, token); }

export function clearDropboxAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

// ── PKCE helpers ──────────────────────────────────────────────────────────────

function base64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function makeChallenge(): Promise<{ verifier: string; challenge: string }> {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)).buffer);
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return { verifier, challenge: base64url(hash) };
}

// ── OAuth flow ────────────────────────────────────────────────────────────────

/** Redirect the browser to Dropbox's OAuth consent page. */
export async function startDropboxAuth(): Promise<void> {
  const { verifier, challenge } = await makeChallenge();
  localStorage.setItem(VERIFIER_KEY, verifier);

  const params = new URLSearchParams({
    client_id:             DROPBOX_APP_KEY!,
    redirect_uri:          REDIRECT_URI,
    response_type:         'code',
    code_challenge:        challenge,
    code_challenge_method: 'S256',
    token_access_type:     'offline',
  });

  window.location.href = `https://www.dropbox.com/oauth2/authorize?${params}`;
}

/** Call this when the page loads with ?code= in the URL. Returns true on success. */
export async function handleDropboxCallback(code: string): Promise<boolean> {
  const verifier = localStorage.getItem(VERIFIER_KEY);
  if (!verifier || !DROPBOX_APP_KEY) return false;

  const resp = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      grant_type:    'authorization_code',
      client_id:     DROPBOX_APP_KEY,
      redirect_uri:  REDIRECT_URI,
      code_verifier: verifier,
    }),
  });

  if (!resp.ok) return false;
  const data = await resp.json();
  setDropboxToken(data.access_token);
  if (data.refresh_token) setDropboxRefresh(data.refresh_token);
  localStorage.removeItem(VERIFIER_KEY);
  return true;
}

// ── Token refresh ─────────────────────────────────────────────────────────────

async function refreshToken(): Promise<string | null> {
  const refresh = getDropboxRefresh();
  if (!refresh || !DROPBOX_APP_KEY) return null;

  const resp = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'refresh_token',
      refresh_token: refresh,
      client_id:     DROPBOX_APP_KEY,
    }),
  });

  if (!resp.ok) return null;
  const data = await resp.json();
  setDropboxToken(data.access_token);
  return data.access_token as string;
}

/** Runs the fetch, retrying once with a refreshed token on 401. */
async function authedFetch(
  url: string,
  init: (token: string) => RequestInit,
): Promise<Response | null> {
  let token = getDropboxToken();
  if (!token) {
    token = await refreshToken();
    if (!token) return null;
  }

  let resp = await fetch(url, init(token));
  if (resp.status === 401) {
    token = await refreshToken();
    if (!token) return null;
    resp = await fetch(url, init(token));
  }
  return resp;
}

// ── Data shape ────────────────────────────────────────────────────────────────

export interface DropboxBackup {
  songs:     unknown[];
  folders:   unknown[];
  sets:      unknown[];
  savedAt:   string;
  version:   1;
}

// ── File operations ───────────────────────────────────────────────────────────

export async function uploadToDropbox(backup: DropboxBackup): Promise<boolean> {
  const resp = await authedFetch(
    'https://content.dropboxapi.com/2/files/upload',
    token => ({
      method: 'POST',
      headers: {
        'Authorization':   `Bearer ${token}`,
        'Content-Type':    'application/octet-stream',
        'Dropbox-API-Arg': JSON.stringify({
          path:       FILE_PATH,
          mode:       'overwrite',
          autorename: false,
          mute:       true,
        }),
      },
      body: JSON.stringify(backup),
    }),
  );
  return resp?.ok ?? false;
}

export async function downloadFromDropbox(): Promise<DropboxBackup | null> {
  const resp = await authedFetch(
    'https://content.dropboxapi.com/2/files/download',
    token => ({
      method: 'POST',
      headers: {
        'Authorization':   `Bearer ${token}`,
        'Dropbox-API-Arg': JSON.stringify({ path: FILE_PATH }),
      },
    }),
  );

  if (!resp?.ok) return null;
  try {
    const data = await resp.json();
    if (data?.version === 1) return data as DropboxBackup;
    return null;
  } catch {
    return null;
  }
}
