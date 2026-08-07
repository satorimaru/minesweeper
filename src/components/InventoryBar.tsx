"use client";

import type { Board, InventoryPowerId } from "@/lib/minesweeper";
import { POWER_UP_ICONS, POWER_UP_LABELS, setArmedPower } from "@/lib/minesweeper";

const ORDER: InventoryPowerId[] = ["nuke", "freeze"];

interface InventoryBarProps {
  board: Board;
  openSwipe: boolean;
  onBoardChange: (next: Board) => void;
  onToggleOpenSwipe: () => void;
  onExit?: () => void;
}

export function InventoryBar({
  board,
  openSwipe,
  onBoardChange,
  onToggleOpenSwipe,
  onExit,
}: InventoryBarProps) {
  return (
    <div className="flex shrink-0 items-center gap-2 rounded-2xl bg-black/30 p-2 ring-1 ring-white/10 backdrop-blur-md">
      {onExit && (
        <button
          type="button"
          onClick={onExit}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-sm text-white/80 active:bg-white/20"
          aria-label="Exit"
        >
          ✕
        </button>
      )}

      <button
        type="button"
        onClick={onToggleOpenSwipe}
        className={`flex h-11 min-w-[4.5rem] flex-col items-center justify-center rounded-xl px-2 text-[10px] font-semibold transition ${
          openSwipe
            ? "bg-sky-500 text-white shadow-lg shadow-sky-500/30"
            : "bg-white/10 text-white/80"
        }`}
      >
        <span className="text-base leading-none">{openSwipe ? "✨" : "🚩"}</span>
        {openSwipe ? "Open swipe" : "Flag swipe"}
      </button>

      <div className="flex flex-1 items-center justify-center gap-2">
        {ORDER.map((id) => {
          const count = board.inventory[id] ?? 0;
          const armed = board.armedPower === id;
          return (
            <button
              key={id}
              type="button"
              disabled={count <= 0 && !armed}
              onClick={() => {
                onBoardChange(setArmedPower(board, armed ? null : id));
              }}
              className={`relative flex h-12 w-14 flex-col items-center justify-center rounded-xl text-[10px] font-semibold transition disabled:opacity-35 ${
                armed
                  ? "bg-amber-400 text-slate-900 shadow-lg shadow-amber-400/40 ring-2 ring-white"
                  : "bg-white/10 text-white/85 active:bg-white/20"
              }`}
            >
              <span className="text-lg leading-none">{POWER_UP_ICONS[id]}</span>
              <span className="truncate px-0.5">{POWER_UP_LABELS[id]}</span>
              {count > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="hidden text-[9px] leading-tight text-white/40 sm:block">
        Tap flag · 2× open
        <br />
        swipe paint path
      </div>
    </div>
  );
}
