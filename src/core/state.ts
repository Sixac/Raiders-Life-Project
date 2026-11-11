/* The single mutable game state, plus the helpers everything else derives from it. */
import type { Battle, BoonId, Crew, Game, Hunt, Legacy, LogClass, WoundId } from "../types";
import { BOON_EFFECT, BOON_PRICES, BOON_SLOTS, BOONS, CH, CREW_KIT, ENEMIES, FATHERS, NAMES } from "../content/tables";
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
  return { pts: 0, own: [], carry: [], slots: BOON_SLOTS.base, seen: {}, best: 0, runs: 0, fought: 0, timing: true, layout: "auto" };
}
/**
 * Legacy as any earlier version saved it, with whatever is missing or impossible put right,
 * so nothing odd in the browser's storage can stop the game from starting.
 */
export function soundLegacy(saved: unknown): Legacy {
  const obj = (v: unknown) => (typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
  const count = (v: unknown, most = Infinity) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.min(most, Math.floor(v)) : 0);
  const s = obj(saved), up = obj(s.up);
  const all = Object.keys(BOONS) as BoonId[];
  const gifts = (v: unknown) => (Array.isArray(v) ? all.filter((id) => v.includes(id)) : null);
  // Under the first legacy rules there were four perks with levels: each one bought carries over as the gift of that name.
  const own = gifts(s.own) ?? all.filter((id) => count(up[id]) > 0);
  const slots = Math.min(BOON_SLOTS.most, Math.max(BOON_SLOTS.base, count(s.slots)));
  return {
    pts: count(s.pts), best: count(s.best), runs: count(s.runs), fought: count(s.fought),
    own, carry: (gifts(s.carry) ?? own).filter((id) => own.includes(id)).slice(0, slots), slots,
    seen: Object.fromEntries(Object.entries(obj(s.seen)).filter(([, v]) => v === true)) as Record<string, boolean>,
    timing: s.timing !== false,
    layout: s.layout === "phone" || s.layout === "desktop" ? s.layout : "auto",
  };
}
export function loadLegacy(): void {
  st.L = soundLegacy(store.load<unknown>(KEYS.legacy));
}
export const keepLegacy = () => store.save(KEYS.legacy, st.L);

/** The price of the next legacy gift, or null when every gift is owned. */
export const nextBoonPrice = (): number | null => (st.L.own.length < Object.keys(BOONS).length ? BOON_PRICES[Math.min(st.L.own.length, BOON_PRICES.length - 1)] : null);
/**
 * Buy a legacy gift, or pick up or set down one already owned. A new gift is carried at once
 * if there is a place free. Returns false when nothing could be done.
 */
export function chooseBoon(id: BoonId): boolean {
  const L = st.L;
  if (!L.own.includes(id)) {
    const price = nextBoonPrice();
    if (price === null || L.pts < price) return false;
    L.pts -= price; L.own.push(id);
    if (L.carry.length < L.slots) L.carry.push(id);
  } else if (L.carry.includes(id)) L.carry = L.carry.filter((b) => b !== id);
  else if (L.carry.length < L.slots) L.carry.push(id);
  else return false;
  keepLegacy();
  return true;
}
/** Buy the place for one more gift. */
export function buyBoonSlot(): boolean {
  const L = st.L;
  if (L.slots >= BOON_SLOTS.most || L.pts < BOON_SLOTS.price) return false;
  L.pts -= BOON_SLOTS.price; L.slots++;
  keepLegacy();
  return true;
}
/** Does this raider carry that legacy gift? */
export const carries = (id: BoonId) => !!st.G?.boons?.includes(id);
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
export const maxSta = () => 8 + (carries("lungs") ? BOON_EFFECT.lungs : 0) - (hasWound("ribs") ? 2 : 0);
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
/** "Ulf", "Ulf and Orm", "Ulf, Orm and Kari". */
export const listOf = (items: string[]) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`);
/** "an ash spear", "a bearded axe". */
export const withArticle = (w: string) => (/^[aeiou]/i.test(w) ? "an " : "a ") + w;
export const randomName = () => pick(NAMES) + " " + pick(FATHERS) + "son";

export function say(t: string, c: LogClass = ""): void {
  const G = g();
  G.log.unshift({ t, c });
  if (G.log.length > 80) G.log.length = 80;
  // Only the screen empties this list, so keep it short: the simulations never draw a screen.
  st.fresh.push(t);
  if (st.fresh.length > 8) st.fresh.shift();
}

export function freshName(): string {
  const used = new Set([g().name.split(" ")[0], ...crewAll().map((c) => c.n)]);
  const free = NAMES.filter((n) => !used.has(n));
  return free.length ? pick(free) : pick(NAMES) + " the Younger";
}
/** Health the captain's kit adds to each man beside him. */
export const kitHp = () => (st.G?.kit ?? 0) * CREW_KIT.hp;
export const mkCrew = (n?: string, mx = 10): Crew => ({ n: n || freshName(), hp: mx + kitHp(), mx: mx + kitHp() });
