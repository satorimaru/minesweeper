import type { Difficulty, GameMode } from "@/lib/minesweeper";

const LOCAL_KEY = "mc_high_scores_v1";
const MAX_LOCAL = 30;
const MAX_GLOBAL = 50;

export type ScoreMode = Extract<GameMode, "solo" | "chaos">;

export interface ScoreEntry {
  id: string;
  name: string;
  score: number;
  mode: ScoreMode;
  difficulty: Difficulty;
  maxCombo: number;
  timeSeconds: number;
  mineHits: number;
  at: number;
}

export interface ScoreSubmitResult {
  entry: ScoreEntry;
  localRank: number | null;
  isLocalBest: boolean;
  globalRank: number | null;
}

function randomId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function readLocal(): ScoreEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ScoreEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e) =>
        e &&
        typeof e.score === "number" &&
        (e.mode === "solo" || e.mode === "chaos"),
    );
  } catch {
    return [];
  }
}

function writeLocal(entries: ScoreEntry[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LOCAL_KEY, JSON.stringify(entries.slice(0, MAX_LOCAL)));
}

/** Sort: higher score first, then faster time, then newer. */
export function sortScores(entries: ScoreEntry[]): ScoreEntry[] {
  return [...entries].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.timeSeconds !== b.timeSeconds) return a.timeSeconds - b.timeSeconds;
    return b.at - a.at;
  });
}

export function getLocalScores(opts?: {
  mode?: ScoreMode | "all";
  difficulty?: Difficulty | "all";
  limit?: number;
}): ScoreEntry[] {
  let list = sortScores(readLocal());
  if (opts?.mode && opts.mode !== "all") {
    list = list.filter((e) => e.mode === opts.mode);
  }
  if (opts?.difficulty && opts.difficulty !== "all") {
    list = list.filter((e) => e.difficulty === opts.difficulty);
  }
  const limit = opts?.limit ?? MAX_LOCAL;
  return list.slice(0, limit);
}

export function getPersonalBest(
  mode: ScoreMode,
  difficulty: Difficulty,
): ScoreEntry | null {
  const list = getLocalScores({ mode, difficulty, limit: 1 });
  return list[0] ?? null;
}

export function addLocalScore(
  input: Omit<ScoreEntry, "id" | "at"> & { at?: number },
): { entry: ScoreEntry; rank: number | null; isBest: boolean } {
  const entry: ScoreEntry = {
    id: randomId(),
    name: (input.name || "Player").trim().slice(0, 24) || "Player",
    score: Math.max(0, Math.floor(input.score)),
    mode: input.mode,
    difficulty: input.difficulty,
    maxCombo: Math.max(0, Math.floor(input.maxCombo)),
    timeSeconds: Math.max(0, input.timeSeconds),
    mineHits: Math.max(0, Math.floor(input.mineHits)),
    at: input.at ?? Date.now(),
  };

  const prevBest = getPersonalBest(entry.mode, entry.difficulty);
  const isBest = !prevBest || entry.score > prevBest.score;

  const next = sortScores([entry, ...readLocal()]).slice(0, MAX_LOCAL);
  writeLocal(next);

  const rankIndex = next.findIndex((e) => e.id === entry.id);
  const rank = rankIndex >= 0 ? rankIndex + 1 : null;

  return { entry, rank, isBest };
}

export async function fetchGlobalScores(opts?: {
  mode?: ScoreMode | "all";
  difficulty?: Difficulty | "all";
  limit?: number;
}): Promise<ScoreEntry[]> {
  const params = new URLSearchParams();
  if (opts?.mode && opts.mode !== "all") params.set("mode", opts.mode);
  if (opts?.difficulty && opts.difficulty !== "all") {
    params.set("difficulty", opts.difficulty);
  }
  if (opts?.limit) params.set("limit", String(opts.limit));
  const qs = params.toString();
  const res = await fetch(`/api/scores${qs ? `?${qs}` : ""}`);
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data.scores) ? (data.scores as ScoreEntry[]) : [];
}

export async function submitScore(input: {
  name: string;
  score: number;
  mode: ScoreMode;
  difficulty: Difficulty;
  maxCombo: number;
  timeSeconds: number;
  mineHits: number;
}): Promise<ScoreSubmitResult> {
  const local = addLocalScore(input);

  let globalRank: number | null = null;
  try {
    const res = await fetch("/api/scores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(local.entry),
    });
    if (res.ok) {
      const data = await res.json();
      if (typeof data.rank === "number") globalRank = data.rank;
    }
  } catch {
    /* offline / API down — local still counts */
  }

  return {
    entry: local.entry,
    localRank: local.rank,
    isLocalBest: local.isBest,
    globalRank,
  };
}

export { MAX_LOCAL, MAX_GLOBAL };
