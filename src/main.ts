/* Browser entry point. A desktop build can call useStore(...) here before loadLegacy(). */
import "./ui/fonts.css";
import "./ui/styles.css";
import { loadLegacy, st } from "./core/state";
import { checkLocalRun } from "./core/savecode";
import { SAVE_VERSION } from "./save/storage";
import { bindInput, loadRun } from "./ui/actions";
import { render } from "./ui/render";
import { freshUiName } from "./ui/ui-state";
import { watchLayout } from "./ui/layout";
import { registerOffline } from "./ui/offline";

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
registerOffline();

// When the page is updated on claude.ai while someone is playing, carry the run across.
const start = (d: unknown) => {
  const s = d as { G?: unknown; B?: unknown } | null;
  const run = s?.G ? checkLocalRun({ v: SAVE_VERSION, G: s.G, B: s.B ?? null }) : null;
  if (run) loadRun(run);
  render();
};
const hot = window.claude?.hot;
try { hot?.snapshot?.(() => ({ G: st.G, B: st.B ? { ...st.B, swing: null } : null })); } catch { /* not on claude.ai */ }
try { if (hot?.ready) hot.ready(start); else start(hot?.data ?? null); } catch { start(null); }
