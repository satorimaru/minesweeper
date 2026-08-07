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
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col pt-[max(0.5rem,env(safe-area-inset-top))]">
      <OnlineGame roomId={roomId} />
    </main>
  );
}
