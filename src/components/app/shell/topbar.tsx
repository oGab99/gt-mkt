"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bell, Building2, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/app/ui/popover";
import { Avatar } from "@/components/app/ui/misc";
import { COMPANY_FILTER_ROUTES, PERIOD_FILTER_ROUTES } from "./nav";
import type { ShellUser } from "./sidebar";

export type ShellNotification = {
  id: string;
  title: string;
  detail: string;
  href: string;
  tone: "negative" | "warning" | "neutral";
};

export type SearchResult = { id: string; type: string; title: string; subtitle: string; href: string };
export type SearchFn = (query: string) => Promise<SearchResult[]>;

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function useParamUpdater() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (key: string, value: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
}

function matches(pathname: string, routes: string[]) {
  return routes.some((r) => pathname === r || pathname.startsWith(`${r}/`));
}

function CompanySelect({ companies }: { companies: { id: string; name: string }[] }) {
  const params = useSearchParams();
  const update = useParamUpdater();
  const current = params.get("empresa") ?? "";
  return (
    <label className="relative flex h-9 items-center">
      <span className="sr-only">Empresa</span>
      <Building2 className="pointer-events-none absolute left-3 size-4 text-muted" aria-hidden />
      <select
        value={companies.some((c) => c.id === current) ? current : ""}
        onChange={(e) => update("empresa", e.target.value || null)}
        className="h-9 max-w-[200px] appearance-none truncate rounded-lg border border-line-strong bg-surface pr-8 pl-9 text-[13px] text-fg outline-none hover:bg-canvas focus-visible:outline-2 focus-visible:outline-fg/30"
      >
        <option value="">Todas as empresas</option>
        {companies.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <ChevronRight className="pointer-events-none absolute right-2.5 size-3.5 rotate-90 text-muted" aria-hidden />
    </label>
  );
}

function PeriodSelect({ currentMonth }: { currentMonth: string }) {
  const params = useSearchParams();
  const update = useParamUpdater();
  const key = params.get("mes") ?? currentMonth;
  const m = key.match(/^(\d{4})-(\d{2})$/);
  const [y, mo] = m ? [Number(m[1]), Number(m[2])] : [Number(currentMonth.slice(0, 4)), Number(currentMonth.slice(5))];
  const shift = (delta: number) => {
    const d = new Date(Date.UTC(y, mo - 1 + delta, 1));
    const k = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    update("mes", k === currentMonth ? null : k);
  };
  return (
    <div className="flex h-9 items-center rounded-lg border border-line-strong bg-surface" role="group" aria-label="Período">
      <button type="button" onClick={() => shift(-1)} className="flex size-9 items-center justify-center rounded-l-lg text-muted-strong hover:bg-canvas hover:text-fg" aria-label="Mês anterior">
        <ChevronLeft className="size-4" />
      </button>
      <button
        type="button"
        onClick={() => update("mes", null)}
        className="min-w-[124px] px-1 text-center text-[13px] font-medium text-fg capitalize"
        title="Voltar para o mês atual"
      >
        {MONTHS[mo - 1]} {y}
      </button>
      <button type="button" onClick={() => shift(1)} className="flex size-9 items-center justify-center rounded-r-lg text-muted-strong hover:bg-canvas hover:text-fg" aria-label="Próximo mês">
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}

function Notifications({ items, markAllRead }: { items: ShellNotification[]; markAllRead?: () => Promise<void> }) {
  const router = useRouter();
  const stored = items.some((n) => n.id.startsWith("n:"));
  const tone = { negative: "bg-negative", warning: "bg-warning", neutral: "bg-muted" };
  return (
    <Popover>
      <PopoverTrigger
        className="relative inline-flex size-9 items-center justify-center rounded-lg border border-line-strong bg-surface text-muted-strong hover:bg-canvas hover:text-fg"
        aria-label={items.length ? `Notificações (${items.length})` : "Notificações"}
      >
        <Bell className="size-[17px]" />
        {items.length ? (
          <span className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-fg px-1 text-[10.5px] font-semibold text-white">
            {items.length > 99 ? "99+" : items.length}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent className="w-[min(92vw,360px)]">
        <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
          <div>
            <p className="text-[14px] font-semibold text-fg">Notificações</p>
            <p className="text-[12px] text-muted-strong">Pendências e respostas dos clientes.</p>
          </div>
          {stored && markAllRead ? (
            <button
              type="button"
              className="shrink-0 text-[12px] font-medium text-muted-strong underline hover:text-fg"
              onClick={async () => {
                await markAllRead();
                router.refresh();
              }}
            >
              Marcar como lidas
            </button>
          ) : null}
        </div>
        {items.length ? (
          <ul className="scroll-thin max-h-[380px] overflow-y-auto p-1.5">
            {items.map((n) => (
              <li key={n.id}>
                {n.id.startsWith("n:") ? (
                  // Notificação registrada: abre pela rota que marca como lida (sem pré-carregamento).
                  <a href={n.href} className="flex gap-3 rounded-lg px-2.5 py-2.5 hover:bg-canvas">
                    <span className={`mt-1.5 size-2 shrink-0 rounded-full ${tone[n.tone]}`} aria-hidden />
                    <span className="min-w-0">
                      <span className="block text-[13.5px] font-medium text-fg">{n.title}</span>
                      <span className="block truncate text-[12.5px] text-muted-strong">{n.detail}</span>
                    </span>
                  </a>
                ) : (
                  <Link href={n.href} className="flex gap-3 rounded-lg px-2.5 py-2.5 hover:bg-canvas">
                    <span className={`mt-1.5 size-2 shrink-0 rounded-full ${tone[n.tone]}`} aria-hidden />
                    <span className="min-w-0">
                      <span className="block text-[13.5px] font-medium text-fg">{n.title}</span>
                      <span className="block truncate text-[12.5px] text-muted-strong">{n.detail}</span>
                    </span>
                  </Link>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-8 text-center text-[13px] text-muted-strong">Nenhuma pendência no momento.</p>
        )}
      </PopoverContent>
    </Popover>
  );
}

function GlobalSearch({ search }: { search: SearchFn }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const seq = useRef(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const id = ++seq.current;
    const t = setTimeout(() => {
      start(async () => {
        const r = await search(q).catch(() => []);
        if (id === seq.current) setResults(r);
      });
    }, 220);
    return () => clearTimeout(t);
  }, [query, search]);

  return (
    <div className="relative w-full max-w-[380px]">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
          if (e.key === "Enter" && results?.[0]) router.push(results[0].href);
        }}
        placeholder="Buscar empresas, postagens, demandas…"
        aria-label="Buscar no sistema"
        className="h-9 w-full rounded-lg border border-line-strong bg-surface pr-12 pl-9 text-[13.5px] text-fg outline-none placeholder:text-muted focus:border-fg/40"
      />
      {query ? (
        <button type="button" onClick={() => setQuery("")} className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-muted hover:text-fg" aria-label="Limpar busca">
          <X className="size-3.5" />
        </button>
      ) : (
        <kbd className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded border border-line px-1.5 text-[11px] text-muted sm:block">⌘K</kbd>
      )}
      {open && query.trim().length >= 2 ? (
        <div className="menu-content absolute top-full right-0 left-0 z-50 mt-2 overflow-hidden rounded-xl border border-line bg-surface shadow-[0_16px_40px_-16px_rgba(23,23,23,0.3)]" data-state="open">
          {pending && !results ? (
            <p className="px-4 py-4 text-[13px] text-muted-strong">Buscando…</p>
          ) : results && results.length ? (
            <ul className="scroll-thin max-h-[360px] overflow-y-auto p-1.5">
              {results.map((r) => (
                <li key={`${r.type}:${r.id}`}>
                  <Link href={r.href} onClick={() => { setOpen(false); setQuery(""); }} className="flex items-center justify-between gap-3 rounded-lg px-2.5 py-2 hover:bg-canvas">
                    <span className="min-w-0">
                      <span className="block truncate text-[13.5px] font-medium text-fg">{r.title}</span>
                      <span className="block truncate text-[12px] text-muted-strong">{r.subtitle}</span>
                    </span>
                    <span className="shrink-0 rounded-md bg-canvas px-1.5 py-0.5 text-[11px] text-muted-strong">{r.type}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-4 text-[13px] text-muted-strong">Nada encontrado para “{query.trim()}”.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function Topbar({
  user,
  companies,
  notifications,
  currentMonth,
  search,
  markAllRead,
}: {
  user: ShellUser;
  companies: { id: string; name: string }[];
  notifications: ShellNotification[];
  currentMonth: string;
  search: SearchFn;
  markAllRead?: () => Promise<void>;
}) {
  const pathname = usePathname();
  const showCompany = matches(pathname, COMPANY_FILTER_ROUTES) && companies.length > 0;
  const showPeriod = matches(pathname, PERIOD_FILTER_ROUTES);

  return (
    <div className="border-b border-line bg-canvas/80 backdrop-blur supports-[backdrop-filter]:bg-canvas/70 lg:sticky lg:top-0 lg:z-30">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-2 px-4 py-3 sm:px-6 lg:flex-nowrap lg:px-8">
        <div className="order-2 w-full lg:order-1 lg:w-auto lg:flex-1">
          <GlobalSearch search={search} />
        </div>
        <div className="order-1 flex w-full flex-wrap items-center gap-2 lg:order-2 lg:w-auto lg:justify-end">
          {showCompany ? <CompanySelect companies={companies} /> : null}
          {showPeriod ? <PeriodSelect currentMonth={currentMonth} /> : null}
          <div className="ml-auto flex items-center gap-2 lg:ml-0">
            <Notifications items={notifications} markAllRead={markAllRead} />
            <Link href="/configuracoes/perfil" className="hidden rounded-full lg:block" aria-label="Meu perfil" title={user.name}>
              <Avatar name={user.name} src={user.image} size={34} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
