import type { Difficulty, GameMode, SabotageType } from "@/lib/minesweeper/types";

export type RoomStatus = "waiting" | "playing" | "finished";
export type PlayerPlayStatus = "idle" | "playing" | "finished";

export interface SabotageEvent {
  id: string;
  type: SabotageType;
  fromPlayerId: string;
  createdAt: number;
}

export interface RoomPlayer {
  id: string;
  name: string;
  ready: boolean;
  openedCount: number;
  flagCount: number;
  mineHits: number;
  score: number;
  combo: number;
  lives: number;
  playStatus: PlayerPlayStatus;
}

export interface Room {
  id: string;
  seed: number;
  difficulty: Difficulty;
  mode: Extract<GameMode, "versus" | "coop">;
  status: RoomStatus;
  host: RoomPlayer;
  guest: RoomPlayer | null;
  /** Winner player id (versus); null if unfinished, draw, or coop win. */
  winnerId: string | null;
  /** versus: win/draw; coop: win/loss for the team */
  result: "win" | "draw" | "loss" | null;
  /** Shared team lives for coop */
  teamLives: number;
  startedAt: number | null;
  createdAt: number;
  /** Sabotage queue (versus) — each player consumes events not from themselves */
  sabotages: SabotageEvent[];
}
