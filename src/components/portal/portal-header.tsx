"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, LogOut } from "lucide-react";
import { exitPreview, signOutPortal } from "@/app/portal/actions";

/* eslint-disable @next/next/no-img-element -- logo servida pela rota protegida do portal */
export function PortalHeader({
  company,
  person,
  preview,
}: {
  company: { name: string; logoUrl: string | null };
  person: string | null;
  preview: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const leave = async () => {
    setPending(true);
    try {
      const r = preview ? await exitPreview() : await signOutPortal();
      if (r.ok) router.replace(r.data.redirectTo);
    } finally {
      setPending(false);
    }
  };
  return (
    <>
      {preview ? (
        <div className="sticky top-0 z-40 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-fg px-4 py-2 text-center text-[12.5px] text-white">
          <Eye className="size-3.5 shrink-0" aria-hidden />
          <span>Pré-visualização da agência: você vê o que o cliente vê. Aprovações e comentários estão desativados.</span>
          <button type="button" onClick={leave} disabled={pending} className="font-medium underline underline-offset-2">
            Sair da pré-visualização
          </button>
        </div>
      ) : null}
      <header className="border-b border-line bg-canvas/85 backdrop-blur supports-[backdrop-filter]:bg-canvas/70">
        <div className="mx-auto flex h-16 max-w-[1240px] items-center gap-3 px-4 sm:h-[72px] sm:px-6">
          <Link href="/portal" className="flex min-w-0 items-center gap-3" aria-label={`Início · ${company.name}`}>
            <span className="inline-flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line bg-surface text-[13px] font-semibold">
              {company.logoUrl ? <img src={company.logoUrl} alt="" className="size-full object-contain p-1" /> : company.name.slice(0, 2).toUpperCase()}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[15px] leading-tight font-semibold tracking-[-0.01em]">{company.name}</span>
              <span className="block text-[11.5px] tracking-[0.12em] text-muted uppercase">Portal do Cliente</span>
            </span>
          </Link>
          <div className="ml-auto flex items-center gap-2 sm:gap-4">
            <Image src="/images/gt-studio/logo-wordmark.png" alt="GT Studio" width={1328} height={327} className="hidden h-[18px] w-auto opacity-90 sm:block" />
            <span className="hidden h-6 w-px bg-line-strong sm:block" aria-hidden />
            {person ? <span className="hidden max-w-[160px] truncate text-[13px] text-muted-strong md:block">{person}</span> : null}
            {!preview ? (
              <button
                type="button"
                onClick={leave}
                disabled={pending}
                className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3.5 text-[13px] font-medium hover:bg-canvas disabled:opacity-60"
              >
                <LogOut className="size-4" aria-hidden />
                <span className="hidden sm:inline">Sair</span>
              </button>
            ) : null}
          </div>
        </div>
      </header>
    </>
  );
}
