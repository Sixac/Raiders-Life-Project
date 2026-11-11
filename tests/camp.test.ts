/* Ways to spend silver in camp that use no camp action, and kit for the men beside a captain. */
import { beforeEach, describe, expect, it } from "vitest";
import { MemoryStore, SAVE_VERSION, useStore } from "../src/save/storage";
import { crewAll, loadLegacy, maxhp, st } from "../src/core/state";
import { act, newGame, nextKit, smithItems } from "../src/core/camp";
import { checkLocalRun } from "../src/core/savecode";
import { refillCrew } from "../src/core/life";
import { CREW_KIT, CREW_KITS, HEALER, HIRE, RINGS } from "../src/content/tables";

/** A raider in camp with nothing pending, of the given rank and with silver to spend. */
function raider(rank: number, silver = 500) {
  newGame("Ketil Ormsson");
  const G = st.G!;
  Object.assign(G, { rank, silver, ev: null, mid: false, acts: 3 });
  return G;
}

beforeEach(() => { useStore(new MemoryStore()); st.interactive = false; loadLegacy(); });

describe("the healer", () => {
  it("sells health for silver once each camp, without using an action", () => {
    const G = raider(0);
    G.hp = 5;
    act("heal");
    expect([G.hp, G.silver, G.acts]).toEqual([5 + HEALER.hp, 500 - HEALER.price, 3]);
    act("heal");
    expect(G.hp).toBe(5 + HEALER.hp);                       // once a camp
  });
  it("takes no silver from a raider with no hurts, or with too little silver", () => {
    const G = raider(0);
    act("heal");
    expect(G.silver).toBe(500);
    G.hp = 5; G.silver = HEALER.price - 1;
    act("heal");
    expect(G.hp).toBe(5);
  });
  it("never heals past full health", () => {
    const G = raider(0);
    G.hp = maxhp() - 2;
    act("heal");
    expect(G.hp).toBe(maxhp());
  });
});

describe("kit for the men beside a captain", () => {
  it("is not for sale below captain", () => {
    raider(CREW_KIT.rank - 1);
    expect(nextKit()).toBeNull();
    expect(smithItems().some((o) => o.t === "k")).toBe(false);
  });
  it("is bought from the smith a step at a time, and makes every man beside you harder to kill, now and later", () => {
    const G = raider(CREW_KIT.rank);
    const before = crewAll().map((m) => m.mx);
    act("buy", "k1");
    expect(G.kit).toBe(1);
    expect(G.silver).toBe(500 - CREW_KITS[1][1]);
    expect(G.acts).toBe(2);                                  // a visit to the smith uses an action
    expect(crewAll().map((m) => m.mx)).toEqual(before.map((mx) => mx + CREW_KIT.hp));
    act("buy", "k3");                                        // steps cannot be skipped
    expect(G.kit).toBe(1);
    act("buy", "k2");
    // A man who joins later has the kit too: a hired spearman, and a new face after a battle.
    act("hire");
    const hired = crewAll().find((m) => m.mx === HIRE.hp + 2 * CREW_KIT.hp);
    expect(hired).toBeDefined();
    G.crew.L.pop();
    refillCrew();
    expect(G.crew.L[G.crew.L.length - 1].mx).toBe(10 + 2 * CREW_KIT.hp);
  });
  it("runs out when the men have the best there is", () => {
    const G = raider(CREW_KIT.rank);
    for (let i = 1; i < CREW_KITS.length; i++) { G.acts = 3; act("buy", `k${i}`); }
    expect(G.kit).toBe(CREW_KITS.length - 1);
    expect(nextKit()).toBeNull();
  });
});

describe("rings for a hersir's men", () => {
  it("are his to give before a battle, once, without using an action", () => {
    const G = raider(RINGS.rank);
    const rep = G.rep;
    act("rings");
    expect([G.rings, G.silver, G.rep, G.acts]).toEqual([true, 500 - RINGS.price, rep + RINGS.rep, 3]);
    act("rings");
    expect(G.silver).toBe(500 - RINGS.price);
  });
  it("are not for a lesser man to give", () => {
    const G = raider(RINGS.rank - 1);
    act("rings");
    expect(G.rings).toBeFalsy();
    expect(G.silver).toBe(500);
  });
});

describe("saves", () => {
  it("keep the new fields, and refuse kit that does not exist", () => {
    const G = raider(CREW_KIT.rank);
    act("buy", "k1");
    const raw = () => JSON.parse(JSON.stringify({ v: SAVE_VERSION, G, B: null }));
    expect(checkLocalRun(raw())?.G.kit).toBe(1);
    const bad = raw(); bad.G.kit = 9;
    expect(checkLocalRun(bad)).toBeNull();
  });
});
