/* Painted chapter scenes, drawn as SVG from each chapter's scene spec in chapters.json. */
import type { MoodId } from "../types";
import { CH } from "../content/tables";
import { rng } from "../core/random";
import { esc } from "./html";

interface Mood { sky: [string, string]; sun?: string | null; moon?: string; far: string; mid: string; near: string; water: string; shore: string; sil: string; tree?: string; snow?: boolean }
const MOODS: Record<MoodId, Mood> = {
  dawn: { sky: ["#e8b98f", "#b9c6cc"], sun: "#fbe6bd", far: "#8e9ba1", mid: "#66767a", near: "#3a4645", water: "#8ba2ab", shore: "#b9a98b", sil: "#262c2f" },
  day: { sky: ["#a9c6d3", "#e1ebe9"], sun: "#fffbe8", far: "#9fb0a2", mid: "#748b74", near: "#46594a", water: "#6f93a2", shore: "#c2b38e", sil: "#232b26" },
  grey: { sky: ["#9aa4a7", "#cdd2d0"], sun: null, far: "#8b9592", mid: "#6a7571", near: "#414b49", water: "#7e8f92", shore: "#a9a28e", sil: "#262d2e" },
  winter: { sky: ["#b8c7d2", "#eef2f4"], sun: "#ffffff", far: "#c3ced4", mid: "#d9e1e5", near: "#f2f5f6", water: "#8ea4b0", shore: "#dfe5e8", sil: "#2f3a40", tree: "#4f6259", snow: true },
  dusk: { sky: ["#3b3452", "#e09766"], sun: "#f6b773", far: "#5c4f61", mid: "#43394c", near: "#251f2d", water: "#56506a", shore: "#6e5e66", sil: "#17131d" },
  night: { sky: ["#0d1626", "#2c3c56"], moon: "#ece6cf", far: "#26324a", mid: "#1c2638", near: "#111823", water: "#253552", shore: "#2a3446", sil: "#090d14" },
  storm: { sky: ["#3f484d", "#7c8689"], far: "#555e5c", mid: "#3f4746", near: "#272d2c", water: "#4a5a5f", shore: "#5d625c", sil: "#171c1c" },
};

function hillsPath(r: () => number, base: number, amp: number, n: number): string {
  const pts: [number, number][] = [];
  for (let k = 0; k <= n; k++) pts.push([(k * 640) / n, base + (r() - 0.5) * 2 * amp]);
  let d = `M0,240 L0,${pts[0][1].toFixed(1)}`;
  for (let k = 0; k < n; k++) {
    const [x1, y1] = pts[k], [x2, y2] = pts[k + 1];
    d += ` Q${(x1 + (x2 - x1) / 2).toFixed(1)},${(y1 - amp * 0.6 * (r() - 0.5)).toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`;
  }
  return d + " L640,240 Z";
}
const SH = ["#9b2f25", "#e6dcc0", "#2b5c6f", "#b4862a"];

function ship(x: number, y: number, s: number, sail: boolean, M: Mood, rot = 0): string {
  const shields = [-32, -22, -12, -2, 8, 18, 28].map((k, i) => `<circle cx="${k}" cy="-5" r="4.2" fill="${SH[i % 4]}" stroke="${M.sil}" stroke-width="1"/>`).join("");
  const rig = sail
    ? `<line x1="0" y1="-4" x2="0" y2="-64" stroke="${M.sil}" stroke-width="2.5"/><line x1="-30" y1="-60" x2="30" y2="-60" stroke="${M.sil}" stroke-width="2"/>${[0, 1, 2, 3, 4, 5].map((k) => `<rect x="${-27 + k * 9}" y="-59" width="9" height="36" fill="${k % 2 ? "#e9dfc6" : "#9b2f25"}"/>`).join("")}`
    : `<line x1="0" y1="-4" x2="0" y2="-44" stroke="${M.sil}" stroke-width="2.5"/>`;
  return `<g transform="translate(${x},${y}) rotate(${rot}) scale(${s})">${rig}<path d="M-52,-6 Q-40,12 0,12 Q40,12 52,-6 Q58,-20 50,-31 Q46,-27 49,-20 Q47,-10 40,-6 Q0,-2 -40,-6 Q-47,-10 -49,-20 Q-46,-27 -50,-31 Q-58,-20 -52,-6Z" fill="${M.sil}"/>${shields}</g>`;
}
function walls(x: number, y: number, w: number, h: number, M: Mood): string {
  let d = `M${x},${y} L${x},${y - h}`;
  for (let k = 0; k < w; k += 12) d += ` L${x + k},${y - h - 6} L${x + Math.min(k + 6, w)},${y - h - 6} L${x + Math.min(k + 6, w)},${y - h} L${x + Math.min(k + 12, w)},${y - h}`;
  return `<path d="${d} L${x + w},${y} Z" fill="${M.sil}"/>`;
}
const church = (x: number, y: number, s: number, M: Mood) => `<g transform="translate(${x},${y}) scale(${s})" fill="${M.sil}"><rect x="-24" y="-22" width="36" height="22"/><path d="M-27,-22 L-6,-37 L15,-22Z"/><rect x="12" y="-46" width="13" height="46"/><path d="M10,-46 L18.5,-57 L27,-46Z"/><rect x="17.5" y="-66" width="2" height="10"/><rect x="14.5" y="-63" width="8" height="2"/></g>`;
const house = (x: number, y: number, s: number, M: Mood) => `<g transform="translate(${x},${y}) scale(${s})" fill="${M.sil}"><rect x="-12" y="-10" width="24" height="10"/><path d="M-16,-10 L0,-22 L16,-10Z"/></g>`;
const tent = (x: number, y: number, s: number, M: Mood) => `<path transform="translate(${x},${y}) scale(${s})" d="M-12,0 L0,-17 L12,0Z M-1,-17 L-1,-21" fill="${M.sil}" stroke="${M.sil}" stroke-width="1.5"/>`;
const fire = (x: number, y: number, i: number) => `<circle cx="${x}" cy="${y - 6}" r="22" fill="url(#gl${i})"/><path d="M${x - 6},${y} Q${x - 7},${y - 10} ${x - 2},${y - 16} Q${x},${y - 9} ${x + 2},${y - 13} Q${x + 7},${y - 7} ${x + 6},${y} Z" fill="#f0a040"/><path d="M${x - 3},${y} Q${x - 3},${y - 6} ${x},${y - 9} Q${x + 3},${y - 5} ${x + 3},${y} Z" fill="#ffe08a"/>`;
const smoke = (x: number, y: number) => `<path d="M${x},${y} q-10,-18 4,-30 q14,-12 2,-30 q-8,-12 6,-24" fill="none" stroke="#8d9396" stroke-width="7" stroke-linecap="round" opacity=".45"/>`;
function palisade(x: number, y: number, w: number, h: number, M: Mood): string {
  let d = `M${x},${y}`;
  for (let k = 0; k <= w; k += 7) d += ` L${x + k},${y - h} L${x + k + 3.5},${y - h - 6} L${x + k + 7},${y - h}`;
  return `<path d="${d} L${x + w + 7},${y} Z" fill="${M.sil}"/>`;
}
function shieldLine(x: number, y: number, w: number, kind: string, M: Mood): string {
  const pal = kind === "saxon" ? ["#c9a227", "#6b2b2b"] : kind === "frank" ? ["#a3222a", "#d8cfb4"] : ["#9b2f25", "#e6dcc0", "#2b5c6f"];
  let heads = "", spears = "", shields = "";
  for (let k = 0, i = 0; k < w; k += 13, i++) {
    const cx = x + k;
    heads += `<circle cx="${cx}" cy="${y - 13}" r="4.5" fill="${M.sil}"/>`;
    spears += `<line x1="${cx + 3}" y1="${y - 4}" x2="${cx + 9}" y2="${y - 34}" stroke="${M.sil}" stroke-width="1.6"/>`;
    shields += `<circle cx="${cx}" cy="${y - 3}" r="7.5" fill="${pal[i % pal.length]}" stroke="${M.sil}" stroke-width="1.5"/>`;
  }
  return `<g>${spears}${heads}<rect x="${x - 8}" y="${y - 6}" width="${w + 4}" height="12" fill="${M.sil}"/>${shields}</g>`;
}
const banner = (x: number, y: number, col: string, M: Mood) => `<line x1="${x}" y1="${y}" x2="${x}" y2="${y - 42}" stroke="${M.sil}" stroke-width="2"/><path d="M${x},${y - 42} L${x + 24},${y - 36} L${x + 6},${y - 30} L${x + 20},${y - 24} L${x},${y - 22}Z" fill="${col}" stroke="${M.sil}" stroke-width="1"/>`;
const thorn = (x: number, y: number, s: number, M: Mood) => `<g transform="translate(${x},${y}) scale(${s})" stroke="${M.sil}" fill="none" stroke-linecap="round"><path d="M0,0 C1,-14 -2,-24 0,-34" stroke-width="5"/><path d="M0,-28 C-8,-36 -18,-38 -26,-46 M-14,-38 C-16,-46 -14,-52 -18,-58 M0,-34 C6,-44 14,-48 24,-50 M12,-46 C14,-54 20,-58 22,-64 M0,-34 C-2,-44 2,-52 0,-62" stroke-width="2.4"/><path d="M-30,-48 Q-20,-62 -6,-58 Q2,-72 14,-64 Q28,-66 28,-52" stroke-width="1.2" stroke-dasharray="2 3"/></g>`;
function pines(x: number, y: number, n: number, M: Mood, r: () => number): string {
  let o = "";
  for (let k = 0; k < n; k++) { const px = x + k * 18 + r() * 6, h = 26 + r() * 18; o += `<path d="M${(px - 9).toFixed(1)},${y} L${px.toFixed(1)},${(y - h).toFixed(1)} L${(px + 9).toFixed(1)},${y}Z" fill="${M.tree || M.sil}"/>`; }
  return o;
}
function ravens(n: number, M: Mood, r: () => number): string {
  let o = "";
  for (let k = 0; k < n; k++) { const x = 60 + r() * 520, y = 20 + r() * 60, s = 0.7 + r() * 0.6; o += `<path transform="translate(${x.toFixed(0)},${y.toFixed(0)}) scale(${s.toFixed(2)})" d="M-9,0 Q-4,-6 0,0 Q4,-6 9,0" fill="none" stroke="${M.sil}" stroke-width="2"/>`; }
  return o;
}
function bridge(x: number, y: number, w: number, M: Mood): string {
  let o = `<rect x="${x}" y="${y - 18}" width="${w}" height="6" fill="${M.sil}"/>`;
  for (let k = 0; k <= w; k += 26) o += `<rect x="${x + k - 3}" y="${y - 14}" width="6" height="22" fill="${M.sil}"/>`;
  return o;
}

export function sceneSVG(i: number): string {
  const c = CH[i], s = c.scene, M = MOODS[s.mood], r = rng(i * 7919 + 17);
  const defs = `<linearGradient id="sk${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${M.sky[0]}"/><stop offset="1" stop-color="${M.sky[1]}"/></linearGradient><radialGradient id="gl${i}"><stop offset="0" stop-color="#ffb347" stop-opacity=".75"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/></radialGradient>`;
  let o = `<rect width="640" height="240" fill="url(#sk${i})"/>`;
  const has = (t: string) => s.props.some((p) => p[0] === t);
  if (has("stars")) for (let k = 0; k < 40; k++) o += `<circle cx="${(r() * 640).toFixed(0)}" cy="${(r() * 110).toFixed(0)}" r="${(r() * 1.2 + 0.3).toFixed(1)}" fill="#f2efe0" opacity="${(0.4 + r() * 0.6).toFixed(2)}"/>`;
  if (M.sun) o += `<circle cx="${s.mood === "dusk" ? 430 : 520}" cy="${s.mood === "dusk" ? 122 : 60}" r="${s.mood === "dusk" ? 34 : 24}" fill="${M.sun}" opacity=".9"/>`;
  if (M.moon) o += `<circle cx="510" cy="52" r="18" fill="${M.moon}"/>`;
  o += `<path d="${hillsPath(r, 112, 16, 6)}" fill="${M.far}"/>`;
  if (s.ground === "ridge") o += `<path d="M0,240 L0,200 Q160,190 260,168 Q380,138 640,128 L640,240Z" fill="${M.mid}"/>`;
  else if (s.ground === "cliff") o += `<path d="M380,240 L380,170 Q420,140 470,134 L640,128 L640,240Z" fill="${M.mid}"/>`;
  else if (s.ground === "flat") o += `<path d="${hillsPath(r, 160, 4, 4)}" fill="${M.mid}"/>`;
  else o += `<path d="${hillsPath(r, 152, 12, 5)}" fill="${M.mid}"/>`;
  if (s.water) {
    const wy = s.water.y;
    if (s.water.kind === "sea") {
      o += `<rect x="0" y="${wy}" width="${s.ground === "cliff" ? 400 : 640}" height="${240 - wy}" fill="${M.water}"/>`;
      if (s.ground !== "cliff") o += `<path d="M0,240 L0,${wy + 8} Q120,${wy + 22} 200,${wy + 46} Q240,${wy + 62} 250,240Z" fill="${M.shore}"/>`;
    } else {
      const h = s.water.kind === "marsh" ? 30 : 24;
      o += `<path d="M0,${wy} Q200,${wy - 4} 320,${wy + 2} Q480,${wy + 6} 640,${wy - 2} L640,${wy + h} Q400,${wy + h + 6} 0,${wy + h - 2}Z" fill="${M.water}"/>`;
      for (let k = 0; k < 6; k++) { const x = r() * 600, y = wy + 4 + r() * (h - 8); o += `<line x1="${x.toFixed(0)}" y1="${y.toFixed(0)}" x2="${(x + 20).toFixed(0)}" y2="${y.toFixed(0)}" stroke="#ffffff" stroke-opacity=".25" stroke-width="1.5"/>`; }
    }
  }
  for (const p of s.props) {
    const [t, a, bb, c2, d, e] = p as [string, number, number, number, number | string, number];
    switch (t) {
      case "ship": o += ship(a, bb, c2, Boolean(d), M, e || 0); break;
      case "walls": o += walls(a, bb, c2, d as number, M); break;
      case "tower": o += walls(a - c2 / 2, bb, c2, d as number, M); break;
      case "church": o += church(a, bb, c2, M); break;
      case "house": o += house(a, bb, c2, M); break;
      case "tent": o += tent(a, bb, c2, M); break;
      case "fire": o += fire(a, bb, i); break;
      case "smoke": o += smoke(a, bb); break;
      case "palisade": o += palisade(a, bb, c2, d as number, M); break;
      case "line": o += shieldLine(a, bb, c2, String(d), M); break;
      case "banner": o += banner(a, bb, String(c2), M); break;
      case "thorn": o += thorn(a, bb, c2, M); break;
      case "pines": o += pines(a, bb, c2, M, r); break;
      case "ravens": o += ravens(a, M, r); break;
      case "bridge": o += bridge(a, bb, c2, M); break;
      case "island": o += `<ellipse cx="${a + c2 / 2}" cy="${bb}" rx="${c2 / 2 + 14}" ry="12" fill="${M.mid}"/>`; break;
      case "reeds": for (let k = 0; k < 26; k++) { const x = r() * 640, y = 200 + r() * 14; o += `<line x1="${x.toFixed(0)}" y1="${y.toFixed(0)}" x2="${(x + r() * 4 - 2).toFixed(0)}" y2="${(y - 10 - r() * 10).toFixed(0)}" stroke="${M.sil}" stroke-width="1.5"/>`; } break;
      case "waves": for (let k = 0; k < 14; k++) { const x = r() * 360, y = 170 + r() * 60; o += `<path d="M${x.toFixed(0)},${y.toFixed(0)} q8,-6 16,0 q8,-6 16,0" fill="none" stroke="#e8eef0" stroke-opacity=".5" stroke-width="1.5"/>`; } break;
    }
  }
  if (!s.water || s.water.kind !== "sea") o += `<path d="${hillsPath(r, 226, 5, 8)}" fill="${M.near}"/>`;
  if (has("rain")) for (let k = 0; k < 70; k++) { const x = r() * 700 - 30, y = r() * 240; o += `<line x1="${x.toFixed(0)}" y1="${y.toFixed(0)}" x2="${(x - 8).toFixed(0)}" y2="${(y + 16).toFixed(0)}" stroke="#d6dde0" stroke-opacity=".35" stroke-width="1"/>`; }
  if (M.snow) for (let k = 0; k < 90; k++) o += `<circle cx="${(r() * 640).toFixed(0)}" cy="${(r() * 240).toFixed(0)}" r="${(r() * 1.6 + 0.6).toFixed(1)}" fill="#ffffff" opacity=".85"/>`;
  return `<svg class="scene" viewBox="0 0 640 240" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${esc(c.alt)}"><defs>${defs}</defs>${o}</svg>`;
}
