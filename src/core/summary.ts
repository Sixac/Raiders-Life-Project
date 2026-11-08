/* One line telling how a raider's saga ended, for sharing. */
import type { Game } from "../types";
import { CH, RANKS } from "../content/tables";

export function sagaSummary(G: Game): string {
  const c = CH[Math.min(G.ch, CH.length - 1)];
  const age = 18 + c.year - 865;
  const r = G.res;
  const how: Record<string, string> = {
    death: `fell at ${c.place} in ${c.year}, ${age} winters old`,
    baptism: `knelt at the font in ${c.year}`,
    sail: `sailed home with ${G.silver} silver in ${c.year}`,
    danelaw: `took land at York in ${c.year}`,
    north: `went north with Halfdan to farm in ${c.year}`,
    desert: `slipped away into the fens in ${c.year}`,
    outlaw: `was driven out of the army as an outlaw in ${c.year}`,
  };
  const rank = RANKS[G.rank].n.toLowerCase();
  return `${G.name}, ${rank}, ${how[r?.k ?? "death"]}. Saga score ${r?.total ?? 0}.`;
}
