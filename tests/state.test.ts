/* Whatever is in the browser's storage, the game must still start. */
import { describe, expect, it } from "vitest";
import { listOf, soundLegacy, withArticle } from "../src/core/state";

describe("legacy read from storage", () => {
  const fresh = { pts: 0, best: 0, runs: 0, fought: 0, own: [], carry: [], slots: 2, seen: {}, timing: true, layout: "auto" };
  it("starts from nothing when nothing usable is saved", () => {
    for (const saved of [null, undefined, "x", 7, [], {}]) expect(soundLegacy(saved)).toEqual(fresh);
  });
  it("puts impossible values right", () => {
    expect(soundLegacy({ pts: "many", best: -4, up: null, own: "all of them", carry: 3, slots: 40, seen: 5, layout: "sideways", timing: "yes" }))
      .toEqual({ ...fresh, slots: 3 });
  });
  it("keeps what is sound", () => {
    expect(soundLegacy({ pts: 12.7, best: 300, runs: 4, fought: 9, own: ["skl", "herbs", "no-such-gift", "skl"], carry: ["herbs", "str"], slots: 2, seen: { camp: true, loot: "yes" }, timing: false, layout: "phone" }))
      .toEqual({ pts: 12, best: 300, runs: 4, fought: 9, own: ["skl", "herbs"], carry: ["herbs"], slots: 2, seen: { camp: true }, timing: false, layout: "phone" });
  });
  it("carries over perks bought under the first legacy rules as the gifts of the same name", () => {
    const L = soundLegacy({ pts: 40, up: { str: 3, skl: 0, end: 1, hoard: 2 }, runs: 5 });
    expect(L.own).toEqual(["str", "end", "hoard"]);
    expect(L.carry).toEqual(["str", "end"]);   // two places: the rest wait on the title screen
    expect(L.pts).toBe(40);
  });
});

describe("listOf", () => {
  it("joins names the way a sentence does", () => {
    expect(listOf([])).toBe("");
    expect(listOf(["Ulf"])).toBe("Ulf");
    expect(listOf(["Ulf", "Orm"])).toBe("Ulf and Orm");
    expect(listOf(["Ulf", "Orm", "Kari"])).toBe("Ulf, Orm and Kari");
  });
});

describe("withArticle", () => {
  it("chooses a or an", () => {
    expect(withArticle("ash spear")).toBe("an ash spear");
    expect(withArticle("bearded axe")).toBe("a bearded axe");
  });
});
