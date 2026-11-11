/* Save codes must round-trip exactly, and refuse anything damaged or invalid instead of breaking the game. */
import { beforeEach, describe, expect, it } from "vitest";
import { KEYS, MemoryStore, SAVE_VERSION, store, useStore } from "../src/save/storage";
import { readSaved } from "../src/save/local";
import { st } from "../src/core/state";
import { newGame } from "../src/core/camp";
import { march } from "../src/core/combat";
import { checkLocalRun, decodeSave, encodeSave, SaveCodeError, type SaveBundle } from "../src/core/savecode";

const bundle = (): SaveBundle => ({ legacy: structuredClone(st.L), run: { v: SAVE_VERSION, G: structuredClone(st.G!), B: null } });
const plain = (data: unknown) => "RL0:" + btoa(unescape(encodeURIComponent(JSON.stringify(data)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

beforeEach(() => { useStore(new MemoryStore()); st.interactive = false; newGame("Ketil Ormsson"); });

describe("save codes", () => {
  it("round-trip a saga and legacy exactly, compressed", async () => {
    const b = bundle();
    const code = await encodeSave(b);
    expect(code.startsWith("RL1:")).toBe(true);
    expect(await decodeSave(code)).toEqual(b);
  });
  it("accept a code split across lines or with spaces, as pasting sometimes does", async () => {
    const code = await encodeSave(bundle());
    const mangled = code.slice(0, 40) + "\n  " + code.slice(40);
    expect((await decodeSave(mangled)).run?.G.name).toBe("Ketil Ormsson");
  });
  it("read the uncompressed form too", async () => {
    expect((await decodeSave(plain(bundle()))).run?.G.name).toBe("Ketil Ormsson");
  });
  it("bring a saga saved mid-battle back to camp, just before that fight", async () => {
    const b = bundle();
    b.run!.G.phase = "battle"; b.run!.G.acts = 2;
    const back = await decodeSave(await encodeSave(b));
    expect(back.run?.G.phase).toBe("camp");
    expect(back.run?.G.acts).toBe(0);
    expect(back.run?.B).toBeNull();
  });
  it("refuse text that is not a save code", async () => {
    await expect(decodeSave("hello")).rejects.toThrow(SaveCodeError);
    await expect(decodeSave("hello")).rejects.toThrow(/isn’t a save code/);
  });
  it("refuse a code that was cut short", async () => {
    const code = await encodeSave(bundle());
    await expect(decodeSave(code.slice(0, code.length >> 1))).rejects.toThrow(/damaged or incomplete/);
  });
  it("refuse impossible values instead of loading them", async () => {
    for (const change of [
      (b: SaveBundle) => { b.run!.G.ch = 99; },
      (b: SaveBundle) => { b.run!.G.ev = "no-such-event"; },
      (b: SaveBundle) => { (b.run!.G as unknown as Record<string, unknown>).hp = "lots"; },
      (b: SaveBundle) => { b.legacy.up.str = 50; },
      (b: SaveBundle) => { (b.run!.G.crew as unknown as Record<string, unknown>).L = "nobody"; },
    ]) {
      const b = bundle();
      change(b);
      await expect(decodeSave(plain(b))).rejects.toThrow(/different game or a newer version/);
    }
  });
  it("load a legacy with no saga in progress", async () => {
    const back = await decodeSave(await encodeSave({ legacy: st.L, run: null }));
    expect(back.run).toBeNull();
    expect(back.legacy.pts).toBe(st.L.pts);
  });
});

/* The saga kept in the browser gets the same checks, so a damaged one cannot break the game either. */
describe("the saga kept in this browser", () => {
  type Raw = { v: number; G: Record<string, unknown>; B: Record<string, unknown> | null };
  /** A save as it comes back from storage: plain data, here in the middle of a battle. */
  const midBattle = (): Raw => {
    st.G!.ev = null;
    march();
    return JSON.parse(JSON.stringify({ v: SAVE_VERSION, G: st.G, B: st.B }));
  };

  it("keeps a battle in progress when it is sound", () => {
    const run = checkLocalRun(midBattle());
    expect(run?.G.phase).toBe("battle");
    expect(run?.B?.foes.length).toBeGreaterThan(0);
    expect(run?.B?.swing).toBeNull();
  });
  it("starts the fight again when the battle is damaged or from an older version", () => {
    const older = midBattle();
    older.v = SAVE_VERSION - 1;
    const damaged = { ...older, v: SAVE_VERSION, B: { ...older.B, foes: "nobody" } };
    for (const raw of [older, damaged]) {
      const run = checkLocalRun(raw);
      expect(run?.G.phase).toBe("camp");
      expect(run?.G.acts).toBe(0);
      expect(run?.B).toBeNull();
    }
  });
  it("fills in what a save from an older version lacks", () => {
    const raw = midBattle();
    delete raw.G.mid; delete raw.G.lastEv; delete raw.G.jarl;
    const run = checkLocalRun(raw);
    expect(run?.G.mid).toBe(false);
    expect(run?.G.lastEv).toBeNull();
  });
  it("refuses a saga it cannot use, instead of breaking on it later", () => {
    const changes: ((raw: Raw) => unknown)[] = [
      (raw) => { raw.G.ev = "an-event-removed-in-an-update"; return raw; },
      (raw) => { raw.G.ch = 40; return raw; },
      (raw) => { raw.G.rank = 9; return raw; },
      (raw) => { delete raw.G.crew; return raw; },
      (raw) => ({ ...raw, G: "nothing" }),
      () => null,
      () => "not a save",
    ];
    for (const change of changes) expect(checkLocalRun(change(midBattle()))).toBeNull();
  });
  it("tells a damaged save from no save at all", () => {
    expect(readSaved()).toEqual({ run: null, damaged: false });
    store.save(KEYS.run, { v: SAVE_VERSION, G: { name: "Ketil" } });
    expect(readSaved()).toEqual({ run: null, damaged: true });
    store.save(KEYS.run, midBattle());
    expect(readSaved().run?.G.name).toBe("Ketil Ormsson");
    expect(readSaved().damaged).toBe(false);
  });
});
