/* Health, wounds, crew and rank: rules shared by camp, events and battle. */
import type { WoundId } from "../types";
import { BOON_EFFECT, HIRE, RANKS, WARBAND_RANK, WOUNDS } from "../content/tables";
import { cl, pct, pick } from "./random";
import { carries, crewAll, g, hasWound, listOf, maxhp, mkCrew, say } from "./state";
import { die } from "./endings";

/** Clamp values after any change. Returns true if the raider has died (and the run is over). */
export function fix(): boolean {
  const G = g();
  G.mor = cl(G.mor, carries("heart") ? BOON_EFFECT.morale : 0, 100);
  G.silver = Math.max(0, G.silver);
  G.hp = Math.min(G.hp, maxhp());
  if (G.hp <= 0) { die("death"); return true; }
  return false;
}

/** Add a wound: the given one, or a random new one. A random wound has a small chance to cost an eye. */
export function addWound(id?: WoundId): void {
  const G = g();
  if (!id && !G.eye && pct(8)) { G.eye = true; say("You lose an eye. Skill −1 for the rest of your life.", "bad"); return; }
  if (id && hasWound(id)) { G.wounds.find((w) => w.id === id)!.t += 1; return; }
  const free = (Object.keys(WOUNDS) as WoundId[]).filter((k) => !hasWound(k));
  const w = id || (free.length ? pick(free) : null);
  if (!w) return;
  G.wounds.push({ id: w, t: WOUNDS[w].t });
  say(`Wound: ${WOUNDS[w].n.toLowerCase()} (${WOUNDS[w].d} until it mends).`, "bad");
}

/** Men the army gives you on each side of the wall: two, or three once you lead a war-band. */
export const crewPerSide = () => (g().rank >= WARBAND_RANK ? 3 : 2);
/** Most men a side can hold, counting hired spearmen. */
export const wallCap = () => HIRE.maxPerSide + (g().rank >= WARBAND_RANK ? 1 : 0);

/** After a battle, fill each side of the wall back up and heal everyone. */
export function refillCrew(): void {
  const G = g();
  const added: string[] = [];
  for (const s of ["L", "R"] as const) while (G.crew[s].length < crewPerSide()) { const c = mkCrew(); G.crew[s].push(c); added.push(c.n); }
  crewAll().forEach((c) => (c.hp = c.mx));
  if (added.length) say(`New faces fill the gaps in the wall: ${listOf(added)}.`);
}

export function promote(): void {
  const G = g();
  while (G.rank < RANKS.length - 1) {
    const n = RANKS[G.rank + 1];
    if (G.nid || G.rep < n.rep || G.kills < n.kills) break;
    G.rank++;
    say(`You are now a ${n.n.toLowerCase()}. ${n.perk}`, "good");
  }
}
