import { NextResponse } from "next/server";
import type { ScoreEntry, ScoreMode } from "@/lib/scores";
import { sortScores } from "@/lib/scores";
import type { Difficulty } from "@/lib/minesweeper/types";
import { DIFFICULTIES } from "@/lib/minesweeper/types";
import {
  addGlobalScore,
  listGlobalScores,
  usingRedisForScores,
} from "@/lib/rooms/scoresStore";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode") as ScoreMode | "all" | null;
    const difficulty = searchParams.get("difficulty") as
      | Difficulty
      | "all"
      | null;
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") ?? 20)));

    let scores = await listGlobalScores(Math.max(limit, 50));

    if (mode && mode !== "all") {
      scores = scores.filter((s) => s.mode === mode);
    }
    if (difficulty && difficulty !== "all" && DIFFICULTIES[difficulty]) {
      scores = scores.filter((s) => s.difficulty === difficulty);
    }

    scores = sortScores(scores).slice(0, limit);

    return NextResponse.json({
      scores,
      redis: usingRedisForScores(),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load scores";
    return NextResponse.json({ error: message, scores: [] }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const mode = body.mode as ScoreMode;
    const difficulty = body.difficulty as Difficulty;

    if (mode !== "solo" && mode !== "chaos") {
      return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
    }
    if (!difficulty || !DIFFICULTIES[difficulty]) {
      return NextResponse.json({ error: "Invalid difficulty" }, { status: 400 });
    }

    const score = Math.max(0, Math.floor(Number(body.score ?? 0)));
    if (!Number.isFinite(score) || score <= 0) {
      return NextResponse.json({ error: "Invalid score" }, { status: 400 });
    }

    // Soft anti-cheat cap (generous for combo chaos)
    if (score > 500_000) {
      return NextResponse.json({ error: "Score out of range" }, { status: 400 });
    }

    const entry: ScoreEntry = {
      id: String(body.id ?? "").slice(0, 64) || `s_${Date.now()}`,
      name: String(body.name ?? "Player").trim().slice(0, 24) || "Player",
      score,
      mode,
      difficulty,
      maxCombo: Math.max(0, Math.floor(Number(body.maxCombo ?? 0))),
      timeSeconds: Math.max(0, Number(body.timeSeconds ?? 0)),
      mineHits: Math.max(0, Math.floor(Number(body.mineHits ?? 0))),
      at: Math.min(Date.now(), Math.max(0, Number(body.at ?? Date.now()))),
    };

    const { rank } = await addGlobalScore(entry);
    return NextResponse.json({ ok: true, rank, redis: usingRedisForScores() });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to save score";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
