import { neighbors, inBounds } from "./generate";
import type {
  Board,
  Cell,
  FloatingScore,
  GameMode,
  InventoryPowerId,
  PowerUpId,
  SabotageType,
} from "./types";
import {
  isInventoryPower,
  playSoftMines,
  POWER_UP_LABELS,
  safeCellCount,
} from "./types";

const COMBO_WINDOW_MS = 1400;
const NUKE_RADIUS = 2;
const CELL_POINTS = 12;
const COMBO_BONUS = 8;
const POWER_POINTS = 40;
const MINE_PENALTY = 80;

function cloneBoard(board: Board): Board {
  return {
    ...board,
    inventory: { ...board.inventory },
    explodedAt: board.explodedAt ? { ...board.explodedAt } : null,
    config: { ...board.config },
    cells: board.cells.map((row) =>
      row.map((cell) => ({ ...cell, justOpened: false })),
    ),
    floaters: [],
    pendingSabotage: null,
  };
}

function pushFloater(
  board: Board,
  row: number,
  col: number,
  text: string,
  kind: FloatingScore["kind"],
): void {
  board.floaterSeq += 1;
  board.floaters.push({
    id: board.floaterSeq,
    row,
    col,
    text,
    kind,
  });
  // Cap so UI never floods
  if (board.floaters.length > 12) {
    board.floaters = board.floaters.slice(-12);
  }
}

function bumpCombo(board: Board, now: number): void {
  if (now - board.lastActionAt <= COMBO_WINDOW_MS && board.combo > 0) {
    board.combo += 1;
  } else {
    board.combo = 1;
  }
  board.lastActionAt = now;
  board.maxCombo = Math.max(board.maxCombo, board.combo);
}

function awardOpen(board: Board, cell: Cell, now: number): void {
  bumpCombo(board, now);
  const pts = CELL_POINTS + (board.combo - 1) * COMBO_BONUS;
  board.score += pts;
  if (board.combo >= 3) {
    pushFloater(board, cell.row, cell.col, `×${board.combo}`, "combo");
  } else {
    pushFloater(board, cell.row, cell.col, `+${pts}`, "score");
  }
}

function openFlood(board: Board, startRow: number, startCol: number, now: number): number {
  const stack: [number, number][] = [[startRow, startCol]];
  let opened = 0;

  while (stack.length > 0) {
    const [row, col] = stack.pop()!;
    const cell = board.cells[row][col];
    if (cell.state === "open" || cell.state === "flagged" || cell.isMine) continue;

    cell.state = "open";
    cell.justOpened = true;
    board.openedCount++;
    opened++;
    awardOpen(board, cell, now);

    if (cell.adjacent === 0) {
      for (const [r, c] of neighbors(board.config, row, col)) {
        const n = board.cells[r][c];
        if (n.state === "hidden" && !n.isMine) {
          stack.push([r, c]);
        }
      }
    }
  }

  return opened;
}

function openSafeCell(board: Board, row: number, col: number, now: number): number {
  const cell = board.cells[row][col];
  if (cell.state !== "hidden" || cell.isMine) return 0;
  if (cell.adjacent === 0) {
    return openFlood(board, row, col, now);
  }
  cell.state = "open";
  cell.justOpened = true;
  board.openedCount++;
  awardOpen(board, cell, now);
  return 1;
}

function checkWin(board: Board): void {
  if (board.openedCount >= safeCellCount(board.config)) {
    board.status = "won";
    const clearBonus = 250 + board.maxCombo * 15;
    board.score += clearBonus;
    pushFloater(
      board,
      Math.floor(board.config.height / 2),
      Math.floor(board.config.width / 2),
      `CLEAR +${clearBonus}`,
      "combo",
    );
    for (const line of board.cells) {
      for (const c of line) {
        if (c.isMine && c.state === "hidden") {
          c.state = "flagged";
          board.flagCount++;
        }
      }
    }
  }
}

function applyBlast(board: Board, centerRow: number, centerCol: number, now: number): string {
  let n = 0;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const r = centerRow + dr;
      const c = centerCol + dc;
      if (!inBounds(board.config, r, c)) continue;
      const cell = board.cells[r][c];
      if (cell.state !== "hidden" || cell.isMine) continue;
      n += openSafeCell(board, r, c, now);
    }
  }
  return `💥 Blast! Opened ${n} cells.`;
}

function applyRocketRow(board: Board, row: number, now: number): string {
  let n = 0;
  for (let col = 0; col < board.config.width; col++) {
    const cell = board.cells[row][col];
    if (cell.state === "hidden" && !cell.isMine) {
      n += openSafeCell(board, row, col, now);
    }
  }
  return `➡️ Row Rocket! Cleared ${n} cells.`;
}

function applyRocketCol(board: Board, col: number, now: number): string {
  let n = 0;
  for (let row = 0; row < board.config.height; row++) {
    const cell = board.cells[row][col];
    if (cell.state === "hidden" && !cell.isMine) {
      n += openSafeCell(board, row, col, now);
    }
  }
  return `⬇️ Col Rocket! Cleared ${n} cells.`;
}

function applyRadar(board: Board, centerRow: number, centerCol: number): string {
  const candidates: Cell[] = [];
  for (let dr = -2; dr <= 2; dr++) {
    for (let dc = -2; dc <= 2; dc++) {
      const r = centerRow + dr;
      const c = centerCol + dc;
      if (!inBounds(board.config, r, c)) continue;
      const cell = board.cells[r][c];
      if (cell.state === "hidden") candidates.push(cell);
    }
  }

  let flagged = 0;
  for (const cell of candidates) {
    if (cell.isMine && cell.state === "hidden") {
      cell.state = "flagged";
      board.flagCount++;
      flagged++;
    }
  }
  return flagged > 0
    ? `📡 Radar! Flagged ${flagged} mine${flagged === 1 ? "" : "s"}.`
    : `📡 Radar! No mines in range.`;
}

function applyShield(board: Board): string {
  board.shieldCharges += 1;
  return `🛡️ Shield ready! Next mine is free.`;
}

function applyChaos(board: Board, now: number): string {
  const hiddenSafe: Cell[] = [];
  for (const line of board.cells) {
    for (const cell of line) {
      if (cell.state === "hidden" && !cell.isMine) hiddenSafe.push(cell);
    }
  }
  // shuffle pick up to 5
  for (let i = hiddenSafe.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [hiddenSafe[i], hiddenSafe[j]] = [hiddenSafe[j], hiddenSafe[i]];
  }
  const pick = hiddenSafe.slice(0, Math.min(5, hiddenSafe.length));
  let n = 0;
  for (const cell of pick) {
    n += openSafeCell(board, cell.row, cell.col, now);
  }
  return `🌀 Chaos Pop! ${n} random cells popped.`;
}

function addToInventory(board: Board, id: InventoryPowerId): void {
  board.inventory[id] = (board.inventory[id] ?? 0) + 1;
}

function detonateNuke(
  board: Board,
  centerRow: number,
  centerCol: number,
  now: number,
): string {
  let cleared = 0;
  let neutralized = 0;
  const r = NUKE_RADIUS;

  for (let dr = -r; dr <= r; dr++) {
    for (let dc = -r; dc <= r; dc++) {
      const row = centerRow + dr;
      const col = centerCol + dc;
      if (!inBounds(board.config, row, col)) continue;
      const cell = board.cells[row][col];

      if (cell.isMine) {
        if (cell.state === "hidden") {
          cell.state = "flagged";
          board.flagCount++;
          neutralized++;
        }
        continue;
      }

      if (cell.state === "hidden") {
        cleared += openSafeCell(board, row, col, now);
      } else if (cell.state === "flagged" && !cell.isMine) {
        cell.state = "hidden";
        board.flagCount--;
        cleared += openSafeCell(board, row, col, now);
      }
    }
  }

  return `☢️ Nuke! Cleared ${cleared}, neutralized ${neutralized}.`;
}

function applyInstantPower(
  board: Board,
  power: PowerUpId,
  row: number,
  col: number,
  now: number,
): void {
  let msg: string;
  switch (power) {
    case "blast":
      msg = applyBlast(board, row, col, now);
      break;
    case "rocket_row":
      msg = applyRocketRow(board, row, now);
      break;
    case "rocket_col":
      msg = applyRocketCol(board, col, now);
      break;
    case "radar":
      msg = applyRadar(board, row, col);
      break;
    case "shield":
      msg = applyShield(board);
      break;
    case "chaos":
      msg = applyChaos(board, now);
      break;
    case "nuke":
      addToInventory(board, "nuke");
      msg = `☢️ Nuke bagged — arm it then tap!`;
      break;
    case "freeze":
      addToInventory(board, "freeze");
      msg = `❄️ Freeze ready — use in Versus to ice a rival!`;
      break;
  }
  board.score += POWER_POINTS;
  board.lastPowerMessage = msg;
  pushFloater(board, row, col, POWER_UP_LABELS[power], "power");
}

function collectPowersFromOpenCells(board: Board, now: number, depth = 0): void {
  if (depth > 10) return;

  const toCollect: { row: number; col: number; power: PowerUpId }[] = [];
  for (const line of board.cells) {
    for (const cell of line) {
      if (cell.state === "open" && cell.powerUp) {
        toCollect.push({ row: cell.row, col: cell.col, power: cell.powerUp });
      }
    }
  }

  if (toCollect.length === 0) return;

  for (const { row, col, power } of toCollect) {
    const cell = board.cells[row][col];
    if (!cell.powerUp) continue;
    cell.powerUp = null;
    cell.powerFlash = power;

    if (isInventoryPower(power)) {
      addToInventory(board, power);
      board.score += POWER_POINTS;
      board.lastPowerMessage =
        power === "nuke"
          ? "☢️ Nuke collected! Arm it, then tap a cell."
          : "❄️ Freeze collected! Arm & tap to sabotage (Versus).";
      pushFloater(board, row, col, POWER_UP_LABELS[power], "power");
    } else {
      applyInstantPower(board, power, row, col, now);
    }
  }

  collectPowersFromOpenCells(board, now, depth + 1);
}

function hitMine(
  board: Board,
  row: number,
  col: number,
  mode: GameMode,
): Board {
  const cell = board.cells[row][col];
  cell.state = "open";
  cell.justOpened = true;
  board.explodedAt = { row, col };
  board.combo = 0;

  if (board.shieldCharges > 0) {
    board.shieldCharges -= 1;
    board.lastPowerMessage = "🛡️ Shield blocked the blast!";
    pushFloater(board, row, col, "BLOCKED", "power");
    return board;
  }

  board.mineHits += 1;
  board.score = Math.max(0, board.score - MINE_PENALTY);
  pushFloater(board, row, col, `−${MINE_PENALTY}`, "hit");

  if (playSoftMines(mode)) {
    board.lives = Math.max(0, board.lives - 1);
    board.lastPowerMessage =
      board.lives > 0
        ? `💥 Boom! ${board.lives} life${board.lives === 1 ? "" : "s"} left.`
        : "💥 Out of lives!";
    if (board.lives <= 0 && mode !== "versus") {
      board.status = "lost";
      for (const line of board.cells) {
        for (const c of line) {
          if (c.isMine) c.state = "open";
        }
      }
    }
    // Versus: never hard-lose — keep racing with score damage
    return board;
  }

  // Hard fail solo
  board.lives = 0;
  board.status = "lost";
  board.lastPowerMessage = "💥 Boom! Game over.";
  for (const line of board.cells) {
    for (const c of line) {
      if (c.isMine) c.state = "open";
    }
  }
  return board;
}

export function revealCell(
  board: Board,
  row: number,
  col: number,
  mode: GameMode = "solo",
  now = Date.now(),
): Board {
  if (board.status !== "playing") return board;

  if (board.armedPower) {
    return useArmedPowerAt(board, row, col, mode, now);
  }

  const next = cloneBoard(board);
  next.lastPowerMessage = null;
  const cell = next.cells[row][col];
  if (cell.state !== "hidden") return board;

  if (cell.isMine) {
    return hitMine(next, row, col, mode);
  }

  openFlood(next, row, col, now);
  collectPowersFromOpenCells(next, now);
  checkWin(next);
  return next;
}

/** Swipe-paint reveal along a path of cells (unique). */
export function revealPath(
  board: Board,
  path: { row: number; col: number }[],
  mode: GameMode = "solo",
  now = Date.now(),
): Board {
  if (board.status !== "playing" || path.length === 0) return board;
  if (board.armedPower) {
    const last = path[path.length - 1];
    return useArmedPowerAt(board, last.row, last.col, mode, now);
  }

  let next = board;
  const seen = new Set<string>();
  for (const { row, col } of path) {
    const key = `${row},${col}`;
    if (seen.has(key)) continue;
    seen.add(key);
    next = revealCell(next, row, col, mode, now);
    if (next.status !== "playing") break;
  }
  return next;
}

export function toggleFlag(board: Board, row: number, col: number): Board {
  if (board.status !== "playing") return board;
  if (board.armedPower) return board;

  const next = cloneBoard(board);
  next.lastPowerMessage = null;
  const cell = next.cells[row][col];
  if (cell.state === "open") return board;

  if (cell.state === "flagged") {
    cell.state = "hidden";
    next.flagCount--;
  } else {
    cell.state = "flagged";
    next.flagCount++;
  }
  return next;
}

/** Swipe-paint flags along a path. */
export function flagPath(
  board: Board,
  path: { row: number; col: number }[],
): Board {
  if (board.status !== "playing" || path.length === 0) return board;
  let next = board;
  const seen = new Set<string>();
  for (const { row, col } of path) {
    const key = `${row},${col}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const cell = next.cells[row][col];
    if (cell.state === "hidden") {
      next = toggleFlag(next, row, col);
    }
  }
  return next;
}

export function chordCell(
  board: Board,
  row: number,
  col: number,
  mode: GameMode = "solo",
  now = Date.now(),
): Board {
  if (board.status !== "playing") return board;
  if (board.armedPower) return board;

  const cell = board.cells[row][col];
  if (cell.state !== "open" || cell.adjacent === 0) return board;

  let flags = 0;
  const hidden: Cell[] = [];
  for (const [r, c] of neighbors(board.config, row, col)) {
    const n = board.cells[r][c];
    if (n.state === "flagged") flags++;
    else if (n.state === "hidden") hidden.push(n);
  }
  if (flags !== cell.adjacent || hidden.length === 0) return board;

  let next = board;
  for (const n of hidden) {
    next = revealCell(next, n.row, n.col, mode, now);
    if (next.status !== "playing") break;
  }
  return next;
}

export function setArmedPower(
  board: Board,
  power: InventoryPowerId | null,
): Board {
  if (board.status !== "playing") return board;
  const next = cloneBoard(board);

  if (power === null) {
    next.armedPower = null;
    next.lastPowerMessage = "Disarmed.";
    return next;
  }

  const count = next.inventory[power] ?? 0;
  if (count <= 0) {
    next.lastPowerMessage = `No ${POWER_UP_LABELS[power]} in inventory.`;
    return next;
  }

  if (next.armedPower === power) {
    next.armedPower = null;
    next.lastPowerMessage = "Disarmed.";
    return next;
  }

  next.armedPower = power;
  next.lastPowerMessage =
    power === "nuke"
      ? "☢️ Nuke armed — tap a cell (5×5)."
      : "❄️ Freeze armed — tap board to launch at rival.";
  return next;
}

export function useArmedPowerAt(
  board: Board,
  row: number,
  col: number,
  mode: GameMode = "solo",
  now = Date.now(),
): Board {
  if (board.status !== "playing") return board;
  const power = board.armedPower;
  if (!power) return board;

  const count = board.inventory[power] ?? 0;
  if (count <= 0) {
    const next = cloneBoard(board);
    next.armedPower = null;
    next.lastPowerMessage = "Nothing to use.";
    return next;
  }

  const next = cloneBoard(board);
  next.inventory[power] = count - 1;
  if ((next.inventory[power] ?? 0) <= 0) {
    delete next.inventory[power];
  }
  next.armedPower = null;
  next.lastPowerMessage = null;

  if (power === "nuke") {
    next.lastPowerMessage = detonateNuke(next, row, col, now);
    collectPowersFromOpenCells(next, now);
    checkWin(next);
  } else if (power === "freeze") {
    if (mode === "versus") {
      next.pendingSabotage = "freeze";
      next.lastPowerMessage = "❄️ Freeze launched at rival!";
      next.score += 25;
      pushFloater(next, row, col, "FREEZE!", "power");
    } else {
      // Solo: freezes combo decay by refreshing window + small bonus
      next.lastActionAt = now;
      next.combo = Math.max(next.combo, 2);
      next.lastPowerMessage = "❄️ Combo frozen in place!";
      next.score += 30;
      pushFloater(next, row, col, "CHILL", "power");
    }
  }

  return next;
}

/** Apply an incoming sabotage from opponent. */
export function applySabotage(
  board: Board,
  type: SabotageType,
  now = Date.now(),
): Board {
  if (board.status !== "playing") return board;
  const next = cloneBoard(board);

  switch (type) {
    case "freeze": {
      next.combo = 0;
      next.lastActionAt = 0;
      next.lastPowerMessage = "❄️ Opponent froze your combo!";
      pushFloater(
        next,
        Math.floor(next.config.height / 2),
        Math.floor(next.config.width / 2),
        "FROZEN",
        "hit",
      );
      break;
    }
    case "fog": {
      // Re-hide a few opened safe non-zero cells for confusion
      const opened: Cell[] = [];
      for (const line of next.cells) {
        for (const cell of line) {
          if (
            cell.state === "open" &&
            !cell.isMine &&
            cell.adjacent > 0 &&
            !cell.powerUp
          ) {
            opened.push(cell);
          }
        }
      }
      for (let i = opened.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [opened[i], opened[j]] = [opened[j], opened[i]];
      }
      const fogCount = Math.min(4, opened.length);
      for (let i = 0; i < fogCount; i++) {
        const cell = opened[i];
        cell.state = "hidden";
        cell.justOpened = false;
        next.openedCount = Math.max(0, next.openedCount - 1);
      }
      next.lastPowerMessage = "🌫️ Fog! Some cells vanished.";
      break;
    }
    case "shake": {
      next.score = Math.max(0, next.score - 40);
      next.combo = 0;
      next.lastPowerMessage = "📳 Screen shake sabotage −40!";
      pushFloater(
        next,
        Math.floor(next.config.height / 2),
        Math.floor(next.config.width / 2),
        "−40",
        "hit",
      );
      break;
    }
  }

  void now;
  return next;
}

export function clearPowerMessage(board: Board): Board {
  if (!board.lastPowerMessage && board.floaters.length === 0) return board;
  return { ...board, lastPowerMessage: null, floaters: [] };
}

export function clearCellFlashes(board: Board): Board {
  let changed = false;
  const cells = board.cells.map((row) =>
    row.map((cell) => {
      if (cell.powerFlash || cell.justOpened) {
        changed = true;
        return { ...cell, powerFlash: null, justOpened: false };
      }
      return cell;
    }),
  );
  if (!changed) return board;
  return { ...board, cells };
}
