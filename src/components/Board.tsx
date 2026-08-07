"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Board as BoardModel, FloatingScore, GameMode } from "@/lib/minesweeper";
import {
  chordCell,
  flagPath,
  revealCell,
  revealPath,
  toggleFlag,
} from "@/lib/minesweeper";
import { BoardGestureController } from "@/lib/gestures";
import { CellView } from "./Cell";

/** Pixel gap between cells — keep in sync with grid style. */
const GAP_PX = 2;
const PAD_PX = 2;

interface BoardProps {
  board: BoardModel;
  mode: GameMode;
  /** When true, swipe paints opens instead of flags. */
  openSwipe: boolean;
  disabled?: boolean;
  onChange: (next: BoardModel) => void;
}

export function Board({
  board,
  mode,
  openSwipe,
  disabled,
  onChange,
}: BoardProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [cellSize, setCellSize] = useState(32);
  const [shake, setShake] = useState(false);
  const boardRef = useRef(board);
  boardRef.current = board;

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const modeRef = useRef(mode);
  modeRef.current = mode;

  const openSwipeRef = useRef(openSwipe);
  openSwipeRef.current = openSwipe;

  const disabledRef = useRef(!!disabled);
  disabledRef.current = !!disabled;

  // Fit entire grid into available width AND height (account for gaps)
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const measure = () => {
      const cols = board.config.width;
      const rows = board.config.height;
      const w = el.clientWidth;
      const h = el.clientHeight;

      // total = n * cell + (n - 1) * gap + 2 * pad
      const sizeFor = (space: number, n: number) => {
        if (space <= 0 || n <= 0) return 8;
        const usable = space - PAD_PX * 2 - GAP_PX * Math.max(0, n - 1);
        return Math.floor(usable / n);
      };

      const byW = sizeFor(w, cols);
      const byH = sizeFor(h > 0 ? h : w, rows);
      // Prefer the tighter constraint so nothing is clipped
      const size = Math.max(14, Math.min(byW, byH, 52));
      setCellSize(size);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    // Re-measure after layout settles (flex parents)
    const t = requestAnimationFrame(measure);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(t);
    };
  }, [board.config.width, board.config.height]);

  // Shake when mine hit
  useEffect(() => {
    if (board.explodedAt) {
      setShake(true);
      const t = setTimeout(() => setShake(false), 450);
      return () => clearTimeout(t);
    }
  }, [board.explodedAt, board.mineHits]);

  const controller = useMemo(
    () =>
      new BoardGestureController({
        // No long-press action — single tap flags, double-tap opens
        onGesture: (g) => {
          if (disabledRef.current) return;
          const b = boardRef.current;
          const m = modeRef.current;
          let next = b;

          if (g.kind === "swipe") {
            // Default swipe paints flags; open-swipe mode paints reveals
            next = openSwipeRef.current
              ? revealPath(b, g.path, m)
              : flagPath(b, g.path);
          } else if (g.kind === "doubletap") {
            const cell = b.cells[g.end.row][g.end.col];
            if (cell.state === "open") {
              next = chordCell(b, g.end.row, g.end.col, m);
            } else if (cell.state === "flagged") {
              // Double-tap a flag: unflag then open (or just open via reveal after unflag)
              let cleared = toggleFlag(b, g.end.row, g.end.col);
              next = revealCell(cleared, g.end.row, g.end.col, m);
            } else {
              next = revealCell(b, g.end.row, g.end.col, m);
            }
          } else if (g.kind === "tap") {
            // Single tap = toggle flag (or fire armed power / ignore open cells)
            if (b.armedPower) {
              next = revealCell(b, g.end.row, g.end.col, m);
            } else {
              const cell = b.cells[g.end.row][g.end.col];
              if (cell.state === "open") {
                // Tap open number → chord (nice for one-hand play)
                next = chordCell(b, g.end.row, g.end.col, m);
              } else {
                next = toggleFlag(b, g.end.row, g.end.col);
                if (
                  next !== b &&
                  typeof navigator !== "undefined" &&
                  navigator.vibrate
                ) {
                  navigator.vibrate(12);
                }
              }
            }
          }

          if (next !== b) onChangeRef.current(next);
        },
      }),
    [],
  );

  const cellFromPoint = useCallback((x: number, y: number) => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    if (!el) return null;
    const btn = el.closest("[data-row][data-col]") as HTMLElement | null;
    if (!btn) return null;
    const row = Number(btn.dataset.row);
    const col = Number(btn.dataset.col);
    if (Number.isNaN(row) || Number.isNaN(col)) return null;
    return { row, col };
  }, []);

  const onPointerDown = useCallback(
    (row: number, col: number, e: React.PointerEvent) => {
      if (disabled) return;
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      controller.start({ row, col }, e.clientX, e.clientY, e.pointerId);
    },
    [controller, disabled],
  );

  const onPointerEnter = useCallback(
    (row: number, col: number, e: React.PointerEvent) => {
      if (disabled || e.buttons === 0) return;
      controller.move({ row, col }, e.clientX, e.clientY, e.pointerId);
    },
    [controller, disabled],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (disabled || e.buttons === 0) return;
      const cell = cellFromPoint(e.clientX, e.clientY);
      if (cell) controller.move(cell, e.clientX, e.clientY, e.pointerId);
    },
    [cellFromPoint, controller, disabled],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      controller.end(e.clientX, e.clientY, e.pointerId);
    },
    [controller],
  );

  const onPointerCancel = useCallback(() => {
    controller.cancel();
  }, [controller]);

  const gridW =
    board.config.width * cellSize +
    Math.max(0, board.config.width - 1) * GAP_PX +
    PAD_PX * 2;
  const gridH =
    board.config.height * cellSize +
    Math.max(0, board.config.height - 1) * GAP_PX +
    PAD_PX * 2;

  return (
    <div
      ref={wrapRef}
      className="relative flex h-full min-h-0 w-full min-w-0 flex-1 items-center justify-center overflow-hidden"
    >
      <div
        className={`relative touch-none ${shake ? "animate-board-shake" : ""}`}
        style={{ width: gridW, height: gridH, maxWidth: "100%", maxHeight: "100%" }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${board.config.width}, ${cellSize}px)`,
            gridTemplateRows: `repeat(${board.config.height}, ${cellSize}px)`,
            gap: GAP_PX,
            padding: PAD_PX,
            width: gridW,
            height: gridH,
            boxSizing: "border-box",
          }}
        >
          {board.cells.flatMap((row) =>
            row.map((cell) => (
              <CellView
                key={`${cell.row}-${cell.col}`}
                cell={cell}
                size={cellSize}
                showMines={board.status === "lost"}
                onPointerDown={onPointerDown}
                onPointerEnter={onPointerEnter}
              />
            )),
          )}
        </div>

        {board.floaters.map((f) => (
          <Floater
            key={f.id}
            floater={f}
            cellSize={cellSize}
            gap={GAP_PX}
            pad={PAD_PX}
          />
        ))}
      </div>
    </div>
  );
}

function Floater({
  floater,
  cellSize,
  gap,
  pad,
}: {
  floater: FloatingScore;
  cellSize: number;
  gap: number;
  pad: number;
}) {
  const colors = {
    score: "text-amber-200",
    combo: "text-fuchsia-300",
    power: "text-cyan-200",
    hit: "text-rose-300",
  };
  const left = pad + floater.col * (cellSize + gap) + cellSize / 2;
  const top = pad + floater.row * (cellSize + gap);
  return (
    <div
      className={`pointer-events-none absolute z-20 animate-float-up font-black drop-shadow-lg ${colors[floater.kind]}`}
      style={{
        left,
        top,
        fontSize: Math.max(11, cellSize * 0.38),
        transform: "translateX(-50%)",
      }}
    >
      {floater.text}
    </div>
  );
}
