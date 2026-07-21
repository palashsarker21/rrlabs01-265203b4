import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSystemHealth } from "@/lib/system-health.functions";
import { cn } from "@/lib/utils";
import type { InternalCheckStatus } from "@/lib/system-health.functions";

type Pill = { label: string; status: InternalCheckStatus };

function dotClass(s: InternalCheckStatus) {
  switch (s) {
    case "ok":
      return "bg-emerald-500";
    case "degraded":
      return "bg-amber-500";
    case "down":
      return "bg-rose-500";
    default:
      return "bg-muted-foreground/40";
  }
}

/**
 * Always-visible status bar with pills for each core service.
 * Polls every 60s; green / amber / red / grey (not configured).
 */
export function SystemStatusBar() {
  const health = useServerFn(getSystemHealth);
  const { data } = useQuery({
    queryKey: ["platform-system-health"],
    queryFn: () => health({}),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const pills: Pill[] = [
    { label: "API", status: data?.runtime.server.status ?? "not_configured" },
    { label: "Database", status: data?.runtime.database.status ?? "not_configured" },
    { label: "Queues", status: data?.runtime.server.status ?? "not_configured" },
    { label: "Workers", status: data?.runtime.server.status ?? "not_configured" },
    { label: "AI", status: data?.ai.openrouter.status ?? "not_configured" },
    { label: "Email", status: data?.messaging.resend.status ?? "not_configured" },
    { label: "WhatsApp", status: data?.messaging.whatsapp.status ?? "not_configured" },
    {
      label: "Payments",
      status:
        data?.billing.lemonsqueezy.status === "ok" || data?.billing.stripe.status === "ok"
          ? "ok"
          : (data?.billing.lemonsqueezy.status ?? "not_configured"),
    },
  ];

  const overall = data?.overall ?? "not_configured";

  return (
    <div
      role="status"
      aria-label="System status"
      className="flex items-center gap-3 overflow-x-auto border-b border-border/60 bg-card/30 px-4 py-1.5 text-xs"
    >
      <div className="flex items-center gap-1.5 pr-2">
        <span className={cn("h-2 w-2 rounded-full", dotClass(overall))} aria-hidden />
        <span className="font-medium">System</span>
      </div>
      <div className="flex flex-1 items-center gap-3">
        {pills.map((p) => (
          <div
            key={p.label}
            title={`${p.label}: ${p.status}`}
            className="flex items-center gap-1.5 whitespace-nowrap text-muted-foreground"
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", dotClass(p.status))} aria-hidden />
            <span>{p.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
