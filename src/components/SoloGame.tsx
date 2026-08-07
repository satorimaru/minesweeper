"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Board, Difficulty, GameMode } from "@/lib/minesweeper";
import {
  clearCellFlashes,
  clearPowerMessage,
  DIFFICULTIES,
  generateBoard,
} from "@/lib/minesweeper";
import { randomSeed } from "@/lib/prng";
import { Board as BoardView } from "./Board";
import { GameHUD } from "./GameHUD";
import { InventoryBar } from "./InventoryBar";
import { ResultModal } from "./ResultModal";

interface SoloGameProps {
  mode: Extract<GameMode, "solo" | "chaos">;
  difficulty: Difficulty;
  onExit: () => void;
}

export function SoloGame({ mode, difficulty, onExit }: SoloGameProps) {
  const config = DIFFICULTIES[difficulty];
  const [board, setBoard] = useState<Board>(() =>
    generateBoard(config, randomSeed(), mode),
  );
  const [openSwipe, setOpenSwipe] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [seedKey, setSeedKey] = useState(0);
  const msgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const restart = useCallback(() => {
    setBoard(generateBoard(config, randomSeed(), mode));
    setStartedAt(null);
    setElapsed(0);
    setOpenSwipe(false);
    setSeedKey((k) => k + 1);
  }, [config, mode]);

  // Timer
  useEffect(() => {
    if (board.status !== "playing" || startedAt === null) return;
    const id = setInterval(() => {
      setElapsed((Date.now() - startedAt) / 1000);
    }, 200);
    return () => clearInterval(id);
  }, [board.status, startedAt]);

  // Clear flashes / messages
  useEffect(() => {
    if (board.floaters.length === 0 && !board.lastPowerMessage) return;
    if (msgTimer.current) clearTimeout(msgTimer.current);
    msgTimer.current = setTimeout(() => {
      setBoard((b) => clearPowerMessage(clearCellFlashes(b)));
    }, 900);
    return () => {
      if (msgTimer.current) clearTimeout(msgTimer.current);
    };
  }, [board.floaters, board.lastPowerMessage, board.floaterSeq]);

  const onChange = (next: Board) => {
    if (startedAt === null && next.openedCount > 0) {
      setStartedAt(Date.now());
    }
    setBoard(next);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 pb-[env(safe-area-inset-bottom)]">
      <div className="shrink-0">
        <GameHUD
          board={board}
          mode={mode}
          elapsed={elapsed}
          message={board.lastPowerMessage}
        />
      </div>

      <div className="min-h-0 flex-1" key={seedKey}>
        <BoardView
          board={board}
          mode={mode}
          openSwipe={openSwipe}
          disabled={board.status !== "playing"}
          onChange={onChange}
        />
      </div>

      <InventoryBar
        board={board}
        openSwipe={openSwipe}
        onBoardChange={setBoard}
        onToggleOpenSwipe={() => setOpenSwipe((v) => !v)}
        onExit={onExit}
      />

      {board.status === "won" && (
        <ResultModal
          tone="win"
          title="Board crushed!"
          subtitle={mode === "chaos" ? "Chaos Run complete" : "Solo Crush complete"}
          stats={[
            { label: "Score", value: board.score.toLocaleString() },
            { label: "Max combo", value: `×${board.maxCombo}` },
            { label: "Time", value: formatTime(elapsed) },
            { label: "Hits", value: String(board.mineHits) },
          ]}
          primaryLabel="Play again"
          onPrimary={restart}
          secondaryLabel="Menu"
          onSecondary={onExit}
        />
      )}

      {board.status === "lost" && (
        <ResultModal
          tone="lose"
          title="Boom…"
          subtitle="The mines got the last laugh"
          stats={[
            { label: "Score", value: board.score.toLocaleString() },
            { label: "Max combo", value: `×${board.maxCombo}` },
            { label: "Opened", value: String(board.openedCount) },
            { label: "Time", value: formatTime(elapsed) },
          ]}
          primaryLabel="Try again"
          onPrimary={restart}
          secondaryLabel="Menu"
          onSecondary={onExit}
        />
      )}
    </div>
  );
}

function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}
