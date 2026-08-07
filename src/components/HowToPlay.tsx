"use client";

import {
  GAME_MODE_META,
  POWER_UP_ICONS,
  POWER_UP_LABELS,
  type GameMode,
  type PowerUpId,
} from "@/lib/minesweeper";
import { sfx } from "@/lib/sfx";

const CONTROLS: { gesture: string; action: string }[] = [
  { gesture: "Single tap", action: "Place or remove a flag 🚩" },
  { gesture: "Double-tap", action: "Open a cell (unflags first if needed)" },
  { gesture: "Tap an open number", action: "Chord — open neighbors when flags match" },
  { gesture: "Swipe across cells", action: "Paint flags along the path" },
  { gesture: "Open swipe (toolbar)", action: "Swipe paints opens instead of flags" },
  { gesture: "Arm Nuke / Freeze", action: "Tap the power, then tap the board to fire" },
];

const POWER_BLURBS: Record<PowerUpId, string> = {
  blast: "Opens a 3×3 area around the pickup",
  rocket_row: "Clears the whole row of safe cells",
  rocket_col: "Clears the whole column of safe cells",
  radar: "Flags nearby mines for you",
  shield: "Blocks the next mine hit",
  chaos: "Pops several random safe cells",
  nuke: "Inventory — arm, then tap for a 5×5 clear",
  freeze:
    "Inventory — Versus: freezes rival combo · Solo: locks your combo window",
};

const GOAL_LINES = [
  "Open every safe cell. Numbers show how many mines touch that square.",
  "Don’t open mines — Solo ends on a hit (unless you have a shield).",
  "Chaos / Co-op use lives. Versus soft-hits mines (score penalty) and keeps racing.",
  "Chain opens quickly for combos and bigger scores. Power-ups hide under safe cells.",
  "Clear the board to win. Solo & Chaos scores go on the high-score table.",
];

interface HowToPlayProps {
  open: boolean;
  onClose: () => void;
}

export function HowToPlay({ open, onClose }: HowToPlayProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 p-3 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="how-to-play-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          sfx.unlock();
          sfx.ui();
          onClose();
        }
      }}
    >
      <div className="flex max-h-[min(92dvh,40rem)] w-full max-w-md animate-pop flex-col overflow-hidden rounded-3xl bg-gradient-to-b from-violet-600 to-fuchsia-700 p-[2px] shadow-2xl">
        <div className="flex min-h-0 flex-1 flex-col rounded-[1.4rem] bg-slate-950 text-white">
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
            <div>
              <h2
                id="how-to-play-title"
                className="text-lg font-bold tracking-tight"
              >
                How to play
              </h2>
              <p className="text-xs text-white/50">Mine Crush for new players</p>
            </div>
            <button
              type="button"
              onClick={() => {
                sfx.unlock();
                sfx.ui();
                onClose();
              }}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-lg active:bg-white/20"
              aria-label="Close"
            >
              ✕
            </button>
          </header>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-4">
            <Section title="Goal" emoji="🎯">
              <ul className="space-y-2">
                {GOAL_LINES.map((line) => (
                  <li
                    key={line}
                    className="flex gap-2 text-sm leading-snug text-white/75"
                  >
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-fuchsia-400" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </Section>

            <Section title="Controls" emoji="👆">
              <div className="space-y-2">
                {CONTROLS.map((c) => (
                  <div
                    key={c.gesture}
                    className="flex items-start gap-3 rounded-xl bg-white/5 px-3 py-2.5 ring-1 ring-white/8"
                  >
                    <div className="min-w-[6.5rem] shrink-0 text-xs font-bold text-fuchsia-300">
                      {c.gesture}
                    </div>
                    <div className="text-sm leading-snug text-white/80">
                      {c.action}
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-white/40">
                Built for phones: use one finger. Double-tap needs two quick taps
                on the same cell.
              </p>
            </Section>

            <Section title="Modes" emoji="🎮">
              <div className="space-y-2">
                {(Object.keys(GAME_MODE_META) as GameMode[]).map((key) => {
                  const m = GAME_MODE_META[key];
                  return (
                    <div
                      key={key}
                      className="rounded-xl bg-white/5 px-3 py-2.5 ring-1 ring-white/8"
                    >
                      <div className="text-sm font-bold">
                        {m.emoji} {m.label}
                        {m.online && (
                          <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-sky-300">
                            Online
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-white/55">{m.blurb}</p>
                      <p className="mt-1 text-[11px] leading-snug text-white/40">
                        {modeExtra(key)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </Section>

            <Section title="Power-ups" emoji="⭐">
              <p className="mb-2 text-xs text-white/50">
                Hidden under some safe cells (subtle gold edge). Opening that
                cell triggers or bags the power.
              </p>
              <div className="grid grid-cols-1 gap-1.5">
                {(Object.keys(POWER_UP_LABELS) as PowerUpId[]).map((id) => (
                  <div
                    key={id}
                    className="flex items-start gap-2 rounded-xl bg-white/5 px-3 py-2"
                  >
                    <span className="text-lg leading-none">
                      {POWER_UP_ICONS[id]}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white">
                        {POWER_UP_LABELS[id]}
                      </div>
                      <div className="text-[11px] leading-snug text-white/50">
                        {POWER_BLURBS[id]}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            <Section title="Scoring tips" emoji="🏆">
              <ul className="space-y-2 text-sm text-white/75">
                <li className="flex gap-2">
                  <span className="shrink-0">•</span>
                  Open cells in a quick chain to build combos — higher combo =
                  more points.
                </li>
                <li className="flex gap-2">
                  <span className="shrink-0">•</span>
                  Mine hits cost score (and lives in Chaos / Co-op).
                </li>
                <li className="flex gap-2">
                  <span className="shrink-0">•</span>
                  Clearing the board adds a big finish bonus. Solo & Chaos post
                  to local + global high scores.
                </li>
              </ul>
            </Section>
          </div>

          <footer className="shrink-0 border-t border-white/10 p-4">
            <button
              type="button"
              onClick={() => {
                sfx.unlock();
                sfx.ui();
                onClose();
              }}
              className="w-full rounded-2xl bg-gradient-to-r from-fuchsia-500 to-violet-500 py-3.5 text-sm font-bold text-white shadow-lg shadow-fuchsia-500/25 active:scale-[0.98]"
            >
              Got it — let’s crush
            </button>
          </footer>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  emoji,
  children,
}: {
  title: string;
  emoji: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-white/45">
        <span aria-hidden>{emoji}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

function modeExtra(mode: GameMode): string {
  switch (mode) {
    case "solo":
      return "One life. Shields can save you. Highest score wins the leaderboard.";
    case "chaos":
      return "Three lives, more loot, slightly denser mines. Survive and stack combos.";
    case "versus":
      return "Same seed for both players. Higher score after both finish wins. Freeze sabotages your rival.";
    case "coop":
      return "Shared team lives. Both players clear the same seed — finish together.";
  }
}

/** Button for the main menu */
export function HowToPlayButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={() => {
        sfx.unlock();
        sfx.ui();
        onClick();
      }}
      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white/8 py-3 text-sm font-semibold text-white ring-1 ring-white/12 transition active:scale-[0.98] active:bg-white/12"
    >
      <span className="text-base">❓</span>
      How to play
    </button>
  );
}
