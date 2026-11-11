/* Whatever is in the browser's storage, the game must still start. */
import { describe, expect, it } from "vitest";
import { soundLegacy, withArticle } from "../src/core/state";

describe("legacy read from storage", () => {
  const fresh = { pts: 0, best: 0, runs: 0, fought: 0, up: { str: 0, skl: 0, end: 0, hoard: 0 }, seen: {}, timing: true, layout: "auto" };
  it("starts from nothing when nothing usable is saved", () => {
    for (const saved of [null, undefined, "x", 7, [], {}]) expect(soundLegacy(saved)).toEqual(fresh);
  });
  it("puts impossible values right", () => {
    expect(soundLegacy({ pts: "many", best: -4, up: null, seen: 5, layout: "sideways", timing: "yes" })).toEqual(fresh);
  });
  it("keeps what is sound", () => {
    expect(soundLegacy({ pts: 12.7, best: 300, runs: 4, fought: 9, up: { str: 2, skl: 9 }, seen: { camp: true, loot: "yes" }, timing: false, layout: "phone" }))
      .toEqual({ pts: 12, best: 300, runs: 4, fought: 9, up: { str: 2, skl: 3, end: 0, hoard: 0 }, seen: { camp: true }, timing: false, layout: "phone" });
  });
});

describe("withArticle", () => {
  it("chooses a or an", () => {
    expect(withArticle("ash spear")).toBe("an ash spear");
    expect(withArticle("bearded axe")).toBe("a bearded axe");
  });
});
