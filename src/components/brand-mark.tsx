/**
 * BrandMark — official RRLabs logo (transparent PNG served from CDN).
 * The image must always be shown on a transparent background and never
 * recolored, cropped, or distorted.
 */
import { LOGO, BRAND } from "@/lib/brand";

export function BrandMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <img
      src={LOGO.full}
      alt={`${BRAND.name} logo`}
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size, objectFit: "contain" }}
      draggable={false}
    />
  );
}

export function BrandLockup({ size = 32 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <BrandMark size={size} />
      <div className="flex flex-col leading-none">
        <span className="text-sm font-bold tracking-tight text-foreground">{BRAND.name}</span>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Revenue Recovery Labs
        </span>
      </div>
    </div>
  );
}
