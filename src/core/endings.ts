/* How a run ends: endings, the saga score, legacy points and the skald's verse. */
import type { EndingId } from "../types";
import { CH, EDINGTON, FINALES } from "../content/tables";
import { KEYS, store } from "../save/storage";
import { pick } from "./random";
import { age, g, keepLegacy, say, st } from "./state";
import { advance } from "./camp";

const isLate = () => g().ch > EDINGTON;

export interface Ending { l?: string; d: () => string; bonus: () => number }
export const ENDINGS: Record<EndingId, Ending> = {
  baptism: {
    l: "Kneel at the font",
    d: () => {
      const G = g();
      return (isLate()
        ? "You are baptised at last, an old raider among the farmers of East Anglia, and live out your years on your own land."
        : "Guthrum agrees to take baptism with thirty of his men, with Alfred as his godfather. You stand among them and take land in East Anglia.")
        + (G.f.promise ? " Eadgyth stands beside you, as you promised." : "")
        + (G.f.son ? " Your son learns to plough rather than row." : "");
    },
    bonus: () => 25 + Math.floor(Math.max(0, g().rep) / 2) + (g().f.promise ? 15 : 0),
  },
  sail: {
    l: "Sail home with your silver",
    d: () => isLate()
      ? `After ${age() - 18} years of war you buy passage north. The whale-road carries you home with your silver.`
      : "You buy passage on a ship bound for the north. The whale-road carries you home with your silver.",
    bonus: () => 15 + Math.floor(g().silver / 2),
  },
  danelaw: {
    l: "Take land at York",
    d: () => isLate()
      ? "You stay in York and take a farm in the Danelaw, where your name is known in every hall."
      : "You make for York, where Danes now hold the land, and claim a farm of your own.",
    bonus: () => 20 + g().rank * 8 + (isLate() ? 10 : 0),
  },
  north: { d: () => "You follow Halfdan north and take a farm by the river. Your raiding days are over.", bonus: () => 20 + g().rank * 5 },
  desert: { d: () => "You vanish into the fens with the deserters. Nobody sings about it.", bonus: () => 0 },
  death: { d: () => `You fall in the mud at ${CH[g().ch].place}, ${age()} winters old.`, bonus: () => 0 },
  outlaw: { d: () => "You leave the wall a second time. The army declares you outlaw and drives you out with stones.", bonus: () => 0 },
};
export const CHOSEN_ENDINGS: EndingId[] = ["baptism", "sail", "danelaw"];

/** Wulfstan's ford pays off only when leaving after Edington. */
export const fordBonus = (k: EndingId) => (g().f.ford && g().ch === EDINGTON && CHOSEN_ENDINGS.includes(k) ? 10 : 0);

export function scoreParts(): [string, number][] {
  const G = g();
  return [["Chapters survived", G.ch * 10], ["Foes slain", G.kills * 2], ["Reputation", Math.max(0, G.rep)], ["Silver", Math.floor(G.silver / 5)], ["Rank", G.rank * 10]];
}

function verse(k: EndingId): string[] | null {
  const G = g();
  if (k === "desert" || k === "outlaw" || G.rep < 10) return null;
  const first = G.name.split(" ")[0];
  const place = CH[Math.min(G.ch, CH.length - 1)].place;
  const kenning = pick(["Feeder of ravens", "Reddener of blades", "Oak of the shield-wall", "Rider of the sail-steed", "Giver of the wolf’s meal"]);
  const l2 = G.ch >= 10 ? "fought from Ashdown’s thorn to the walls of Paris" : G.kills >= 12 ? `gave the eagle its fill at ${place}` : `stood in the wall where ${place} ran red`;
  const l3 = ["kept his oar and kept his word", "rose from the bench to stand before the jarl", "won rings from the jarl’s own hand", "took the steering-oar of his own ship"][G.rank];
  const l4 = ({ baptism: "and knelt at last in the White Christ’s water.", sail: "and the whale-road carried him home.", danelaw: "and York gave him ploughland.", north: "and found his peace in Northumbria’s fields.", death: "and Odin has him now in the high hall." } as Record<string, string>)[k];
  return [`${kenning}, ${first},`, l2 + ";", l3 + ",", l4];
}

export function finish(k: EndingId): void {
  const G = g(), L = st.L;
  const parts = scoreParts();
  const base = parts.reduce((s, p) => s + p[1], 0);
  const bonus = ENDINGS[k].bonus() + fordBonus(k);
  const total = base + bonus;
  const pts = Math.floor(total / 5);
  L.pts += pts; L.runs++; L.best = Math.max(L.best, total);
  keepLegacy();
  store.remove(KEYS.run);
  G.res = { k, parts, bonus, total, pts, verse: verse(k),
    text: ENDINGS[k].d() + (fordBonus(k) ? " Wulfstan kept his word: his men let you through at the ford." : "") };
  G.phase = "over";
  st.B = null; st.H = null;
}
export const die = (k: EndingId) => finish(k);

/** Pick one of the chosen endings at a finale. */
export function ending(k: EndingId): void {
  if (g().phase !== "finale" || !ENDINGS[k].l) return;
  finish(k);
}

/** After Edington, keep going with the army that crosses to Francia. */
export function crossSea(): void {
  const G = g();
  if (G.phase !== "finale" || G.ch !== EDINGTON) return;
  say("You will not kneel and you will not farm. You join the men gathering at Fulham to cross the sea.", "head");
  G.mor += 5;
  advance();
}
export const isFinale = (ch: number) => FINALES.includes(ch);
