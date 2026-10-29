"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarDays, Columns3, List, Plus, Search } from "lucide-react";
import { Button } from "@/components/app/ui/button";
import { useSetParams } from "@/components/app/ui/use-params";
import { APPROVAL_LABELS, PLATFORM_LABELS, PLATFORMS } from "@/lib/domain/labels";
import { PIPELINE_LABELS } from "@/lib/domain/posts-metrics-labels";
import { PostFormModal, type CompanyOption } from "./post-form-modal";

const VIEWS = [
  { key: "lista", label: "Lista", icon: List },
  { key: "quadro", label: "Quadro", icon: Columns3 },
  { key: "calendario", label: "Calendário", icon: CalendarDays },
] as const;

const selectCls = "h-9 rounded-lg border border-line-strong bg-surface px-2.5 text-[13px] text-fg outline-none hover:bg-canvas";

export function PostsToolbar({
  view,
  companies,
  members,
  userId,
  canCreate,
  autoOpen,
  defaultCompanyId,
}: {
  view: string;
  companies: CompanyOption[];
  members: { id: string; name: string }[];
  userId: string;
  canCreate: boolean;
  autoOpen: boolean;
  defaultCompanyId: string | null;
}) {
  const params = useSearchParams();
  const setParams = useSetParams();
  const [open, setOpen] = useState(autoOpen);
  const [q, setQ] = useState(params.get("q") ?? "");
  const active = ["etapa", "aprovacao", "plataforma", "responsavel", "q"].some((k) => params.get(k));

  return (
    <div className="mb-5 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="flex rounded-lg border border-line bg-surface p-0.5" aria-label="Visualização">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => setParams({ visao: v.key === "lista" ? null : v.key })}
              aria-current={view === v.key ? "true" : undefined}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium ${view === v.key ? "bg-fg text-white" : "text-muted-strong hover:text-fg"}`}
            >
              <v.icon className="size-4" aria-hidden /> {v.label}
            </button>
          ))}
        </nav>
        {canCreate ? (
          <Button variant="primary" size="sm" icon={<Plus className="size-4" />} onClick={() => setOpen(true)}>
            Nova postagem
          </Button>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <form
          className="relative min-w-[200px] flex-1 sm:max-w-[260px]"
          onSubmit={(e) => {
            e.preventDefault();
            setParams({ q: q.trim() || null });
          }}
        >
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} onBlur={() => setParams({ q: q.trim() || null })} placeholder="Título ou legenda" aria-label="Buscar postagens" className="h-9 w-full rounded-lg border border-line-strong bg-surface pr-3 pl-9 text-[13px] outline-none placeholder:text-muted focus:border-fg/40" />
        </form>
        <select className={selectCls} aria-label="Etapa do fluxo" value={params.get("etapa") ?? ""} onChange={(e) => setParams({ etapa: e.target.value || null })}>
          <option value="">Todas as etapas</option>
          {Object.entries(PIPELINE_LABELS).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
        <select className={selectCls} aria-label="Aprovação" value={params.get("aprovacao") ?? ""} onChange={(e) => setParams({ aprovacao: e.target.value || null })}>
          <option value="">Qualquer aprovação</option>
          {Object.entries(APPROVAL_LABELS).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
        <select className={selectCls} aria-label="Rede" value={params.get("plataforma") ?? ""} onChange={(e) => setParams({ plataforma: e.target.value || null })}>
          <option value="">Todas as redes</option>
          {PLATFORMS.map((p) => (
            <option key={p} value={p}>
              {PLATFORM_LABELS[p]}
            </option>
          ))}
        </select>
        <select className={selectCls} aria-label="Responsável" value={params.get("responsavel") ?? ""} onChange={(e) => setParams({ responsavel: e.target.value || null })}>
          <option value="">Todos os responsáveis</option>
          <option value={userId}>Minhas postagens</option>
          <option value="none">Sem responsável</option>
          {members
            .filter((m) => m.id !== userId)
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
        </select>
        {active ? (
          <button
            type="button"
            className="text-[12.5px] text-muted-strong underline hover:text-fg"
            onClick={() => {
              setQ("");
              setParams({ etapa: null, aprovacao: null, plataforma: null, responsavel: null, q: null });
            }}
          >
            Limpar filtros
          </button>
        ) : null}
      </div>
      {open ? (
        <PostFormModal
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o && params.get("nova")) setParams({ nova: null }, { replace: true });
          }}
          companies={companies}
          members={members}
          defaultCompanyId={defaultCompanyId}
        />
      ) : null}
    </div>
  );
}
