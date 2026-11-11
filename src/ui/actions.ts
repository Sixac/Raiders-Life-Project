/* Every button runs one of these by name (see btn() in html.ts). The page re-renders after each. */
import type { BoonId } from "../types";
import { KEYS, SAVE_VERSION, store } from "../save/storage";
import { readSaved } from "../save/local";
import { buyBoonSlot, chooseBoon, keepLegacy, loadLegacy, st } from "../core/state";
import { act, loose, newGame } from "../core/camp";
import { choose } from "../core/events";
import { answer, loot, march, release, turn } from "../core/combat";
import { crossSea, ending } from "../core/endings";
import { decodeSave, encodeSave, SaveCodeError, type SaveBundle, type SavedRun } from "../core/savecode";
import { sagaSummary } from "../core/summary";
import { canonicalUrl, canShareSheet, copyText } from "./share";
import { freshUiName, ui, type Tab } from "./ui-state";
import { LAYOUTS } from "./layout";
import { fail, NUMBER_KEY_PHASES, render } from "./render";

/** Take up a saved run. It has already been checked and repaired (see checkLocalRun). */
export function loadRun(s: SavedRun): void {
  st.G = s.G; st.B = s.B; st.H = null;
}

const ACTIONS: Record<string, (...args: never[]) => unknown> = {
  act, choose, march, turn, answer, release, loot, ending, crossSea, loose,
  sub: (s: string | null) => { ui.sub = s; },
  dismiss: (k: string) => { st.L.seen[k] = true; keepLegacy(); },
  toggleTiming: () => { st.L.timing = !st.L.timing; keepLegacy(); },
  cycleLayout: () => { st.L.layout = LAYOUTS[(LAYOUTS.indexOf(st.L.layout) + 1) % LAYOUTS.length]; keepLegacy(); },
  tab: (t: Tab) => { ui.tab = t; ui.help = false; window.scrollTo(0, 0); },
  help: () => { ui.help = !ui.help; window.scrollTo(0, 0); },
  dismissProblem: () => { ui.problem = ""; },
  eraseRun: () => { store.remove(KEYS.run); ui.problem = ""; },
  boon: (id: BoonId) => { chooseBoon(id); },
  boonSlot: () => { buyBoonSlot(); },
  reroll: () => { freshUiName(); },
  continueRun: () => { const { run } = readSaved(); if (run) { loadRun(run); Object.assign(ui, { tab: "saga", recent: 0, saveMsg: "", problem: "" }); } },
  begin: () => {
    if (readSaved().run && !ui.confirmNew) { ui.confirmNew = true; return; }
    ui.confirmNew = false;
    Object.assign(ui, { tab: "saga", saveMsg: "", shareMsg: "", shareText: "", problem: "" });
    newGame(ui.name);
  },
  copySave: () => {
    const bundle: SaveBundle = { legacy: st.L, run: readSaved().run };
    const code = encodeSave(bundle);
    Object.assign(ui, { saveMsg: "", saveCode: "" });
    return copyText(code).then(async (ok) => {
      if (ok) ui.saveMsg = "Save code copied. Keep it somewhere safe, such as a note or an email to yourself.";
      else ui.saveCode = await code;
    });
  },
  toggleImport: () => { Object.assign(ui, { importOpen: !ui.importOpen, importError: "", pendingImport: null, saveMsg: "" }); },
  loadSave: () => decodeSave(ui.importText).then(
    (bundle) => { Object.assign(ui, { pendingImport: bundle, importError: "" }); },
    (e) => { Object.assign(ui, { pendingImport: null, importError: e instanceof SaveCodeError ? e.message : "That save code could not be read." }); },
  ),
  confirmImport: () => {
    const bundle = ui.pendingImport;
    if (!bundle) return;
    store.save(KEYS.legacy, bundle.legacy);
    if (bundle.run) store.save(KEYS.run, bundle.run); else store.remove(KEYS.run);
    loadLegacy();
    Object.assign(ui, { pendingImport: null, importOpen: false, importText: "", confirmNew: false, saveMsg: "Save loaded." });
  },
  cancelImport: () => { ui.pendingImport = null; },
  shareSaga: () => {
    const G = st.G;
    if (!G?.res) return;
    const text = sagaSummary(G), url = canonicalUrl(), full = `${text}\nA Raider’s Life: ${url}`;
    Object.assign(ui, { shareMsg: "", shareText: "" });
    if (canShareSheet()) {
      return navigator.share({ title: "A Raider’s Life", text, url })
        .catch((e: Error) => { if (e?.name !== "AbortError") ui.shareText = full; });
    }
    return copyText(Promise.resolve(full)).then((ok) => {
      if (ok) ui.shareMsg = "Your saga is copied. Paste it wherever you like.";
      else ui.shareText = full;
    });
  },
  toMenu: () => {
    if (st.G && st.G.phase !== "over") store.save(KEYS.run, { v: SAVE_VERSION, G: st.G, B: st.B ? { ...st.B, swing: null } : null });
    st.G = null; st.B = null; st.H = null;
    Object.assign(ui, { shareMsg: "", shareText: "", help: false });
  },
};

export function run(name: string, args: unknown[] = []): void {
  const fn = ACTIONS[name] as ((...a: unknown[]) => unknown) | undefined;
  if (!fn) return;
  const actsBefore = st.G?.acts;
  let result: unknown;
  // A rule that throws must not leave a page that no longer answers: go back to the title screen.
  try { result = fn(...args); } catch (e) { fail(e); return; }
  // Copying, sharing and save codes finish a moment later; draw again when they do.
  if (result instanceof Promise) result.finally(render);
  // Close a camp sub-menu once an action has been used up, or on anything other than a tip.
  if (name === "act" ? st.G?.acts !== actsBefore : !["sub", "dismiss", "tab", "cycleLayout", "toggleTiming", "help"].includes(name)) ui.sub = null;
  render();
}

export function bindInput(): void {
  // Timing-sensitive controls (the swing and hunt bars) fire as soon as a finger or button goes down.
  // The click that follows is then ignored; a click on its own (screen readers, keyboards) still works.
  let pressedAt = -1e9;
  document.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    const el = (e.target as Element).closest<HTMLElement>("[data-press]");
    if (!el || (el as HTMLButtonElement).disabled) return;
    e.preventDefault();
    pressedAt = performance.now();
    run(el.dataset.press!);
  });
  document.addEventListener("click", (e) => {
    const el = (e.target as Element).closest<HTMLButtonElement>("button[data-act]");
    if (!el || el.disabled || (el.dataset.press && performance.now() - pressedAt < 1000)) return;
    run(el.dataset.act!, JSON.parse(el.dataset.args || "[]"));
  });
  document.addEventListener("input", (e) => {
    const t = e.target as HTMLInputElement;
    if (t.id === "nm") ui.name = t.value;
    if (t.id === "importCode") ui.importText = t.value;
  });
  document.addEventListener("keydown", (e) => {
    if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName) || e.ctrlKey || e.metaKey || e.altKey) return;
    // The question mark opens and closes the How to play page; Escape closes it.
    if (e.key === "?" || (e.key === "Escape" && ui.help)) { e.preventDefault(); run("help"); return; }
    const G = st.G;
    if (!G || ui.help) return;
    // In camp, at the hoard and at an ending, number keys pick from the choices on screen and 0 marches.
    if (NUMBER_KEY_PHASES.includes(G.phase) && /^[0-9]$/.test(e.key)) {
      const el = e.key === "0" ? document.querySelector<HTMLButtonElement>("main .march .btn") : document.querySelectorAll<HTMLButtonElement>("main .actions .btn")[Number(e.key) - 1];
      if (el && !el.disabled) { e.preventDefault(); el.click(); }
      return;
    }
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
