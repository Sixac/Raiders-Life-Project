/**
 * The save layer. Everything the game persists goes through `store`, so a
 * desktop build only has to provide another SaveStore (for example one that
 * writes JSON files through Tauri) and call useStore() at startup.
 */
export interface SaveStore {
  load<T>(key: string): T | null;
  save(key: string, value: unknown): void;
  remove(key: string): void;
}

/** Browser storage. Fails quietly where storage is blocked (private windows, sandboxes). */
export class BrowserStore implements SaveStore {
  load<T>(key: string): T | null {
    try { return JSON.parse(localStorage.getItem(key) || "null") as T | null; } catch { return null; }
  }
  save(key: string, value: unknown): void {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
  }
  remove(key: string): void {
    try { localStorage.removeItem(key); } catch { /* storage unavailable */ }
  }
}

/** In-memory storage for tests and simulations. */
export class MemoryStore implements SaveStore {
  private data = new Map<string, string>();
  load<T>(key: string): T | null { const v = this.data.get(key); return v ? (JSON.parse(v) as T) : null; }
  save(key: string, value: unknown): void { this.data.set(key, JSON.stringify(value)); }
  remove(key: string): void { this.data.delete(key); }
}

export let store: SaveStore = typeof localStorage !== "undefined" ? new BrowserStore() : new MemoryStore();
export function useStore(s: SaveStore): void { store = s; }

/** Keys and version are unchanged from the single-file game, so existing saves keep working. */
export const KEYS = { legacy: "raider-legacy", run: "raider-run" } as const;
export const SAVE_VERSION = 3;
