/* The line players share at the end of a saga. */
import { beforeEach, expect, it } from "vitest";
import { MemoryStore, useStore } from "../src/save/storage";
import { st } from "../src/core/state";
import { newGame } from "../src/core/camp";
import { finish } from "../src/core/endings";
import { sagaSummary } from "../src/core/summary";

beforeEach(() => { useStore(new MemoryStore()); st.interactive = false; newGame("Ketil Ormsson"); });

it("tells where a raider fell, and at what age", () => {
  const G = st.G!;
  G.ch = 10; G.rank = 3;
  finish("death");
  expect(sagaSummary(G)).toBe(`Ketil Ormsson, ship’s captain, fell at Paris in 885, 38 winters old. Saga score ${G.res!.total}.`);
});

it("tells how a raider who lived ended his days", () => {
  const G = st.G!;
  G.ch = 15; G.rank = 4; G.silver = 260;
  finish("sail");
  expect(sagaSummary(G)).toBe(`Ketil Ormsson, hersir, sailed home with 260 silver in 900. Saga score ${G.res!.total}.`);
});
