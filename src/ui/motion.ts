/* The moving markers for the hunt and for timed swings. Only the browser runs this. */
import { st } from "../core/state";
import { huntSpeed } from "../core/camp";
import { swingSpeed } from "../core/combat";

let raf = 0;
let running: "" | "hunt" | "swing" = "";
const reduced = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Start or stop the animation loop to match the current state. Called after every render. */
export function syncMotion(): void {
  const want = st.H && st.G?.phase === "hunt" ? "hunt" : st.B?.swing ? "swing" : "";
  if (want === running) return;
  cancelAnimationFrame(raf);
  running = want;
  if (want) raf = requestAnimationFrame(loop);
}

function loop(ts: number): void {
  const o = running === "hunt" ? st.H : st.B?.swing;
  if (!o) { running = ""; return; }
  const speed = (running === "hunt" ? huntSpeed() : swingSpeed(st.B!.swing!.a)) * (reduced() ? 0.5 : 1);
  const dt = o.t ? Math.min(50, ts - o.t) / 1000 : 0;
  o.t = ts;
  o.pos += o.dir * speed * dt;
  if (o.pos >= 100) { o.pos = 100; o.dir = -1; }
  if (o.pos <= 0) { o.pos = 0; o.dir = 1; }
  const m = document.getElementById("marker");
  if (m) m.style.left = o.pos + "%";
  raf = requestAnimationFrame(loop);
}
