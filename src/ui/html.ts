/* Small HTML helpers shared by the views. */
import { cl } from "../core/random";

export const esc = (s: unknown) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export interface BtnOpts { cls?: string; dis?: boolean; odds?: number | null; note?: string; key?: string | number }

/**
 * A button that runs a named action from ui/actions.ts with the given arguments.
 * data-key identifies the button across re-renders so keyboard focus can be restored.
 */
export function btn(label: string, action: string, args: (string | number | null)[] = [], o: BtnOpts = {}): string {
  const a = esc(JSON.stringify(args));
  return `<button type="button" class="btn ${o.cls || ""}" data-act="${action}" data-args="${a}" data-key="${esc(action)}${a}"${o.dis ? " disabled" : ""}>`
    + `<span class="row1">${o.key !== undefined ? `<span class="key" aria-hidden="true">${o.key}</span>` : ""}<span>${label}</span>${o.odds != null ? `<span class="odds">${o.odds}%</span>` : ""}</span>`
    + `${o.note ? `<span class="note">${o.note}</span>` : ""}</button>`;
}

export const bar = (label: string, v: number, m: number, cls: string) =>
  `<div class="meter ${cls}"><div class="meter-top"><span>${label}</span><span class="num">${Math.max(0, v)} / ${m}</span></div><div class="track"><div class="fill" style="width:${cl((v / m) * 100, 0, 100)}%"></div></div></div>`;

const PAINTS: [string, string][] = [["var(--paint1)", "var(--paint2)"], ["var(--paint3)", "var(--paint2)"], ["var(--paint4)", "var(--paint1)"], ["var(--paint2)", "var(--paint3)"], ["var(--paint1)", "var(--paint4)"]];
/** A round shield painted in colours picked from the owner's name, so each man keeps his shield. */
export function shieldEl(name: string): string {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const [a, b] = PAINTS[h % PAINTS.length];
  return `<div class="shield" style="--c1:${a};--c2:${b}" aria-hidden="true"></div>`;
}
