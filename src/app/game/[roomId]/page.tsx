"use client";

import { use } from "react";
import { OnlineGame } from "@/components/OnlineGame";

export default function GameRoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = use(params);
  return (
    <main className="mx-auto flex h-dvh max-h-dvh w-full max-w-lg flex-col overflow-hidden pt-[max(0.25rem,env(safe-area-inset-top))]">
      <OnlineGame roomId={roomId} />
    </main>
  );
}
