import type { ReactNode } from "react";

export function PageHeader({ title, description, actions, eyebrow }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? <p className="mb-1.5 text-[12px] font-medium tracking-[0.12em] text-muted uppercase">{eyebrow}</p> : null}
        <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.025em] text-fg sm:text-[30px]">{title}</h1>
        {description ? <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-muted-strong">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function PageContainer({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 ${className}`}>{children}</div>;
}
