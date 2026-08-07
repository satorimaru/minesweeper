import { nanoid } from "nanoid";
import { randomSeed } from "@/lib/prng";
import type { Difficulty, GameMode, SabotageType } from "@/lib/minesweeper/types";
import { DIFFICULTIES, safeCellCount, startingLives } from "@/lib/minesweeper/types";
import { getRoom, saveRoom } from "./store";
import type { Room, RoomPlayer } from "./types";

function makePlayer(id: string, name: string, mode: Room["mode"]): RoomPlayer {
  return {
    id,
    name: name.trim().slice(0, 24) || "Player",
    ready: false,
    openedCount: 0,
    flagCount: 0,
    mineHits: 0,
    score: 0,
    combo: 0,
    lives: startingLives(mode),
    playStatus: "idle",
  };
}

function resetPlayerProgress(p: RoomPlayer, mode: Room["mode"]): void {
  p.ready = false;
  p.openedCount = 0;
  p.flagCount = 0;
  p.mineHits = 0;
  p.score = 0;
  p.combo = 0;
  p.lives = startingLives(mode);
  p.playStatus = "idle";
}

function resolveVersus(room: Room): void {
  if (!room.host || !room.guest) return;
  if (
    room.host.playStatus !== "finished" ||
    room.guest.playStatus !== "finished"
  ) {
    return;
  }

  const a = room.host.score;
  const b = room.guest.score;
  room.status = "finished";

  if (a === b) {
    room.result = "draw";
    room.winnerId = null;
  } else if (a > b) {
    room.result = "win";
    room.winnerId = room.host.id;
  } else {
    room.result = "win";
    room.winnerId = room.guest.id;
  }
}

function resolveCoop(room: Room): void {
  if (!room.host || !room.guest) return;

  if (room.teamLives <= 0) {
    room.status = "finished";
    room.result = "loss";
    room.winnerId = null;
    return;
  }

  if (
    room.host.playStatus === "finished" &&
    room.guest.playStatus === "finished"
  ) {
    room.status = "finished";
    room.result = "win";
    room.winnerId = null;
  }
}

export async function createRoom(
  hostId: string,
  hostName: string,
  difficulty: Difficulty,
  mode: Extract<GameMode, "versus" | "coop"> = "versus",
): Promise<Room> {
  if (!DIFFICULTIES[difficulty]) {
    throw new Error("Invalid difficulty");
  }
  if (mode !== "versus" && mode !== "coop") {
    throw new Error("Invalid mode");
  }

  const room: Room = {
    id: nanoid(10),
    seed: randomSeed(),
    difficulty,
    mode,
    status: "waiting",
    host: makePlayer(hostId, hostName || "Host", mode),
    guest: null,
    winnerId: null,
    result: null,
    teamLives: mode === "coop" ? 3 : 99,
    startedAt: null,
    createdAt: Date.now(),
    sabotages: [],
  };

  await saveRoom(room);
  return room;
}

export async function joinRoom(
  roomId: string,
  playerId: string,
  playerName: string,
): Promise<Room> {
  const room = await getRoom(roomId);
  if (!room) throw new Error("Room not found");

  if (room.host.id === playerId) return room;
  if (room.guest?.id === playerId) return room;

  if (room.guest) {
    throw new Error("Room is full");
  }
  if (room.status !== "waiting") {
    throw new Error("Game already started");
  }

  room.guest = makePlayer(playerId, playerName || "Guest", room.mode);
  await saveRoom(room);
  return room;
}

export async function setReady(
  roomId: string,
  playerId: string,
  ready: boolean,
): Promise<Room> {
  const room = await getRoom(roomId);
  if (!room) throw new Error("Room not found");
  if (room.status !== "waiting") throw new Error("Game already started");

  const player =
    room.host.id === playerId
      ? room.host
      : room.guest?.id === playerId
        ? room.guest
        : null;
  if (!player) throw new Error("Not a player in this room");

  player.ready = ready;

  if (room.host.ready && room.guest?.ready) {
    room.status = "playing";
    room.startedAt = Date.now();
    room.host.playStatus = "playing";
    room.host.ready = true;
    room.guest.playStatus = "playing";
    room.guest.ready = true;
    room.teamLives = room.mode === "coop" ? 3 : 99;
    room.sabotages = [];
  }

  await saveRoom(room);
  return room;
}

export async function updateProgress(
  roomId: string,
  playerId: string,
  data: {
    openedCount: number;
    flagCount: number;
    mineHits: number;
    score: number;
    combo: number;
    lives: number;
  },
): Promise<Room> {
  const room = await getRoom(roomId);
  if (!room) throw new Error("Room not found");
  if (room.status !== "playing") return room;

  const player =
    room.host.id === playerId
      ? room.host
      : room.guest?.id === playerId
        ? room.guest
        : null;
  if (!player || player.playStatus !== "playing") return room;

  const prevHits = player.mineHits;
  player.openedCount = Math.max(0, data.openedCount);
  player.flagCount = Math.max(0, data.flagCount);
  player.mineHits = Math.max(0, data.mineHits);
  player.score = Math.max(0, Math.floor(data.score));
  player.combo = Math.max(0, Math.floor(data.combo));
  player.lives = Math.max(0, Math.floor(data.lives));

  if (room.mode === "coop") {
    // New mine hits from either player drain team lives
    const deltaHits = Math.max(0, player.mineHits - prevHits);
    if (deltaHits > 0) {
      room.teamLives = Math.max(0, room.teamLives - deltaHits);
    }
    // Mirror remaining team lives onto both players for UI
    room.host.lives = room.teamLives;
    if (room.guest) room.guest.lives = room.teamLives;
    resolveCoop(room);
  }

  await saveRoom(room);
  return room;
}

export async function sendSabotage(
  roomId: string,
  playerId: string,
  type: SabotageType,
): Promise<Room> {
  const room = await getRoom(roomId);
  if (!room) throw new Error("Room not found");
  if (room.mode !== "versus") throw new Error("Sabotage only in versus");
  if (room.status !== "playing") throw new Error("Game not in progress");

  const isPlayer =
    room.host.id === playerId || room.guest?.id === playerId;
  if (!isPlayer) throw new Error("Not a player in this room");

  room.sabotages.push({
    id: nanoid(8),
    type,
    fromPlayerId: playerId,
    createdAt: Date.now(),
  });
  // Keep queue short
  if (room.sabotages.length > 20) {
    room.sabotages = room.sabotages.slice(-20);
  }

  await saveRoom(room);
  return room;
}

/**
 * Player finished clearing the board. Locks their score.
 * Versus ends when both finish (higher score wins).
 * Coop ends when both finish (team win) or team lives hit 0.
 */
export async function reportFinish(
  roomId: string,
  playerId: string,
  data: {
    score: number;
    mineHits: number;
    openedCount: number;
  },
): Promise<Room> {
  const room = await getRoom(roomId);
  if (!room) throw new Error("Room not found");
  if (room.status === "finished") return room;
  if (room.status !== "playing") throw new Error("Game not in progress");

  const isHost = room.host.id === playerId;
  const isGuest = room.guest?.id === playerId;
  if (!isHost && !isGuest) throw new Error("Not a player in this room");

  const me = isHost ? room.host : room.guest!;
  if (me.playStatus === "finished") return room;

  const config = DIFFICULTIES[room.difficulty];
  const needed = safeCellCount(config);
  if (data.openedCount < needed - 2) {
    throw new Error("Board not cleared yet");
  }

  me.playStatus = "finished";
  me.mineHits = Math.max(0, Math.floor(data.mineHits));
  me.openedCount = Math.max(data.openedCount, needed);
  me.score = Math.max(0, Math.floor(data.score));
  me.combo = 0;

  if (room.mode === "versus") {
    resolveVersus(room);
  } else {
    resolveCoop(room);
  }

  await saveRoom(room);
  return room;
}

export async function rematchRoom(
  roomId: string,
  playerId: string,
): Promise<Room> {
  const room = await getRoom(roomId);
  if (!room) throw new Error("Room not found");
  if (room.host.id !== playerId && room.guest?.id !== playerId) {
    throw new Error("Not a player in this room");
  }

  room.seed = randomSeed();
  room.status = "waiting";
  room.winnerId = null;
  room.result = null;
  room.startedAt = null;
  room.teamLives = room.mode === "coop" ? 3 : 99;
  room.sabotages = [];

  for (const p of [room.host, room.guest]) {
    if (!p) continue;
    resetPlayerProgress(p, room.mode);
  }

  await saveRoom(room);
  return room;
}
