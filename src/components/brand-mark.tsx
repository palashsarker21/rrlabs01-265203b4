/**
 * BrandMark — RRLabs interim mark (geometric R/recovery arrow).
 * Will be replaced with the official uploaded logo.
 */
export function BrandMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <div
      className={className}
      style={{ width: size, height: size }}
      aria-label="RRLabs"
    >
      <svg viewBox="0 0 48 48" width={size} height={size} role="img" aria-hidden>
        <defs>
          <linearGradient id="rrl-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" />
            <stop offset="100%" stopColor="hsl(var(--chart-2))" />
          </linearGradient>
        </defs>
        <rect x="1" y="1" width="46" height="46" rx="12" fill="url(#rrl-g)" />
        <path
          d="M14 34V14h10a6 6 0 0 1 3 11l5 9h-5l-4.5-8H19v8h-5Zm5-13h4a2 2 0 0 0 0-4h-4v4Z"
          fill="hsl(var(--primary-foreground))"
        />
      </svg>
    </div>
  );
}

export function BrandLockup({ size = 32 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <BrandMark size={size} />
      <div className="flex flex-col leading-none">
        <span className="text-sm font-bold tracking-tight text-foreground">RRLabs</span>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
          AI Recovery
        </span>
      </div>
    </div>
  );
}
