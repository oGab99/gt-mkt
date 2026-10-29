import type { HTMLAttributes, ReactNode } from "react";

export function Card({ className = "", children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`rounded-xl border border-line bg-surface ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
  className = "",
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-start justify-between gap-x-4 gap-y-3 px-5 pt-5 ${className}`}>
      <div className="min-w-0">
        <h2 className="text-[14.5px] font-semibold tracking-[-0.01em] text-fg">{title}</h2>
        {description ? <p className="mt-0.5 text-[12.5px] text-muted-strong">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
