/* Checks the data files, so a typo in events.json or chapters.json fails here instead of in play. */
import { describe, expect, it } from "vitest";
import { CH, EVENTS, FINALES, FOE_KINDS, WOUNDS } from "../src/content/tables";
import { namesHisLord, theFoe } from "../src/core/combat";
import type { Cond, Outcome } from "../src/types";

const STATS = ["str", "skl", "end", "fight"];
const ENDINGS = ["baptism", "sail", "danelaw", "north", "desert", "death", "outlaw"];
const OUTCOME_KEYS = ["text", "rep", "mor", "hp", "silver", "str", "skl", "end", "silverLoss", "flags", "wound", "woundChance", "addCrew", "weapon", "favour", "endRun"];
const COND_KEYS = ["flags", "notFlags", "minAge", "minKills", "maxWeapon", "minSilver", "nid"];
const PLACEHOLDERS = ["lost", "god", "crewFirst", "name"];
const EVENT_KEYS = ["id", "chapters", "when", "minRank", "priority", "repeatable", "after", "gap", "weight", "text", "options"];

function checkCond(c: Cond | undefined, where: string) {
  if (!c) return;
  for (const k of Object.keys(c)) expect(COND_KEYS, `${where}: unknown condition "${k}"`).toContain(k);
}
function checkOutcome(o: Outcome, where: string) {
  for (const k of Object.keys(o)) expect(OUTCOME_KEYS, `${where}: unknown outcome field "${k}"`).toContain(k);
  expect(typeof o.text, `${where}: text`).toBe("string");
  for (const m of o.text.matchAll(/\{(\w+)\}/g)) expect(PLACEHOLDERS, `${where}: unknown placeholder {${m[1]}}`).toContain(m[1]);
  if (o.wound && o.wound !== "random") expect(Object.keys(WOUNDS), `${where}: wound`).toContain(o.wound);
  if (o.endRun) expect(ENDINGS, `${where}: endRun`).toContain(o.endRun);
  if (o.silverLoss !== undefined) expect(o.silverLoss > 0 && o.silverLoss <= 1, `${where}: silverLoss is a fraction`).toBe(true);
}

describe("chapters", () => {
  it("has sixteen chapters running from 865 to 900", () => {
    expect(CH).toHaveLength(16);
    expect(CH[0].year).toBe(865);
    expect(CH[15].year).toBe(900);
    for (let i = 1; i < CH.length; i++) expect(CH[i].year).toBeGreaterThanOrEqual(CH[i - 1].year);
  });
  it("has the fields every screen needs", () => {
    for (const c of CH) {
      expect(c.foes).toHaveLength(2);
      expect(c.foeCount).toBeGreaterThanOrEqual(2);
      expect(c.alt.length).toBeGreaterThan(10);
      expect(["dawn", "day", "grey", "winter", "dusk", "night", "storm"]).toContain(c.scene.mood);
      expect(c.foeKinds, `${c.place}: foeKinds`).toHaveLength(2);
      for (const k of c.foeKinds) expect(Object.keys(FOE_KINDS), `${c.place}: foe kind`).toContain(k);
    }
  });
  it("ends at a finale", () => expect(FINALES).toContain(CH.length - 1));
  it("names enemies so they read right in a sentence", () => {
    expect(theFoe({ n: "Mercian spearman" })).toBe("the Mercian spearman");
    expect(theFoe({ n: "king’s thegn" })).toBe("the king’s thegn");
    expect(theFoe({ n: "Louis’s champion" })).toBe("Louis’s champion");
    expect(theFoe({ n: "Count Odo’s retainer" })).toBe("Count Odo’s retainer");
    // Ordinary enemies follow "Another", which a name like "Edward’s raider" cannot.
    for (const c of CH) expect(namesHisLord(c.foes[0]), `${c.place}: "Another ${c.foes[0]}"`).toBe(false);
  });
});

describe("events", () => {
  it("have unique ids", () => {
    const ids = EVENTS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  for (const e of EVENTS) {
    it(`${e.id} is well formed`, () => {
      for (const k of Object.keys(e)) expect(EVENT_KEYS, `${e.id}: unknown field "${k}"`).toContain(k);
      expect(e.text.length).toBeGreaterThan(0);
      expect(e.options.length).toBeGreaterThanOrEqual(2);
      if (e.weight !== undefined) expect(e.weight, `${e.id}: weight`).toBeGreaterThan(0);
      if (e.after) {
        // The next step of a story: the step before must exist, and leave this one time to come.
        const before = EVENTS.find((x) => x.id === e.after);
        expect(before, `${e.id}: after "${e.after}" names no event`).toBeDefined();
        const gap = e.gap ?? 1;
        expect(gap, `${e.id}: gap`).toBeGreaterThanOrEqual(1);
        expect((before!.chapters?.[0] ?? 0) + gap, `${e.id} comes too early to follow ${e.after}`).toBeLessThanOrEqual(e.chapters?.[1] ?? CH.length - 1);
      } else expect(e.gap, `${e.id}: gap needs after`).toBeUndefined();
      if (e.chapters) {
        expect(e.chapters[0]).toBeLessThanOrEqual(e.chapters[1]);
        expect(e.chapters[1]).toBeLessThan(CH.length);
      }
      checkCond(e.when, e.id);
      // At least one option must always be available, or the camp would be stuck.
      expect(e.options.some((o) => !o.requires && !o.pay), `${e.id}: needs one option with no requirement`).toBe(true);
      e.options.forEach((o, i) => {
        const where = `${e.id} option ${i + 1}`;
        checkCond(o.requires, where);
        checkCond(o.test, where);
        if (o.check) expect(STATS, `${where}: check stat`).toContain(o.check.stat);
        if (o.check || o.chance !== undefined || o.test) expect(o.fail, `${where}: a roll needs a fail outcome`).toBeDefined();
        checkOutcome(o.pass, where + " pass");
        if (o.fail) checkOutcome(o.fail, where + " fail");
      });
    });
  }
});
