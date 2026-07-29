import { useEffect, useState } from "react";
import { getReadiness } from "@/lib/api";

type HealthState = "checking" | "ready" | "degraded" | "offline";

const POLL_INTERVAL_MS = 30000;

const STATE_CONFIG: Record<HealthState, { label: string; dot: string; text: string; glow: boolean }> = {
  checking: { label: "Checking…", dot: "bg-[hsl(0_0%_40%)]", text: "text-[hsl(0_0%_50%)]", glow: false },
  ready: { label: "All systems operational", dot: "bg-[hsl(142_71%_45%)]", text: "text-[hsl(142_71%_55%)]", glow: true },
  degraded: { label: "Degraded — check system status", dot: "bg-amber-400", text: "text-amber-400", glow: false },
  offline: { label: "Backend unreachable", dot: "bg-rose-500", text: "text-rose-400", glow: false },
};

const HealthIndicator = () => {
  const [state, setState] = useState<HealthState>("checking");

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const result = await getReadiness();
        if (cancelled) return;
        setState(result.status === "ready" ? "ready" : "degraded");
      } catch {
        if (!cancelled) setState("offline");
      }
    };

    check();
    const interval = setInterval(check, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const cfg = STATE_CONFIG[state];

  return (
    <div
      title={cfg.label}
      className="flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1.5 shrink-0"
    >
      <span className="relative flex h-2 w-2">
        {cfg.glow && (
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${cfg.dot} opacity-75`} />
        )}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${cfg.dot}`} />
      </span>
      <span className={`font-mono-label text-[11px] tracking-wide whitespace-nowrap ${cfg.text}`}>{cfg.label}</span>
    </div>
  );
};

export default HealthIndicator;
