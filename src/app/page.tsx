"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DIFFICULTIES,
  GAME_MODE_META,
  type Difficulty,
  type GameMode,
} from "@/lib/minesweeper";
import {
  getOrCreatePlayerId,
  getPlayerName,
  setPlayerName,
} from "@/lib/player";
import { SoloGame } from "@/components/SoloGame";

type Screen = "menu" | "solo" | "chaos";

export default function HomePage() {
  const router = useRouter();
  const [screen, setScreen] = useState<Screen>("menu");
  const [name, setName] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("beginner");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getOrCreatePlayerId();
    setName(getPlayerName() || "");
  }, []);

  const createOnline = async (mode: Extract<GameMode, "versus" | "coop">) => {
    setCreating(true);
    setError(null);
    setPlayerName(name);
    try {
      const playerId = getOrCreatePlayerId();
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId,
          playerName: name || "Host",
          difficulty,
          mode,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create room");
      router.push(`/game/${data.room.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create room");
      setCreating(false);
    }
  };

  if (screen === "solo" || screen === "chaos") {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <header className="mb-2 text-center">
          <h1 className="text-lg font-bold text-white">
            {GAME_MODE_META[screen].emoji} {GAME_MODE_META[screen].label}
          </h1>
          <p className="text-xs text-white/50">{DIFFICULTIES[difficulty].label}</p>
        </header>
        <SoloGame
          mode={screen}
          difficulty={difficulty}
          onExit={() => setScreen("menu")}
        />
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-8 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="rounded-3xl bg-white/10 p-6 text-white shadow-2xl ring-1 ring-white/15 backdrop-blur-xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-fuchsia-500 to-violet-600 text-3xl shadow-lg shadow-fuchsia-500/40">
            💣
          </div>
          <h1 className="text-3xl font-black tracking-tight">Mine Crush</h1>
          <p className="mt-2 text-sm leading-relaxed text-white/60">
            Minesweeper meets candy chaos — combos, rockets, nukes, and swipe
            gestures built for your phone.
          </p>
        </div>

        <div className="space-y-5">
          <div>
            <label
              htmlFor="name"
              className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-white/45"
            >
              Display name
            </label>
            <input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              maxLength={24}
              className="w-full rounded-xl bg-white/10 px-3 py-3 text-sm text-white outline-none ring-1 ring-white/15 placeholder:text-white/30 focus:ring-2 focus:ring-fuchsia-400"
            />
          </div>

          <div>
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-white/45">
              Board heat
            </span>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(DIFFICULTIES) as Difficulty[]).map((key) => {
                const d = DIFFICULTIES[key];
                const selected = difficulty === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setDifficulty(key)}
                    className={`rounded-xl px-2 py-3 text-center transition active:scale-95 ${
                      selected
                        ? "bg-gradient-to-br from-fuchsia-500 to-violet-600 shadow-md shadow-fuchsia-500/30"
                        : "bg-white/10 text-white/80"
                    }`}
                  >
                    <div className="text-sm font-bold">{d.label}</div>
                    <div
                      className={`mt-0.5 text-[10px] ${
                        selected ? "text-white/80" : "text-white/40"
                      }`}
                    >
                      {d.subtitle}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <p className="rounded-xl bg-rose-500/20 px-3 py-2 text-sm text-rose-200">
              {error}
            </p>
          )}

          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["solo", () => setScreen("solo")],
                ["chaos", () => setScreen("chaos")],
                ["versus", () => createOnline("versus")],
                ["coop", () => createOnline("coop")],
              ] as const
            ).map(([mode, action]) => {
              const meta = GAME_MODE_META[mode];
              return (
                <button
                  key={mode}
                  type="button"
                  disabled={creating && meta.online}
                  onClick={() => {
                    setPlayerName(name);
                    action();
                  }}
                  className="flex flex-col items-start rounded-2xl bg-white/8 p-3 text-left ring-1 ring-white/10 transition active:scale-[0.98] hover:bg-white/12 disabled:opacity-60"
                >
                  <span className="text-xl">{meta.emoji}</span>
                  <span className="mt-1 text-sm font-bold">{meta.label}</span>
                  <span className="mt-0.5 text-[11px] leading-snug text-white/45">
                    {meta.blurb}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-1 text-center text-[11px] text-white/35">
        <p>Tap open · Hold to flag · Swipe to paint · Double-tap chord</p>
        <p>Add to Home Screen for the full PWA vibe</p>
      </div>
    </main>
  );
}
