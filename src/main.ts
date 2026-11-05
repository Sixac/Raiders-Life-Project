/* Browser entry point. A desktop build can call useStore(...) here before loadLegacy(). */
import "./ui/styles.css";
import type { Battle, Game } from "./types";
import { loadLegacy, st } from "./core/state";
import { bindInput, loadRun } from "./ui/actions";
import { render } from "./ui/render";
import { freshUiName } from "./ui/ui-state";
import { watchLayout } from "./ui/layout";

interface HotHook {
  snapshot?: (fn: () => unknown) => void;
  ready?: (start: (data: unknown) => void) => void;
  data?: unknown;
}
declare global { interface Window { claude?: { hot?: HotHook } } }

st.interactive = true;
loadLegacy();
freshUiName();
bindInput();
watchLayout(render);

// When the page is updated on claude.ai while someone is playing, carry the run across.
const start = (d: unknown) => {
  const s = d as { G?: Game; B?: Battle | null } | null;
  if (s?.G) loadRun({ v: 3, G: s.G, B: s.B ?? null });
  render();
};
const hot = window.claude?.hot;
try { hot?.snapshot?.(() => ({ G: st.G, B: st.B ? { ...st.B, swing: null } : null })); } catch { /* not on claude.ai */ }
try { if (hot?.ready) hot.ready(start); else start(hot?.data ?? null); } catch { start(null); }
