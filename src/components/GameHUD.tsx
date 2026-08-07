"use client";

import type { Board, GameMode } from "@/lib/minesweeper";
import { safeCellCount } from "@/lib/minesweeper";

interface GameHUDProps {
  board: Board;
  mode: GameMode;
  elapsed: number;
  rivalScore?: number;
  rivalName?: string;
  teamLives?: number;
  message?: string | null;
}

export function GameHUD({
  board,
  mode,
  elapsed,
  rivalScore,
  rivalName,
  teamLives,
  message,
}: GameHUDProps) {
  const remaining =
    board.config.mineCount - board.flagCount + board.mineHits; // approx mines left to flag
  const progress = Math.min(
    100,
    Math.round((board.openedCount / safeCellCount(board.config)) * 100),
  );
  const lives =
    mode === "coop" && teamLives !== undefined ? teamLives : board.lives;

  return (
    <div className="w-full space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Stat
          label="Score"
          value={board.score.toLocaleString()}
          accent="text-amber-300"
        />
        <Stat
          label="Combo"
          value={board.combo > 1 ? `×${board.combo}` : "—"}
          accent="text-fuchsia-300"
        />
        <Stat
          label="Time"
          value={formatTime(elapsed)}
          accent="text-sky-300"
        />
        {(mode === "chaos" || mode === "coop" || mode === "versus") && (
          <Stat
            label="Lives"
            value={mode === "versus" ? "∞" : "❤️".repeat(Math.min(lives, 5)) || "0"}
            accent="text-rose-300"
          />
        )}
      </div>

      <div className="flex items-center gap-2 text-[11px] text-white/60">
        <span>💣 {Math.max(0, remaining)}</span>
        <span className="text-white/30">·</span>
        <span>🚩 {board.flagCount}</span>
        <span className="text-white/30">·</span>
        <span>Max ×{board.maxCombo}</span>
        {board.shieldCharges > 0 && (
          <>
            <span className="text-white/30">·</span>
            <span>🛡️×{board.shieldCharges}</span>
          </>
        )}
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 via-violet-500 to-amber-400 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {rivalName !== undefined && rivalScore !== undefined && (
        <div className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-xs">
          <span className="text-white/70">
            {mode === "coop" ? "Partner" : "Rival"}:{" "}
            <span className="font-semibold text-white">{rivalName}</span>
          </span>
          <span className="font-bold text-amber-200">
            {rivalScore.toLocaleString()} pts
          </span>
        </div>
      )}

      {message && (
        <div className="animate-pop rounded-xl bg-gradient-to-r from-violet-600/80 to-fuchsia-600/80 px-3 py-2 text-center text-xs font-semibold text-white shadow-lg">
          {message}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="min-w-0 flex-1 rounded-xl bg-white/8 px-2 py-1.5 text-center ring-1 ring-white/10">
      <div className="text-[9px] font-medium uppercase tracking-wider text-white/45">
        {label}
      </div>
      <div className={`truncate text-sm font-bold tabular-nums ${accent}`}>
        {value}
      </div>
    </div>
  );
}

function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}
