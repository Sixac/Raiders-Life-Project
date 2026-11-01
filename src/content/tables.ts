/* Tuning tables: ranks, gear, wounds, gods, legacy perks, enemy moves. */
import type { Action, Chapter, GameEvent, GodId, IntentId, PerkId, WoundId } from "../types";
import chaptersJson from "./chapters.json";
import eventsJson from "./events.json";

export const CH = chaptersJson as unknown as Chapter[];
export const EVENTS = eventsJson as unknown as GameEvent[];
export const EVENT_BY_ID: Record<string, GameEvent> = Object.fromEntries(EVENTS.map((e) => [e.id, e]));

/** Chapters (0-based) after which the player picks an ending: Edington and York 900. */
export const FINALES = [7, 15];
export const EDINGTON = 7;

export const NAMES = ["Ketil", "Ulf", "Asbjorn", "Thorgrim", "Orm", "Skeggi", "Bersi", "Gunnar", "Kolbein", "Hrolf", "Vigfus", "Eyvind", "Sigtrygg", "Thorstein", "Grim", "Ragnvald", "Bjarni", "Steinar", "Arnor", "Kari", "Toki", "Svein", "Halldor", "Einar", "Ari", "Leif", "Odd", "Snorri"];
export const FATHERS = ["Ketils", "Ulfs", "Asbjarnar", "Thorgrims", "Orms", "Gunnars", "Kolbeins", "Hrolfs", "Eyvindar", "Steinars", "Grims", "Bjarnar", "Halldors", "Einars", "Toka", "Sveins"];

export interface Rank { n: string; rep: number; kills: number; share: number; acts: number; perk: string }
export const RANKS: Rank[] = [
  { n: "Oarsman", rep: 0, kills: 0, share: 1, acts: 3, perk: "" },
  { n: "Shield-wall veteran", rep: 10, kills: 3, share: 1.5, acts: 3, perk: "You can drill recruits in camp, and your loot share grows." },
  { n: "Hirðman", rep: 24, kills: 8, share: 2, acts: 3, perk: "You serve in the jarl’s own retinue. His gifts and your share grow." },
  { n: "Ship’s captain", rep: 48, kills: 16, share: 3, acts: 4, perk: "You command a ship. One more camp action and the largest share." },
];

/** [name, tier, price]. Weapon tier adds 2 damage and 2% to hit; armour tier cuts enemy hits by 5%. */
export type Gear = [string, number, number];
export const WEAPONS: Gear[] = [["rusty seax", 0, 0], ["ash spear", 1, 8], ["bearded axe", 2, 18], ["ring-sword", 3, 34], ["Frankish blade", 4, 48]];
export const ARMOUR: Gear[] = [["wool tunic", 0, 0], ["leather jerkin", 1, 10], ["mail byrnie", 2, 22], ["mail and iron helm", 3, 38]];
/** The Frankish blade is only for sale from this chapter on. */
export const FRANKISH_FROM = 8;

export const WOUNDS: Record<WoundId, { n: string; d: string; t: number }> = {
  arm: { n: "Broken arm", d: "strength −2", t: 2 },
  head: { n: "Head wound", d: "skill −2", t: 2 },
  ribs: { n: "Cracked ribs", d: "stamina −2", t: 2 },
  gash: { n: "Festering gash", d: "health −5", t: 3 },
};

export const GODS: Record<GodId, { n: string; d: string }> = {
  odin: { n: "Odin", d: "+3% to hit per favour" },
  thor: { n: "Thor", d: "+1 damage per favour" },
  freyr: { n: "Freyr", d: "+2 healing per favour each camp; at 2 favour wounds mend faster" },
};

export const PERKS: Record<PerkId, { n: string; d: string }> = {
  str: { n: "Strong arms", d: "+1 starting strength" },
  skl: { n: "Sharp eyes", d: "+1 starting skill" },
  end: { n: "Hard hide", d: "+1 starting endurance" },
  hoard: { n: "Father’s hoard", d: "+8 starting silver" },
};

export const COST: Record<Action, number> = { strike: 1, heavy: 2, berserk: 0, rally: 1, guard: 0, bash: 1, flee: 0 };
export const ATTACKS: Action[] = ["strike", "heavy", "berserk"];

/** Enemy moves: w is the base weight when drawing the next move. */
export const INTENTS: Record<IntentId, { w: number; t: string; d: string; hint: string; counter: Action }> = {
  overhead: { w: 3, t: "He raises his weapon high", d: "for an overhead blow.", hint: "Raise your shield: you block it and leave him open.", counter: "guard" },
  thrust: { w: 3, t: "He draws his spear back", d: "to thrust under your shield.", hint: "Strike first. A raised shield helps less against a low thrust.", counter: "strike" },
  hook: { w: 2, t: "He reaches for your shield rim", d: "to hook it down with his axe.", hint: "Bash him back. Raising your shield plays into his hands.", counter: "bash" },
  hold: { w: 2, t: "He crouches behind his shield", d: "and waits.", hint: "He won’t attack. A heavy blow can split his shield; a quick strike will glance off.", counter: "heavy" },
  shove: { w: 2, t: "He sets his shoulder to his shield", d: "to shove your line back.", hint: "Bash or brace behind your shield, or your wall gives ground.", counter: "bash" },
};
