"use client";

import type { Cell as CellModel, PowerUpId } from "@/lib/minesweeper";
import { POWER_UP_ICONS } from "@/lib/minesweeper";

const NUMBER_COLORS = [
  "",
  "#2563eb",
  "#16a34a",
  "#dc2626",
  "#7c3aed",
  "#b45309",
  "#0891b2",
  "#1e293b",
  "#64748b",
];

interface CellProps {
  cell: CellModel;
  size: number;
  showMines: boolean;
  onPointerDown: (row: number, col: number, e: React.PointerEvent) => void;
  onPointerEnter: (row: number, col: number, e: React.PointerEvent) => void;
}

export function CellView({
  cell,
  size,
  showMines,
  onPointerDown,
  onPointerEnter,
}: CellProps) {
  const { state, isMine, adjacent, powerUp, powerFlash, justOpened } = cell;

  let content: React.ReactNode = null;
  let className =
    "relative box-border flex h-full w-full items-center justify-center select-none font-bold transition-transform duration-150 ";

  if (state === "open") {
    className += justOpened
      ? "bg-amber-50 shadow-inner animate-pop "
      : "bg-slate-100/90 shadow-inner ";
    if (isMine) {
      content = "💣";
      className += "bg-rose-400/90 ";
    } else if (adjacent > 0) {
      content = (
        <span style={{ color: NUMBER_COLORS[adjacent], fontSize: size * 0.42 }}>
          {adjacent}
        </span>
      );
    }
    if (powerFlash) {
      content = (
        <span className="animate-bounce text-[0.85em]">
          {POWER_UP_ICONS[powerFlash as PowerUpId]}
        </span>
      );
    }
  } else if (state === "flagged") {
    className +=
      "bg-gradient-to-br from-fuchsia-500 to-violet-600 text-white shadow-md ";
    content = "🚩";
  } else {
    className +=
      "bg-gradient-to-br from-indigo-500 to-violet-600 shadow-md active:scale-95 ";
    if (powerUp) {
      className += "ring-1 ring-amber-300/40 ";
    }
  }

  if (showMines && isMine && state === "hidden") {
    content = "·";
  }

  const radius = Math.max(3, Math.min(8, size * 0.18));

  return (
    <button
      type="button"
      data-row={cell.row}
      data-col={cell.col}
      aria-label={`Cell ${cell.row},${cell.col}`}
      className={className}
      style={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        maxWidth: size,
        maxHeight: size,
        fontSize: Math.max(10, size * 0.4),
        borderRadius: radius,
        touchAction: "none",
        padding: 0,
      }}
      onPointerDown={(e) => onPointerDown(cell.row, cell.col, e)}
      onPointerEnter={(e) => onPointerEnter(cell.row, cell.col, e)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {content}
    </button>
  );
}
