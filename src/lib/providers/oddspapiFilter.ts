import { ENABLED_SHARP_BOOK_KEYS } from '@/lib/config/sharpBooks';

// Single source of truth: enabled sharp books from the Sharp Market Reference
// Policy config (S1 + S2). Do not maintain a second allowlist here.
export const ALLOWED_BOOKMAKERS = ENABLED_SHARP_BOOK_KEYS;

export function filterOddsPapiBookmakers(response: any): any {
  if (!response || typeof response !== 'object') return response;
  
  const clone = JSON.parse(JSON.stringify(response));

  if (clone.data && Array.isArray(clone.data.bookmakers)) {
    clone.data.bookmakers = clone.data.bookmakers.filter((b: any) => {
      if (!b || !b.name) return false;
      const normalized = b.name.toLowerCase().trim();
      return ALLOWED_BOOKMAKERS.includes(normalized);
    });
  }

  // Handle arrays of matches if top level data is an array
  if (Array.isArray(clone.data)) {
    clone.data.forEach((match: any) => {
      if (match && Array.isArray(match.bookmakers)) {
        match.bookmakers = match.bookmakers.filter((b: any) => {
          if (!b || !b.name) return false;
          const normalized = b.name.toLowerCase().trim();
          return ALLOWED_BOOKMAKERS.includes(normalized);
        });
      }
    });
  }

  return clone;
}
