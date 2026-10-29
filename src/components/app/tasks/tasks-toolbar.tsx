"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarDays, Columns3, LayoutDashboard, List, Plus, Search } from "lucide-react";
import { Button } from "@/components/app/ui/button";
import { useSetParams } from "@/components/app/ui/use-params";
import { PRIORITY_LABELS, PRIORITIES } from "@/lib/domain/labels";
import type { CompanyNode } from "@/lib/domain/tasks-query";
import { TaskFormModal } from "./task-form-modal";

const VIEWS = [
  { key: "visao-geral", label: "Visão geral", icon: LayoutDashboard },
  { key: "lista", label: "Lista", icon: List },
  { key: "quadro", label: "Quadro", icon: Columns3 },
  { key: "calendario", label: "Calendário", icon: CalendarDays },
] as const;
import type { ViewKey } from "./views";

const selectCls = "h-9 rounded-lg border border-line-strong bg-surface px-2.5 text-[13px] text-fg outline-none hover:bg-canvas focus-visible:outline-2 focus-visible:outline-fg/30";

export function TasksToolbar({
  view,
  members,
  userId,
  tree,
  folderId,
  canCreate,
  autoOpen,
}: {
  view: ViewKey;
  members: { id: string; name: string }[];
  userId: string;
  tree: CompanyNode[];
  folderId?: string;
  canCreate: boolean;
  autoOpen?: boolean;
}) {
  const params = useSearchParams();
  const setParams = useSetParams();
  const [open, setOpen] = useState(Boolean(autoOpen));
  const [q, setQ] = useState(params.get("q") ?? "");

  return (
    <div className="mb-5 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="scroll-thin flex max-w-full overflow-x-auto rounded-lg border border-line bg-surface p-0.5" aria-label="Visualização">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => setParams({ visao: v.key === "visao-geral" ? null : v.key, demanda: null })}
              aria-current={view === v.key ? "true" : undefined}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium whitespace-nowrap ${view === v.key ? "bg-fg text-white" : "text-muted-strong hover:text-fg"}`}
            >
              <v.icon className="size-4" aria-hidden />
              {v.label}
            </button>
          ))}
        </nav>
        {canCreate ? (
          <Button variant="primary" size="sm" icon={<Plus className="size-4" />} onClick={() => setOpen(true)}>
            Nova demanda
          </Button>
        ) : null}
      </div>
      {view !== "visao-geral" ? (
        <div className="flex flex-wrap items-center gap-2">
          <form
            className="relative min-w-[200px] flex-1 sm:max-w-[280px]"
            onSubmit={(e) => {
              e.preventDefault();
              setParams({ q: q.trim() || null });
            }}
          >
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <input value={q} onChange={(e) => setQ(e.target.value)} onBlur={() => setParams({ q: q.trim() || null })} placeholder="Filtrar por título" aria-label="Filtrar por título" className="h-9 w-full rounded-lg border border-line-strong bg-surface pr-3 pl-9 text-[13px] outline-none placeholder:text-muted focus:border-fg/40" />
          </form>
          <select className={selectCls} value={params.get("responsavel") ?? ""} onChange={(e) => setParams({ responsavel: e.target.value || null })} aria-label="Responsável">
            <option value="">Todos os responsáveis</option>
            <option value={userId}>Minhas demandas</option>
            <option value="none">Sem responsável</option>
            {members
              .filter((m) => m.id !== userId)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
          </select>
          <select className={selectCls} value={params.get("prioridade") ?? ""} onChange={(e) => setParams({ prioridade: e.target.value || null })} aria-label="Prioridade">
            <option value="">Todas as prioridades</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </select>
          {params.get("q") || params.get("responsavel") || params.get("prioridade") ? (
            <button type="button" className="text-[12.5px] text-muted-strong underline hover:text-fg" onClick={() => { setQ(""); setParams({ q: null, responsavel: null, prioridade: null }); }}>
              Limpar filtros
            </button>
          ) : null}
        </div>
      ) : null}
      {open ? <TaskFormModal open={open} onOpenChange={setOpen} tree={tree} members={members} defaultFolderId={folderId} /> : null}
    </div>
  );
}
