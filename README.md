# A Raider’s Life

A permadeath roguelite RPG about one ordinary raider of the Great Heathen Army, from the landing in East Anglia in 865 to a last summer at York in 900. Inspired by *A Legionary’s Life*.

Each of the sixteen chapters is a camp (train, feast, rest, hunt, buy gear, make offerings, deal with events) followed by a shield-wall battle (read the enemy’s move, time your blows, push their wall back). Death is permanent; points from finished runs buy starting bonuses for the next raider.

It plays on phones too: below 720 pixels wide it switches to a phone layout with large buttons, a status bar at the top and tabs at the bottom. Players can force either layout under Settings. On the public site it can also be added to a phone’s home screen and played offline.

## AI Notice

Made with Claude

## Getting started

You need [Node.js](https://nodejs.org) 22.12 or newer.

```sh
npm install
npm run dev        # play at http://localhost:5173 with live reload
npm test           # check the content files and simulate 7,500 runs
npm run build      # build dist/index.html, one self-contained file
```

`dist/index.html` is the whole game in one file, fonts included. Open it in a browser, upload it anywhere, or use it as the front end of a desktop build. The other files in `dist` (icons, the link-preview image, `manifest.webmanifest` and `sw.js`) come from `public/` and are only needed on a website, for installing to a phone, offline play and link previews.

## Project layout

```
src/
  content/
    chapters.json   the 16 chapters: year, place, text, enemies, map position, scene
    events.json     the camp events and their choices
    tables.ts       tuning tables: ranks, gear, training, enemies, loot, prices, wounds, gods, perks, enemy moves
  core/             the rules, with no browser code (so tests can run them)
    state.ts        the game state and values derived from it
    camp.ts         new runs, camp actions, hunting, moving between chapters
    events.ts       picking events and carrying out choices
    combat.ts       the battle: enemy moves, swings, the push of the walls, loot
    life.ts         health, wounds, crew and promotion
    endings.ts      endings, score, legacy points, the skald’s verse
    savecode.ts     save codes: turning a save into text and checking codes before loading them
    summary.ts      the one-line saga players can share
  save/storage.ts   where saves go (see "Saves" below)
  ui/               everything that touches the page
    render.ts       all screens, desktop and phone
    layout.ts       picks the desktop or phone layout
    scenes.ts       the painted chapter scenes, drawn as SVG
    actions.ts      button and keyboard handling
    motion.ts       the moving markers for hunting and timed swings
    share.ts        copying and sharing, with a fallback when the clipboard is refused
    offline.ts      offline play and installing (only on the https website)
    fonts.css       the two typefaces, bundled into the page
    styles.css
  main.ts           browser entry point
tests/
  content.test.ts   catches mistakes in the JSON files
  savecode.test.ts  save codes round-trip, and damaged or invalid codes are refused
  summary.test.ts   the line players share at the end
  html.test.ts      names and other text are shown as typed, never as markup
  simulate.test.ts  plays thousands of runs with bots and checks the balance
  sim.ts            the bot and the balance report
```

## Writing events

Events live in `src/content/events.json`. Add one and it can appear in camp; no code needed.

```json
{
  "id": "horses",
  "chapters": [1, 15],
  "text": "The enemy’s horses are picketed just past the river, lightly guarded.",
  "options": [
    { "label": "Steal two (skill)", "check": { "stat": "skl", "diff": 1 },
      "pass": { "text": "You sell them to the jarl’s stablemaster. Silver +8, reputation +1.", "silver": 8, "rep": 1 },
      "fail": { "text": "A guard’s spear catches your leg. Health −5.", "hp": -5 } },
    { "label": "Leave them", "pass": { "text": "You leave them." } }
  ]
}
```

**Event fields**

| Field | Meaning |
| --- | --- |
| `id` | Unique name. |
| `chapters` | `[first, last]` chapter it can appear in, counting from 0 (865 is 0, 900 is 15). |
| `when` | A condition (below) that must hold for the event to appear. |
| `minRank` | 1 veteran, 2 hirðman, 3 ship’s captain. |
| `priority` | Shown before any other eligible event, for fixed historical moments. |
| `repeatable` | Can appear more than once. |
| `text` | What happens. `{crewFirst}` and `{name}` are filled in. |
| `options` | Two or more choices. At least one must have no requirement. |

**Option fields**

| Field | Meaning |
| --- | --- |
| `label` | Button text. Add the stat in brackets when there is a check, e.g. “(strength)”. |
| `check` | `{ "stat": "str" \| "skl" \| "end" \| "fight", "diff": 0–2 }`. The odds show on the button. `fight` averages strength and skill. |
| `chance` | A hidden percentage roll instead of a stat check. |
| `test` | A condition that decides pass or fail with no roll, e.g. `{ "minKills": 5 }`. |
| `pay` | Silver paid up front; the button is disabled without it. |
| `requires` | A condition; the button is disabled unless it holds. |
| `pass`, `fail` | Outcomes. `fail` is needed whenever there is a check, chance or test. |

**Outcome fields:** `text` (required), `rep`, `mor`, `hp`, `silver`, `str`, `skl`, `end` (changes), `silverLoss` (lose a fraction, filling `{lost}`), `flags` (set story flags; `null` clears one), `wound` (`arm`, `head`, `ribs`, `gash` or `random`), `woundChance` (percent), `addCrew` (`{ "name", "hp", "place": "leftFront" | "shortSide" }`), `weapon` (set weapon tier), `favour` (`"random"`, filling `{god}`), `endRun` (end the run with an ending such as `north` or `desert`).

**Conditions:** `flags` (each flag must equal the value), `notFlags` (none of these set), `minAge`, `minKills`, `maxWeapon`, `minSilver`, `nid` (true while the raider is a níðingr).

Story flags already in use: `rival` (Hrafn, 1–4), `wife` (Eadgyth, 1–2), `promise`, `son`, `thegn` (Wulfstan), `ford`, `oath` (Yule oath, checked in battle).

Run `npm test` after editing. The content test names the event and field if something is wrong.

## Tuning the balance

Most of the numbers you would want to change are in `src/content/tables.ts`: ranks and promotion thresholds, gear prices, training, enemy strength, the bonus for perfectly timed swings, loot and the jarl's gift, and the prices of gifts and hired spearmen. Hit chance and damage formulas are in `src/core/combat.ts`, and the ending bonuses in `src/core/endings.ts`.

`npm run balance` plays 7,500 runs with bots and prints a report for each kind of player: careful players (who answer the enemy's moves) with poor, average and skilled timing or timing turned off, and careless players. For each it shows how many survive to 900, where the rest die, when each rank is first reached, silver and reputation at the end, and which ending would score best.

The test fails when a change tips the game too far, for example if a careful player with average timing survives to 900 less than 15% or more than 45% of the time, if timing decides too much, if the top ranks come before Edington, or if one ending is best for nearly everyone. The limits are in `tests/simulate.test.ts`; the bot is in `tests/sim.ts`.

## The public site

- **No outside requests.** The fonts (Alegreya and Uncial Antiqua, both under the SIL Open Font License) are bundled into the page from the `@fontsource` packages, so visitors’ browsers never contact Google or anyone else. That also avoids the GDPR problem of loading Google Fonts from Google’s servers.
- **Link previews.** `index.html` has a description and Open Graph tags, so links shared on Discord, Reddit or in messages show the title, a line of text and `public/preview.png`. If the game moves to another address, change `og:url` and `og:image` there; the share button uses `og:url` too.
- **Offline and installable.** On the https site, `public/sw.js` keeps a copy of the game so it starts without a connection once it has been opened, and `public/manifest.webmanifest` lets phones add it to the home screen. The worker fetches from the network first, so players get new versions as soon as they are online. If you change the list of files it caches, change `CACHE` in `sw.js` so old copies are cleared.
- **Sharing.** The end screen has a “Share your saga” button: on phones it opens the share sheet, elsewhere it copies a line such as “Ketil Ormsson, hersir, sailed home with 260 silver in 900. Saga score 309.” with a link to the game.

## Saves

Saves live in the player’s browser. On the title screen, **Copy save code** turns the legacy and any saga in progress into a short code (compressed, about 600 characters) that can be kept as a backup or pasted into **Load a save code** on another device. Codes are checked field by field before loading, so a damaged or edited code is refused with a message instead of breaking the game; a saga saved in the middle of a battle resumes in camp just before it.

Everything saved goes through the `SaveStore` interface in `src/save/storage.ts`. In the browser that is `localStorage` (the same keys as the original single-file game, so existing saves carry over). For a desktop build, write a `SaveStore` that reads and writes files and call `useStore(new YourStore())` at the top of `src/main.ts`, before `loadLegacy()`.
