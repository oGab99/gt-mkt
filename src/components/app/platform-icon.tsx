import type { PlatformKey } from "@/lib/domain/labels";
import { PLATFORM_LABELS } from "@/lib/domain/labels";

/** Marcas simplificadas das redes, em traço único (monocromático). */
export function PlatformIcon({ platform, className = "size-4" }: { platform: PlatformKey | string; className?: string }) {
  const common = { className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  switch (platform) {
    case "INSTAGRAM":
      return (
        <svg {...common}>
          <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
          <circle cx="12" cy="12" r="3.8" />
          <circle cx="17.2" cy="6.8" r="0.6" fill="currentColor" />
        </svg>
      );
    case "FACEBOOK":
      return (
        <svg {...common}>
          <path d="M14.5 8.5h2V5h-2.4C11.6 5 10.5 6.6 10.5 9v2H8v3.4h2.5V21h3.4v-6.6h2.4l.5-3.4h-2.9V9.3c0-.5.3-.8.6-.8Z" />
        </svg>
      );
    case "TIKTOK":
      return (
        <svg {...common}>
          <path d="M14 3.5v11.2a3.8 3.8 0 1 1-3.3-3.8" />
          <path d="M14 3.5c.4 2.6 2.2 4.4 5 4.6" />
        </svg>
      );
    case "YOUTUBE":
      return (
        <svg {...common}>
          <rect x="2.8" y="5.8" width="18.4" height="12.4" rx="3.6" />
          <path d="m10.3 9.4 4.4 2.6-4.4 2.6Z" fill="currentColor" />
        </svg>
      );
    default:
      return null;
  }
}

export function PlatformList({ platforms, className = "" }: { platforms: string[]; className?: string }) {
  if (!platforms.length) return <span className="text-[12.5px] text-muted">—</span>;
  return (
    <span className={`inline-flex items-center gap-1.5 text-muted-strong ${className}`}>
      {platforms.map((p) => (
        <span key={p} title={PLATFORM_LABELS[p as PlatformKey]}>
          <PlatformIcon platform={p} />
          <span className="sr-only">{PLATFORM_LABELS[p as PlatformKey]}</span>
        </span>
      ))}
    </span>
  );
}
