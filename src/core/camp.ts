/* A new run, camp actions, the hunting minigame and moving on between chapters. */
import type { GodId, Stat } from "../types";
import { ARMOUR, CH, FRANKISH_FROM, GIFT, GODS, HIRE, RANKS, STATS, TRAINING, WEAPONS, WOUNDS } from "../content/tables";
import { cl, pct, R } from "./random";
import { age, eSkl, g, hurt, maxhp, mkCrew, randomName, say, st, withArticle } from "./state";
import { addWound, fix, wallCap } from "./life";
import { drawEvent } from "./events";

export function newGame(name?: string): void {
  const L = st.L;
  const n = (name || "").trim().slice(0, 40) || randomName();
  st.G = {
    name: n, ch: 0, str: 3 + L.up.str, skl: 3 + L.up.skl, end: 3 + L.up.end, hp: 0, mor: 60, rep: 0, silver: 6 + L.up.hoard * 8,
    wp: 0, ar: 0, kills: 0, rank: 0, nid: false, wounds: [], eye: false, gods: { odin: 0, thor: 0, freyr: 0 }, f: {}, used: [],
    log: [], crew: { L: [], R: [] }, phase: "camp", acts: 0, jarl: false, ev: null, mid: false, lastEv: null,
  };
  const G = st.G;
  G.hp = maxhp();
  for (const side of ["L", "L", "R", "R"] as const) G.crew[side].push(mkCrew());
  st.B = null;
  say(`${G.name}, eighteen winters old, takes an oar and swears to follow the jarl. Your saga begins.`);
  startCamp();
}

export function startCamp(): void {
  const G = g();
  G.phase = "camp"; G.acts = RANKS[G.rank].acts; G.jarl = false;
  const c = CH[G.ch];
  say(`${c.year}: ${c.title}`, "head");
  G.hp = Math.min(maxhp(), G.hp + 6 + G.gods.freyr * 2);
  const fav = G.gods.odin + G.gods.thor + G.gods.freyr;
  if (G.ch > 0 && fav === 0 && pct(50)) { G.mor -= 8; say("Ravens fly left over the camp. The gods have been neglected. Morale −8.", "bad"); }
  else if (fav >= 5) { G.mor += 5; say("An eagle circles the camp, a good omen. Morale +5.", "good"); }
  G.ev = drawEvent();
  G.mid = pct(55);
  fix();
}

/** Use up one camp action; a second event may turn up partway through the camp. */
function spend(): void {
  const G = g();
  G.acts--;
  if (G.mid && !G.ev && G.acts === RANKS[G.rank].acts - 2) { G.mid = false; G.ev = drawEvent(); }
  fix();
}

/** Chance that training raises a stat: it gets harder as the stat grows (see TRAINING). */
export const trainP = (s: Stat) => { const v = g()[s]; return TRAINING.chance.find((c) => v < c.below)?.pct ?? 0; };

export function smithItems() {
  const G = g();
  return [
    ...WEAPONS.map((w, i) => ({ t: "w" as const, i, w })).filter((o) => o.i > G.wp && (o.i < 4 || G.ch >= FRANKISH_FROM)),
    ...ARMOUR.map((w, i) => ({ t: "a" as const, i, w })).filter((o) => o.i > G.ar),
  ];
}

export type CampAction = "train" | "feast" | "rest" | "gift" | "hire" | "offer" | "drill" | "forage" | "buy";

/** The side of the wall a new man joins: the shorter one, or null if both are full. */
export function hireSide(): "L" | "R" | null {
  const G = g(), side = G.crew.L.length <= G.crew.R.length ? "L" : "R";
  return G.crew[side].length < wallCap() ? side : null;
}

/** Purchases made in passing: they cost silver but no camp action, so they never compete with training. */
export const QUICK: CampAction[] = ["gift", "hire"];

export function act(k: CampAction, x?: string): void {
  const G = g();
  if (G.phase !== "camp" || G.ev || (G.acts < 1 && !QUICK.includes(k))) return;
  switch (k) {
    case "train": {
      const s = x as Stat;
      if (G.mor < 30) { say("You are too downhearted to train. Raise your morale first."); return; }
      G.mor -= TRAINING.morale;
      if (pct(trainP(s))) { G[s]++; if (s === "end") G.hp += 2; say(`You drill until your arms shake. ${STATS[s].n} +1, morale −${TRAINING.morale}.`); }
      else say(`You drill hard but learn nothing new. ${STATS[s].n} is near its limit. Morale −${TRAINING.morale}.`);
      return spend();
    }
    case "feast":
      if (G.silver < 3) return;
      G.silver -= 3; G.mor += 20; say("Mead, roast boar and old songs. Morale +20, silver −3.");
      return spend();
    case "rest": {
      const wife = G.f.wife === 2, h = 10 + (wife ? 4 : 0);
      G.hp += h; G.mor += 3;
      const w = [...G.wounds].sort((a, z) => z.t - a.t)[0];
      let s = `You sleep by the fire${wife ? " while Eadgyth changes your bandages" : ""}. Health +${h}, morale +3.`;
      if (w) {
        w.t--;
        if (w.t <= 0) { G.wounds = G.wounds.filter((z) => z !== w); s += ` Your ${WOUNDS[w.id].n.toLowerCase()} has mended.`; }
        else s += ` Your ${WOUNDS[w.id].n.toLowerCase()} mends a little.`;
      }
      say(s);
      return spend();
    }
    case "gift":
      // G.jarl marks that the jarl has had a gift from you this camp.
      if (G.jarl || G.nid || G.silver < GIFT.price) return;
      G.jarl = true; G.silver -= GIFT.price; G.rep += GIFT.rep;
      say(`You bring the jarl a silver cup, and he drinks to your name before the hall. Reputation +${GIFT.rep}, silver −${GIFT.price}.`);
      return;
    case "hire": {
      const side = hireSide();
      if (G.rank < 1 || G.silver < HIRE.price || !side) return;
      G.silver -= HIRE.price;
      const c = mkCrew(undefined, HIRE.hp);
      G.crew[side].push(c);
      say(`${c.n}, a free Dane with his own shield, joins your part of the wall for a share of the loot. Silver −${HIRE.price}.`);
      return;
    }
    case "offer": {
      const god = x as GodId;
      if (G.silver < 2 || G.gods[god] >= 3) return;
      G.silver -= 2; G.gods[god]++; G.mor += 4;
      say(`You hang a goat in the grove for ${GODS[god].n}. Favour +1, morale +4, silver −2.`);
      return spend();
    }
    case "drill":
      if (G.rank < 1) return;
      G.rep += 2; G.mor -= 3; say("You drill the new men until they can hold a line. Reputation +2, morale −3.");
      return spend();
    case "forage":
      if (x === "raid") {
        if (pct(55)) { G.silver += 6; say("You raid a farmstead and drive off its pigs. Silver +6."); }
        else { hurt(5); G.rep -= 1; if (pct(25)) addWound(); say("The farmers fight back with pitchforks. Health −5, reputation −1."); }
        return spend();
      }
      if (x === "fish") {
        let s = "You fish the river in peace. Morale +4."; G.mor += 4;
        if (pct(30)) { G.silver += 3; s += " You find a lost purse in the reeds. Silver +3."; }
        say(s);
        return spend();
      }
      if (x === "hunt") return startHunt();
      return;
    case "buy": {
      const kind = x![0], i = Number(x!.slice(1));
      const item = (kind === "w" ? WEAPONS : ARMOUR)[i];
      if (!item || G.silver < item[2]) return;
      if (kind === "w" && i >= 4 && G.ch < FRANKISH_FROM) return;
      G.silver -= item[2];
      if (kind === "w") G.wp = i; else G.ar = i;
      say(`The smith sells you ${withArticle(item[0])}. Silver −${item[2]}.`);
      return spend();
    }
  }
}

/* ---------- hunting minigame ---------- */
export function huntZone(): [number, number] {
  const w = cl(10 + eSkl() * 2, 10, 30), a = R(100 - w);
  return [a, a + w];
}
export function startHunt(): void {
  const G = g();
  G.acts--; G.phase = "hunt";
  st.H = { arrows: 3, hits: 0, pos: 0, dir: 1, zone: huntZone(), msg: "A stag moves between the alders.", t: 0 };
}
/** Speed of the hunt marker in % of the track per second. */
export const huntSpeed = () => 62 * (1 + (3 - (st.H?.arrows ?? 3)) * 0.22);

export function loose(): void {
  const H = st.H;
  if (!H || H.arrows < 1) return;
  const hit = H.pos >= H.zone[0] && H.pos <= H.zone[1];
  H.arrows--; if (hit) H.hits++;
  H.msg = hit ? "Your arrow strikes home." : "The arrow flies wide.";
  H.zone = huntZone();
  if (H.arrows === 0) endHunt();
}
function endHunt(): void {
  const G = g(), h = st.H!.hits;
  st.H = null; G.phase = "camp";
  if (h === 0) {
    if (pct(30)) { hurt(3); say("You come back empty-handed, and a boar catches you on the way. Health −3."); }
    else { G.mor -= 2; say("You come back empty-handed. Morale −2."); }
  } else if (h === 1) { G.mor += 5; say("You bring down a hare and a grouse. Morale +5."); }
  else if (h === 2) { G.mor += 8; G.silver += 2; say("You bring down a stag and sell the hide. Morale +8, silver +2."); }
  else { G.mor += 12; G.silver += 4; G.rep += 1; say("Three arrows, three kills. The whole bench eats venison. Morale +12, silver +4, reputation +1.", "good"); }
  G.acts++;
  spend();
}

/* ---------- between chapters ---------- */
export function advance(): void {
  const G = g();
  const before = age();
  G.ch++;
  const fast = G.gods.freyr >= 2 ? 1 : 0;
  G.wounds.forEach((w) => (w.t -= 1 + fast));
  G.wounds.filter((w) => w.t <= 0).forEach((w) => say(`Your ${WOUNDS[w.id].n.toLowerCase()} has mended.`, "good"));
  G.wounds = G.wounds.filter((w) => w.t > 0);
  for (const k of Object.keys(G.gods) as GodId[]) G.gods[k] = Math.max(0, G.gods[k] - 1);
  const now = age();
  if (before < 45 && now >= 45) { G.end = Math.max(1, G.end - 1); G.hp = Math.min(G.hp, maxhp()); say(`You are ${now} now, and your knees ache on cold mornings. Endurance −1.`, "bad"); }
  if (before < 52 && now >= 52) { G.str = Math.max(1, G.str - 1); say(`At ${now} your sword arm is not what it was. Strength −1.`, "bad"); }
  startCamp();
}
