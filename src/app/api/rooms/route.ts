import { NextResponse } from "next/server";
import { createRoom } from "@/lib/rooms/service";
import type { Difficulty, GameMode } from "@/lib/minesweeper/types";
import { DIFFICULTIES } from "@/lib/minesweeper/types";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const playerId = String(body.playerId ?? "");
    const playerName = String(body.playerName ?? "Host");
    const difficulty = body.difficulty as Difficulty;
    const mode = (body.mode as GameMode) || "versus";

    if (!playerId) {
      return NextResponse.json({ error: "playerId required" }, { status: 400 });
    }
    if (!difficulty || !DIFFICULTIES[difficulty]) {
      return NextResponse.json({ error: "Invalid difficulty" }, { status: 400 });
    }
    if (mode !== "versus" && mode !== "coop") {
      return NextResponse.json(
        { error: "Mode must be versus or coop" },
        { status: 400 },
      );
    }

    const room = await createRoom(playerId, playerName, difficulty, mode);
    return NextResponse.json({ room });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create room";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
