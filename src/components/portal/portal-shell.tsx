import Image from "next/image";
import type { ReactNode } from "react";

/** Moldura das telas públicas do portal (entrar / confirmar acesso). */
export function PortalAuthShell({ children, title, subtitle }: { children: ReactNode; title: string; subtitle?: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-[420px] animate-fade-in">
        <Image src="/images/gt-studio/logo-wordmark.png" alt="GT Studio" width={1328} height={327} className="mx-auto mb-10 h-7 w-auto" priority />
        <div className="rounded-3xl border border-line bg-surface p-7 shadow-[0_24px_60px_-32px_rgba(23,23,23,0.25)] sm:p-9">
          <p className="mb-2 text-[11.5px] font-medium tracking-[0.16em] text-muted uppercase">Portal do Cliente</p>
          <h1 className="text-[24px] leading-tight font-semibold tracking-[-0.02em]">{title}</h1>
          {subtitle ? <p className="mt-2 text-[14.5px] leading-relaxed text-muted-strong">{subtitle}</p> : null}
          <div className="mt-7">{children}</div>
        </div>
        <p className="mt-6 text-center text-[12px] text-muted">Acesso pessoal e protegido. Não compartilhe seus links.</p>
      </div>
    </main>
  );
}
