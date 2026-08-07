import { Redis } from "@upstash/redis";
import type { ScoreEntry } from "@/lib/scores";
import { MAX_GLOBAL, sortScores } from "@/lib/scores";

const KEY = "mc:highscores";
const TTL_SECONDS = 60 * 60 * 24 * 365; // 1 year

function hasRedis(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
  );
}

function getRedis(): Redis {
  return Redis.fromEnv();
}

const memory = globalThis as typeof globalThis & {
  __mineCrushScores?: ScoreEntry[];
};

function mem(): ScoreEntry[] {
  if (!memory.__mineCrushScores) memory.__mineCrushScores = [];
  return memory.__mineCrushScores;
}

export async function listGlobalScores(limit = 20): Promise<ScoreEntry[]> {
  const n = Math.min(MAX_GLOBAL, Math.max(1, limit));
  if (hasRedis()) {
    // Sorted set: score desc via negative? Upstash ZREVRANGEBYSCORE
    // Store as ZADD score = entry.score, member = JSON
    const rows = await getRedis().zrange<string[]>(KEY, 0, n - 1, {
      rev: true,
    });
    const out: ScoreEntry[] = [];
    for (const row of rows ?? []) {
      try {
        const parsed =
          typeof row === "string" ? (JSON.parse(row) as ScoreEntry) : (row as ScoreEntry);
        if (parsed && typeof parsed.score === "number") out.push(parsed);
      } catch {
        /* skip bad members */
      }
    }
    return out;
  }
  return sortScores(mem()).slice(0, n);
}

export async function addGlobalScore(
  entry: ScoreEntry,
): Promise<{ rank: number | null }> {
  if (hasRedis()) {
    const redis = getRedis();
    const member = JSON.stringify(entry);
    await redis.zadd(KEY, { score: entry.score, member });
    // Cap set size
    const count = await redis.zcard(KEY);
    if (count > MAX_GLOBAL * 2) {
      // Remove lowest scores (keep top MAX_GLOBAL*1.5)
      await redis.zremrangebyrank(KEY, 0, count - MAX_GLOBAL - 1);
    }
    await redis.expire(KEY, TTL_SECONDS);

    // Rank: 0-based from highest — zrevrank
    const rank0 = await redis.zrevrank(KEY, member);
    return { rank: rank0 === null ? null : rank0 + 1 };
  }

  const list = mem();
  list.push(entry);
  const sorted = sortScores(list);
  memory.__mineCrushScores = sorted.slice(0, MAX_GLOBAL);
  const idx = memory.__mineCrushScores.findIndex((e) => e.id === entry.id);
  return { rank: idx >= 0 ? idx + 1 : null };
}

export function usingRedisForScores(): boolean {
  return hasRedis();
}
