/* Every button runs one of these by name (see btn() in html.ts). The page re-renders after each. */
import type { Game, Battle, PerkId } from "../types";
import { KEYS, SAVE_VERSION, store } from "../save/storage";
import { keepLegacy, st } from "../core/state";
import { act, loose, newGame } from "../core/camp";
import { choose } from "../core/events";
import { answer, loot, march, release, turn } from "../core/combat";
import { crossSea, ending } from "../core/endings";
import { freshUiName, ui } from "./ui-state";
import { render } from "./render";

interface SavedRun { v?: number; G: Game; B: Battle | null }

/** Load a saved run, repairing anything an older version of the game could not resume. */
export function loadRun(s: SavedRun): void {
  st.G = s.G; st.B = s.B || null; st.H = null;
  if (s.v !== SAVE_VERSION && st.B) { st.B = null; if (st.G.phase === "battle") { st.G.phase = "camp"; st.G.acts = 0; } }
  if (st.B) st.B.swing = null;
  if (st.G.phase === "hunt") { st.G.phase = "camp"; st.G.acts++; }
}

const ACTIONS: Record<string, (...args: never[]) => void> = {
  act, choose, march, turn, answer, release, loot, ending, crossSea, loose,
  sub: (s: string | null) => { ui.sub = s; },
  dismiss: (k: string) => { st.L.seen[k] = true; keepLegacy(); },
  toggleTiming: () => { st.L.timing = !st.L.timing; keepLegacy(); },
  up: (k: PerkId) => { const L = st.L; if (L.pts < 3 || L.up[k] >= 3) return; L.pts -= 3; L.up[k]++; keepLegacy(); },
  reroll: () => { freshUiName(); },
  continueRun: () => { const s = store.load<SavedRun>(KEYS.run); if (s?.G) loadRun(s); },
  begin: () => {
    const saved = store.load<SavedRun>(KEYS.run);
    if (saved?.G && saved.G.phase !== "over" && !ui.confirmNew) { ui.confirmNew = true; return; }
    ui.confirmNew = false;
    newGame(ui.name);
  },
  toMenu: () => {
    if (st.G && st.G.phase !== "over") store.save(KEYS.run, { v: SAVE_VERSION, G: st.G, B: st.B ? { ...st.B, swing: null } : null });
    st.G = null; st.B = null; st.H = null;
  },
};

export function run(name: string, args: unknown[] = []): void {
  const fn = ACTIONS[name] as ((...a: unknown[]) => void) | undefined;
  if (!fn) return;
  const actsBefore = st.G?.acts;
  fn(...args);
  // Close a camp sub-menu once an action has been used up, or on anything other than a tip.
  if (name === "act" ? st.G?.acts !== actsBefore : name !== "sub" && name !== "dismiss") ui.sub = null;
  render();
}

export function bindInput(): void {
  document.addEventListener("click", (e) => {
    const el = (e.target as Element).closest<HTMLButtonElement>("button[data-act]");
    if (!el || el.disabled) return;
    run(el.dataset.act!, JSON.parse(el.dataset.args || "[]"));
  });
  document.addEventListener("input", (e) => {
    const t = e.target as HTMLInputElement;
    if (t.id === "nm") ui.name = t.value;
  });
  document.addEventListener("keydown", (e) => {
    const G = st.G;
    if (!G || (e.target as HTMLElement).tagName === "INPUT" || e.ctrlKey || e.metaKey || e.altKey) return;
    const go = e.key === " " || e.key === "Enter";
    if (G.phase === "hunt" && st.H && go) { e.preventDefault(); run("loose"); return; }
    const B = st.B;
    if (G.phase !== "battle" || !B) return;
    if (B.swing && go) { e.preventDefault(); run("release"); return; }
    if (!B.swing && !B.prompt && /^[1-7]$/.test(e.key)) {
      const el = document.querySelectorAll<HTMLButtonElement>("#battle-actions .btn")[Number(e.key) - 1];
      if (el && !el.disabled) { e.preventDefault(); el.click(); }
    }
  });
}
