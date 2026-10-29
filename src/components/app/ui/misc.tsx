import type { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = "",
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-center px-6 py-12 text-center ${className}`}>
      {icon ? (
        <div className="mb-4 flex size-12 items-center justify-center rounded-xl border border-line bg-canvas text-muted-strong">
          {icon}
        </div>
      ) : null}
      <p className="text-[15px] font-semibold text-fg">{title}</p>
      {description ? <p className="mt-1.5 max-w-sm text-[13.5px] leading-relaxed text-muted-strong">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-line/70 ${className}`} aria-hidden />;
}

export function ProgressBar({ value, max = 100, label, className = "" }: { value: number; max?: number; label?: string; className?: string }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-label={label}
      className={`h-1.5 w-full overflow-hidden rounded-full bg-line ${className}`}
    >
      <div className="h-full rounded-full bg-fg transition-[width] duration-500" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Avatar({ name, src, size = 32, className = "" }: { name: string; src?: string | null; size?: number; className?: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#E4DFD5] font-medium text-fg ${className}`}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.36) }}
      aria-hidden={!src}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- imagem servida pela rota autenticada de arquivos
        <img src={src} alt={name} className="size-full object-cover" />
      ) : (
        initials || "?"
      )}
    </span>
  );
}

export function StatLabel({ children }: { children: ReactNode }) {
  return <p className="text-[12.5px] font-medium text-muted-strong">{children}</p>;
}
