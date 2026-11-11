/* How camp events are chosen: fixed moments and story steps first, then a weighted pick. */
import { beforeEach, describe, expect, it } from "vitest";
import { MemoryStore, useStore } from "../src/save/storage";
import { st } from "../src/core/state";
import { newGame } from "../src/core/camp";
import { choose, drawEvent, eligibleEvents, eventWeight } from "../src/core/events";
import { EVENT_BY_ID } from "../src/content/tables";

const ids = () => eligibleEvents().map((e) => e.id);
/** Put the raider in a chapter with nothing pending, so the tests decide what has happened. */
function at(ch: number): void {
  const G = st.G!;
  G.ch = ch; G.ev = null; G.lastEv = null;
}

beforeEach(() => { useStore(new MemoryStore()); st.interactive = false; newGame("Ketil Ormsson"); });

describe("choosing events", () => {
  it("favours events that belong to few chapters", () => {
    expect(eventWeight(EVENT_BY_ID.yule)).toBeGreaterThan(eventWeight(EVENT_BY_ID.wife1));
    expect(eventWeight(EVENT_BY_ID.wife1)).toBeGreaterThan(eventWeight(EVENT_BY_ID.dice));
    expect(eventWeight({ ...EVENT_BY_ID.dice, weight: 7 })).toBe(7);
  });
  it("holds back the next step of a story until the step before has been met, a chapter earlier", () => {
    const G = st.G!;
    at(3); G.f.wife = 1;
    expect(ids()).not.toContain("wife2");              // she has not been met in this saga
    at(2); G.ev = "wife1"; choose(0);                  // meet her in chapter 3 (counting from 0: 2)
    expect(G.at?.wife1).toBe(2);
    at(2); expect(ids()).not.toContain("wife2");       // too soon, and outside her next window
    at(3); expect(ids()).toContain("wife2");
  });
  it("brings a story step before ordinary events, and a fixed moment whose time is short before the step", () => {
    const G = st.G!;
    at(2); G.ev = "wife1"; choose(0);
    at(4);
    for (let i = 0; i < 20; i++) { G.lastEv = null; expect(drawEvent()).toBe("wife2"); }
    // Chapter 6 (counting from 0: 5) has Halfdan's parting, which can only happen there.
    G.ev = "wife2"; choose(0);
    at(5);
    for (let i = 0; i < 20; i++) { G.lastEv = null; expect(drawEvent()).toBe("halfdan"); }
  });
  it("still continues a story in a saga begun before chapters were recorded", () => {
    const G = st.G!;
    at(4); G.f.wife = 1; G.used.push("wife1"); delete G.at;
    expect(ids()).toContain("wife2");
  });
});
