/* Tuning tables: ranks, gear, wounds, gods, legacy perks, enemy moves. */
import type { Action, BoonId, Chapter, FoeKind, GameEvent, GodId, IntentId, Stat, WoundId } from "../types";
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

/**
 * Ranks, with the reputation and kills needed for each. Spread so promotions keep coming
 * through the whole campaign: run `npm run balance` to see when players typically reach each.
 */
export interface Rank { n: string; rep: number; kills: number; share: number; acts: number; perk: string }
export const RANKS: Rank[] = [
  { n: "Oarsman", rep: 0, kills: 0, share: 1, acts: 3, perk: "" },
  { n: "Shield-wall veteran", rep: 12, kills: 4, share: 1.25, acts: 3, perk: "You can drill recruits and hire spearmen in camp, and your loot share grows." },
  { n: "Hirðman", rep: 40, kills: 14, share: 1.5, acts: 3, perk: "You serve in the jarl’s own retinue. His gifts and your share grow." },
  { n: "Ship’s captain", rep: 80, kills: 22, share: 2, acts: 4, perk: "You command a ship. One more camp action and a larger share." },
  { n: "Hersir", rep: 140, kills: 32, share: 2.5, acts: 4, perk: "You lead your own war-band. Three of your men stand on each side of you in the wall." },
];
/** Rank from which the raider leads a war-band: a third man on each side of the wall. */
export const WARBAND_RANK = 4;

/**
 * What each stat does, as shown to the player. The numbers themselves live in the rules:
 * dmgRange and hitP in core/combat.ts, maxhp in core/state.ts. Change these lines if you change those.
 */
export const STATS: Record<Stat, { n: string; d: string }> = {
  str: { n: "Strength", d: "+1 damage for every 2 points" },
  skl: { n: "Skill", d: "+4% to hit; you read moves and feints more often" },
  end: { n: "Endurance", d: "+2 health" },
};

/** Training: the morale it costs, and the chance it works while the stat is below each level. */
export const TRAINING = {
  morale: 8,
  chance: [{ below: 6, pct: 100 }, { below: 8, pct: 60 }, { below: 10, pct: 30 }],
};

/**
 * Enemies, and the rewards for beating them, grow with each chapter up to tierCap.
 * hitBase is an enemy's basic chance to hit you, before armour, tier and the other changes.
 * From chapter lateFrom on (counting from 0) every enemy has lateHp more health with each
 * chapter: by then a raider has silver to spend on his men, and needs to.
 */
export const ENEMIES = { tierCap: 13, hitBase: 47, lateFrom: 10, lateHp: 1 };

/** Timed swings: change to hit chance and damage for each result. Timing turned off counts as "good". */
export const SWING = {
  perfect: { hit: 10, dmg: 1.15 },
  good: { hit: 0, dmg: 1 },
  poor: { hit: -12, dmg: 1 },
};

/** Silver after a won battle: a share of the hoard by rank, plus the jarl's gift for your own part. */
export const LOOT = { base: 4, perTier: 2, champion: 3, rout: 2 };
export const JARL_GIFT = { perKill: 1, champion: 3, wallHeld: 2, perRank: 1 };

/** Ways to spend silver in camp. */
export const GIFT = { price: 10, rep: 3 };
export const HIRE = { price: 12, hp: 12, maxPerSide: 3 };

/** A healer in camp: silver for health, without using a camp action. Once each camp. */
export const HEALER = { price: 12, hp: 10 };
/**
 * Kit a captain buys from the smith for the men beside him: [what they carry, price]. Each step
 * adds CREW_KIT.hp to the health of every man in his part of the wall, now and later.
 */
export const CREW_KITS: [string, number][] = [["whatever they came with", 0], ["limewood shields and good spears", 25], ["mail shirts", 45], ["iron helms with their mail", 70]];
export const CREW_KIT = { rank: 3, hp: 1 };
/** Arm-rings a hersir gives his men before a battle: they strike that much more often in it (percent), and he gains reputation. */
export const RINGS = { rank: 4, price: 25, rep: 2, strike: 20 };
/** How often one of your neighbours lands a blow of his own each round (percent). */
export const CREW_STRIKE = 20;

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

/**
 * Legacy gifts. Each is bought once with legacy points and is then there for every raider after,
 * but one raider carries only a few of them (BOON_SLOTS). So buying more gifts brings more
 * choice, not ever more strength: `npm run balance` checks how strong the best of them are together.
 */
export const BOON_EFFECT = { hoard: 16, herbs: 3, lungs: 2, read: 4, morale: 30 };
export const BOONS: Record<BoonId, { n: string; d: string }> = {
  str: { n: "Strong arms", d: "+1 strength" },
  skl: { n: "Sharp eyes", d: "+1 skill" },
  end: { n: "Hard hide", d: "+1 endurance" },
  hoard: { n: "Father’s hoard", d: `+${BOON_EFFECT.hoard} silver to start with` },
  spear: { n: "Father’s spear", d: "start with an ash spear" },
  jerkin: { n: "A mother’s stitching", d: "start with a leather jerkin" },
  herbs: { n: "Healer’s herbs", d: `+${BOON_EFFECT.herbs} healing in every camp` },
  lungs: { n: "Rower’s lungs", d: `+${BOON_EFFECT.lungs} stamina` },
  wolf: { n: "A wolf’s patience", d: `you read your enemy’s next move ${BOON_EFFECT.read}% more often` },
  heart: { n: "A glad heart", d: `your morale never falls below ${BOON_EFFECT.morale}` },
};
/** The price of the next gift, by how many are owned already: each costs more than the last. */
export const BOON_PRICES = [15, 25, 40, 55, 70, 90, 110, 130, 150, 170];
/** How many gifts one raider carries, and the price of a place for one more. */
export const BOON_SLOTS = { base: 2, most: 3, price: 200 };

export const COST: Record<Action, number> = { strike: 1, heavy: 2, berserk: 0, rally: 1, guard: 0, bash: 1, flee: 0 };
export const ATTACKS: Action[] = ["strike", "heavy", "berserk"];

/**
 * Enemy moves. t and d describe the tell you see; as names it when he only pretends to it;
 * reveal says what he really did when he fooled you with a feint.
 */
export const INTENTS: Record<IntentId, { t: string; d: string; hint: string; counter: Action; as: string; reveal: string }> = {
  overhead: { t: "He raises his weapon high", d: "for an overhead blow.", hint: "Raise your shield: you block it and leave him open.", counter: "guard", as: "an overhead blow", reveal: "his blow comes down from high" },
  thrust: { t: "He draws his spear back", d: "to thrust under your shield.", hint: "Strike first. A raised shield helps less against a low thrust.", counter: "strike", as: "a thrust", reveal: "he thrusts low, under your shield" },
  hook: { t: "He reaches for your shield rim", d: "to hook it down with his axe.", hint: "Bash him back. Raising your shield plays into his hands.", counter: "bash", as: "a hook at your shield", reveal: "he hooks your shield rim" },
  hold: { t: "He crouches behind his shield", d: "and waits.", hint: "He won’t attack. A heavy blow can split his shield; a quick strike will glance off.", counter: "heavy", as: "waiting behind his shield", reveal: "he stays crouched behind his shield" },
  shove: { t: "He sets his shoulder to his shield", d: "to shove your line back.", hint: "Bash or brace behind your shield, or your wall gives ground.", counter: "bash", as: "a shove", reveal: "he shoves into your shield" },
  charge: { t: "He spurs his horse at the wall", d: "to ride you down.", hint: "Raise your shield and brace: a horse will not ride into a solid wall of shields.", counter: "guard", as: "a charge", reveal: "he spurs his horse at you" },
};

/**
 * Kinds of enemy. Each chapter in chapters.json names the kind of its ordinary enemies and of its
 * champion (foeKinds). moves sets how often each move comes; feint is the chance he shows a false one.
 */
export const FOE_KINDS: Record<FoeKind, { note: string; moves: Partial<Record<IntentId, number>>; feint: number }> = {
  levy: { note: "A farmer with a shield: he shoves and holds more than he strikes.", moves: { shove: 4, hold: 3, overhead: 2, thrust: 2, hook: 1 }, feint: 0 },
  spear: { note: "A spearman: expect thrusts under your shield.", moves: { thrust: 6, hold: 2, shove: 2, overhead: 1, hook: 1 }, feint: 0 },
  axe: { note: "An axeman: watch for blows from high and hooks at your shield.", moves: { hook: 5, overhead: 4, shove: 2, hold: 1 }, feint: 0 },
  rider: { note: "A horseman: he may charge the wall.", moves: { charge: 4, thrust: 3, overhead: 2 }, feint: 0 },
  elite: { note: "A seasoned warrior: he may feint.", moves: { overhead: 4, hook: 3, thrust: 2, hold: 2, shove: 1 }, feint: 0.2 },
};

/**
 * Feints: extra chance for champions, and for everyone in the long wars after Edington.
 * Your chance to see through one is seeBase + seePerSkill × skill, up to seeMax (percent).
 */
export const FEINTS = { champion: 0.1, lateFrom: 8, late: 0.1, seeBase: 15, seePerSkill: 6, seeMax: 75 };
