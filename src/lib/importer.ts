/**
 * Imports chart text from various sources.
 * For URL imports we use allorigins.win as a CORS proxy.
 */

const CORS_PROXY = 'https://api.allorigins.win/get?url=';

/**
 * Fetch raw text from a URL via CORS proxy.
 * Strips common HTML to extract plain text.
 */
export async function fetchChartFromUrl(url: string): Promise<string> {
  const proxyUrl = CORS_PROXY + encodeURIComponent(url);
  const resp = await fetch(proxyUrl);
  if (!resp.ok) throw new Error(`Failed to fetch: ${resp.status} ${resp.statusText}`);
  const json = await resp.json();
  const html: string = json.contents ?? '';

  // Strip HTML tags and decode entities
  return htmlToText(html);
}

/**
 * Convert HTML string to plain text suitable for chord parsing.
 * Strips navigation, headers, footers, and tries to find main song content.
 */
function htmlToText(html: string): string {
  // Remove entire blocks that are never part of a song chart
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '');

  // Try to narrow down to the main content area
  const mainMatch =
    text.match(/<main[^>]*>([\s\S]*?)<\/main>/i) ??
    text.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  if (mainMatch) {
    text = mainMatch[1];
  }

  // Replace block elements with newlines
  text = text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/tr>/gi, '\n');

  // Remove all remaining tags
  text = text.replace(/<[^>]+>/g, '');

  // Decode common HTML entities
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)));

  // Collapse excessive blank lines (keep max 2)
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}

/**
 * Read a file as text (supports .txt, .pdf is not supported natively—falls back to raw)
 */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target?.result as string ?? '');
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

/**
 * Guess title and artist from URL
 */
export function guessMetaFromUrl(url: string): { title: string; artist: string } {
  try {
    const u = new URL(url);
    // e.g. ultimate-guitar.com/tabs/artist-name/song-name-tab-123456
    const segments = u.pathname.split('/').filter(Boolean);
    if (segments.length >= 2) {
      const raw = segments[segments.length - 1]
        .replace(/-tab-\d+$/, '')
        .replace(/-chords-\d+$/, '')
        .replace(/-\d+$/, '')
        .replace(/-/g, ' ');
      return {
        title: toTitleCase(raw),
        artist: toTitleCase(segments[segments.length - 2]?.replace(/-/g, ' ') ?? ''),
      };
    }
  } catch {}
  return { title: 'Untitled', artist: '' };
}

function toTitleCase(s: string): string {
  return s.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}
