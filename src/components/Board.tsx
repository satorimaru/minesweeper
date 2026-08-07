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

interface BoardProps {
  board: BoardModel;
  mode: GameMode;
  flagPaint: boolean;
  disabled?: boolean;
  onChange: (next: BoardModel) => void;
}

export function Board({
  board,
  mode,
  flagPaint,
  disabled,
  onChange,
}: BoardProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [cellSize, setCellSize] = useState(36);
  const [shake, setShake] = useState(false);
  const boardRef = useRef(board);
  boardRef.current = board;

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const modeRef = useRef(mode);
  modeRef.current = mode;

  const flagPaintRef = useRef(flagPaint);
  flagPaintRef.current = flagPaint;

  const disabledRef = useRef(!!disabled);
  disabledRef.current = !!disabled;

  // Responsive cell size for phone screens
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const measure = () => {
      const w = el.clientWidth;
      const cols = board.config.width;
      // Leave a little padding
      const size = Math.floor((w - 8) / cols);
      setCellSize(Math.max(28, Math.min(48, size)));
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [board.config.width]);

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
        onLongPress: (cell) => {
          if (disabledRef.current) return;
          const next = toggleFlag(boardRef.current, cell.row, cell.col);
          if (next !== boardRef.current) onChangeRef.current(next);
          if (typeof navigator !== "undefined" && navigator.vibrate) {
            navigator.vibrate(18);
          }
        },
        onGesture: (g) => {
          if (disabledRef.current) return;
          const b = boardRef.current;
          const m = modeRef.current;
          let next = b;

          if (g.kind === "swipe") {
            next = flagPaintRef.current
              ? flagPath(b, g.path)
              : revealPath(b, g.path, m);
          } else if (g.kind === "doubletap") {
            const cell = b.cells[g.end.row][g.end.col];
            if (cell.state === "open") {
              next = chordCell(b, g.end.row, g.end.col, m);
            } else {
              next = flagPaintRef.current
                ? toggleFlag(b, g.end.row, g.end.col)
                : revealCell(b, g.end.row, g.end.col, m);
            }
          } else if (g.kind === "tap") {
            next = flagPaintRef.current
              ? toggleFlag(b, g.end.row, g.end.col)
              : revealCell(b, g.end.row, g.end.col, m);
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

  const gridW = cellSize * board.config.width + 4;
  const gridH = cellSize * board.config.height + 4;

  return (
    <div ref={wrapRef} className="relative w-full overflow-x-auto">
      <div
        className={`relative mx-auto touch-none ${shake ? "animate-board-shake" : ""}`}
        style={{ width: gridW, height: gridH }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        <div
          className="grid gap-0.5 p-0.5"
          style={{
            gridTemplateColumns: `repeat(${board.config.width}, ${cellSize}px)`,
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

        {/* Floating score / combo popups */}
        {board.floaters.map((f) => (
          <Floater key={f.id} floater={f} cellSize={cellSize} />
        ))}
      </div>
    </div>
  );
}

function Floater({
  floater,
  cellSize,
}: {
  floater: FloatingScore;
  cellSize: number;
}) {
  const colors = {
    score: "text-amber-200",
    combo: "text-fuchsia-300",
    power: "text-cyan-200",
    hit: "text-rose-300",
  };
  return (
    <div
      className={`pointer-events-none absolute z-20 animate-float-up font-black drop-shadow-lg ${colors[floater.kind]}`}
      style={{
        left: floater.col * cellSize + cellSize / 2,
        top: floater.row * cellSize,
        fontSize: Math.max(12, cellSize * 0.38),
        transform: "translateX(-50%)",
      }}
    >
      {floater.text}
    </div>
  );
}
