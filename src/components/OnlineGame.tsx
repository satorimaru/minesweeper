"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Board } from "@/lib/minesweeper";
import {
  applySabotage,
  clearCellFlashes,
  clearPowerMessage,
  DIFFICULTIES,
  generateBoard,
} from "@/lib/minesweeper";
import type { Room } from "@/lib/rooms/types";
import { playBoardTransition } from "@/lib/boardSfx";
import { getOrCreatePlayerId, getPlayerName, setPlayerName } from "@/lib/player";
import { sfx } from "@/lib/sfx";
import { Board as BoardView } from "./Board";
import { GameHUD } from "./GameHUD";
import { InventoryBar } from "./InventoryBar";
import { Lobby } from "./Lobby";
import { ResultModal } from "./ResultModal";

interface OnlineGameProps {
  roomId: string;
}

export function OnlineGame({ roomId }: OnlineGameProps) {
  const playerId = useRef("");
  const [room, setRoom] = useState<Room | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [openSwipe, setOpenSwipe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [joining, setJoining] = useState(true);
  const [namePrompt, setNamePrompt] = useState("");
  const [needsName, setNeedsName] = useState(false);

  const seenSabotages = useRef(new Set<string>());
  const finishedRef = useRef(false);
  const boardSeedRef = useRef<number | null>(null);
  const msgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boardSnapRef = useRef<Board | null>(null);

  const api = useCallback(
    async (action: string, extra: Record<string, unknown> = {}) => {
      const res = await fetch(`/api/rooms/${roomId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          playerId: playerId.current,
          ...extra,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      return data.room as Room;
    },
    [roomId],
  );

  // Bootstrap join
  useEffect(() => {
    playerId.current = getOrCreatePlayerId();
    const name = getPlayerName();
    if (!name) {
      setNeedsName(true);
      setJoining(false);
      return;
    }
    void (async () => {
      try {
        // Ensure room exists
        const getRes = await fetch(`/api/rooms/${roomId}`);
        if (!getRes.ok) {
          setError("Room not found");
          setJoining(false);
          return;
        }
        const r = await api("join", { playerName: name });
        setRoom(r);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to join");
      } finally {
        setJoining(false);
      }
    })();
  }, [api, roomId]);

  // Poll room
  useEffect(() => {
    if (!room || needsName) return;
    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/rooms/${roomId}`);
        if (!res.ok) return;
        const data = await res.json();
        setRoom(data.room as Room);
      } catch {
        /* ignore */
      }
    }, 900);
    return () => clearInterval(id);
  }, [room, roomId, needsName]);

  // Start / reset board when room seed changes (match start or rematch)
  useEffect(() => {
    if (!room || room.status === "waiting") return;
    if (boardSeedRef.current === room.seed) return;

    boardSeedRef.current = room.seed;
    finishedRef.current = false;
    seenSabotages.current = new Set();
    const config = DIFFICULTIES[room.difficulty];
    const next = generateBoard(config, room.seed, room.mode);
    boardSnapRef.current = next;
    setBoard(next);
    setOpenSwipe(false);
    setElapsed(0);
    sfx.unlock();
    sfx.ready();
  }, [room]);

  const applyBoard = useCallback((next: Board) => {
    sfx.unlock();
    const prev = boardSnapRef.current;
    if (prev) playBoardTransition(prev, next);
    boardSnapRef.current = next;
    setBoard(next);
  }, []);

  // Timer — freezes when local board or room leaves playing
  useEffect(() => {
    if (!room?.startedAt) return;
    const start = room.startedAt;
    if (room.status !== "playing" || board?.status !== "playing") {
      setElapsed((Date.now() - start) / 1000);
      return;
    }
    const id = setInterval(() => {
      setElapsed((Date.now() - start) / 1000);
    }, 200);
    return () => clearInterval(id);
  }, [room?.startedAt, room?.status, board?.status]);

  // Progress sync
  useEffect(() => {
    if (!room || room.status !== "playing" || !board) return;
    if (board.status !== "playing") return;

    const id = setInterval(() => {
      void api("progress", {
        openedCount: board.openedCount,
        flagCount: board.flagCount,
        mineHits: board.mineHits,
        score: board.score,
        combo: board.combo,
        lives: board.lives,
      }).then(setRoom).catch(() => undefined);
    }, 1200);
    return () => clearInterval(id);
  }, [api, board, room]);

  // Finish report
  useEffect(() => {
    if (!room || !board || finishedRef.current) return;
    if (board.status !== "won") return;
    finishedRef.current = true;
    void api("finish", {
      score: board.score,
      mineHits: board.mineHits,
      openedCount: board.openedCount,
    })
      .then(setRoom)
      .catch((e) => setError(e instanceof Error ? e.message : "Finish failed"));
  }, [api, board, room]);

  // Incoming sabotages (versus)
  useEffect(() => {
    if (!room || room.mode !== "versus" || !board) return;
    if (room.status !== "playing") return;

    for (const s of room.sabotages) {
      if (s.fromPlayerId === playerId.current) continue;
      if (seenSabotages.current.has(s.id)) continue;
      seenSabotages.current.add(s.id);
      setBoard((b) => {
        if (!b) return b;
        const next = applySabotage(b, s.type);
        playBoardTransition(b, next);
        boardSnapRef.current = next;
        sfx.freeze();
        return next;
      });
    }
  }, [room, board]);

  // Outgoing sabotage from freeze power
  useEffect(() => {
    if (!board?.pendingSabotage || !room) return;
    const type = board.pendingSabotage;
    setBoard((b) => (b ? { ...b, pendingSabotage: null } : b));
    void api("sabotage", { type }).then(setRoom).catch(() => undefined);
  }, [api, board?.pendingSabotage, room]);

  // Clear floaters
  useEffect(() => {
    if (!board) return;
    if (board.floaters.length === 0 && !board.lastPowerMessage) return;
    if (msgTimer.current) clearTimeout(msgTimer.current);
    msgTimer.current = setTimeout(() => {
      setBoard((b) => (b ? clearPowerMessage(clearCellFlashes(b)) : b));
    }, 900);
    return () => {
      if (msgTimer.current) clearTimeout(msgTimer.current);
    };
  }, [board?.floaters, board?.lastPowerMessage, board?.floaterSeq]);

  const submitName = () => {
    const n = namePrompt.trim().slice(0, 24) || "Player";
    setPlayerName(n);
    setNeedsName(false);
    setJoining(true);
    void (async () => {
      try {
        playerId.current = getOrCreatePlayerId();
        const r = await api("join", { playerName: n });
        setRoom(r);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to join");
      } finally {
        setJoining(false);
      }
    })();
  };

  if (needsName) {
    return (
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4">
        <div className="rounded-3xl bg-white/10 p-6 text-white ring-1 ring-white/15">
          <h1 className="text-xl font-bold">Join the crush</h1>
          <p className="mt-1 text-sm text-white/60">Pick a display name</p>
          <input
            value={namePrompt}
            onChange={(e) => setNamePrompt(e.target.value)}
            maxLength={24}
            placeholder="Your name"
            className="mt-4 w-full rounded-xl border-0 bg-white/10 px-3 py-3 text-white outline-none ring-1 ring-white/20 focus:ring-2 focus:ring-fuchsia-400"
          />
          <button
            type="button"
            onClick={submitName}
            className="mt-4 w-full rounded-2xl bg-gradient-to-r from-fuchsia-500 to-violet-500 py-3 font-bold"
          >
            Join room
          </button>
        </div>
      </div>
    );
  }

  if (joining || !room) {
    return (
      <div className="flex flex-1 items-center justify-center text-white/70">
        {error ?? "Connecting…"}
      </div>
    );
  }

  if (room.status === "waiting") {
    return (
      <Lobby
        room={room}
        playerId={playerId.current}
        error={error}
        linkCopied={linkCopied}
        onReady={(ready) => {
          void api("ready", { ready }).then(setRoom).catch((e) => {
            setError(e instanceof Error ? e.message : "Ready failed");
          });
        }}
        onCopyLink={() => {
          const url = window.location.href;
          void navigator.clipboard?.writeText(url);
          setLinkCopied(true);
          setTimeout(() => setLinkCopied(false), 2000);
        }}
      />
    );
  }

  if (!board) {
    return (
      <div className="flex flex-1 items-center justify-center text-white/70">
        Loading board…
      </div>
    );
  }

  const me =
    room.host.id === playerId.current ? room.host : room.guest;
  const rival =
    room.host.id === playerId.current ? room.guest : room.host;
  const iWon =
    room.mode === "coop"
      ? room.result === "win"
      : room.winnerId === playerId.current;
  const isDraw = room.result === "draw";
  const teamLost = room.mode === "coop" && room.result === "loss";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 px-2 pb-[env(safe-area-inset-bottom)] pt-1">
      <div className="shrink-0">
        <GameHUD
          board={board}
          mode={room.mode}
          elapsed={elapsed}
          rivalName={rival?.name}
          rivalScore={rival?.score ?? 0}
          teamLives={room.mode === "coop" ? room.teamLives : undefined}
          message={board.lastPowerMessage}
        />
      </div>

      <div className="min-h-0 flex-1">
        <BoardView
          board={board}
          mode={room.mode}
          openSwipe={openSwipe}
          disabled={
            board.status !== "playing" ||
            room.status === "finished" ||
            me?.playStatus === "finished"
          }
          onChange={applyBoard}
        />
      </div>

      <InventoryBar
        board={board}
        openSwipe={openSwipe}
        onBoardChange={applyBoard}
        onToggleOpenSwipe={() => {
          sfx.unlock();
          sfx.ui();
          setOpenSwipe((v) => !v);
        }}
      />

      {(room.status === "finished" || board.status === "lost") && (
        <ResultModal
          tone={teamLost || board.status === "lost" ? "lose" : isDraw ? "draw" : iWon ? "win" : "lose"}
          title={
            room.mode === "coop"
              ? room.result === "win"
                ? "Team clear!"
                : "Team wiped"
              : isDraw
                ? "Dead heat!"
                : iWon
                  ? "You crushed it!"
                  : "Rival wins"
          }
          subtitle={
            room.mode === "coop"
              ? `Team score ${(room.host.score + (room.guest?.score ?? 0)).toLocaleString()}`
              : rival
                ? `${room.host.name} ${room.host.score} · ${room.guest?.name ?? "?"} ${room.guest?.score ?? 0}`
                : undefined
          }
          stats={[
            { label: "Your score", value: board.score.toLocaleString() },
            { label: "Max combo", value: `×${board.maxCombo}` },
            { label: "Hits", value: String(board.mineHits) },
            {
              label: room.mode === "coop" ? "Team lives" : "Rival score",
              value:
                room.mode === "coop"
                  ? String(room.teamLives)
                  : String(rival?.score ?? 0),
            },
          ]}
          primaryLabel="Rematch"
          onPrimary={() => {
            void api("rematch").then(setRoom).catch((e) => {
              setError(e instanceof Error ? e.message : "Rematch failed");
            });
          }}
          secondaryLabel="Copy invite"
          onSecondary={() => {
            void navigator.clipboard?.writeText(window.location.href);
          }}
        />
      )}

      {me?.playStatus === "finished" && room.status === "playing" && (
        <div className="fixed inset-x-0 bottom-24 z-40 mx-auto w-[min(100%,24rem)] px-4">
          <div className="rounded-2xl bg-emerald-500/90 px-4 py-3 text-center text-sm font-bold text-white shadow-xl">
            You cleared! Waiting for {rival?.name ?? "partner"}…
          </div>
        </div>
      )}
    </div>
  );
}
