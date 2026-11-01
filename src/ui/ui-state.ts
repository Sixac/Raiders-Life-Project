/* Screen-only state that is never saved. */
import { randomName } from "../core/state";

export const ui = {
  /** Which camp sub-menu is open: train, forage, smith or gods. */
  sub: null as string | null,
  /** The title screen asks once before a new saga overwrites a saved one. */
  confirmNew: false,
  name: "",
};
export const freshUiName = () => (ui.name = randomName());
