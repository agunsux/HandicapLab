// EPIC 35 — Live Validation Store Factory
// Provides a unified accessor that initializes either SupabaseLiveValidationStore,
// FileLiveValidationStore, or MemoryLiveValidationStore based on runtime environment.

import type { LiveValidationStore } from './types';
import { MemoryLiveValidationStore } from './memory-store';
import { FileLiveValidationStore } from './file-store';
import { SupabaseLiveValidationStore } from './supabase-store';

let singletonStore: LiveValidationStore | null = null;

export interface StoreOptions {
  forceKind?: 'supabase' | 'file' | 'memory';
  projectRoot?: string;
}

export function getLiveValidationStore(options?: StoreOptions): LiveValidationStore {
  if (singletonStore && !options?.forceKind) {
    return singletonStore;
  }

  const kind =
    options?.forceKind ||
    process.env.LIVE_VALIDATION_STORE_KIND ||
    (process.env.NODE_ENV === 'test' ? 'file' : 'supabase');

  let instance: LiveValidationStore;

  switch (kind) {
    case 'memory':
      instance = new MemoryLiveValidationStore();
      break;
    case 'file':
      instance = new FileLiveValidationStore(options?.projectRoot);
      break;
    case 'supabase':
    default:
      instance = new SupabaseLiveValidationStore();
      break;
  }

  if (!options?.forceKind) {
    singletonStore = instance;
  }

  return instance;
}

export function resetLiveValidationStore(): void {
  singletonStore = null;
}
