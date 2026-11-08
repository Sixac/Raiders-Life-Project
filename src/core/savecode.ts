/*
 * Save codes: the whole save (legacy and any saga in progress) as text a player can copy,
 * to keep a backup or carry on playing on another device. A code is checked field by field
 * before it is used, so a damaged or edited code is refused instead of breaking the game.
 * No browser-only code here, so the tests can run it.
 */
import type { Battle, Game, Legacy } from "../types";
import { ARMOUR, CH, EVENT_BY_ID, RANKS, WEAPONS, WOUNDS } from "../content/tables";
import { SAVE_VERSION } from "../save/storage";

export interface SavedRun { v: number; G: Game; B: Battle | null }
export interface SaveBundle { legacy: Legacy; run: SavedRun | null }

/** RL1: compressed, RL0: plain (for browsers that cannot compress). Both are base64url. */
const ZIPPED = "RL1:";
const PLAIN = "RL0:";

export class SaveCodeError extends Error {}
const damaged = () => new SaveCodeError("The save code is damaged or incomplete. Copy the whole code and try again.");

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromBase64Url(text: string): Uint8Array {
  const bin = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
async function through(bytes: Uint8Array, stream: GenericTransformStream): Promise<Uint8Array> {
  const piped = new Blob([bytes as BlobPart]).stream().pipeThrough(stream as TransformStream<Uint8Array, Uint8Array>);
  return new Uint8Array(await new Response(piped).arrayBuffer());
}

export async function encodeSave(bundle: SaveBundle): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(bundle));
  if (typeof CompressionStream === "function") {
    try { return ZIPPED + toBase64Url(await through(json, new CompressionStream("deflate-raw"))); } catch { /* use the plain form */ }
  }
  return PLAIN + toBase64Url(json);
}

export async function decodeSave(code: string): Promise<SaveBundle> {
  const text = code.replace(/\s+/g, "");
  if (!text.startsWith(ZIPPED) && !text.startsWith(PLAIN)) {
    throw new SaveCodeError("That isn’t a save code. Save codes start with RL1: or RL0:.");
  }
  let bytes: Uint8Array;
  try {
    bytes = fromBase64Url(text.slice(4));
    if (text.startsWith(ZIPPED)) {
      if (typeof DecompressionStream !== "function") throw new SaveCodeError("This browser can’t open compressed save codes. Try a newer browser.");
      bytes = await through(bytes, new DecompressionStream("deflate-raw"));
    }
  } catch (e) {
    throw e instanceof SaveCodeError ? e : damaged();
  }
  let data: unknown;
  try { data = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw damaged(); }
  return checkBundle(data);
}

/* ---------- checks ---------- */
type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => typeof x === "object" && x !== null && !Array.isArray(x);
const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const isInt = (x: unknown, lo: number, hi: number) => Number.isInteger(x) && (x as number) >= lo && (x as number) <= hi;
const isStr = (x: unknown, max = 1000): x is string => typeof x === "string" && x.length <= max;
const isBool = (x: unknown): x is boolean => typeof x === "boolean";
const wrong = () => new SaveCodeError("This save code is from a different game or a newer version, so it can’t be loaded.");
function need(ok: boolean): void { if (!ok) throw wrong(); }

function checkLegacy(x: unknown): Legacy {
  need(isObj(x));
  const L = x as Obj, up = L.up as Obj;
  need(isNum(L.pts) && L.pts >= 0 && isNum(L.best) && isNum(L.runs) && isNum(L.fought) && isObj(up) && isObj(L.seen));
  need(["str", "skl", "end", "hoard"].every((k) => up[k] === undefined || isInt(up[k], 0, 3)));
  need(Object.values(L.seen as Obj).every(isBool));
  return {
    pts: L.pts as number, best: L.best as number, runs: L.runs as number, fought: L.fought as number,
    up: { str: (up.str as number) ?? 0, skl: (up.skl as number) ?? 0, end: (up.end as number) ?? 0, hoard: (up.hoard as number) ?? 0 },
    seen: L.seen as Record<string, boolean>,
    timing: isBool(L.timing) ? L.timing : true,
    layout: L.layout === "phone" || L.layout === "desktop" ? L.layout : "auto",
  };
}

const PHASES = ["camp", "battle", "aftermath", "hunt", "finale"];
const LOG_CLASSES = ["", "head", "good", "bad"];

function checkGame(x: unknown): Game {
  need(isObj(x));
  const G = x as Obj;
  need(isStr(G.name, 60) && isInt(G.ch, 0, CH.length - 1) && PHASES.includes(G.phase as string));
  for (const k of ["str", "skl", "end", "hp", "mor", "rep", "silver", "kills", "acts"]) need(isNum(G[k]));
  need(isInt(G.wp, 0, WEAPONS.length - 1) && isInt(G.ar, 0, ARMOUR.length - 1) && isInt(G.rank, 0, RANKS.length - 1));
  need(isBool(G.nid) && isBool(G.eye) && isBool(G.jarl) && isBool(G.mid));
  need(G.ev === null || (isStr(G.ev) && G.ev in EVENT_BY_ID));
  need(G.lastEv === null || G.lastEv === undefined || isStr(G.lastEv));
  need(Array.isArray(G.wounds) && G.wounds.every((w) => isObj(w) && (w.id as string) in WOUNDS && isNum(w.t)));
  need(isObj(G.gods) && ["odin", "thor", "freyr"].every((k) => isInt((G.gods as Obj)[k], 0, 3)));
  need(isObj(G.f) && Object.values(G.f as Obj).every(isNum));
  need(Array.isArray(G.used) && G.used.every((u) => isStr(u)));
  need(Array.isArray(G.log) && G.log.every((l) => isObj(l) && isStr(l.t, 2000) && LOG_CLASSES.includes(l.c as string)));
  const crew = G.crew as Obj;
  need(isObj(crew) && [crew.L, crew.R].every((side) => Array.isArray(side) && side.length <= 8
    && side.every((c) => isObj(c) && isStr(c.n, 60) && isNum(c.hp) && isNum(c.mx))));
  need((G.loot === undefined || isNum(G.loot)) && (G.gift === undefined || isNum(G.gift)));
  const game = { ...G } as unknown as Game;
  delete game.res;
  // A saga saved mid-battle or mid-hunt picks up in camp, just before that fight.
  if (game.phase === "battle") { game.phase = "camp"; game.acts = 0; game.ev = null; }
  if (game.phase === "hunt") game.phase = "camp";
  return game;
}

function checkBundle(x: unknown): SaveBundle {
  if (!isObj(x)) throw wrong();
  const legacy = checkLegacy(x.legacy);
  let run: SavedRun | null = null;
  if (x.run !== null && x.run !== undefined) {
    need(isObj(x.run));
    run = { v: SAVE_VERSION, G: checkGame((x.run as Obj).G), B: null };
  }
  return { legacy, run };
}
