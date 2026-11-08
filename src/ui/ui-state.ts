/* Screen-only state that is never saved. */
import { randomName } from "../core/state";
import type { SaveBundle } from "../core/savecode";

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
  /** Title screen, "Your saves": messages, a code to copy by hand, and the box for loading a code. */
  saveMsg: "",
  saveCode: "",
  importOpen: false,
  importText: "",
  importError: "",
  pendingImport: null as SaveBundle | null,
  /** End screen: whether the saga was copied, or the text to copy by hand. */
  shareMsg: "",
  shareText: "",
};
export const freshUiName = () => (ui.name = randomName());
