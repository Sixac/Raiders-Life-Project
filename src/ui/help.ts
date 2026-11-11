/*
 * The "How to play" page. It is built from the tuning tables wherever it can be, so it stays
 * true when the numbers change. The few numbers written out here come from formulas in
 * core/combat.ts, core/camp.ts and core/state.ts; change them here if you change them there.
 * No browser code, so the tests can read the page.
 */
import { BOON_PRICES, BOON_SLOTS, BOONS, COST, CREW_KIT, FEINTS, FOE_KINDS, GIFT, GODS, HEALER, HIRE, INTENTS, RANKS, RINGS, STATS, SWING, TRAINING } from "../content/tables";
import type { BoonId, GodId, IntentId, Stat } from "../types";

const pct = (n: number) => `${n > 0 ? "+" : "−"}${Math.abs(n)}%`;

export function helpHtml(phone: boolean): string {
  const stats = (Object.keys(STATS) as Stat[]).map((k) => `<dt>${STATS[k].n}</dt><dd>${STATS[k].d}.</dd>`).join("");
  const [easy, mid, hard] = TRAINING.chance;
  const gods = (Object.keys(GODS) as GodId[]).map((k) => `<dt>${GODS[k].n}</dt><dd>${GODS[k].d}.</dd>`).join("");
  const moves = (Object.keys(INTENTS) as IntentId[]).map((k) => `<tr><td>${INTENTS[k].t} ${INTENTS[k].d}</td><td>${INTENTS[k].hint}</td></tr>`).join("");
  const kinds = Object.values(FOE_KINDS).map((k) => `<li>${k.note}</li>`).join("");
  const ranks = RANKS.slice(1).map((r) => `<dt>${r.n}</dt><dd>Reputation ${r.rep} and ${r.kills} foes slain. ${r.perk}</dd>`).join("");
  const captain = RANKS.find((r) => r.acts > RANKS[0].acts);
  const gifts = (Object.keys(BOONS) as BoonId[]).map((k) => `<dt>${BOONS[k].n}</dt><dd>${BOONS[k].d.charAt(0).toUpperCase() + BOONS[k].d.slice(1)}.</dd>`).join("");
  const number = ["no", "one", "two", "three"];
  return `<section class="help" aria-label="How to play">
    <h2>How to play</h2>
    <p>You are one raider of the Great Heathen Army. Each of the sixteen chapters is a camp and then a battle. Death is permanent, but every saga earns legacy points that buy gifts for the raiders who come after (see Legacy, below).</p>

    <h3>Your raider</h3>
    <dl>${stats}
      <dt>Morale</dt><dd>Above 75 you hit 5% more often. Below 30 you cannot train. Below 25 you hit 10% less often and enemies hit you 8% more. Going berserk needs 60.</dd>
      <dt>Stamina</dt><dd>Attacks, bashes and war-cries spend it (a heavy blow costs ${COST.heavy}). Raising your shield wins back 3.</dd>
      <dt>Wounds</dt><dd>Each lowers one thing until it mends. They mend as chapters pass, and resting speeds them up.</dd>
    </dl>

    <h3>Camp</h3>
    <p>You get ${RANKS[0].acts} actions before each battle${captain ? `, and ${captain.acts} once you are a ${captain.n.toLowerCase()}` : ""}.</p>
    <dl>
      <dt>Train</dt><dd>Costs ${TRAINING.morale} morale. It ${easy.pct >= 100 ? "always works" : `works ${easy.pct}% of the time`} while the stat is below ${easy.below}, then ${mid.pct}% of the time below ${mid.below} and ${hard.pct}% below ${hard.below}.</dd>
      <dt>Feast, rest, forage</dt><dd>Feasting and fishing raise morale. Resting heals you and mends your worst wound a little. Hunting and raiding are gambles.</dd>
      <dt>The smith</dt><dd>Each better weapon adds 2 damage and 2% to hit. Each better armour makes enemies hit you 5% less often.</dd>
      <dt>The healer</dt><dd>${HEALER.price} silver buys ${HEALER.hp} health once each camp, without using an action.</dd>
      <dt>The jarl and your men</dt><dd>A gift to the jarl (${GIFT.price} silver) earns ${GIFT.rep} reputation once each camp, and a hired spearman (${HIRE.price} silver) stands beside you in the wall. Neither uses an action. A ${RANKS[CREW_KIT.rank].n.toLowerCase()} can buy kit for his men at the smith: each step adds ${CREW_KIT.hp} health to every man beside him. A ${RANKS[RINGS.rank].n.toLowerCase()} can give them rings before a battle (${RINGS.price} silver), and they strike more often in it.</dd>
      <dt>Offerings</dt><dd>Each raises a god’s favour by one, up to three, and every favour fades by one each chapter. With no favour at all you may lose heart.</dd>
      ${gods}
    </dl>

    <h3>Battle</h3>
    <p>Each round your enemy shows what he is about to do. Answer it:</p>
    <table><thead><tr><th scope="col">He…</th><th scope="col">Your answer</th></tr></thead><tbody>${moves}</tbody></table>
    <p>You cannot always read him: skill helps (45%, and 6% more for each point). Seasoned warriors sometimes show a false move; you see through a feint ${FEINTS.seeBase}% of the time, and ${FEINTS.seePerSkill}% more for each point of skill.</p>
    <ul>${kinds}</ul>
    <dl>
      <dt>Timed swings</dt><dd>Stop the red line in the green mark. The bright centre is a perfect blow: ${pct(SWING.perfect.hit)} to hit and ${Math.round((SWING.perfect.dmg - 1) * 100)}% more damage. A badly timed blow is ${pct(SWING.poor.hit)} to hit. You can turn timing off in the settings.</dd>
      <dt>The push of the walls</dt><dd>Kills, shield bashes and war-cries push their wall back. Fallen neighbours and shoves you fail to answer push yours. Break their wall and the battle is won at once. If yours breaks, enemies hit you more often, but you may withdraw without shame.</dd>
      <dt>Your neighbours</dt><dd>They cover your sides. Each side left open lets enemies hit you 10% more often.</dd>
      <dt>Berserk</dt><dd>Costs 20 morale: double damage and 10% more to hit, but he hits you more easily too.</dd>
      <dt>Withdrawing</dt><dd>Leave the wall while it still stands and you are called níðingr: no promotion and no gifts from the jarl until you hold your place through a battle you win. Do it twice and you are outlawed.</dd>
    </dl>

    <h3>Rank</h3>
    <p>Reputation and kills earn promotion after a battle. A higher rank means a larger share of the loot.</p>
    <dl>${ranks}</dl>

    <h3>Silver and endings</h3>
    <p>After a battle the hoard is shared out by rank, and the jarl adds a gift for your own kills. Skimming doubles your share if nobody sees you. After Edington in 878 you may end your saga or cross the sea, and after the last battle of 900 you choose your ending: baptism rewards reputation, sailing home rewards the silver you kept, and land at York rewards rank and kills. Silver spent on your men, the healer and the jarl helps you live to see an ending, but it does not sail home with you.</p>
    <h3>Legacy</h3>
    <p>Every saga earns one legacy point for each five points of its score, however it ends. On the title screen the points buy gifts. A gift stays for every raider after, and each costs more than the last, from ${BOON_PRICES[0]} points to ${BOON_PRICES[BOON_PRICES.length - 1]}. One raider carries ${number[BOON_SLOTS.base]} of them, or ${number[BOON_SLOTS.most]} once you have bought the place for another (${BOON_SLOTS.price} points).</p>
    <dl>${gifts}</dl>

    ${phone ? "" : `<h3>Keys</h3>
    <p>Number keys pick from the choices on screen, and 0 marches to battle. Space or Enter swings and looses arrows. The question mark opens and closes this page.</p>`}
  </section>`;
}
