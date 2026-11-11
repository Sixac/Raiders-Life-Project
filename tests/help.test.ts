/* The How to play page is built from the tuning tables; check nothing in them is left out. */
import { describe, expect, it } from "vitest";
import { FOE_KINDS, GODS, INTENTS, RANKS, STATS } from "../src/content/tables";
import { helpHtml } from "../src/ui/help";

describe("the How to play page", () => {
  const page = helpHtml(false);
  it("explains every stat, enemy move, kind of enemy, god and rank", () => {
    for (const s of Object.values(STATS)) expect(page).toContain(s.d);
    for (const i of Object.values(INTENTS)) { expect(page).toContain(i.t); expect(page).toContain(i.hint); }
    for (const k of Object.values(FOE_KINDS)) expect(page).toContain(k.note);
    for (const god of Object.values(GODS)) expect(page).toContain(god.n);
    for (const r of RANKS.slice(1)) expect(page).toContain(`<dt>${r.n}</dt>`);
  });
  it("lists the keys on a desktop only", () => {
    expect(page).toContain("<h3>Keys</h3>");
    expect(helpHtml(true)).not.toContain("<h3>Keys</h3>");
  });
});
