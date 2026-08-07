import { mulberry32 } from "@/lib/prng";
import type {
  Board,
  BoardConfig,
  Cell,
  GameMode,
  PowerUpId,
} from "./types";
import { isInventoryPower, startingLives } from "./types";

function inBounds(config: BoardConfig, row: number, col: number): boolean {
  return row >= 0 && row < config.height && col >= 0 && col < config.width;
}

function neighbors(
  config: BoardConfig,
  row: number,
  col: number,
): [number, number][] {
  const out: [number, number][] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const r = row + dr;
      const c = col + dc;
      if (inBounds(config, r, c)) out.push([r, c]);
    }
  }
  return out;
}

function pickPowerType(rng: () => number, mode: GameMode): PowerUpId {
  const roll = rng();
  if (mode === "chaos") {
    if (roll < 0.18) return "blast";
    if (roll < 0.3) return "rocket_row";
    if (roll < 0.42) return "rocket_col";
    if (roll < 0.54) return "radar";
    if (roll < 0.66) return "shield";
    if (roll < 0.8) return "chaos";
    if (roll < 0.9) return "nuke";
    return "freeze";
  }
  // solo / multiplayer base mix
  if (roll < 0.22) return "blast";
  if (roll < 0.34) return "rocket_row";
  if (roll < 0.46) return "rocket_col";
  if (roll < 0.58) return "radar";
  if (roll < 0.72) return "shield";
  if (roll < 0.84) return "chaos";
  if (roll < 0.94) return "nuke";
  return "freeze";
}

function placePowerUps(
  cells: Cell[][],
  config: BoardConfig,
  rng: () => number,
  mode: GameMode,
): void {
  const safe: Cell[] = [];
  for (const row of cells) {
    for (const cell of row) {
      if (!cell.isMine) safe.push(cell);
    }
  }
  if (safe.length === 0) return;

  for (let i = safe.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [safe[i], safe[j]] = [safe[j], safe[i]];
  }

  const density = mode === "chaos" ? 0.1 : 0.065;
  const target = Math.min(
    mode === "chaos" ? 14 : 10,
    Math.max(3, Math.round(safe.length * density)),
  );
  const minDist = config.width >= 12 ? 2 : 1;

  // Guarantee one inventory power early
  safe[0].powerUp = rng() < 0.55 ? "nuke" : "freeze";
  const placed: Cell[] = [safe[0]];

  for (let i = 1; i < safe.length; i++) {
    if (placed.length >= target) break;
    const cell = safe[i];
    const tooClose = placed.some(
      (p) =>
        Math.abs(p.row - cell.row) <= minDist &&
        Math.abs(p.col - cell.col) <= minDist,
    );
    if (tooClose) continue;

    cell.powerUp = pickPowerType(rng, mode);
    placed.push(cell);
  }
}

/**
 * Deterministic board from seed so multiplayer opponents share the same layout.
 */
export function generateBoard(
  config: BoardConfig,
  seed: number,
  mode: GameMode = "solo",
): Board {
  const rng = mulberry32(seed);
  const cells: Cell[][] = [];

  for (let row = 0; row < config.height; row++) {
    const line: Cell[] = [];
    for (let col = 0; col < config.width; col++) {
      line.push({
        row,
        col,
        isMine: false,
        adjacent: 0,
        state: "hidden",
        powerUp: null,
        powerFlash: null,
        justOpened: false,
      });
    }
    cells.push(line);
  }

  const total = config.width * config.height;
  const indices = Array.from({ length: total }, (_, i) => i);

  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  // Chaos mode: slightly denser mines for drama
  let mineCount = Math.min(config.mineCount, total - 1);
  if (mode === "chaos") {
    mineCount = Math.min(total - 1, Math.round(mineCount * 1.15));
  }

  for (let i = 0; i < mineCount; i++) {
    const idx = indices[i];
    const row = Math.floor(idx / config.width);
    const col = idx % config.width;
    cells[row][col].isMine = true;
  }

  // Reflect actual mine count on a copy of config for scoring
  const effectiveConfig: BoardConfig = {
    ...config,
    mineCount,
  };

  for (let row = 0; row < config.height; row++) {
    for (let col = 0; col < config.width; col++) {
      if (cells[row][col].isMine) continue;
      let count = 0;
      for (const [r, c] of neighbors(effectiveConfig, row, col)) {
        if (cells[r][c].isMine) count++;
      }
      cells[row][col].adjacent = count;
    }
  }

  placePowerUps(cells, effectiveConfig, rng, mode);

  return {
    config: effectiveConfig,
    seed,
    cells,
    openedCount: 0,
    flagCount: 0,
    mineHits: 0,
    shieldCharges: mode === "chaos" ? 1 : 0,
    lives: startingLives(mode),
    score: 0,
    combo: 0,
    maxCombo: 0,
    lastActionAt: 0,
    inventory: {},
    armedPower: null,
    status: "playing",
    explodedAt: null,
    lastPowerMessage: null,
    pendingSabotage: null,
    floaters: [],
    floaterSeq: 0,
  };
}

export { neighbors, inBounds, isInventoryPower };
