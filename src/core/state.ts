/* The single mutable game state, plus the helpers everything else derives from it. */
import type { Battle, Crew, Game, Hunt, Legacy, LogClass, WoundId } from "../types";
import { CH, ENEMIES, FATHERS, NAMES } from "../content/tables";
import { KEYS, SAVE_VERSION, store } from "../save/storage";
import { cl, pick } from "./random";

export const st = {
  G: null as Game | null,
  B: null as Battle | null,
  H: null as Hunt | null,
  L: defaultLegacy(),
  /** Log lines added since the last render, for the screen-reader live region. */
  fresh: [] as string[],
  /** True in the browser; false in tests, where timed swings resolve instantly. */
  interactive: false,
};

function defaultLegacy(): Legacy {
  return { pts: 0, up: { str: 0, skl: 0, end: 0, hoard: 0 }, seen: {}, best: 0, runs: 0, fought: 0, timing: true, layout: "auto" };
}
export function loadLegacy(): void {
  const saved = store.load<Partial<Legacy>>(KEYS.legacy) || {};
  const d = defaultLegacy();
  st.L = { ...d, ...saved, up: { ...d.up, ...(saved.up || {}) }, seen: saved.seen || {} };
  if (st.L.timing === undefined) st.L.timing = true;
}
export const keepLegacy = () => store.save(KEYS.legacy, st.L);
export function saveRun(): void {
  const G = st.G;
  if (G && G.phase !== "over") store.save(KEYS.run, { v: SAVE_VERSION, G, B: st.B ? { ...st.B, swing: null } : null });
}

/** Non-null accessors for code that only runs mid-game. */
export const g = (): Game => st.G!;
export const b = (): Battle => st.B!;

/* ---------- derived values ---------- */
export const hasWound = (id: WoundId) => g().wounds.some((w) => w.id === id);
export const eStr = () => Math.max(1, g().str - (hasWound("arm") ? 2 : 0));
export const eSkl = () => Math.max(1, g().skl - (hasWound("head") ? 2 : 0) - (g().eye ? 1 : 0));
export const maxhp = () => 18 + g().end * 2 - (hasWound("gash") ? 5 : 0);
export const maxSta = () => 8 - (hasWound("ribs") ? 2 : 0);
export const chapter = () => CH[Math.min(g().ch, CH.length - 1)];
export const age = () => 18 + chapter().year - 865;
/** How strong enemies are, and how rich the rewards: grows each chapter up to ENEMIES.tierCap. */
export const tier = () => Math.min(g().ch, ENEMIES.tierCap);
/** Odds of a stat check, as a percentage. */
export const ck = (s: number, d = 0) => cl(30 + s * 8 - d * 8, 5, 95);
export const crewAll = (): Crew[] => [...g().crew.L, ...g().crew.R];
export const exposed = () => (g().crew.L.length ? 0 : 1) + (g().crew.R.length ? 0 : 1);
export const hurt = (n: number) => { g().hp -= n; };
export const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
export const randomName = () => pick(NAMES) + " " + pick(FATHERS) + "son";

export function say(t: string, c: LogClass = ""): void {
  const G = g();
  G.log.unshift({ t, c });
  if (G.log.length > 80) G.log.length = 80;
  st.fresh.push(t);
}

export function freshName(): string {
  const used = new Set([g().name.split(" ")[0], ...crewAll().map((c) => c.n)]);
  const free = NAMES.filter((n) => !used.has(n));
  return free.length ? pick(free) : pick(NAMES) + " the Younger";
}
export const mkCrew = (n?: string, mx = 10): Crew => ({ n: n || freshName(), hp: mx, mx });
