/*
 * Plays thousands of runs with two bots and checks that nothing breaks and the balance holds.
 * The careful bot answers every enemy move it can read; the careless one mostly just attacks.
 * Run `npm run balance` to see the numbers.
 */
import { beforeAll, describe, expect, it } from "vitest";
import type { Action } from "../src/types";
import { MemoryStore, useStore } from "../src/save/storage";
import { maxhp, st } from "../src/core/state";
import { act, newGame } from "../src/core/camp";
import { choose, optionEnabled } from "../src/core/events";
import { answer, loot, march, turn } from "../src/core/combat";
import { crossSea, ending } from "../src/core/endings";
import { ARMOUR, CH, EDINGTON, EVENT_BY_ID, EVENTS, FRANKISH_FROM, INTENTS, WEAPONS } from "../src/content/tables";

beforeAll(() => { useStore(new MemoryStore()); st.interactive = false; });

interface Stats { runs: number; ends: Record<string, number>; endedAt: number[]; errors: string[]; seen: Set<string>; finished: number }

function play(careful: boolean, runs: number): Stats {
  const s: Stats = { runs, ends: {}, endedAt: Array(CH.length + 1).fill(0), errors: [], seen: new Set(), finished: 0 };
  for (let n = 0; n < runs; n++) {
    try {
      newGame("Test Raider");
      let steps = 0;
      while (st.G!.phase !== "over" && steps++ < 8000) {
        const G = st.G!;
        if (G.phase === "camp") {
          if (G.ev) {
            s.seen.add(G.ev);
            const e = EVENT_BY_ID[G.ev];
            let ok = e.options.map((o, i) => (optionEnabled(o) ? i : -1)).filter((i) => i >= 0);
            const stay = ok.filter((i) => !(e.id === "deserters" && i === 2) && !(e.id === "halfdan" && i === 0 && Math.random() < 0.85));
            if (stay.length) ok = stay;
            choose(ok[Math.floor(Math.random() * ok.length)]);
            continue;
          }
          if (G.acts < 1) { march(); continue; }
          const nw = WEAPONS[G.wp + 1], na = ARMOUR[G.ar + 1];
          if (G.hp < maxhp() * 0.75) act("rest");
          else if (G.mor < 45 && G.silver >= 3) act("feast");
          else if (G.mor < 35) act("forage", "fish");
          else if (na && G.silver >= na[2] && G.ar <= G.wp) act("buy", "a" + (G.ar + 1));
          else if (nw && G.silver >= nw[2] && (G.wp + 1 < 4 || G.ch >= FRANKISH_FROM)) act("buy", "w" + (G.wp + 1));
          else if (!G.jarl) act("jarl");
          else if (G.silver >= 2 && G.gods.odin < 2) act("offer", "odin");
          else if (G.mor >= 30) act("train", (["str", "skl", "end"] as const).slice().sort((a, b) => G[a] - G[b])[0]);
          else act("forage", "raid");
          continue;
        }
        if (G.phase === "battle") {
          const B = st.B!;
          if (B.prompt) { answer(Math.random() < 0.5 ? 0 : 1); continue; }
          let a: Action = careful && B.read ? INTENTS[B.intent].counter : "strike";
          if (!careful && Math.random() < 0.2) a = (["strike", "heavy", "guard", "bash", "rally"] as Action[])[Math.floor(Math.random() * 5)];
          if (a === "strike" && G.mor >= 80) a = "berserk";
          if (a === "heavy" && B.sta < 2) a = "guard";
          if ((a === "strike" || a === "bash" || a === "rally") && B.sta < 1) a = "guard";
          turn(a);
          continue;
        }
        if (G.phase === "aftermath") { loot(Math.random() < 0.2 ? "skim" : "take"); continue; }
        if (G.phase === "finale") {
          if (G.ch === EDINGTON && Math.random() < 0.75) crossSea();
          else ending((["baptism", "sail", "danelaw"] as const)[Math.floor(Math.random() * 3)]);
          continue;
        }
        throw new Error("stuck in phase " + G.phase);
      }
      const G = st.G!;
      if (G.phase !== "over") throw new Error(`did not finish (phase ${G.phase}, chapter ${G.ch})`);
      s.ends[G.res!.k] = (s.ends[G.res!.k] || 0) + 1;
      s.endedAt[G.ch]++;
      if (G.ch === CH.length - 1 && G.res!.k !== "death") s.finished++;
    } catch (e) {
      s.errors.push(String((e as Error).stack || e));
    }
  }
  return s;
}

describe("simulated play", () => {
  it("a careful player gets far, a careless one does not, and nothing breaks", () => {
    const careful = play(true, 1500);
    const careless = play(false, 1500);
    console.log("careful:", careful.ends, "survived to 900:", careful.finished, "\nended at chapter:", careful.endedAt.join(" "));
    console.log("careless:", careless.ends, "survived to 900:", careless.finished, "\nended at chapter:", careless.endedAt.join(" "));
    console.log("events never seen:", EVENTS.filter((e) => !careful.seen.has(e.id) && !careless.seen.has(e.id)).map((e) => e.id).join(", ") || "none");
    expect(careful.errors.slice(0, 3)).toEqual([]);
    expect(careless.errors.slice(0, 3)).toEqual([]);
    // Balance guard rails: tweak these if the game is meant to get easier or harder.
    expect(careful.finished / careful.runs).toBeGreaterThan(0.08);
    expect(careless.finished / careless.runs).toBeLessThan(0.05);
  }, 120_000);
});
