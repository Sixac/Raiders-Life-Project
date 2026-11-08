/*
 * Plays thousands of runs with bots and checks that nothing breaks and the balance holds.
 * Run `npm run balance` to see the full report. If a change to the rules fails one of these
 * checks on purpose, adjust the limits here and say why in the commit.
 */
import { describe as group, expect, it } from "vitest";
import { EVENTS } from "../src/content/tables";
import { describe, pctOf, simulate, type Profile, type Report } from "./sim";

const RUNS = 1500;
const PROFILES: Record<string, Profile> = {
  "careful, timing off": { careful: true, timing: "off" },
  "careful, poor timing": { careful: true, timing: "poor" },
  "careful, average timing": { careful: true, timing: "average" },
  "careful, skilled timing": { careful: true, timing: "skilled" },
  "careless, average timing": { careful: false, timing: "average" },
};

group("simulated play", () => {
  it("nothing breaks, and the balance stays within its limits", () => {
    const r: Record<string, Report> = {};
    for (const [label, p] of Object.entries(PROFILES)) {
      r[label] = simulate(p, RUNS);
      console.log(describe(label, r[label]));
    }
    const seen = new Set(Object.values(r).flatMap((x) => [...x.eventsSeen]));
    console.log("events never seen:", EVENTS.filter((e) => !seen.has(e.id)).map((e) => e.id).join(", ") || "none");

    for (const x of Object.values(r)) expect(x.errors.slice(0, 3)).toEqual([]);
    const survival = (label: string) => pctOf(r[label].reached900, RUNS);
    const avg = r["careful, average timing"];

    // A careful player with average timing should often, but not usually, live to 900.
    expect(survival("careful, average timing")).toBeGreaterThan(15);
    expect(survival("careful, average timing")).toBeLessThan(45);
    // Fighting without reading the enemy should almost never get there.
    expect(survival("careless, average timing")).toBeLessThan(5);
    // Timing should matter, but not decide most runs.
    expect(survival("careful, skilled timing") - survival("careful, poor timing")).toBeLessThan(35);
    // Turning timed swings off should neither help nor hurt much compared with average timing.
    expect(Math.abs(survival("careful, timing off") - survival("careful, average timing"))).toBeLessThan(12);
    // Promotions should be spread over the campaign: the last two ranks come after Edington (chapter 7).
    expect(avg.rankChapter[3]).toBeGreaterThanOrEqual(7);
    expect(avg.rankChapter[4]).toBeGreaterThanOrEqual(9);
    // No single ending should be the best choice for nearly everyone who reaches 900.
    const n900 = avg.silver900.length;
    for (const k of Object.keys(avg.bestEnding)) expect(pctOf(avg.bestEnding[k], n900)).toBeLessThan(75);
  }, 300_000);
});
