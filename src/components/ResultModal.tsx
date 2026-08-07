"use client";

interface ResultModalProps {
  title: string;
  subtitle?: string;
  stats: { label: string; value: string }[];
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  tone?: "win" | "lose" | "draw";
}

export function ResultModal({
  title,
  subtitle,
  stats,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  tone = "win",
}: ResultModalProps) {
  const ring =
    tone === "win"
      ? "from-amber-400 to-fuchsia-500"
      : tone === "draw"
        ? "from-sky-400 to-violet-500"
        : "from-rose-500 to-slate-700";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center">
      <div
        className={`w-full max-w-sm animate-pop overflow-hidden rounded-3xl bg-gradient-to-b ${ring} p-[2px] shadow-2xl`}
      >
        <div className="rounded-[1.4rem] bg-slate-950 px-6 py-7 text-center text-white">
          <div className="mb-1 text-3xl">
            {tone === "win" ? "🎉" : tone === "draw" ? "🤝" : "💥"}
          </div>
          <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
          {subtitle && (
            <p className="mt-1 text-sm text-white/60">{subtitle}</p>
          )}

          <div className="mt-5 grid grid-cols-2 gap-2">
            {stats.map((s) => (
              <div
                key={s.label}
                className="rounded-2xl bg-white/5 px-3 py-2.5 ring-1 ring-white/10"
              >
                <div className="text-[10px] uppercase tracking-wide text-white/45">
                  {s.label}
                </div>
                <div className="text-lg font-bold tabular-nums text-amber-200">
                  {s.value}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 space-y-2">
            <button
              type="button"
              onClick={onPrimary}
              className="w-full rounded-2xl bg-gradient-to-r from-fuchsia-500 to-violet-500 py-3.5 text-sm font-bold text-white shadow-lg shadow-fuchsia-500/30 active:scale-[0.98]"
            >
              {primaryLabel}
            </button>
            {secondaryLabel && onSecondary && (
              <button
                type="button"
                onClick={onSecondary}
                className="w-full rounded-2xl bg-white/10 py-3 text-sm font-medium text-white/80 active:bg-white/15"
              >
                {secondaryLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
