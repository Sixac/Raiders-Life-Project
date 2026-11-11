/*
 * A bot that plays whole runs through the game rules, for the balance test and `npm run balance`.
 *
 * "Careful" bots answer every enemy move they can read with its counter; "careless" ones mostly
 * just attack. Timed swings are modelled with a share of perfect and badly timed blows, since a
 * player's timing changes the odds a lot; "off" plays with timed swings turned off.
 * Bots pick event options at random; one that "follows the stories" takes the option that keeps
 * a story going whenever there is one, as a player curious about Eadgyth or Hrafn would.
 */
import type { Action, BoonId, Quality } from "../src/types";
import { MemoryStore, useStore } from "../src/save/storage";
import { maxhp, st } from "../src/core/state";
import { act, hireSide, newGame, nextKit } from "../src/core/camp";
import { choose, eligibleEvents, optionEnabled } from "../src/core/events";
import { answer, loot, march, resolve, turn, visibleIntent } from "../src/core/combat";
import { crossSea, ending, ENDINGS } from "../src/core/endings";
import { ARMOUR, ATTACKS, CH, COST, EDINGTON, EVENT_BY_ID, EVENTS, FRANKISH_FROM, GIFT, HEALER, HIRE, INTENTS, RANKS, RINGS, WEAPONS } from "../src/content/tables";

export type Timing = "off" | "poor" | "average" | "skilled";
export interface Profile {
  careful: boolean; timing: Timing; stories?: boolean;
  /** Legacy gifts every raider of this bot carries. */
  boons?: BoonId[];
  /** Keeps his silver to sail home rich: he buys his own gear and hires men, but pays for no healer, rings, gifts or kit. */
  thrifty?: boolean;
}

/** The first event of each story: one that later events follow and that follows nothing itself. */
export const STORY_OPENERS = [...new Set(EVENTS.filter((e) => e.after).map((e) => {
  let first = EVENT_BY_ID[e.after!];
  while (first.after) first = EVENT_BY_ID[first.after];
  return first.id;
}))];
/** By this chapter (counting from 0) every story opener has had its chance to appear. */
export const STORIES_BEGUN_BY = Math.max(...STORY_OPENERS.map((id) => EVENT_BY_ID[id].chapters?.[1] ?? 0)) + 1;

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
  /** For each event: the runs in which it appeared, and the runs in which it could have. */
  eventMet: Record<string, number>;
  eventCould: Record<string, number>;
  /** Runs that lasted until every story opener had had its chance, and how many of them began a story. */
  storyRuns: number;
  storyBegun: number;
  /** Legacy points each run earned. */
  points: number[];
}

export const median = (a: number[]) => { if (!a.length) return NaN; const b = [...a].sort((x, y) => x - y); return b[b.length >> 1]; };
export const pctOf = (n: number, of: number) => (of ? (100 * n) / of : 0);

function swingQuality(t: Timing): Quality {
  if (t === "off") return null;
  const r = Math.random(), p = TIMING[t];
  return r < p.perfect ? "perfect" : r < p.perfect + p.poor ? "poor" : "good";
}

/**
 * Camp: buy gear, then kit for the men; spend spare silver on men, the jarl, the healer and rings
 * (none of which needs an action); then heal, eat and train.
 */
function campStep(thrifty = false): void {
  const G = st.G!;
  const nw = WEAPONS[G.wp + 1], na = ARMOUR[G.ar + 1], kit = thrifty ? null : nextKit();
  const ownGear = Math.min(na ? na[2] : Infinity, nw && (G.wp + 1 < 4 || G.ch >= FRANKISH_FROM) ? nw[2] : Infinity);
  // Silver is kept back for the next thing at the smith: the raider's own gear first, then his men's.
  const nextGear = Number.isFinite(ownGear) ? ownGear : kit ? kit[2] : Infinity;
  const spare = G.silver - (G.acts > 0 && Number.isFinite(nextGear) ? nextGear : 0);
  if (G.rank >= 1 && hireSide() && spare >= HIRE.price) return act("hire");
  if (!thrifty) {
    if (!G.jarl && !G.nid && spare >= GIFT.price) return act("gift");
    if (!G.healed && G.hp < maxhp() * 0.75 && spare >= HEALER.price) return act("heal");
    if (G.rank >= RINGS.rank && !G.rings && !G.nid && spare >= RINGS.price) return act("rings");
  }
  if (G.acts < 1) return march();
  if (G.hp < maxhp() * 0.75) act("rest");
  else if (G.mor < 45 && G.silver >= 3) act("feast");
  else if (G.mor < 35) act("forage", "fish");
  else if (na && G.silver >= na[2] && G.ar <= G.wp) act("buy", "a" + (G.ar + 1));
  else if (nw && G.silver >= nw[2] && (G.wp + 1 < 4 || G.ch >= FRANKISH_FROM)) act("buy", "w" + (G.wp + 1));
  else if (kit && !Number.isFinite(ownGear) && G.silver >= kit[2]) act("buy", "k" + kit[1]);
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
    silver900: [], rep900: [], bestEnding: { baptism: 0, sail: 0, danelaw: 0 }, roundsPerBattle: [], eventsSeen: new Set(),
    eventMet: {}, eventCould: {}, storyRuns: 0, storyBegun: 0, points: [] };
  const boons = p.boons ?? [];
  Object.assign(st.L, { own: [...boons], carry: [...boons], slots: Math.max(2, boons.length) });
  const rankChapters: number[][] = RANKS.map(() => []);
  for (let n = 0; n < runs; n++) {
    try {
      newGame("Test Raider");
      let steps = 0, rounds = 0, topRank = 0;
      const met = new Set<string>(), could = new Set<string>();
      while (st.G!.phase !== "over" && steps++ < 9000) {
        const G = st.G!;
        while (topRank < G.rank) { topRank++; rankChapters[topRank].push(G.ch); r.rankReached[topRank]++; }
        if (G.phase === "camp") {
          if (G.ev) {
            r.eventsSeen.add(G.ev);
            met.add(G.ev); could.add(G.ev);
            for (const other of eligibleEvents()) could.add(other.id);
            const e = EVENT_BY_ID[G.ev];
            let ok = e.options.map((o, i) => (optionEnabled(o) ? i : -1)).filter((i) => i >= 0);
            // Bots stay with the army so whole runs get tested.
            const stay = ok.filter((i) => !(e.id === "deserters" && i === 2) && !(e.id === "halfdan" && i === 0));
            if (stay.length) ok = stay;
            // Following the stories: take an option that sets a story going or keeps it going.
            const hooks = ok.filter((i) => Object.values(e.options[i].pass.flags ?? {}).some((v) => v));
            if (p.stories && hooks.length) ok = hooks;
            choose(ok[Math.floor(Math.random() * ok.length)]);
          } else { if (G.acts < 1) rounds = 0; campStep(p.thrifty); }
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
      r.points.push(G.res!.pts);
      if (G.res!.k === "death") r.deathsAt[G.ch]++;
      else if (G.ch === CH.length - 1) r.reached900++;
      for (const id of met) r.eventMet[id] = (r.eventMet[id] ?? 0) + 1;
      for (const id of could) r.eventCould[id] = (r.eventCould[id] ?? 0) + 1;
      if (G.ch >= STORIES_BEGUN_BY) { r.storyRuns++; if (STORY_OPENERS.some((id) => met.has(id))) r.storyBegun++; }
    } catch (e) {
      r.errors.push(String((e as Error).stack || e));
    }
  }
  r.rankChapter = rankChapters.map((c, i) => (i === 0 ? 0 : c.length ? median(c) : null));
  return r;
}

/** How often an event appeared, as a percentage of the runs in which it could have. */
export const shown = (r: Report, id: string) => pctOf(r.eventMet[id] ?? 0, r.eventCould[id] ?? 0);

/** How the stories and the rarer events fared, printed for the bot that follows the stories. */
export function describeEvents(r: Report): string {
  const steps = (id: string): string[] => [id, ...EVENTS.filter((e) => e.after === id).flatMap((e) => steps(e.id))];
  const line = (id: string) => `${id} ${shown(r, id).toFixed(0)}%`;
  const rare = EVENTS.filter((e) => r.eventCould[e.id]).sort((a, b) => shown(r, a.id) - shown(r, b.id)).slice(0, 8);
  return [
    `  a story begins in ${pctOf(r.storyBegun, r.storyRuns).toFixed(0)}% of runs that last to chapter ${STORIES_BEGUN_BY + 1}`,
    ...STORY_OPENERS.map((id) => `  story: ${line(id)} of all runs; then, of the runs where each step could come: ${steps(id).slice(1).map(line).join(", ")}`),
    `  events seen least often, of the runs where they could come: ${rare.map((e) => line(e.id)).join(", ")}`,
  ].join("\n");
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
    `  rounds per battle: median ${median(r.roundsPerBattle)}; legacy points per run: median ${median(r.points)}`,
  ].join("\n");
}
