/* Chooses between the desktop and phone layouts. */
import type { Layout } from "../types";
import { st } from "../core/state";

/** The automatic setting uses the phone layout on narrow screens, and on short ones (a phone held sideways). */
const PHONE_QUERY = "(max-width: 720px), (max-height: 480px)";
const mq = typeof window !== "undefined" && window.matchMedia ? window.matchMedia(PHONE_QUERY) : null;

export const isPhone = () => st.L.layout === "phone" || (st.L.layout !== "desktop" && !!mq?.matches);

/** Re-render when the screen crosses the phone width, e.g. when a phone is rotated. */
export function watchLayout(onChange: () => void): void {
  mq?.addEventListener?.("change", () => { if (st.L.layout === "auto") onChange(); });
}

export const LAYOUTS: Layout[] = ["auto", "phone", "desktop"];
export const LAYOUT_NAMES: Record<Layout, string> = { auto: "automatic", phone: "phone", desktop: "desktop" };
export const LAYOUT_NOTES: Record<Layout, string> = {
  auto: "phone layout on small screens",
  phone: "big buttons, tabs at the bottom",
  desktop: "everything on one page",
};
