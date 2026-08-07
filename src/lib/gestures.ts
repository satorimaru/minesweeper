/** Shared touch / pointer gesture helpers for mobile board play. */

export type CellCoord = { row: number; col: number };

export type GestureKind = "tap" | "longpress" | "swipe" | "doubletap";

export interface GestureResult {
  kind: GestureKind;
  path: CellCoord[];
  start: CellCoord;
  end: CellCoord;
}

const LONG_PRESS_MS = 450;
const TAP_SLOP_PX = 14;
const SWIPE_MIN_CELLS = 2;
/** Wait this long before committing a single-tap so double-tap can win. */
const DOUBLE_TAP_MS = 260;

export interface GestureControllerOptions {
  longPressMs?: number;
  onLongPress?: (cell: CellCoord) => void;
  onGesture?: (result: GestureResult) => void;
}

/**
 * Tracks pointer/touch from start to end and classifies:
 * - long press (optional, fires early via onLongPress)
 * - single tap (deferred so double-tap can cancel it)
 * - double tap
 * - swipe path across cells
 */
export class BoardGestureController {
  private longPressMs: number;
  private onLongPress?: (cell: CellCoord) => void;
  private onGesture?: (result: GestureResult) => void;

  private active = false;
  private longFired = false;
  private startCell: CellCoord | null = null;
  private path: CellCoord[] = [];
  private startX = 0;
  private startY = 0;
  private longTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingTapTimer: ReturnType<typeof setTimeout> | null = null;
  private lastTapAt = 0;
  private lastTapCell: CellCoord | null = null;
  private pointerId: number | null = null;

  constructor(opts: GestureControllerOptions = {}) {
    this.longPressMs = opts.longPressMs ?? LONG_PRESS_MS;
    this.onLongPress = opts.onLongPress;
    this.onGesture = opts.onGesture;
  }

  start(cell: CellCoord, x: number, y: number, pointerId: number): void {
    // New press cancels a pending single-tap only if it's a double-tap candidate
    // (handled in end). Don't cancel long-press timer setup here incorrectly.
    this.cancelLongTimer();
    this.active = true;
    this.longFired = false;
    this.startCell = cell;
    this.path = [cell];
    this.startX = x;
    this.startY = y;
    this.pointerId = pointerId;

    if (this.onLongPress) {
      this.longTimer = setTimeout(() => {
        if (!this.active || !this.startCell || this.path.length !== 1) return;
        this.longFired = true;
        // Cancel any deferred single-tap — long press wins
        this.cancelPendingTap();
        this.lastTapAt = 0;
        this.lastTapCell = null;
        this.onLongPress?.(this.startCell);
      }, this.longPressMs);
    }
  }

  move(cell: CellCoord, x: number, y: number, pointerId: number): void {
    if (!this.active || this.pointerId !== pointerId) return;
    const last = this.path[this.path.length - 1];
    if (last.row === cell.row && last.col === cell.col) return;

    // Leaving first cell cancels long-press
    if (this.path.length === 1) {
      this.cancelLongTimer();
    }

    this.path.push(cell);
    void x;
    void y;
  }

  end(x: number, y: number, pointerId: number): void {
    if (!this.active || this.pointerId !== pointerId) return;
    this.cancelLongTimer();
    this.active = false;
    this.pointerId = null;

    if (!this.startCell || this.path.length === 0) return;

    // Long press already handled
    if (this.longFired) {
      this.startCell = null;
      this.path = [];
      return;
    }

    const dx = Math.abs(x - this.startX);
    const dy = Math.abs(y - this.startY);
    const unique = uniquePath(this.path);
    const end = unique[unique.length - 1];

    if (unique.length >= SWIPE_MIN_CELLS) {
      // Swipe cancels a pending single-tap
      this.cancelPendingTap();
      this.lastTapAt = 0;
      this.lastTapCell = null;
      this.onGesture?.({
        kind: "swipe",
        path: unique,
        start: this.startCell,
        end,
      });
    } else if (dx <= TAP_SLOP_PX && dy <= TAP_SLOP_PX) {
      const now = Date.now();
      const isDouble =
        this.lastTapCell &&
        this.lastTapCell.row === end.row &&
        this.lastTapCell.col === end.col &&
        now - this.lastTapAt <= DOUBLE_TAP_MS;

      if (isDouble) {
        // Second tap of a double — kill deferred single-tap, fire doubletap
        this.cancelPendingTap();
        this.onGesture?.({
          kind: "doubletap",
          path: [end],
          start: end,
          end,
        });
        this.lastTapAt = 0;
        this.lastTapCell = null;
      } else {
        // Defer single-tap so a quick second tap can become doubletap
        this.cancelPendingTap();
        this.lastTapAt = now;
        this.lastTapCell = end;
        const tapEnd = end;
        this.pendingTapTimer = setTimeout(() => {
          this.pendingTapTimer = null;
          this.onGesture?.({
            kind: "tap",
            path: [tapEnd],
            start: tapEnd,
            end: tapEnd,
          });
          this.lastTapAt = 0;
          this.lastTapCell = null;
        }, DOUBLE_TAP_MS);
      }
    }

    this.startCell = null;
    this.path = [];
  }

  cancel(): void {
    this.cancelLongTimer();
    this.cancelPendingTap();
    this.active = false;
    this.pointerId = null;
    this.startCell = null;
    this.path = [];
    this.longFired = false;
  }

  private cancelLongTimer(): void {
    if (this.longTimer) {
      clearTimeout(this.longTimer);
      this.longTimer = null;
    }
  }

  private cancelPendingTap(): void {
    if (this.pendingTapTimer) {
      clearTimeout(this.pendingTapTimer);
      this.pendingTapTimer = null;
    }
  }
}

function uniquePath(path: CellCoord[]): CellCoord[] {
  const out: CellCoord[] = [];
  const seen = new Set<string>();
  for (const c of path) {
    const k = `${c.row},${c.col}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(c);
  }
  return out;
}
