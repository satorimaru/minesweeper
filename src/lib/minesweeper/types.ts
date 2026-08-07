export type Difficulty = "beginner" | "intermediate" | "expert";

export type CellState = "hidden" | "open" | "flagged";

/** How the session is played */
export type GameMode = "solo" | "chaos" | "versus" | "coop";

/** Instant on pickup */
export type InstantPowerId =
  | "blast"
  | "rocket_row"
  | "rocket_col"
  | "radar"
  | "shield"
  | "chaos";

/** Stored in inventory; arm then tap / swipe to use */
export type InventoryPowerId = "nuke" | "freeze";

export type PowerUpId = InstantPowerId | InventoryPowerId;

export interface Cell {
  row: number;
  col: number;
  isMine: boolean;
  adjacent: number;
  state: CellState;
  /** Pickup under this safe cell; cleared when collected. */
  powerUp: PowerUpId | null;
  /** Set after collecting a power-up for a brief UI flash. */
  powerFlash: PowerUpId | null;
  /** Visual pulse when opened as part of a cascade / power. */
  justOpened: boolean;
}

export interface BoardConfig {
  width: number;
  height: number;
  mineCount: number;
}

export type Inventory = Partial<Record<InventoryPowerId, number>>;

export interface FloatingScore {
  id: number;
  row: number;
  col: number;
  text: string;
  kind: "score" | "combo" | "power" | "hit";
}

export interface Board {
  config: BoardConfig;
  seed: number;
  cells: Cell[][];
  openedCount: number;
  flagCount: number;
  mineHits: number;
  shieldCharges: number;
  lives: number;
  score: number;
  combo: number;
  maxCombo: number;
  lastActionAt: number;
  inventory: Inventory;
  armedPower: InventoryPowerId | null;
  status: "playing" | "won" | "lost";
  explodedAt: { row: number; col: number } | null;
  lastPowerMessage: string | null;
  /** Pending sabotage to send to opponent (versus). Cleared by UI after send. */
  pendingSabotage: SabotageType | null;
  floaters: FloatingScore[];
  floaterSeq: number;
}

export type SabotageType = "freeze" | "fog" | "shake";

export const DIFFICULTIES: Record<
  Difficulty,
  BoardConfig & { label: string; subtitle: string }
> = {
  beginner: {
    label: "Spark",
    subtitle: "9×9 · chill",
    width: 9,
    height: 9,
    mineCount: 10,
  },
  intermediate: {
    label: "Blaze",
    subtitle: "12×12 · spicy",
    width: 12,
    height: 12,
    mineCount: 22,
  },
  expert: {
    label: "Inferno",
    subtitle: "16×16 · wild",
    width: 16,
    height: 16,
    mineCount: 40,
  },
};

/** Phone-friendly sizes — wider boards scroll horizontally if needed. */
export const GAME_MODE_META: Record<
  GameMode,
  { label: string; blurb: string; emoji: string; online: boolean }
> = {
  solo: {
    label: "Solo Crush",
    blurb: "Classic clear with combos & power-ups",
    emoji: "💎",
    online: false,
  },
  chaos: {
    label: "Chaos Run",
    blurb: "Extra lives, denser loot, pure candy-crush energy",
    emoji: "🌪️",
    online: false,
  },
  versus: {
    label: "Versus",
    blurb: "Same board race — sabotage your rival",
    emoji: "⚔️",
    online: true,
  },
  coop: {
    label: "Co-op",
    blurb: "Shared lives, combined score — clear together",
    emoji: "🤝",
    online: true,
  },
};

export const POWER_UP_LABELS: Record<PowerUpId, string> = {
  blast: "Blast",
  rocket_row: "Row Rocket",
  rocket_col: "Col Rocket",
  radar: "Radar",
  shield: "Shield",
  chaos: "Chaos Pop",
  nuke: "Nuke",
  freeze: "Freeze",
};

export const POWER_UP_ICONS: Record<PowerUpId, string> = {
  blast: "💥",
  rocket_row: "➡️",
  rocket_col: "⬇️",
  radar: "📡",
  shield: "🛡️",
  chaos: "🌀",
  nuke: "☢️",
  freeze: "❄️",
};

export const POWER_UP_COLORS: Record<PowerUpId, string> = {
  blast: "#f97316",
  rocket_row: "#38bdf8",
  rocket_col: "#a78bfa",
  radar: "#34d399",
  shield: "#60a5fa",
  chaos: "#f472b6",
  nuke: "#fbbf24",
  freeze: "#67e8f9",
};

export function isInventoryPower(id: PowerUpId): id is InventoryPowerId {
  return id === "nuke" || id === "freeze";
}

export function safeCellCount(config: BoardConfig): number {
  return config.width * config.height - config.mineCount;
}

export function startingLives(mode: GameMode): number {
  switch (mode) {
    case "chaos":
      return 3;
    case "versus":
      return 99; // soft hits only — score penalty, no hard fail
    case "coop":
      return 3; // team lives tracked server-side; local display uses this
    case "solo":
    default:
      return 1;
  }
}

export function playSoftMines(mode: GameMode): boolean {
  return mode === "versus" || mode === "chaos" || mode === "coop";
}
