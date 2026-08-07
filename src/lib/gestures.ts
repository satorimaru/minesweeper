/** Shared touch / pointer gesture helpers for mobile board play. */

export type CellCoord = { row: number; col: number };

export type GestureKind = "tap" | "longpress" | "swipe" | "doubletap";

export interface GestureResult {
  kind: GestureKind;
  path: CellCoord[];
  start: CellCoord;
  end: CellCoord;
}

const LONG_PRESS_MS = 380;
const TAP_SLOP_PX = 14;
const SWIPE_MIN_CELLS = 2;
const DOUBLE_TAP_MS = 280;

export interface GestureControllerOptions {
  longPressMs?: number;
  onLongPress?: (cell: CellCoord) => void;
  onGesture?: (result: GestureResult) => void;
}

/**
 * Tracks pointer/touch from start to end and classifies:
 * - long press (fires early via onLongPress)
 * - tap / double tap
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
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lastTapAt = 0;
  private lastTapCell: CellCoord | null = null;
  private pointerId: number | null = null;

  constructor(opts: GestureControllerOptions = {}) {
    this.longPressMs = opts.longPressMs ?? LONG_PRESS_MS;
    this.onLongPress = opts.onLongPress;
    this.onGesture = opts.onGesture;
  }

  start(cell: CellCoord, x: number, y: number, pointerId: number): void {
    this.cancelTimer();
    this.active = true;
    this.longFired = false;
    this.startCell = cell;
    this.path = [cell];
    this.startX = x;
    this.startY = y;
    this.pointerId = pointerId;

    this.timer = setTimeout(() => {
      if (!this.active || !this.startCell || this.path.length !== 1) return;
      this.longFired = true;
      this.onLongPress?.(this.startCell);
    }, this.longPressMs);
  }

  move(cell: CellCoord, x: number, y: number, pointerId: number): void {
    if (!this.active || this.pointerId !== pointerId) return;
    const last = this.path[this.path.length - 1];
    if (last.row === cell.row && last.col === cell.col) return;

    // Leaving first cell cancels long-press
    if (this.path.length === 1) {
      this.cancelTimer();
    }

    this.path.push(cell);
    void x;
    void y;
  }

  end(x: number, y: number, pointerId: number): void {
    if (!this.active || this.pointerId !== pointerId) return;
    this.cancelTimer();
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
        this.onGesture?.({
          kind: "doubletap",
          path: [end],
          start: end,
          end,
        });
        this.lastTapAt = 0;
        this.lastTapCell = null;
      } else {
        this.onGesture?.({
          kind: "tap",
          path: [end],
          start: end,
          end,
        });
        this.lastTapAt = now;
        this.lastTapCell = end;
      }
    }

    this.startCell = null;
    this.path = [];
  }

  cancel(): void {
    this.cancelTimer();
    this.active = false;
    this.pointerId = null;
    this.startCell = null;
    this.path = [];
    this.longFired = false;
  }

  private cancelTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
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
