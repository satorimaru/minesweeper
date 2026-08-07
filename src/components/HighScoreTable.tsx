"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DIFFICULTIES,
  GAME_MODE_META,
  type Difficulty,
} from "@/lib/minesweeper";
import {
  fetchGlobalScores,
  getLocalScores,
  type ScoreEntry,
  type ScoreMode,
} from "@/lib/scores";
import { sfx } from "@/lib/sfx";

type Tab = "local" | "global";
type ModeFilter = ScoreMode | "all";
type DiffFilter = Difficulty | "all";

interface HighScoreTableProps {
  compact?: boolean;
  highlightId?: string | null;
  defaultMode?: ModeFilter;
  defaultDifficulty?: DiffFilter;
}

export function HighScoreTable({
  compact,
  highlightId,
  defaultMode = "all",
  defaultDifficulty = "all",
}: HighScoreTableProps) {
  const [tab, setTab] = useState<Tab>("local");
  const [mode, setMode] = useState<ModeFilter>(defaultMode);
  const [difficulty, setDifficulty] = useState<DiffFilter>(defaultDifficulty);
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [globalOk, setGlobalOk] = useState(true);

  const load = useCallback(async () => {
    if (tab === "local") {
      setScores(
        getLocalScores({
          mode,
          difficulty,
          limit: compact ? 5 : 15,
        }),
      );
      return;
    }
    setLoading(true);
    try {
      const list = await fetchGlobalScores({
        mode,
        difficulty,
        limit: compact ? 5 : 15,
      });
      setScores(list);
      setGlobalOk(true);
    } catch {
      setScores([]);
      setGlobalOk(false);
    } finally {
      setLoading(false);
    }
  }, [tab, mode, difficulty, compact]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div
      className={`rounded-2xl bg-black/25 ring-1 ring-white/10 ${
        compact ? "p-3" : "p-4"
      }`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold tracking-wide text-white">
          🏆 High scores
        </h2>
        <div className="flex rounded-lg bg-white/5 p-0.5 text-[11px] font-semibold">
          {(["local", "global"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                sfx.unlock();
                sfx.ui();
                setTab(t);
              }}
              className={`rounded-md px-2.5 py-1 capitalize ${
                tab === t
                  ? "bg-fuchsia-500 text-white"
                  : "text-white/50 active:text-white"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-2 flex flex-wrap gap-1.5">
        {(
          [
            ["all", "All"],
            ["solo", "Solo"],
            ["chaos", "Chaos"],
          ] as const
        ).map(([key, label]) => (
          <FilterChip
            key={key}
            active={mode === key}
            onClick={() => {
              sfx.unlock();
              setMode(key);
            }}
            label={label}
          />
        ))}
      </div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        <FilterChip
          active={difficulty === "all"}
          onClick={() => setDifficulty("all")}
          label="Any heat"
        />
        {(Object.keys(DIFFICULTIES) as Difficulty[]).map((key) => (
          <FilterChip
            key={key}
            active={difficulty === key}
            onClick={() => setDifficulty(key)}
            label={DIFFICULTIES[key].label}
          />
        ))}
      </div>

      {loading ? (
        <p className="py-4 text-center text-xs text-white/40">Loading…</p>
      ) : scores.length === 0 ? (
        <p className="py-4 text-center text-xs text-white/40">
          {tab === "global" && !globalOk
            ? "Couldn’t load global board."
            : "No scores yet — crush a board!"}
        </p>
      ) : (
        <ol className="space-y-1.5">
          {scores.map((entry, i) => {
            const hi = highlightId && entry.id === highlightId;
            return (
              <li
                key={entry.id}
                className={`flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm ${
                  hi
                    ? "bg-amber-400/20 ring-1 ring-amber-300/40"
                    : "bg-white/5"
                }`}
              >
                <span
                  className={`w-6 shrink-0 text-center text-xs font-bold ${
                    i === 0
                      ? "text-amber-300"
                      : i === 1
                        ? "text-slate-300"
                        : i === 2
                          ? "text-orange-300"
                          : "text-white/35"
                  }`}
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-white">
                    {entry.name}
                    {hi && (
                      <span className="ml-1 text-[10px] font-bold text-amber-300">
                        YOU
                      </span>
                    )}
                  </div>
                  <div className="truncate text-[10px] text-white/40">
                    {GAME_MODE_META[entry.mode].emoji}{" "}
                    {DIFFICULTIES[entry.difficulty].label}
                    {" · "}×{entry.maxCombo}
                    {" · "}
                    {formatTime(entry.timeSeconds)}
                    {entry.mineHits > 0 ? ` · ${entry.mineHits} hits` : ""}
                  </div>
                </div>
                <span className="shrink-0 font-black tabular-nums text-amber-200">
                  {entry.score.toLocaleString()}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
        active
          ? "bg-violet-500 text-white"
          : "bg-white/8 text-white/45 active:bg-white/15"
      }`}
    >
      {label}
    </button>
  );
}

function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}
