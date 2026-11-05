/* Screen-only state that is never saved. */
import { randomName } from "../core/state";

export type Tab = "saga" | "raider" | "map" | "log";

export const ui = {
  /** Which camp sub-menu is open: train, forage, smith or gods. */
  sub: null as string | null,
  /** The title screen asks once before a new saga overwrites a saved one. */
  confirmNew: false,
  name: "",
  /** Phone layout: which tab is showing. */
  tab: "saga" as Tab,
  /** Phone layout: how many of the newest log lines to show as "what just happened". */
  recent: 0,
};
export const freshUiName = () => (ui.name = randomName());
