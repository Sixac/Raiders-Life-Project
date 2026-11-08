/*
 * A bot that plays whole runs through the game rules, for the balance test and `npm run balance`.
 *
 * "Careful" bots answer every enemy move they can read with its counter; "careless" ones mostly
 * just attack. Timed swings are modelled with a share of perfect and badly timed blows, since a
 * player's timing changes the odds a lot; "off" plays with timed swings turned off.
 */
import type { Action, Quality } from "../src/types";
import { MemoryStore, useStore } from "../src/save/storage";
import { maxhp, st } from "../src/core/state";
import { act, hireSide, newGame } from "../src/core/camp";
import { choose, optionEnabled } from "../src/core/events";
import { answer, loot, march, resolve, turn, visibleIntent } from "../src/core/combat";
import { crossSea, ending, ENDINGS } from "../src/core/endings";
import { ARMOUR, ATTACKS, CH, COST, EDINGTON, EVENT_BY_ID, FRANKISH_FROM, GIFT, HIRE, INTENTS, RANKS, WEAPONS } from "../src/content/tables";

export type Timing = "off" | "poor" | "average" | "skilled";
export interface Profile { careful: boolean; timing: Timing }

/** Share of perfect and badly timed swings; the rest are good. */
const TIMING: Record<Exclude<Timing, "off">, { perfect: number; poor: number }> = {
  poor: { perfect: 0.1, poor: 0.45 },
  average: { perfect: 0.25, poor: 0.2 },
  skilled: { perfect: 0.55, poor: 0.05 },
};
const CHOSEN = ["baptism", "sail", "danelaw"] as const;

export interface Report {
  runs: number;
  errors: string[];
  /** Runs that lived through the last battle of 900. */
  reached900: number;
  deathsAt: number[];
  /** Median chapter in which each rank was first reached, among runs that reached it; and how many did. */
  rankChapter: (number | null)[];
  rankReached: number[];
  /** At the 900 finale: median silver and reputation, and how often each ending scored best. */
  silver900: number[];
  rep900: number[];
  bestEnding: Record<string, number>;
  roundsPerBattle: number[];
  eventsSeen: Set<string>;
}

const median = (a: number[]) => { if (!a.length) return NaN; const b = [...a].sort((x, y) => x - y); return b[b.length >> 1]; };
export const pctOf = (n: number, of: number) => (of ? (100 * n) / of : 0);

function swingQuality(t: Timing): Quality {
  if (t === "off") return null;
  const r = Math.random(), p = TIMING[t];
  return r < p.perfect ? "perfect" : r < p.perfect + p.poor ? "poor" : "good";
}

/** Camp: buy gear, spend spare silver on men and the jarl (no action needed), then heal, eat and train. */
function campStep(): void {
  const G = st.G!;
  const nw = WEAPONS[G.wp + 1], na = ARMOUR[G.ar + 1];
  const nextGear = Math.min(na ? na[2] : Infinity, nw && (G.wp + 1 < 4 || G.ch >= FRANKISH_FROM) ? nw[2] : Infinity);
  const spare = G.silver - (G.acts > 0 && Number.isFinite(nextGear) ? nextGear : 0);
  if (G.rank >= 1 && hireSide() && spare >= HIRE.price) return act("hire");
  if (!G.jarl && !G.nid && spare >= GIFT.price) return act("gift");
  if (G.acts < 1) return march();
  if (G.hp < maxhp() * 0.75) act("rest");
  else if (G.mor < 45 && G.silver >= 3) act("feast");
  else if (G.mor < 35) act("forage", "fish");
  else if (na && G.silver >= na[2] && G.ar <= G.wp) act("buy", "a" + (G.ar + 1));
  else if (nw && G.silver >= nw[2] && (G.wp + 1 < 4 || G.ch >= FRANKISH_FROM)) act("buy", "w" + (G.wp + 1));
  else if (G.silver >= 2 && G.gods.odin < 2) act("offer", "odin");
  else if (G.mor >= 30) act("train", (["str", "skl", "end"] as const).slice().sort((a, b) => G[a] - G[b])[0]);
  else act("forage", "raid");
}

function battleStep(p: Profile): void {
  const G = st.G!, B = st.B!;
  if (B.prompt) { answer(Math.random() < 0.5 ? 0 : 1); return; }
  // Only what a player could see: a feint fools the bot unless it was seen through.
  const seen = visibleIntent().id;
  let a: Action = p.careful && seen ? INTENTS[seen].counter : "strike";
  if (!p.careful && Math.random() < 0.2) a = (["strike", "heavy", "guard", "bash", "rally"] as Action[])[Math.floor(Math.random() * 5)];
  if (a === "strike" && G.mor >= 80) a = "berserk";
  if (a === "heavy" && B.sta < 2) a = "guard";
  if ((a === "strike" || a === "bash" || a === "rally") && B.sta < 1) a = "guard";
  // Attacks with timing on resolve with a modelled swing, as the timed bar would in the browser.
  if (ATTACKS.includes(a) && p.timing !== "off" && B.sta >= COST[a] && !(a === "berserk" && G.mor < 60)) resolve(a, swingQuality(p.timing));
  else turn(a);
}

export function simulate(p: Profile, runs: number): Report {
  useStore(new MemoryStore());
  st.interactive = false;
  const r: Report = { runs, errors: [], reached900: 0, deathsAt: Array(CH.length).fill(0), rankChapter: [], rankReached: Array(RANKS.length).fill(0),
    silver900: [], rep900: [], bestEnding: { baptism: 0, sail: 0, danelaw: 0 }, roundsPerBattle: [], eventsSeen: new Set() };
  const rankChapters: number[][] = RANKS.map(() => []);
  for (let n = 0; n < runs; n++) {
    try {
      newGame("Test Raider");
      let steps = 0, rounds = 0, topRank = 0;
      while (st.G!.phase !== "over" && steps++ < 9000) {
        const G = st.G!;
        while (topRank < G.rank) { topRank++; rankChapters[topRank].push(G.ch); r.rankReached[topRank]++; }
        if (G.phase === "camp") {
          if (G.ev) {
            r.eventsSeen.add(G.ev);
            const e = EVENT_BY_ID[G.ev];
            let ok = e.options.map((o, i) => (optionEnabled(o) ? i : -1)).filter((i) => i >= 0);
            // Bots stay with the army so whole runs get tested.
            const stay = ok.filter((i) => !(e.id === "deserters" && i === 2) && !(e.id === "halfdan" && i === 0));
            if (stay.length) ok = stay;
            choose(ok[Math.floor(Math.random() * ok.length)]);
          } else { if (G.acts < 1) rounds = 0; campStep(); }
        } else if (G.phase === "battle") {
          rounds++;
          battleStep(p);
          if (st.G!.phase !== "battle") r.roundsPerBattle.push(rounds);
        } else if (G.phase === "aftermath") loot(Math.random() < 0.15 ? "skim" : "take");
        else if (G.phase === "finale") {
          if (G.ch === EDINGTON) crossSea();
          else {
            r.silver900.push(G.silver); r.rep900.push(G.rep);
            const scores = CHOSEN.map((k) => ENDINGS[k].bonus());
            r.bestEnding[CHOSEN[scores.indexOf(Math.max(...scores))]]++;
            ending(CHOSEN[Math.floor(Math.random() * 3)]);
          }
        } else if (G.phase === "hunt") throw new Error("bots do not hunt");
      }
      const G = st.G!;
      if (G.phase !== "over") throw new Error(`did not finish (phase ${G.phase}, chapter ${G.ch})`);
      if (G.res!.k === "death") r.deathsAt[G.ch]++;
      else if (G.ch === CH.length - 1) r.reached900++;
    } catch (e) {
      r.errors.push(String((e as Error).stack || e));
    }
  }
  r.rankChapter = rankChapters.map((c, i) => (i === 0 ? 0 : c.length ? median(c) : null));
  return r;
}

/** One readable block per profile, printed by `npm run balance`. */
export function describe(label: string, r: Report): string {
  const n900 = r.silver900.length;
  const ranks = RANKS.slice(1).map((k, i) => `${k.n} ${r.rankChapter[i + 1] === null ? "never" : `ch ${r.rankChapter[i + 1]} (${pctOf(r.rankReached[i + 1], r.runs).toFixed(0)}%)`}`).join(", ");
  const best = CHOSEN.map((k) => `${k} ${pctOf(r.bestEnding[k], n900).toFixed(0)}%`).join(", ");
  return [
    `== ${label}`,
    `  survived to 900: ${pctOf(r.reached900, r.runs).toFixed(1)}%   deaths by chapter: ${r.deathsAt.join(" ")}`,
    `  rank first reached (median chapter, share of runs): ${ranks}`,
    `  at 900: median silver ${median(r.silver900)}, median reputation ${median(r.rep900)}; best ending ${n900 ? best : "n/a"}`,
    `  rounds per battle: median ${median(r.roundsPerBattle)}`,
  ].join("\n");
}
