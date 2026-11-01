/* Camp events: choosing which one appears, and carrying out the option the player picks. */
import type { Cond, EventOption, GameEvent, GodId, Outcome } from "../types";
import { EVENT_BY_ID, EVENTS, GODS } from "../content/tables";
import { pct, pick } from "./random";
import { age, ck, crewAll, eSkl, eStr, g, mkCrew, say } from "./state";
import { addWound, fix } from "./life";
import { finish } from "./endings";

export function holds(c: Cond | undefined): boolean {
  if (!c) return true;
  const G = g();
  if (c.flags && Object.entries(c.flags).some(([k, v]) => (G.f[k] ?? 0) !== v)) return false;
  if (c.notFlags && c.notFlags.some((k) => G.f[k])) return false;
  if (c.minAge !== undefined && age() < c.minAge) return false;
  if (c.minKills !== undefined && G.kills < c.minKills) return false;
  if (c.maxWeapon !== undefined && G.wp > c.maxWeapon) return false;
  if (c.minSilver !== undefined && G.silver < c.minSilver) return false;
  if (c.nid !== undefined && G.nid !== c.nid) return false;
  return true;
}

export function optionEnabled(o: EventOption): boolean {
  return holds(o.requires) && (o.pay === undefined || g().silver >= o.pay);
}

/** Shown odds for options with a stat check; null otherwise. */
export function optionOdds(o: EventOption): number | null {
  if (!o.check) return null;
  const s = o.check.stat === "fight" ? Math.floor((eStr() + eSkl()) / 2) : o.check.stat === "str" ? eStr() : o.check.stat === "skl" ? eSkl() : g().end;
  return ck(s, o.check.diff);
}

export function fillText(t: string, vars: Record<string, string | number> = {}): string {
  const all: Record<string, string | number> = { crewFirst: crewAll()[0]?.n ?? "A shipmate", name: g().name, ...vars };
  return t.replace(/\{(\w+)\}/g, (m, k) => (k in all ? String(all[k]) : m));
}
export const eventText = (e: GameEvent) => fillText(e.text);

export function drawEvent(): string | null {
  const G = g();
  const ok = EVENTS.filter((e) => (e.repeatable || !G.used.includes(e.id)) && e.id !== G.lastEv
    && G.ch >= (e.chapters ? e.chapters[0] : 0) && G.ch <= (e.chapters ? e.chapters[1] : 99)
    && G.rank >= (e.minRank || 0) && holds(e.when));
  if (!ok.length) return null;
  const pr = ok.filter((e) => e.priority);
  const e = pick(pr.length ? pr : ok);
  G.lastEv = e.id;
  return e.id;
}

/** Apply an outcome. Returns the text to log, or null if the run ended. */
function apply(o: Outcome): string | null {
  const G = g();
  const vars: Record<string, string | number> = {};
  for (const k of ["rep", "mor", "hp", "silver", "str", "skl", "end"] as const) if (o[k]) G[k] += o[k]!;
  if (o.silverLoss) { const lost = Math.floor(G.silver * o.silverLoss); G.silver -= lost; vars.lost = lost; }
  if (o.flags) for (const [k, v] of Object.entries(o.flags)) { if (v === null) delete G.f[k]; else G.f[k] = v; }
  if (o.wound) addWound(o.wound === "random" ? undefined : o.wound);
  if (o.woundChance && pct(o.woundChance)) addWound();
  if (o.addCrew) {
    const c = mkCrew(o.addCrew.name, o.addCrew.hp);
    if (o.addCrew.place === "leftFront") G.crew.L.unshift(c);
    else (G.crew.L.length <= G.crew.R.length ? G.crew.L : G.crew.R).push(c);
  }
  if (o.weapon !== undefined) G.wp = o.weapon;
  if (o.favour) {
    const god = pick(Object.keys(GODS) as GodId[]);
    G.gods[god] = Math.min(3, G.gods[god] + 1);
    vars.god = GODS[god].n;
  }
  if (o.endRun) { finish(o.endRun); return null; }
  return fillText(o.text, vars);
}

export function choose(i: number): void {
  const G = g();
  const e = G.ev ? EVENT_BY_ID[G.ev] : null;
  if (!e) return;
  const o = e.options[i];
  if (!o || !optionEnabled(o)) return;
  if (!e.repeatable) G.used.push(e.id);
  G.ev = null;
  if (o.pay) G.silver -= o.pay;
  const odds = optionOdds(o);
  const passed = o.test ? holds(o.test) : odds !== null ? pct(odds) : o.chance !== undefined ? pct(o.chance) : true;
  const text = apply(passed || !o.fail ? o.pass : o.fail);
  if (text === null) return;
  if (text) say(text);
  fix();
}
