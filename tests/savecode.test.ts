/* Save codes must round-trip exactly, and refuse anything damaged or invalid instead of breaking the game. */
import { beforeEach, describe, expect, it } from "vitest";
import { MemoryStore, SAVE_VERSION, useStore } from "../src/save/storage";
import { st } from "../src/core/state";
import { newGame } from "../src/core/camp";
import { decodeSave, encodeSave, SaveCodeError, type SaveBundle } from "../src/core/savecode";

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
