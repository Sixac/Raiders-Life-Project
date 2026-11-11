/* The saga kept in this browser. It is checked before use, exactly as a save code is. */
import { checkLocalRun, type SavedRun } from "../core/savecode";
import { KEYS, store } from "./storage";

export interface Saved {
  run: SavedRun | null;
  /** Something is saved, but it is damaged or from a version this one cannot continue. */
  damaged: boolean;
}

export function readSaved(): Saved {
  const raw = store.load<unknown>(KEYS.run);
  if (raw === null || raw === undefined) return { run: null, damaged: false };
  const run = checkLocalRun(raw);
  return { run, damaged: !run };
}
