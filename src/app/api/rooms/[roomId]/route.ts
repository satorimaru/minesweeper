import { NextResponse } from "next/server";
import { getRoom } from "@/lib/rooms/store";
import {
  joinRoom,
  rematchRoom,
  reportFinish,
  sendSabotage,
  setReady,
  updateProgress,
} from "@/lib/rooms/service";
import type { SabotageType } from "@/lib/minesweeper/types";

type Params = { params: Promise<{ roomId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { roomId } = await params;
  const room = await getRoom(roomId);
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }
  return NextResponse.json({ room });
}

export async function POST(request: Request, { params }: Params) {
  const { roomId } = await params;
  try {
    const body = await request.json();
    const action = String(body.action ?? "");
    const playerId = String(body.playerId ?? "");

    if (!playerId) {
      return NextResponse.json({ error: "playerId required" }, { status: 400 });
    }

    switch (action) {
      case "join": {
        const room = await joinRoom(
          roomId,
          playerId,
          String(body.playerName ?? "Guest"),
        );
        return NextResponse.json({ room });
      }
      case "ready": {
        const room = await setReady(roomId, playerId, Boolean(body.ready));
        return NextResponse.json({ room });
      }
      case "progress": {
        const room = await updateProgress(roomId, playerId, {
          openedCount: Number(body.openedCount ?? 0),
          flagCount: Number(body.flagCount ?? 0),
          mineHits: Number(body.mineHits ?? 0),
          score: Number(body.score ?? 0),
          combo: Number(body.combo ?? 0),
          lives: Number(body.lives ?? 0),
        });
        return NextResponse.json({ room });
      }
      case "sabotage": {
        const type = String(body.type ?? "freeze") as SabotageType;
        if (type !== "freeze" && type !== "fog" && type !== "shake") {
          return NextResponse.json(
            { error: "Invalid sabotage type" },
            { status: 400 },
          );
        }
        const room = await sendSabotage(roomId, playerId, type);
        return NextResponse.json({ room });
      }
      case "finish": {
        const room = await reportFinish(roomId, playerId, {
          score: Number(body.score ?? 0),
          mineHits: Number(body.mineHits ?? 0),
          openedCount: Number(body.openedCount ?? 0),
        });
        return NextResponse.json({ room });
      }
      case "rematch": {
        const room = await rematchRoom(roomId, playerId);
        return NextResponse.json({ room });
      }
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed";
    const status =
      message === "Room not found"
        ? 404
        : message === "Room is full" || message === "Game already started"
          ? 409
          : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
