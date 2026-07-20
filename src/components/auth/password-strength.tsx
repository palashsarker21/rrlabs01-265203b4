import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PASSWORD_RULES, evaluatePassword } from "@/lib/auth/password-policy";

interface Props {
  password: string;
  className?: string;
}

/**
 * Live password policy checklist + strength meter.
 * Announces changes via aria-live so screen readers hear updates.
 */
export function PasswordStrength({ password, className }: Props) {
  const ev = evaluatePassword(password);
  const width = (ev.score / PASSWORD_RULES.length) * 100;
  const barColor =
    ev.score <= 1
      ? "bg-destructive"
      : ev.score <= 2
        ? "bg-orange-500"
        : ev.score <= 3
          ? "bg-yellow-500"
          : ev.score <= 4
            ? "bg-emerald-500"
            : "bg-emerald-600";

  return (
    <div className={cn("space-y-2", className)} aria-live="polite">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full transition-all duration-300", barColor)}
          style={{ width: `${width}%` }}
          role="progressbar"
          aria-valuenow={ev.score}
          aria-valuemin={0}
          aria-valuemax={PASSWORD_RULES.length}
          aria-label={`Password strength: ${ev.label}`}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Strength: <span className="font-medium text-foreground">{ev.label}</span>
      </p>
      <ul className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
        {PASSWORD_RULES.map((r) => {
          const ok = ev.passed.has(r.id);
          return (
            <li
              key={r.id}
              className={cn(
                "flex items-center gap-1.5",
                ok ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
              )}
            >
              {ok ? (
                <Check className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <X className="h-3.5 w-3.5" aria-hidden />
              )}
              <span>{r.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Hook: detect Caps Lock while typing in a password input. */
export function useCapsLock() {
  const [caps, setCaps] = useState(false);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (typeof e.getModifierState === "function") {
        setCaps(e.getModifierState("CapsLock"));
      }
    };
    window.addEventListener("keydown", handler);
    window.addEventListener("keyup", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener("keyup", handler);
    };
  }, []);
  return caps;
}
