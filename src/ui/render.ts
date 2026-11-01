/* All screens. render() rebuilds the page from state after every action. */
import type { Action, EndingId, Stat } from "../types";
import { ARMOUR, CH, EDINGTON, EVENT_BY_ID, GODS, INTENTS, PERKS, RANKS, WEAPONS, WOUNDS } from "../content/tables";
import { KEYS, store } from "../save/storage";
import type { Game } from "../types";
import { age, b, cap, eSkl, eStr, exposed, g, maxhp, maxSta, saveRun, st } from "../core/state";
import { cl } from "../core/random";
import { eventText, optionEnabled, optionOdds } from "../core/events";
import { smithItems, trainP } from "../core/camp";
import { dmgRange, foeP, hitP, mods, PROMPTS, skimP, withdrawP } from "../core/combat";
import { CHOSEN_ENDINGS, ENDINGS, fordBonus } from "../core/endings";
import { bar, btn, esc, shieldEl } from "./html";
import { sceneSVG } from "./scenes";
import { ui } from "./ui-state";
import { syncMotion } from "./motion";

const withArticle = (w: string) => (/^[aeiou]/i.test(w) ? "an " : "a ") + w;

const tip = (k: string, html: string) =>
  st.L.seen[k] ? "" : `<aside class="tip" aria-label="Tip"><p>${html}</p><div>${btn("Got it", "dismiss", [k])}</div></aside>`;

function chapterHead(): string {
  const G = g(), c = CH[G.ch];
  return `${sceneSVG(G.ch)}<header class="chap"><span class="year">${c.year}, chapter ${G.ch + 1} of ${CH.length}</span><h2>${c.title}</h2><p>${c.text}</p></header>`;
}

function sheet(): string {
  const G = g(), B = st.B;
  const stat = (lab: string, base: number, eff: number) => `<div class="stat"><span>${lab}</span><b>${eff}${eff !== base ? ` <small class="bad">of ${base}</small>` : ""}</b></div>`;
  const next = RANKS[G.rank + 1];
  const chips: string[] = [];
  G.wounds.forEach((w) => chips.push(`<span class="chip bad">${WOUNDS[w.id].n}, ${WOUNDS[w.id].d}, ${w.t} chapter${w.t === 1 ? "" : "s"}</span>`));
  if (G.eye) chips.push(`<span class="chip bad">Lost eye, skill −1</span>`);
  if (G.nid) chips.push(`<span class="chip bad">Níðingr: no promotion, the jarl shuns you</span>`);
  if (G.f.wife === 2) chips.push(`<span class="chip good">Married to Eadgyth</span>`);
  if (G.f.son) chips.push(`<span class="chip good">A son</span>`);
  if (G.f.oath) chips.push(`<span class="chip">Yule oath: kill the next champion</span>`);
  if (G.f.ford) chips.push(`<span class="chip good">Wulfstan’s ford</span>`);
  const pips = (v: number) => `<span class="pips" aria-label="${v} of 3">${[0, 1, 2].map((i) => `<span class="pip${i < v ? " on" : ""}"></span>`).join("")}</span>`;
  return `<section class="panel" aria-label="Your raider">
    <div class="who"><h2>${esc(G.name)}</h2><span class="rank">${RANKS[G.rank].n}, ${age()} winters</span></div>
    ${bar("Health", G.hp, maxhp(), "hp")}${B ? bar("Stamina", B.sta, maxSta(), "sta") : ""}${bar("Morale", G.mor, 100, "mo")}
    <div class="stats">${stat("Strength", G.str, eStr())}${stat("Skill", G.skl, eSkl())}${stat("Endurance", G.end, G.end)}
      <div class="stat"><span>Reputation</span><b>${G.rep}</b></div><div class="stat"><span>Silver</span><b>${G.silver}</b></div><div class="stat"><span>Foes slain</span><b>${G.kills}</b></div></div>
    <p class="gear">You carry a ${WEAPONS[G.wp][0]} and wear a ${ARMOUR[G.ar][0]}.</p>
    ${next ? `<p class="nextrank">Next rank, ${next.n.toLowerCase()}: reputation ${G.rep} of ${next.rep}, foes slain ${G.kills} of ${next.kills}${G.nid ? ", blocked while you are níðingr" : ""}.</p>` : `<p class="nextrank">You hold the highest rank.</p>`}
    ${chips.length ? `<div class="chips">${chips.join("")}</div>` : ""}
    <div class="gods"><h3>Favour of the gods</h3>${(Object.keys(GODS) as (keyof typeof GODS)[]).map((k) => `<div class="god"><span>${GODS[k].n}</span>${pips(G.gods[k])}</div>`).join("")}</div>
  </section>`;
}

const COAST = "M96,6 L121,9 L129,31 L141,55 L151,79 L163,96 L158,110 L166,123 L172,139 L168,151 L184,157 L195,170 L193,189 L188,198 L196,206 L183,215 L151,222 L121,224 L96,229 L74,233 L50,236 L22,236 L33,226 L54,216 L70,206 L59,200 L41,198 L25,193 L30,180 L45,170 L42,151 L54,141 L70,139 L72,120 L65,100 L60,76 L75,60 L70,40 L80,20 Z";
const CONTINENT = "M300,168 L272,178 L252,186 L236,198 L222,210 L210,224 L206,236 L196,246 L184,256 L170,262 L156,268 L140,268 L128,262 L116,270 L96,276 L78,280 L62,284 L60,330 L300,330 Z";
function mapView(): string {
  const G = g(), upto = Math.min(G.ch, CH.length - 1), wide = upto > EDINGTON;
  const route = CH.slice(0, upto + 1).map((c) => `${c.map.x},${c.map.y}`).join(" ");
  const pts = CH.slice(0, wide ? CH.length : EDINGTON + 1).map((c, i) => {
    const cls = i < upto ? "done" : i === upto ? "now" : "";
    // York appears twice; label it once.
    const label = i <= upto && !(i === 1 && upto >= 15) ? `<text x="${c.map.x + c.map.lx}" y="${c.map.y + c.map.ly}" text-anchor="${c.map.anchor}">${c.place}</text>` : "";
    const ring = i === upto && G.phase !== "over" ? `<circle class="ring" cx="${c.map.x}" cy="${c.map.y}" r="3.5"/>` : "";
    return `${ring}<circle class="pt ${cls}" cx="${c.map.x}" cy="${c.map.y}" r="3.2"><title>${c.year}, ${c.place}</title></circle>${label}`;
  }).join("");
  return `<section class="panel map" aria-label="Map of the campaign"><h3>The army’s road, ${CH[0].year} to ${CH[upto].year}</h3>
    <svg viewBox="${wide ? "0 0 300 330" : "0 0 210 244"}" role="img" aria-label="Sketch map of the army's route from ${CH[0].place} to ${CH[upto].place}">
    <path class="land" d="${COAST}"/>${wide ? `<path class="land" d="${CONTINENT}"/><text class="sea" x="250" y="318" text-anchor="middle">Francia</text>` : ""}<text class="sea" x="186" y="120" text-anchor="middle">North Sea</text>
    <polyline class="route" points="${route}"/>${pts}</svg></section>`;
}
const logView = () =>
  `<section class="panel" aria-label="Saga log"><h3>The saga so far</h3><ol class="log">${g().log.slice(0, 40).map((l) => `<li class="${l.c}">${l.t}</li>`).join("")}</ol></section>`;

/* ---------- camp ---------- */
function campView(): string {
  const G = g();
  let h = chapterHead();
  h += tip("camp", "<b>Camp.</b> You get a few actions before each battle. Training raises a stat but costs morale, and below 30 morale you cannot train and you fight worse. Offerings to the gods fade by one favour each chapter. Wounds mend over chapters, and resting speeds them up.");
  if (G.ev) {
    const e = EVENT_BY_ID[G.ev];
    h += `<section class="event" aria-label="Event"><p>${eventText(e)}</p><div class="actions">${e.options.map((o, i) => btn(o.label, "choose", [i], { odds: optionOdds(o), dis: !optionEnabled(o) })).join("")}</div></section>`;
  } else {
    const none = G.acts < 1;
    h += `<p class="acts-left">${none ? "No camp actions left. Time to march." : `${G.acts} camp action${G.acts === 1 ? "" : "s"} left`}</p>`;
    if (ui.sub === "train") {
      const s = (k: Stat, n: string) => btn(`${n} ${G[k]} to ${G[k] + 1}`, "act", ["train", k], { odds: trainP(k), dis: G.mor < 30 || trainP(k) === 0, note: "morale −8" });
      h += `<div class="actions">${s("str", "Strength")}${s("skl", "Skill")}${s("end", "Endurance")}${btn("Back", "sub", [null])}</div>`;
      if (G.mor < 30) h += `<p class="bad">Your morale is below 30. Feast, rest or fish before you train.</p>`;
    } else if (ui.sub === "forage") {
      h += `<div class="actions">${btn("Hunt in the woods", "act", ["forage", "hunt"], { note: "a test of your aim" })}${btn("Raid a farmstead", "act", ["forage", "raid"], { odds: 55, note: "silver, or a beating" })}${btn("Fish the river", "act", ["forage", "fish"], { note: "safe, small morale gain" })}${btn("Back", "sub", [null])}</div>`;
    } else if (ui.sub === "smith") {
      const items = smithItems().map((o) => btn(`${o.w[0]}, ${o.w[2]} silver`, "act", ["buy", `${o.t}${o.i}`], { dis: G.silver < o.w[2], note: o.t === "w" ? `+${o.w[1] * 2} damage, +${o.w[1] * 2}% to hit` : `enemies hit you ${o.w[1] * 5}% less` })).join("");
      h += `<p class="muted">You have ${G.silver} silver.</p><div class="actions">${items || "<p>The smith has nothing better to sell you.</p>"}${btn("Back", "sub", [null])}</div>`;
    } else if (ui.sub === "gods") {
      h += `<div class="actions">${(Object.keys(GODS) as (keyof typeof GODS)[]).map((k) => btn(`Offer to ${GODS[k].n}`, "act", ["offer", k], { dis: G.silver < 2 || G.gods[k] >= 3, note: `2 silver. ${GODS[k].d}` })).join("")}${btn("Back", "sub", [null])}</div>`;
    } else {
      h += `<div class="actions">
        ${btn("Train", "sub", ["train"], { dis: none, note: "raise a stat" })}
        ${btn("Feast", "act", ["feast"], { dis: none || G.silver < 3, note: "3 silver, morale +20" })}
        ${btn("Rest", "act", ["rest"], { dis: none, note: `health +${10 + (G.f.wife === 2 ? 4 : 0)}, wounds mend` })}
        ${btn("Forage", "sub", ["forage"], { dis: none, note: "hunt, raid or fish" })}
        ${btn("Visit the smith", "sub", ["smith"], { dis: none, note: "weapons and armour" })}
        ${btn("Make an offering", "sub", ["gods"], { dis: none, note: "gain a god’s favour" })}
        ${btn("Seek the jarl", "act", ["jarl"], { dis: none || G.jarl, note: G.jarl ? "already seen this camp" : "once per camp" })}
        ${G.rank >= 1 ? btn("Drill the recruits", "act", ["drill"], { dis: none, note: "reputation +2, morale −3" }) : ""}
      </div>`;
    }
  }
  h += `<div class="march">${btn(`March to battle at ${CH[G.ch].place}`, "march", [], { cls: "go", dis: !!G.ev, note: G.ev ? "deal with the matter at hand first" : G.acts > 0 ? `${G.acts} camp action${G.acts === 1 ? "" : "s"} will go unused` : "" })}</div>`;
  return h;
}

/* ---------- battle ---------- */
function wallView(): string {
  const G = g(), B = b();
  const left = [], right = [];
  for (let k = Math.max(2, G.crew.L.length) - 1; k >= 0; k--) left.push(G.crew.L[k] || null);
  for (let k = 0; k < Math.max(2, G.crew.R.length); k++) right.push(G.crew.R[k] || null);
  const slot = (s: { n: string; hp: number; mx: number } | null) => s
    ? `<div class="slot" role="listitem">${shieldEl(s.n)}<span class="sname">${esc(s.n)}</span><div class="mini" aria-label="${s.hp} of ${s.mx} health"><div style="width:${cl((s.hp / s.mx) * 100, 0, 100)}%"></div></div></div>`
    : `<div class="slot" role="listitem"><div class="shield gap" aria-hidden="true"></div><span class="sname muted">Gap</span></div>`;
  const you = `<div class="slot you" role="listitem">${shieldEl(G.name)}<span class="sname">You</span><div class="mini" aria-label="${G.hp} of ${maxhp()} health"><div style="width:${cl((G.hp / maxhp()) * 100, 0, 100)}%"></div></div></div>`;
  const ex = exposed();
  const note = B.broken ? '<span class="bad">Your wall has broken. Enemies hit you far more often.</span>'
    : ex ? `<span class="bad">${ex === 2 ? "Both your sides are" : "One side is"} open: enemies hit you ${ex * 10}% more often.</span>`
    : "Your neighbours cover your sides. If they fall, you are exposed.";
  return `<section aria-label="Your shield-wall"><div class="wall-wrap"><div class="wall" role="list">${left.map(slot).join("")}${you}${right.map(slot).join("")}</div></div>
    <p class="muted" style="text-align:center;font-size:.9rem">${note}</p></section>`;
}
function pushView(): string {
  const B = b(), cells = [];
  for (let k = -5; k <= 5; k++) cells.push(`<span class="${k === B.line ? "mid" : k < 0 && k >= B.line ? "theirs" : k > 0 && k <= B.line ? "ours" : ""}"></span>`);
  const word = B.line >= 3 ? "Their wall is bending" : B.line > 0 ? "Your wall is pushing forward" : B.line === 0 ? "The walls are locked" : B.line > -3 ? "Your wall is giving ground" : "Your wall is close to breaking";
  return `<div class="push" role="img" aria-label="Push of the shield-walls: ${B.line} on a scale from minus 5 to plus 5. ${word}."><div class="push-lab"><span>Your wall breaks</span><b>${word}</b><span>Theirs breaks</span></div><div class="push-track">${cells.join("")}</div></div>`;
}
function battleView(): string {
  const G = g(), B = b(), f = B.foes[B.i];
  let h = chapterHead();
  h += tip("battle2", "<b>Battle.</b> Watch what your enemy is about to do and answer it: block an overhead blow, strike first against a thrust, bash a hook or a shove. Attacks are timed: press when the red line is in the green mark, or in the bright centre for a perfect blow. Kills, bashes and war-cries push their wall back; lose ground and yours breaks. Number keys 1 to 7 pick actions, and Space swings.");
  const remaining = B.foes.length - B.i - 1, I = INTENTS[B.intent], novice = st.L.fought < 3;
  h += `<section class="foe" aria-label="Your enemy"><div class="foe-top"><h3>${cap(f.n)}${f.champ ? ' <span class="chip bad">champion</span>' : ""}</h3><span class="muted">${remaining ? `${remaining} more behind him` : "the last one"}</span></div>
    ${bar("His health", Math.max(0, f.hp), f.mx, "hp")}
    ${B.read ? `<div class="intent"><b>${I.t}</b><span>${I.d}</span>${novice ? `<span class="hint">${I.hint}</span>` : ""}</div>` : `<div class="intent"><b>You can’t read his next move.</b><span class="hint">A better skill helps you read your enemy.</span></div>`}
    ${B.opened ? '<p class="good">He is off balance: +20% to hit with your next attack.</p>' : ""}
    ${pushView()}</section>`;
  if (B.flash) h += `<p class="flash ${B.flash.startsWith("Badly") ? "bad" : "good"}" aria-hidden="true">${B.flash}</p>`;
  h += wallView();
  if (B.prompt) {
    const P = PROMPTS[B.prompt];
    return h + `<section class="event" aria-label="In the thick of it"><p>${P.t()}</p><div class="actions">${P.o.map((o, i) => btn(o.l, "answer", [i], { odds: o.p ? o.p() : null })).join("")}</div></section>`;
  }
  if (B.swing) {
    const s = B.swing;
    return h + `<section class="swing" aria-label="Time your blow"><p><b>${({ strike: "Strike", heavy: "Heavy blow", berserk: "Berserk" } as Record<string, string>)[s.a]}:</b> press when the red line is in the green mark. The bright centre is a perfect blow.</p>
      <div class="swing-track"><div class="zone" style="left:${s.zone[0]}%;width:${s.zone[1] - s.zone[0]}%"></div><div class="perfect" style="left:${s.perf[0]}%;width:${s.perf[1] - s.perf[0]}%"></div><div class="marker" id="marker" style="left:${s.pos}%"></div></div>
      <div class="actions">${btn("Swing now", "release", [], { cls: "go", key: "Space" })}</div></section>`;
  }
  const [a1, b1] = dmgRange("strike"), [a2, b2] = dmgRange("heavy"), [a3, b3] = dmgRange("berserk"), [a4, b4] = dmgRange("bash");
  const best = (a: Action) => (novice && B.read && I.counter === a ? "best" : "");
  const foeN = (a: Action) => (B.read && mods(a, B.intent).noAttack ? "he won’t land a blow" : `he hits ${foeP(a, true)}%`);
  h += `<div class="actions" id="battle-actions">
    ${btn("Strike", "turn", ["strike"], { key: 1, cls: best("strike"), odds: hitP("strike", true), dis: B.sta < 1, note: `1 stamina, ${a1}–${b1} damage, ${foeN("strike")}` })}
    ${btn("Heavy blow", "turn", ["heavy"], { key: 2, cls: best("heavy"), odds: hitP("heavy", true), dis: B.sta < 2, note: `2 stamina, ${a2}–${b2} damage, ${foeN("heavy")}` })}
    ${btn("Raise your shield", "turn", ["guard"], { key: 3, cls: best("guard"), note: `+3 stamina, ${foeN("guard")}` })}
    ${btn("Shield bash", "turn", ["bash"], { key: 4, cls: best("bash"), odds: hitP("bash", true), dis: B.sta < 1, note: `1 stamina, ${a4}–${b4} damage, ${foeN("bash")}` })}
    ${btn("War-cry", "turn", ["rally"], { key: 5, dis: B.sta < 1, note: `1 stamina, morale +10, ${foeN("rally")}` })}
    ${btn("Berserk", "turn", ["berserk"], { key: 6, odds: hitP("berserk", true), dis: G.mor < 60, note: G.mor < 60 ? "needs 60 morale" : `morale −20, ${a3}–${b3} damage` })}
    ${btn("Withdraw", "turn", ["flee"], { key: 7, odds: withdrawP(), note: B.broken ? "no shame now your wall has broken" : G.nid ? "a second time means outlawry" : "you will be called níðingr" })}
  </div>`;
  return h;
}

function aftermathView(): string {
  const G = g(), share = G.loot ?? 0;
  return chapterHead()
    + tip("loot", "<b>The hoard.</b> Loot is pooled and shared out by rank. Skimming doubles your take if nobody sees you; skill improves your odds.")
    + `<section class="event" aria-label="Sharing the loot"><p>The jarl’s men count out the hoard from the field. As ${withArticle(RANKS[G.rank].n.toLowerCase())}, your share is ${share} silver.</p>
    <div class="actions">${btn("Take your share", "loot", ["take"], { note: `${share} silver` })}${btn("Skim from the hoard", "loot", ["skim"], { odds: skimP(), note: `${share * 2} silver if unseen, flogging if caught` })}</div></section>`;
}
function huntView(): string {
  const H = st.H!;
  return chapterHead() + `<section class="event" aria-label="Hunting"><p>${H.msg} Loose when the red line is inside the green mark. A better skill gives a wider mark.</p>
    <div class="hunt-track"><div class="zone" style="left:${H.zone[0]}%;width:${H.zone[1] - H.zone[0]}%"></div><div class="marker" id="marker" style="left:${H.pos}%"></div></div>
    <div class="actions" style="align-items:center">${btn("Loose an arrow", "loose", [], { cls: "go", key: "Space" })}<span class="arrows" aria-label="${H.arrows} arrows left">${[0, 1, 2].map((i) => `<span class="arrow${i >= H.arrows ? " spent" : ""}"></span>`).join("")}</span><span class="muted">${H.hits} hit${H.hits === 1 ? "" : "s"}</span></div></section>`;
}
function finaleView(): string {
  const G = g();
  const opt = (k: EndingId, prefix = "") => btn(ENDINGS[k].l!, "ending", [k], { note: `${prefix}ending bonus +${ENDINGS[k].bonus() + fordBonus(k)}` });
  if (G.ch === EDINGTON) {
    return chapterHead() + `<section class="event" aria-label="After Edington"><p>Guthrum’s army falls back to its camp at Chippenham, and after two weeks of hunger it surrenders. Alfred lets the Danes live. Some will settle; some will look for war elsewhere. What will you do?</p>
      <div class="actions">${btn("Cross the sea with the new army", "crossSea", [], { cls: "go", note: "the saga continues to Francia and beyond, to the year 900" })}${CHOSEN_ENDINGS.map((k) => opt(k, "end your saga here, ")).join("")}</div></section>`;
  }
  return chapterHead() + `<section class="event" aria-label="The end of the fighting"><p>You are ${age()} winters old and have fought from East Anglia to Paris and back. There is no more war for you this side of the grave. How will you spend your last years?</p>
    <div class="actions">${CHOSEN_ENDINGS.map((k) => opt(k)).join("")}</div></section>`;
}
function overView(): string {
  const G = g(), r = G.res!, L = st.L;
  const win = ["baptism", "sail", "danelaw", "north"].includes(r.k);
  const title = { baptism: "A Christian name", sail: "Home over the whale-road", danelaw: "A farm by York", north: "Ploughland in Northumbria", desert: "Gone into the fens", death: "Slain", outlaw: "Outlawed" }[r.k];
  return `<div class="title-screen">
    ${sceneSVG(Math.min(G.ch, CH.length - 1))}
    <h1>${title}</h1>
    <p class="lede">${r.text}</p>
    ${r.verse ? `<div class="panel"><h3>The skald’s verse for ${esc(G.name)}</h3><p class="verse">${r.verse.map(esc).join("<br>")}</p></div>` : `<p class="muted">${win ? "No skald thought your deeds worth a verse." : "No skald will sing of you."}</p>`}
    <section class="panel" aria-label="Saga score"><h3>Saga score</h3><table class="score">
      ${r.parts.map((p) => `<tr><td>${p[0]}</td><td>${p[1]}</td></tr>`).join("")}
      <tr><td>Ending</td><td>${r.bonus}</td></tr>
      <tr class="total"><td>Total</td><td>${r.total}</td></tr></table>
      <p>That earns ${r.pts} legacy point${r.pts === 1 ? "" : "s"} for your next raider. You now have ${L.pts}.</p></section>
    <div class="actions">${btn("Spend legacy and begin again", "toMenu", [], { cls: "go" })}</div>
    ${logView()}
  </div>`;
}
function titleView(): string {
  const L = st.L;
  const saved = store.load<{ G: Game }>(KEYS.run);
  const hasSave = !!(saved && saved.G && saved.G.phase !== "over");
  const sc = hasSave ? Math.min(saved!.G.ch, CH.length - 1) : 0;
  return `<div class="title-screen">
    ${sceneSVG(sc)}
    <h1>A Raider’s Life</h1>
    <p class="lede">You are not Ivar the Boneless and you are not Guthrum. You are one oar on one ship of the Great Heathen Army. Fight from the landing in 865 to Edington, and if you live that long, on through Francia to the year 900.</p>
    ${hasSave ? `<section class="panel"><h3>Saga in progress</h3><p>${esc(saved!.G.name)}, ${RANKS[saved!.G.rank].n.toLowerCase()}, is with the army at ${CH[sc].place} (${CH[sc].year}).</p><div class="actions">${btn("Continue the saga", "continueRun", [], { cls: "go" })}</div></section>` : ""}
    <section class="panel" aria-label="New raider"><h3>A new raider</h3>
      <div class="field"><label for="nm">Name</label><div class="row"><input type="text" id="nm" maxlength="40" value="${esc(ui.name)}" autocomplete="off">${btn("Another name", "reroll")}</div></div>
      <div class="actions">${btn(ui.confirmNew ? "Abandon the old saga and begin" : "Take the oar", "begin", [], { cls: hasSave ? "" : "go" })}</div>
      ${ui.confirmNew && hasSave ? `<p class="bad">This ends ${esc(saved!.G.name)}’s saga without scoring it.</p>` : ""}
    </section>
    <section class="panel" aria-label="Legacy"><h3>Legacy</h3>
      <p>Raiders who came before left you <b>${L.pts}</b> legacy point${L.pts === 1 ? "" : "s"}. Each gift costs 3 and lasts for every raider after, up to three times.</p>
      <div class="perks">${(Object.keys(PERKS) as (keyof typeof PERKS)[]).map((k) => btn(`${PERKS[k].n}, ${L.up[k]} of 3`, "up", [k], { dis: L.pts < 3 || L.up[k] >= 3, note: PERKS[k].d })).join("")}</div>
      ${L.runs ? `<p class="muted">Best saga score ${L.best} across ${L.runs} raider${L.runs === 1 ? "" : "s"}.</p>` : ""}
    </section>
    <section class="panel" aria-label="Settings"><h3>Settings</h3><div class="actions">${btn(`Timed swings: ${L.timing ? "on" : "off"}`, "toggleTiming", [], { note: L.timing ? "you time each attack yourself" : "attacks use your odds alone" })}</div></section>
    <p class="muted">Sixteen chapters, each a camp and a battle. Death is permanent. Choose fights that suit your raider.</p>
  </div>`;
}

export function render(): void {
  const app = document.getElementById("app")!;
  const active = document.activeElement as HTMLElement | null;
  const focusKey = active?.dataset?.key ?? null;
  const G = st.G;
  let h: string;
  if (!G) h = titleView();
  else if (G.phase === "over") h = overView();
  else {
    const body = { camp: campView, battle: battleView, aftermath: aftermathView, hunt: huntView, finale: finaleView }[G.phase]();
    h = `<div class="top"><span class="brand">A Raider’s Life</span><span class="progress"><span>${CH[G.ch].year}, ${cap(CH[G.ch].place)}</span>${btn(`Timed swings ${st.L.timing ? "on" : "off"}`, "toggleTiming", [], { cls: "link" })}${btn("Save and leave", "toMenu", [], { cls: "link" })}</span></div>
      <div class="grid"><main>${body}</main><aside>${sheet()}${mapView()}${logView()}</aside></div>`;
  }
  app.innerHTML = h;
  if (st.fresh.length) { document.getElementById("live")!.textContent = st.fresh.slice(-3).join(" "); st.fresh = []; }
  // Keep keyboard focus where the player was, or on the swing button while a swing is running.
  const swingBtn = st.B?.swing ? document.querySelector<HTMLElement>('[data-act="release"]') : null;
  if (swingBtn) swingBtn.focus({ preventScroll: true });
  else if (focusKey) {
    let el = document.querySelector<HTMLButtonElement>(`[data-key="${CSS.escape(focusKey)}"]`);
    if (!el || el.disabled) el = document.querySelector("main .btn:not(:disabled), .title-screen .btn:not(:disabled)");
    el?.focus({ preventScroll: true });
  }
  saveRun();
  syncMotion();
}
