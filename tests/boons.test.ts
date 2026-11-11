/* Legacy gifts: buying them, choosing which to carry, and what each does for a new raider. */
import { beforeEach, describe, expect, it } from "vitest";
import { MemoryStore, useStore } from "../src/save/storage";
import { buyBoonSlot, chooseBoon, loadLegacy, maxhp, maxSta, nextBoonPrice, st } from "../src/core/state";
import { newGame, startCamp } from "../src/core/camp";
import { readP } from "../src/core/combat";
import { fix } from "../src/core/life";
import { BOON_EFFECT, BOON_PRICES, BOON_SLOTS, BOONS } from "../src/content/tables";
import type { BoonId } from "../src/types";

const all = Object.keys(BOONS) as BoonId[];
/** A new raider carrying exactly these gifts. */
function raider(...gifts: BoonId[]) {
  Object.assign(st.L, { own: [...gifts], carry: [...gifts], slots: 3 });
  newGame("Ketil Ormsson");
  return st.G!;
}

beforeEach(() => { useStore(new MemoryStore()); st.interactive = false; loadLegacy(); });

describe("buying and carrying legacy gifts", () => {
  it("has a price for every gift, each higher than the last", () => {
    expect(BOON_PRICES).toHaveLength(all.length);
    for (let i = 1; i < BOON_PRICES.length; i++) expect(BOON_PRICES[i]).toBeGreaterThan(BOON_PRICES[i - 1]);
  });
  it("charges the next price, keeps the gift for good, and carries it while there is a place free", () => {
    st.L.pts = 100;
    expect(chooseBoon("skl")).toBe(true);
    expect(st.L.pts).toBe(100 - BOON_PRICES[0]);
    expect(nextBoonPrice()).toBe(BOON_PRICES[1]);
    expect(chooseBoon("spear")).toBe(true);
    expect(chooseBoon("herbs")).toBe(true);
    expect(st.L.own).toEqual(["skl", "spear", "herbs"]);
    expect(st.L.carry).toEqual(["skl", "spear"]);               // only two places
    expect(st.L.pts).toBe(100 - BOON_PRICES[0] - BOON_PRICES[1] - BOON_PRICES[2]);
  });
  it("refuses a gift the points do not cover", () => {
    st.L.pts = BOON_PRICES[0] - 1;
    expect(chooseBoon("str")).toBe(false);
    expect(st.L.own).toEqual([]);
  });
  it("lets an owned gift be set down and another picked up, at no cost", () => {
    Object.assign(st.L, { pts: 5, own: ["skl", "spear", "herbs"], carry: ["skl", "spear"] });
    expect(chooseBoon("herbs")).toBe(false);                    // hands full
    expect(chooseBoon("skl")).toBe(true);                       // set one down
    expect(chooseBoon("herbs")).toBe(true);
    expect(st.L.carry).toEqual(["spear", "herbs"]);
    expect(st.L.pts).toBe(5);
  });
  it("sells one more place, once", () => {
    st.L.pts = BOON_SLOTS.price + 1;
    expect(buyBoonSlot()).toBe(true);
    expect(st.L.slots).toBe(BOON_SLOTS.most);
    st.L.pts = 9999;
    expect(buyBoonSlot()).toBe(false);
  });
  it("has nothing more to sell when every gift is owned", () => {
    st.L.own = [...all];
    expect(nextBoonPrice()).toBeNull();
  });
});

describe("what the gifts do", () => {
  it("a raider with none starts as before", () => {
    const G = raider();
    expect([G.str, G.skl, G.end, G.silver, G.wp, G.ar]).toEqual([3, 3, 3, 6, 0, 0]);
    expect(maxSta()).toBe(8);
  });
  it("stats, silver and gear", () => {
    expect(raider("str").str).toBe(4);
    expect(raider("skl").skl).toBe(4);
    const hardy = raider("end");
    expect(hardy.end).toBe(4);
    expect(hardy.hp).toBe(maxhp());
    expect(raider("hoard").silver).toBe(6 + BOON_EFFECT.hoard);
    expect(raider("spear").wp).toBe(1);
    expect(raider("jerkin").ar).toBe(1);
  });
  it("stamina, reading the enemy and morale", () => {
    raider("lungs");
    expect(maxSta()).toBe(8 + BOON_EFFECT.lungs);
    raider();
    const plain = readP();
    raider("wolf");
    expect(readP()).toBe(plain + BOON_EFFECT.read);
    const glad = raider("heart");
    glad.mor = 3; fix();
    expect(glad.mor).toBe(BOON_EFFECT.morale);
  });
  it("healer's herbs add to the healing at the start of each camp", () => {
    const healed = (...gifts: BoonId[]) => { const G = raider(...gifts); G.end = 9; G.hp = 5; G.ev = null; startCamp(); return G.hp - 5; };
    expect(healed("herbs") - healed()).toBe(BOON_EFFECT.herbs);
  });
  it("only what the raider set out with counts: gifts bought later are for the next one", () => {
    const G = raider("str");
    st.L.carry = ["str", "skl"];
    expect(G.boons).toEqual(["str"]);
    expect(G.skl).toBe(3);
  });
});
