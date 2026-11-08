/* The shield-wall battle: enemy moves, timed swings, the push of the walls, mid-fight choices, loot. */
import type { Action, Foe, IntentId, Quality, Swing } from "../types";
import { ARMOUR, ATTACKS, CH, COST, ENEMIES, FEINTS, FOE_KINDS, INTENTS, JARL_GIFT, LOOT, RANKS, SWING } from "../content/tables";
import { cl, pct, pick, R, roll } from "./random";
import { b, ck, crewAll, eSkl, eStr, exposed, g, hurt, keepLegacy, maxSta, say, st, tier } from "./state";
import { addWound, fix, promote, refillCrew } from "./life";
import { advance } from "./camp";
import { die, isFinale } from "./endings";

export const readP = () => cl(45 + eSkl() * 6, 45, 95);

/** Chance (percent) to see through a feint. */
export const seeP = () => cl(FEINTS.seeBase + eSkl() * FEINTS.seePerSkill, FEINTS.seeBase, FEINTS.seeMax);
const kindOf = (f: Foe) => FOE_KINDS[f.kind ?? (f.champ ? "elite" : "levy")];

function pickMove(w: Partial<Record<IntentId, number>>, not?: IntentId): IntentId {
  const ks = (Object.keys(w) as IntentId[]).filter((k) => k !== not && (w[k] ?? 0) > 0);
  if (!ks.length) return not ?? "thrust";
  let r = Math.random() * ks.reduce((t, k) => t + w[k]!, 0);
  for (const k of ks) { r -= w[k]!; if (r < 0) return k; }
  return ks[ks.length - 1];
}

/** Choose his next move, whether you can read it, and whether he is feinting. */
function newIntent(): void {
  const B = b(), f = B.foes[B.i];
  if (!f) return;
  const kind = kindOf(f), w = { ...kind.moves };
  // A beaten man turtles up; a winning one presses.
  if (B.line >= 3 && w.hold) w.hold += 2;
  if (B.line <= -2 && w.shove) w.shove += 1;
  B.intent = pickMove(w);
  B.read = pct(readP());
  const feint = kind.feint + (f.champ ? FEINTS.champion : 0) + (g().ch >= FEINTS.lateFrom ? FEINTS.late : 0);
  B.feint = B.read && pct(feint * 100);
  B.shown = B.feint ? pickMove(kind.moves, B.intent) : B.intent;
  B.seen = B.feint && pct(seeP());
}

/**
 * What you can tell about his next move: nothing (id null), the move he shows, or his real move
 * when you saw through a feint. The screen and the balance bot both use only this.
 */
export function visibleIntent(): { id: IntentId | null; shown: IntentId | null; feintSeen: boolean } {
  const B = b();
  if (!B.read) return { id: null, shown: null, feintSeen: false };
  const shown = B.shown ?? B.intent;
  return B.feint && B.seen ? { id: B.intent, shown, feintSeen: true } : { id: shown, shown, feintSeen: false };
}

export function march(): void {
  const G = g();
  if (G.phase !== "camp" || G.ev) return;
  const c = CH[G.ch], t = tier(), late = Math.max(0, G.ch - 7), foes: Foe[] = [];
  for (let i = 0; i < c.foeCount; i++) {
    const champ = i === c.foeCount - 1 && G.ch > 0;
    const hp = 6 + Math.round(t * 2.5) + late + R(3) + (champ ? 4 : 0);
    foes.push({ n: champ ? c.foes[1] : c.foes[0], hp, mx: hp, atk: 2 + Math.floor(t / 2) + (champ ? 1 : 0), df: Math.floor(t / 2) + (champ ? 1 : 0), champ,
      kind: c.foeKinds[champ ? 1 : 0] });
  }
  st.B = { foes, i: 0, sta: maxSta(), kills: 0, lost: [], broken: false, round: 0, champKilled: false, line: 0, opened: false,
    intent: "thrust", read: true, shown: "thrust", feint: false, seen: false, prompt: null, prompts: 0, swing: null, flash: "" };
  newIntent();
  G.phase = "battle";
  say(`The shield-wall forms at ${c.place}. ${c.foeCount} enemies face you.`, "head");
}

/** How the enemy's move changes things: your hit chance, his hit chance, and whether he attacks at all. */
export function mods(a: Action, it: IntentId | null) {
  const o = { my: 0, foe: 0, noAttack: false };
  if (it === "hold") { o.noAttack = true; if (a === "strike" || a === "berserk") o.my -= 20; if (a === "heavy") o.my += 10; }
  if (it === "overhead" && a === "guard") o.noAttack = true;
  if (it === "thrust") { if (a === "strike") { o.my += 15; o.foe -= 15; } if (a === "guard") o.foe += 18; }
  if (it === "hook") { if (a === "guard") o.foe += 20; if (a === "bash") o.noAttack = true; }
  if (it === "shove") o.noAttack = true;
  if (it === "charge") { if (a === "guard") o.noAttack = true; else o.foe += 10; }
  return o;
}
/** Your chance to hit. With useIntent, it includes what you can read of his next move. */
export function hitP(a: Action, useIntent = false): number {
  const G = g(), B = b(), f = B.foes[B.i];
  let p = 45 + eSkl() * 4 - f.df * 4 + G.gods.odin * 3 + G.wp * 2 + (G.mor > 75 ? 5 : G.mor < 25 ? -10 : 0) + (B.opened ? 20 : 0);
  if (a === "heavy") p -= 12;
  if (a === "berserk") p += 10;
  if (a === "bash") p += 10;
  const seen = useIntent ? visibleIntent().id : null;
  if (seen) p += mods(a, seen).my;
  return cl(p, 10, 95);
}
export function dmgRange(a: Action): [number, number] {
  const G = g();
  let lo = 3 + Math.floor(eStr() / 2) + G.wp * 2 + G.gods.thor, hi = lo + 3;
  if (a === "heavy") { lo = Math.ceil(lo * 1.7); hi = Math.ceil(hi * 1.7); }
  if (a === "berserk") { lo *= 2; hi *= 2; }
  if (a === "bash") { lo = 1 + Math.floor(eStr() / 3); hi = lo + 2; }
  return [lo, hi];
}
/** His chance to hit you. */
export function foeP(a: Action, useIntent = false): number {
  const G = g(), B = b(), f = B.foes[B.i];
  let p = ENEMIES.hitBase + tier() * 2 + (f.champ ? 6 : 0) - ARMOUR[G.ar][1] * 5 + exposed() * 10 + (B.broken ? 10 : 0) + (G.mor < 25 ? 8 : 0);
  if (a === "guard") p -= 28;
  if (a === "rally") p += 12;
  if (a === "berserk") p += 8;
  const seen = useIntent ? visibleIntent().id : null;
  if (seen) p += mods(a, seen).foe;
  return cl(p, 5, 92);
}
export const withdrawP = () => (b().broken ? 90 : cl(40 + eSkl() * 3, 10, 80));
export const skimP = () => cl(40 + eSkl() * 5, 10, 85);

/** The player picks an action. Attacks become a timed swing when timing is on and someone is playing. */
export function turn(a: Action): void {
  const G = g(), B = st.B;
  if (G.phase !== "battle" || !B || B.prompt || B.swing) return;
  if (a === "berserk" && G.mor < 60) return;
  if (B.sta < COST[a]) { say("You are too winded for that. Raise your shield to get your breath back."); return; }
  if (ATTACKS.includes(a) && st.L.timing && st.interactive) { B.swing = newSwing(a); return; }
  resolve(a, null);
}

/* ---------- timed swings ---------- */
function newSwing(a: Action): Swing {
  const w = cl(22 + eSkl() * 2, 22, 42), s = 10 + R(80 - w);
  const pw = Math.max(6, Math.round(w * 0.3)), ps = s + Math.round((w - pw) / 2);
  return { a, pos: 0, dir: 1, t: 0, zone: [s, s + w], perf: [ps, ps + pw] };
}
/** Speed of the swing marker in % of the track per second. */
export const swingSpeed = (a: Action) => ({ strike: 95, heavy: 120, berserk: 140 } as Record<string, number>)[a] ?? 95;
export function release(): void {
  const B = st.B;
  if (!B || !B.swing) return;
  const s = B.swing, p = s.pos;
  B.swing = null;
  const q: Quality = p >= s.perf[0] && p <= s.perf[1] ? "perfect" : p >= s.zone[0] && p <= s.zone[1] ? "good" : "poor";
  resolve(s.a, q);
}

/* ---------- one round ---------- */
function killCrew(c: { n: string }, m: string[]): void {
  const G = g(), B = b();
  for (const side of ["L", "R"] as const) {
    const arr = G.crew[side], j = arr.findIndex((x) => x === c);
    if (j < 0) continue;
    arr.splice(j, 1); B.lost.push(c.n); G.mor -= 6; B.line--;
    m.push(arr.length ? `${c.n} falls, and the line closes up. Morale −6.` : `${c.n} falls, and your ${side === "L" ? "left" : "right"} side lies open. Morale −6.`);
  }
}
/** Returns true when that was the last foe. */
function foeFalls(f: Foe, m: string[]): boolean {
  const G = g(), B = b();
  G.kills++; B.kills++; B.line++;
  if (f.champ) B.champKilled = true;
  m.push(`The ${f.n} falls.`);
  B.i++;
  if (B.i < B.foes.length) m.push(`Another ${B.foes[B.i].n} steps over the body.`);
  return B.i >= B.foes.length;
}
function wallRound(a: Action, m: string[]): void {
  const G = g();
  for (const side of ["L", "R"] as const) {
    const arr = G.crew[side];
    for (let j = arr.length - 1; j >= 0; j--) {
      const c = arr[j];
      if (pct(12 + tier() * 2 + (j === 0 ? 6 : 0) - (a === "guard" ? 10 : 0))) { c.hp -= 1 + R(3); if (c.hp <= 0) killCrew(c, m); }
    }
  }
}
function checkLines(): boolean {
  const B = b();
  B.line = cl(B.line, -5, 5);
  if (B.line >= 5) { say("Their wall buckles and breaks. The enemy runs!", "good"); victory(true); return true; }
  if (!B.broken && (B.line <= -5 || !crewAll().length)) { B.broken = true; say("Your wall has broken. Withdrawing now carries no shame.", "bad"); }
  return false;
}

export function resolve(a: Action, q: Quality): void {
  const G = g(), B = b(), f = B.foes[B.i], it = B.intent, m: string[] = [], o = mods(a, it);
  B.round++; B.sta -= COST[a]; B.flash = "";
  // A feint you fell for: say what he really did, so you learn to watch for it.
  const fooled = B.read && B.feint && !B.seen;
  if (fooled) m.push(`It was a feint: ${INTENTS[it].reveal}.`);
  if (a === "flee") {
    if (pct(withdrawP())) return withdraw();
    m.push("You try to back out of the line, but the press of bodies holds you.");
  } else if (a === "guard") {
    B.sta = Math.min(maxSta(), B.sta + 3);
    if (it === "overhead") { B.opened = true; B.flash = "Blocked! He is open."; m.push("His overhead blow thuds into your raised shield and leaves him wide open."); }
    else if (it === "charge") { B.opened = true; B.line++; B.flash = "Braced! He is open."; m.push("His horse shies from your braced shields, and he is left open as it wheels."); }
    else if (it === "hook") m.push("He hooks your raised shield and drags it down.");
    else m.push("You lock shields with your neighbours and get your breath back.");
  } else if (a === "rally") {
    G.mor += 10;
    crewAll().forEach((c) => (c.hp = Math.min(c.mx, c.hp + 1)));
    m.push("Your war-cry steadies the wall. Morale +10.");
    if (pct(50)) { B.line++; m.push("The wall takes a step forward."); }
  } else {
    if (a === "berserk") G.mor -= 20;
    const p = hitP(a) + o.my + SWING[q ?? "good"].hit;
    B.opened = false;
    if (pct(cl(p, 5, 98))) {
      const [lo, hi] = dmgRange(a);
      let d = lo + R(hi - lo + 1);
      if (q === "perfect") { d = Math.ceil(d * SWING.perfect.dmg); B.flash = "A perfect blow!"; }
      f.hp -= d;
      const verb = ({ strike: "You hit", heavy: "Your heavy blow lands on", berserk: "In a red rage you hack at", bash: "Your shield boss smashes into" } as Record<string, string>)[a];
      m.push(`${verb} the ${f.n} for ${d}${q === "perfect" ? ", a perfect blow" : ""}.`);
      if (a === "heavy" && it === "hold" && f.df > 0) { f.df--; m.push("His shield splits."); }
      if (a === "bash" && (it === "hook" || it === "shove")) { B.line++; m.push(it === "hook" ? "You drive him back before he can hook your shield." : "You meet his shove and drive him back."); }
      else if (a === "bash" && pct(30)) { B.line++; m.push("He stumbles back a step."); }
    } else {
      m.push(q === "poor" ? "Your swing is badly timed and goes wide." : "Your blow is turned aside.");
      if (q === "poor") B.flash = "Badly timed.";
      if (a === "bash" && it === "hook") m.push("He catches your shield rim anyway.");
    }
  }
  if (it === "shove" && a !== "bash" && a !== "flee") {
    if (a === "guard") m.push("You brace behind your shield and hold your ground against his shove.");
    else { B.line--; B.sta = Math.max(0, B.sta - 1); m.push("His shove sends you staggering. Your wall gives ground."); }
  }
  if (it === "hold" && (a === "strike" || a === "heavy" || a === "berserk")) m.push("He stays crouched behind his shield.");
  if (f.hp > 0 && crewAll().length && pct(20)) { const c = pick(crewAll()), d = 2 + Math.floor(tier() / 2); f.hp -= d; m.push(`${c.n}’s spear finds a gap for ${d}.`); }
  let killed = false;
  if (f.hp <= 0) {
    killed = true;
    if (foeFalls(f, m)) { say(m.join(" ")); return victory(false); }
  }
  if (!killed && !o.noAttack) {
    if (pct(cl(foeP(a) + o.foe, 5, 95))) {
      const d = Math.max(1, f.atk + (it === "overhead" ? 2 : it === "charge" ? 4 : 0) + R(3) - Math.floor(ARMOUR[G.ar][1] / 2) + (a === "berserk" ? 2 : 0) - (a === "guard" ? 1 : 0));
      G.hp -= d;
      m.push(`The ${f.n} wounds you for ${d}.`);
      if (it === "charge") { B.line--; m.push("The wall bends under his charge."); }
      if (G.hp > 0 && ((d >= 5 && pct(30)) || pct(4))) addWound();
    } else m.push("You turn his blow.");
  }
  if (fooled && !B.flash) B.flash = "A feint!";
  wallRound(a, m);
  say(m.join(" "));
  if (fix() || checkLines()) return;
  newIntent();
  if (!B.prompt && B.prompts < 2 && pct(13)) startPrompt();
}

/* ---------- mid-battle choices ---------- */
interface PromptOption { l: string; p?: () => number; f: () => string }
interface Prompt { ok?: () => boolean; t: () => string; o: PromptOption[] }
const foeHit = () => Math.max(1, b().foes[b().i].atk + R(3) - Math.floor(ARMOUR[g().ar][1] / 2));
export const PROMPTS: Record<string, Prompt> = {
  cover: {
    ok: () => crewAll().length > 0,
    t: () => `${b().pn} is down on one knee beside you, his shield arm hanging.`,
    o: [
      { l: "Step across and cover him", f: () => {
        const c = crewAll().find((x) => x.n === b().pn);
        if (c) c.hp = Math.min(c.mx, c.hp + 4);
        g().rep++;
        if (pct(foeP("strike") + 10)) { const d = foeHit(); hurt(d); return `You take the blow meant for him. Health −${d}. ${b().pn} gets back on his feet. Reputation +1.`; }
        return `You cover him and nothing gets through. ${b().pn} gets back up. Reputation +1.`;
      } },
      { l: "Keep your own guard", f: () => {
        const c = crewAll().find((x) => x.n === b().pn), m: string[] = [];
        if (c) { c.hp -= 4; if (c.hp <= 0) killCrew(c, m); }
        return m.length ? m.join(" ") : `${b().pn} takes a hard blow but stays up.`;
      } },
    ],
  },
  gap: {
    t: () => "A gap opens in their line where a man has fallen.",
    o: [
      { l: "Push into it (strength)", p: () => ck(eStr(), 1), f: () => roll(ck(eStr(), 1),
        () => { b().line += 2; b().foes[b().i].hp -= 4; return "You shoulder into the gap and their line bends back. 4 damage to your foe."; },
        () => { hurt(4); b().line--; return "The gap closes on you. Health −4, and your wall gives ground."; }) },
      { l: "Hold your place", f: () => "You stay in the wall." },
    ],
  },
  spear: {
    t: () => "A thrown spear wobbles through the air toward your face.",
    o: [
      { l: "Catch it and throw it back (skill)", p: () => ck(eSkl(), 2), f: () => roll(ck(eSkl(), 2),
        () => { b().foes[b().i].hp -= 6; g().rep += 2; return "You snatch it out of the air and send it back. 6 damage to your foe. Reputation +2."; },
        () => { hurt(5); return "It catches your shoulder. Health −5."; }) },
      { l: "Duck behind your shield", f: () => { b().sta = Math.max(0, b().sta - 1); return "It thuds into your shield. Stamina −1."; } },
    ],
  },
  banner: {
    ok: () => g().ch > 0,
    t: () => "The enemy’s banner-bearer is only a few paces away.",
    o: [
      { l: "Go for the banner (strength)", p: () => ck(eStr(), 2), f: () => roll(ck(eStr(), 2),
        () => { b().line += 3; g().rep += 4; return "You tear down their banner, and their line wavers. Reputation +4."; },
        () => { hurt(6); if (pct(35)) addWound(); return "His guards cut you back into the wall. Health −6."; }) },
      { l: "Stay in the wall", f: () => "You let it go." },
    ],
  },
  mud: {
    t: () => "The ground under your feet is churned to mud and blood.",
    o: [
      { l: "Plant your feet", f: () => { b().sta = Math.max(0, b().sta - 1); return "You steady yourself. Stamina −1."; } },
      { l: "Press on regardless", f: () => roll(40,
        () => { const d = Math.max(1, b().foes[b().i].atk + R(3)); hurt(d); return `You slip, and he is on you. Health −${d}.`; },
        () => { b().line++; return "You keep your footing and gain a step."; }) },
    ],
  },
};
function startPrompt(): void {
  const B = b();
  const ks = Object.keys(PROMPTS).filter((k) => !PROMPTS[k].ok || PROMPTS[k].ok!());
  if (!ks.length) return;
  const k = pick(ks);
  B.prompt = k; B.prompts++;
  if (k === "cover") B.pn = pick(crewAll()).n;
}
export function answer(i: number): void {
  const B = st.B;
  if (!B || !B.prompt) return;
  const o = PROMPTS[B.prompt].o[i];
  if (!o) return;
  B.prompt = null;
  const m = [o.f()].filter(Boolean);
  const f = B.foes[B.i];
  if (g().hp > 0 && f && f.hp <= 0 && foeFalls(f, m)) { say(m.join(" ")); return victory(false); }
  say(m.join(" "));
  if (fix() || checkLines()) return;
  if (f && f.hp <= 0) newIntent();
}

/* ---------- after the fight ---------- */
function victory(rout: boolean): void {
  const G = g(), B = b(), L = st.L;
  const champ = B.champKilled, held = B.lost.length === 0;
  L.fought++; keepLegacy();
  const rep = 2 + tier() + (held ? 2 : 0) + (rout ? 3 : 0);
  G.rep += rep; G.mor += 10;
  let msg = rout ? `You broke their line. Reputation +${rep}, morale +10.` : `Your last foe falls. Reputation +${rep}${held ? " (the wall held without loss)" : ""}, morale +10.`;
  if (G.f.oath) {
    if (champ) { G.rep += 6; msg += " You kept your Yule oath. Reputation +6."; }
    else { G.rep -= 4; msg += " Your Yule oath is unfulfilled. Reputation −4."; }
    delete G.f.oath;
  }
  if (G.nid && !B.broken) { G.nid = false; msg += " You held your place in the wall, and men stop calling you níðingr."; }
  say(msg, "good");
  if (B.lost.length) say(`You lost ${B.lost.join(", ")} from your part of the wall.`, "bad");
  st.B = null;
  promote(); refillCrew();
  if (isFinale(G.ch)) {
    const edington = G.ch === 7;
    say(edington ? "Around you the Danish line gives way. Alfred holds the field at Edington." : "Edward’s men pull back south. The summer’s fighting is over.", edington ? "bad" : "good");
    G.phase = "finale";
    return;
  }
  G.loot = Math.round((LOOT.base + tier() * LOOT.perTier) * RANKS[G.rank].share) + (champ ? LOOT.champion : 0) + (rout ? LOOT.rout : 0);
  // The jarl rewards what you did yourself; he gives nothing to a níðingr.
  G.gift = G.nid ? 0 : B.kills * JARL_GIFT.perKill + (champ ? JARL_GIFT.champion : 0) + (held ? JARL_GIFT.wallHeld : 0) + G.rank * JARL_GIFT.perRank;
  G.phase = "aftermath";
}

function withdraw(): void {
  const G = g(), B = b();
  if (B.broken) { G.mor -= 8; say("With the wall gone you fall back with the others. No one calls it shame. Morale −8."); }
  else if (G.nid) { st.B = null; die("outlaw"); return; }
  else { G.nid = true; G.rep -= 6; G.mor -= 15; say("You leave your place in the wall. Men will call you níðingr until you stand fast again. Reputation −6, morale −15.", "bad"); }
  if (G.f.oath) { G.rep -= 4; delete G.f.oath; say("Your Yule oath is broken. Reputation −4.", "bad"); }
  st.B = null;
  refillCrew();
  if (isFinale(G.ch)) { G.phase = "finale"; return; }
  advance();
}

export function loot(k: "take" | "skim"): void {
  const G = g();
  if (G.phase !== "aftermath") return;
  const share = G.loot ?? 0, gift = G.gift ?? 0;
  const rings = gift ? ` and the jarl’s arm-rings worth ${gift}` : "";
  if (k === "take") { G.silver += share + gift; say(`You take your share of ${share} silver${rings}. Silver +${share + gift}.`); }
  else if (pct(skimP())) { G.silver += share * 2 + gift; say(`You slip extra hacksilver into your boot${rings ? `, and take the jarl’s arm-rings worth ${gift}` : ""}. Silver +${share * 2 + gift}.`); }
  else { G.rep -= 8; hurt(3); say("You are caught with your hand in the hoard and flogged before the crew. The jarl takes back his gift. Reputation −8, health −3.", "bad"); }
  G.loot = 0; G.gift = 0;
  if (fix()) return;
  advance();
}
