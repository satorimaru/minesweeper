"use client";

import type { Room } from "@/lib/rooms/types";
import { DIFFICULTIES, GAME_MODE_META } from "@/lib/minesweeper";

interface LobbyProps {
  room: Room;
  playerId: string;
  onReady: (ready: boolean) => void;
  onCopyLink: () => void;
  linkCopied: boolean;
  error?: string | null;
}

export function Lobby({
  room,
  playerId,
  onReady,
  onCopyLink,
  linkCopied,
  error,
}: LobbyProps) {
  const me =
    room.host.id === playerId
      ? room.host
      : room.guest?.id === playerId
        ? room.guest
        : null;
  const isHost = room.host.id === playerId;
  const modeMeta = GAME_MODE_META[room.mode];
  const diff = DIFFICULTIES[room.difficulty];

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 px-4 py-8">
      <div className="rounded-3xl bg-white/10 p-6 text-white ring-1 ring-white/15 backdrop-blur-xl">
        <div className="text-center">
          <div className="text-4xl">{modeMeta.emoji}</div>
          <h1 className="mt-2 text-2xl font-bold">{modeMeta.label}</h1>
          <p className="mt-1 text-sm text-white/60">
            {diff.label} · {diff.width}×{diff.height}
          </p>
        </div>

        <div className="mt-6 space-y-3">
          <PlayerRow
            label="Host"
            name={room.host.name}
            ready={room.host.ready}
            you={isHost}
          />
          <PlayerRow
            label="Guest"
            name={room.guest?.name ?? "Waiting…"}
            ready={room.guest?.ready ?? false}
            you={!!room.guest && room.guest.id === playerId}
            empty={!room.guest}
          />
        </div>

        {error && (
          <p className="mt-4 rounded-xl bg-rose-500/20 px-3 py-2 text-sm text-rose-200">
            {error}
          </p>
        )}

        <div className="mt-6 space-y-2">
          <button
            type="button"
            onClick={onCopyLink}
            className="w-full rounded-2xl bg-white/10 py-3 text-sm font-semibold text-white active:bg-white/15"
          >
            {linkCopied ? "Link copied!" : "Copy invite link"}
          </button>

          {me && room.guest && (
            <button
              type="button"
              onClick={() => onReady(!me.ready)}
              className={`w-full rounded-2xl py-3.5 text-sm font-bold shadow-lg active:scale-[0.98] ${
                me.ready
                  ? "bg-white/15 text-white"
                  : "bg-gradient-to-r from-fuchsia-500 to-violet-500 text-white shadow-fuchsia-500/30"
              }`}
            >
              {me.ready ? "Unready" : "Ready!"}
            </button>
          )}

          {!room.guest && isHost && (
            <p className="text-center text-xs text-white/45">
              Share the link — game starts when both ready
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function PlayerRow({
  label,
  name,
  ready,
  you,
  empty,
}: {
  label: string;
  name: string;
  ready: boolean;
  you?: boolean;
  empty?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-2xl px-4 py-3 ring-1 ${
        empty
          ? "bg-white/5 ring-dashed ring-white/15"
          : "bg-white/8 ring-white/10"
      }`}
    >
      <div>
        <div className="text-[10px] uppercase tracking-wide text-white/40">
          {label}
          {you ? " · you" : ""}
        </div>
        <div className={`font-semibold ${empty ? "text-white/35" : "text-white"}`}>
          {name}
        </div>
      </div>
      {!empty && (
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
            ready
              ? "bg-emerald-500/20 text-emerald-300"
              : "bg-white/10 text-white/50"
          }`}
        >
          {ready ? "READY" : "…"}
        </span>
      )}
    </div>
  );
}
