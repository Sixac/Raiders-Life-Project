/* Shared types for game state and content. */

export type Stat = "str" | "skl" | "end";
export type GodId = "odin" | "thor" | "freyr";
export type WoundId = "arm" | "head" | "ribs" | "gash";
export type EndingId = "baptism" | "sail" | "danelaw" | "north" | "desert" | "death" | "outlaw";
export type Phase = "camp" | "battle" | "aftermath" | "hunt" | "finale" | "over";
export type IntentId = "overhead" | "thrust" | "hook" | "hold" | "shove" | "charge";
/** How an enemy fights; see FOE_KINDS in content/tables.ts. */
export type FoeKind = "levy" | "spear" | "axe" | "rider" | "elite";
export type Action = "strike" | "heavy" | "berserk" | "rally" | "guard" | "bash" | "flee";
export type Quality = "perfect" | "good" | "poor" | null;
export type PerkId = "str" | "skl" | "end" | "hoard";
export type Layout = "auto" | "phone" | "desktop";
export type LogClass = "" | "head" | "good" | "bad";

export interface Crew { n: string; hp: number; mx: number }
export interface LogLine { t: string; c: LogClass }
export interface Wound { id: WoundId; t: number }

export interface RunResult {
  k: EndingId;
  parts: [string, number][];
  bonus: number;
  total: number;
  pts: number;
  text: string;
  verse: string[] | null;
}

/** One raider's run. Saved as-is, so keep it plain data. */
export interface Game {
  name: string;
  ch: number;
  str: number; skl: number; end: number;
  hp: number; mor: number; rep: number; silver: number;
  wp: number; ar: number;
  kills: number; rank: number;
  nid: boolean;
  wounds: Wound[];
  eye: boolean;
  gods: Record<GodId, number>;
  /** Story flags set by events, e.g. rival, wife, thegn, ford, oath, son. */
  f: Record<string, number>;
  used: string[];
  log: LogLine[];
  crew: { L: Crew[]; R: Crew[] };
  phase: Phase;
  acts: number;
  jarl: boolean;
  ev: string | null;
  mid: boolean;
  lastEv: string | null;
  /** Hoard share and jarl's gift waiting on the after-battle screen. */
  loot?: number;
  gift?: number;
  res?: RunResult;
}

export interface Foe { n: string; hp: number; mx: number; atk: number; df: number; champ: boolean; kind: FoeKind }

export interface Swing {
  a: Action;
  pos: number; dir: 1 | -1; t: number;
  zone: [number, number];
  perf: [number, number];
}

export interface Battle {
  foes: Foe[];
  i: number;
  sta: number;
  kills: number;
  lost: string[];
  broken: boolean;
  round: number;
  champKilled: boolean;
  /** Push of the walls, -5 (ours breaks) to +5 (theirs breaks). */
  line: number;
  opened: boolean;
  /** His real next move. */
  intent: IntentId;
  /** Whether you can read him at all this round. */
  read: boolean;
  /** The move he shows you: the real one, or a different one when he feints. */
  shown: IntentId;
  feint: boolean;
  /** Whether you saw through the feint. */
  seen: boolean;
  prompt: string | null;
  prompts: number;
  swing: Swing | null;
  flash: string;
  pn?: string;
}

export interface Hunt {
  arrows: number; hits: number;
  pos: number; dir: 1 | -1; t: number;
  zone: [number, number];
  msg: string;
}

/** Persists across runs. */
export interface Legacy {
  pts: number;
  up: Record<PerkId, number>;
  seen: Record<string, boolean>;
  best: number;
  runs: number;
  fought: number;
  timing: boolean;
  /** Screen layout: automatic switches to the phone layout on narrow screens. */
  layout: Layout;
}

/* ---------- content ---------- */

export type MoodId = "dawn" | "day" | "grey" | "winter" | "dusk" | "night" | "storm";
export type SceneProp = [string, ...(string | number)[]];
export interface SceneSpec {
  mood: MoodId;
  water?: { y: number; kind: "sea" | "river" | "marsh" };
  ground: "hills" | "ridge" | "flat" | "cliff";
  props: SceneProp[];
}
export interface Chapter {
  year: number;
  place: string;
  title: string;
  text: string;
  /** [regular foe, champion]. Written as they read mid-sentence ("the thegn’s hearth-guard"). */
  foes: [string, string];
  foeCount: number;
  /** How the ordinary enemies and the champion fight. */
  foeKinds: [FoeKind, FoeKind];
  map: { x: number; y: number; lx: number; ly: number; anchor: "start" | "middle" | "end" };
  alt: string;
  scene: SceneSpec;
}

/** Conditions for an event or an option. All given fields must hold. */
export interface Cond {
  flags?: Record<string, number>;
  notFlags?: string[];
  minAge?: number;
  minKills?: number;
  maxWeapon?: number;
  minSilver?: number;
  nid?: boolean;
}

/** What happens when an option resolves. Text may use {lost}, {god}, {crewFirst}, {name}. */
export interface Outcome {
  text: string;
  rep?: number; mor?: number; hp?: number; silver?: number;
  str?: number; skl?: number; end?: number;
  /** Lose this fraction of your silver; the amount fills {lost}. */
  silverLoss?: number;
  /** Set flags; null removes one. */
  flags?: Record<string, number | null>;
  wound?: WoundId | "random";
  woundChance?: number;
  addCrew?: { name: string; hp: number; place: "leftFront" | "shortSide" };
  weapon?: number;
  favour?: "random";
  /** End the run with this ending. */
  endRun?: EndingId;
}

export interface EventOption {
  label: string;
  /** The option is shown but disabled unless this holds. */
  requires?: Cond;
  /** Silver paid up front. Also implies requires.minSilver. */
  pay?: number;
  /** A stat check; the odds are shown on the button. "fight" averages strength and skill. */
  check?: { stat: Stat | "fight"; diff: number };
  /** A plain percentage roll (not shown). */
  chance?: number;
  /** A deterministic branch: pass if this holds. */
  test?: Cond;
  pass: Outcome;
  fail?: Outcome;
}

export interface GameEvent {
  id: string;
  /** Inclusive chapter range, counting from 0. */
  chapters?: [number, number];
  minRank?: number;
  /** Priority events are drawn before any others when eligible. */
  priority?: boolean;
  repeatable?: boolean;
  when?: Cond;
  text: string;
  options: EventOption[];
}
