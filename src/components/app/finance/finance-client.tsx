"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, MoreHorizontal, Pencil, Plus, Repeat, RotateCcw, Search, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/app/ui/button";
import { Badge } from "@/components/app/ui/badge";
import { EmptyState } from "@/components/app/ui/misc";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/app/ui/menu";
import { useAction } from "@/components/app/ui/use-action";
import { useConfirm } from "@/components/app/ui/confirm";
import { useSetParams } from "@/components/app/ui/use-params";
import { FINANCE_CATEGORIES } from "@/lib/domain/labels";
import { formatBRL } from "@/lib/money";
import { fmtDate, now } from "@/lib/tz";
import { deleteCommission, deleteEntry, setCommissionStatus, setEntryStatus, stopRecurrence } from "@/app/(app)/financeiro/actions";
import { CommissionModal, EntryModal, RecurrenceModal, type EntryValues, type RecurrenceValues } from "./finance-forms";

type Company = { id: string; name: string };
type Perms = { create: boolean; edit: boolean; delete: boolean };

export type EntryRow = EntryValues & { id: string; companyName: string | null; recurring: boolean };

function statusBadge(e: Pick<EntryRow, "status" | "type" | "dueDate">) {
  if (e.status === "PAID") return <Badge tone="positive">{e.type === "INCOME" ? "Recebido" : "Pago"}</Badge>;
  if (e.status === "CANCELED") return <Badge tone="outline">Cancelado</Badge>;
  if (e.dueDate && new Date(e.dueDate).getTime() < now().getTime() - 12 * 3600 * 1000) return <Badge tone="negative">Vencido</Badge>;
  return <Badge tone="warning">{e.type === "INCOME" ? "A receber" : "A pagar"}</Badge>;
}

export function NewEntryButtons({ companies, allowNone, perms }: { companies: Company[]; allowNone: boolean; perms: Perms }) {
  const [open, setOpen] = useState<"entry" | "rec" | "com" | null>(null);
  if (!perms.create) return null;
  return (
    <>
      <Button size="sm" variant="secondary" icon={<Repeat className="size-4" />} onClick={() => setOpen("rec")}>
        Recorrência
      </Button>
      <Button size="sm" variant="secondary" onClick={() => setOpen("com")}>
        Comissão
      </Button>
      <Button size="sm" variant="primary" icon={<Plus className="size-4" />} onClick={() => setOpen("entry")}>
        Novo lançamento
      </Button>
      {open === "entry" ? <EntryModal onClose={() => setOpen(null)} companies={companies} allowNone={allowNone} /> : null}
      {open === "rec" ? <RecurrenceModal onClose={() => setOpen(null)} companies={companies} allowNone={allowNone} /> : null}
      {open === "com" ? <CommissionModal onClose={() => setOpen(null)} companies={companies} allowNone={allowNone} /> : null}
    </>
  );
}

export function EntriesFilters() {
  const params = useSearchParams();
  const setParams = useSetParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const cls = "h-9 rounded-lg border border-line-strong bg-surface px-2.5 text-[13px] outline-none hover:bg-canvas";
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <form className="relative min-w-[200px] flex-1 sm:max-w-[260px]" onSubmit={(e) => { e.preventDefault(); setParams({ q: q.trim() || null }); }}>
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
        <input value={q} onChange={(e) => setQ(e.target.value)} onBlur={() => setParams({ q: q.trim() || null })} placeholder="Buscar descrição" aria-label="Buscar lançamentos" className="h-9 w-full rounded-lg border border-line-strong bg-surface pr-3 pl-9 text-[13px] outline-none placeholder:text-muted focus:border-fg/40" />
      </form>
      <select className={cls} aria-label="Tipo" value={params.get("tipo") ?? ""} onChange={(e) => setParams({ tipo: e.target.value || null })}>
        <option value="">Entradas e saídas</option>
        <option value="INCOME">Entradas</option>
        <option value="EXPENSE">Saídas</option>
      </select>
      <select className={cls} aria-label="Situação" value={params.get("status") ?? ""} onChange={(e) => setParams({ status: e.target.value || null })}>
        <option value="">Todas as situações</option>
        <option value="PENDING">Pendentes</option>
        <option value="vencidos">Vencidos (qualquer mês)</option>
        <option value="PAID">Pagos / recebidos</option>
        <option value="CANCELED">Cancelados</option>
      </select>
      <select className={cls} aria-label="Categoria" value={params.get("categoria") ?? ""} onChange={(e) => setParams({ categoria: e.target.value || null })}>
        <option value="">Todas as categorias</option>
        <optgroup label="Entradas">
          {FINANCE_CATEGORIES.INCOME.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </optgroup>
        <optgroup label="Saídas">
          {FINANCE_CATEGORIES.EXPENSE.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </optgroup>
      </select>
    </div>
  );
}

export function EntriesTable({ entries, companies, allowNone, perms }: { entries: EntryRow[]; companies: Company[]; allowNone: boolean; perms: Perms }) {
  const [editing, setEditing] = useState<EntryRow | null>(null);
  const { run } = useAction();
  const confirm = useConfirm();
  const totals = entries.filter((e) => e.status !== "CANCELED").reduce((s, e) => s + (e.type === "INCOME" ? e.amountCents : -e.amountCents), 0);

  if (!entries.length)
    return (
      <div className="rounded-xl border border-line bg-surface">
        <EmptyState title="Nenhum lançamento encontrado" description="Cadastre entradas e saídas ou ajuste os filtros e o mês." />
      </div>
    );

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="scroll-thin overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-[13px]">
          <thead className="border-b border-line bg-canvas/50 text-[12px] text-muted-strong">
            <tr>
              <th className="px-5 py-2.5 font-medium">Descrição</th>
              <th className="px-3 py-2.5 font-medium">Categoria</th>
              <th className="px-3 py-2.5 font-medium">Vencimento</th>
              <th className="px-3 py-2.5 font-medium">Situação</th>
              <th className="px-3 py-2.5 text-right font-medium">Valor</th>
              <th className="w-12 px-3 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {entries.map((e) => (
              <tr key={e.id} className={e.status === "CANCELED" ? "text-muted" : ""}>
                <td className="px-5 py-3">
                  <p className={`font-medium ${e.status === "CANCELED" ? "line-through" : ""}`}>{e.description}</p>
                  <p className="text-[12px] text-muted-strong">
                    {e.companyName ?? "Geral da agência"}
                    {e.recurring ? " · recorrente" : ""}
                  </p>
                </td>
                <td className="px-3 py-3 text-muted-strong">{e.category}</td>
                <td className="px-3 py-3 tabular-nums">{e.dueDate ? fmtDate(e.dueDate) : fmtDate(e.date)}</td>
                <td className="px-3 py-3">
                  {statusBadge(e)}
                  {e.status === "PAID" && e.paidAt ? <span className="ml-2 text-[12px] text-muted-strong tabular-nums">{fmtDate(e.paidAt)}</span> : null}
                </td>
                <td className={`px-3 py-3 text-right font-medium tabular-nums ${e.type === "INCOME" ? "text-fg" : "text-negative"}`}>
                  {e.type === "INCOME" ? "+" : "−"} {formatBRL(e.amountCents)}
                </td>
                <td className="px-3 py-3">
                  {perms.edit || perms.delete ? (
                    <Menu>
                      <MenuTrigger className="inline-flex size-8 items-center justify-center rounded-lg text-muted-strong hover:bg-canvas" aria-label={`Ações de ${e.description}`}>
                        <MoreHorizontal className="size-4" />
                      </MenuTrigger>
                      <MenuContent>
                        {perms.edit ? (
                          <>
                            {e.status !== "PAID" ? (
                              <MenuItem icon={<CheckCircle2 className="size-4" />} onSelect={() => run(() => setEntryStatus(e.id, "PAID"))}>
                                {e.type === "INCOME" ? "Marcar como recebido" : "Marcar como pago"}
                              </MenuItem>
                            ) : (
                              <MenuItem icon={<RotateCcw className="size-4" />} onSelect={() => run(() => setEntryStatus(e.id, "PENDING"))}>
                                Voltar para pendente
                              </MenuItem>
                            )}
                            <MenuItem icon={<Pencil className="size-4" />} onSelect={() => setEditing(e)}>
                              Editar
                            </MenuItem>
                            {e.status !== "CANCELED" ? (
                              <MenuItem icon={<XCircle className="size-4" />} onSelect={() => run(() => setEntryStatus(e.id, "CANCELED"))}>
                                Cancelar
                              </MenuItem>
                            ) : null}
                          </>
                        ) : null}
                        {perms.delete ? (
                          <>
                            <MenuSeparator />
                            <MenuItem
                              danger
                              icon={<Trash2 className="size-4" />}
                              onSelect={async () => {
                                if (await confirm({ title: "Excluir lançamento?", description: e.recurring ? "Parcelas de recorrência são canceladas em vez de apagadas, para não serem recriadas." : e.description, confirmLabel: "Excluir", danger: true }))
                                  run(() => deleteEntry(e.id));
                              }}
                            >
                              Excluir
                            </MenuItem>
                          </>
                        ) : null}
                      </MenuContent>
                    </Menu>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-line bg-canvas/40 text-[13px]">
            <tr>
              <td className="px-5 py-3 text-muted-strong" colSpan={4}>
                Resultado dos lançamentos listados (sem cancelados)
              </td>
              <td className={`px-3 py-3 text-right font-semibold tabular-nums ${totals < 0 ? "text-negative" : ""}`}>{formatBRL(totals)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      {editing ? <EntryModal initial={editing} onClose={() => setEditing(null)} companies={companies} allowNone={allowNone} /> : null}
    </div>
  );
}

export type RecurrenceRow = RecurrenceValues & { companyName: string | null; active: boolean };

export function RecurrencesList({ items, companies, allowNone, perms }: { items: RecurrenceRow[]; companies: Company[]; allowNone: boolean; perms: Perms }) {
  const [editing, setEditing] = useState<RecurrenceRow | null>(null);
  const { run } = useAction();
  const confirm = useConfirm();
  if (!items.length)
    return (
      <div className="rounded-xl border border-line bg-surface">
        <EmptyState icon={<Repeat className="size-5" />} title="Nenhuma recorrência" description="Use para mensalidades de clientes, assinaturas e custos fixos." />
      </div>
    );
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <ul className="divide-y divide-line">
        {items.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3">
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{r.description}</span>
              <span className="block text-[12px] text-muted-strong">
                {r.companyName ?? "Geral da agência"} · {r.category} · {r.frequency === "MONTHLY" ? `todo dia ${r.dayOfMonth}` : `anual, dia ${r.dayOfMonth}`} · desde {fmtDate(r.startDate)}
                {r.endDate ? ` até ${fmtDate(r.endDate)}` : ""}
              </span>
            </span>
            {r.active ? <Badge tone="positive">Ativa</Badge> : <Badge tone="outline">Encerrada</Badge>}
            <span className={`w-32 text-right font-medium tabular-nums ${r.type === "EXPENSE" ? "text-negative" : ""}`}>
              {r.type === "INCOME" ? "+" : "−"} {formatBRL(r.amountCents)}
            </span>
            {perms.edit && r.active ? (
              <span className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => setEditing(r)}>
                  Editar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-negative"
                  onClick={async () => {
                    if (await confirm({ title: "Encerrar recorrência?", description: "As parcelas futuras pendentes serão canceladas. O histórico fica preservado.", confirmLabel: "Encerrar", danger: true })) run(() => stopRecurrence(r.id));
                  }}
                >
                  Encerrar
                </Button>
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      {editing ? <RecurrenceModal initial={editing} onClose={() => setEditing(null)} companies={companies} allowNone={allowNone} /> : null}
    </div>
  );
}

export type CommissionRow = { id: string; beneficiary: string; description: string; amountCents: number; dueDate: string; status: "PENDING" | "PAID" | "CANCELED"; paidAt: string | null; companyName: string | null };

export function CommissionsList({ items, perms }: { items: CommissionRow[]; perms: Perms }) {
  const { run } = useAction();
  const confirm = useConfirm();
  if (!items.length)
    return (
      <div className="rounded-xl border border-line bg-surface">
        <EmptyState title="Nenhuma comissão registrada" description="Comissões pagas entram nas despesas do mês em que forem pagas." />
      </div>
    );
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <ul className="divide-y divide-line">
        {items.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3">
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{c.beneficiary}</span>
              <span className="block text-[12px] text-muted-strong">
                {c.description} · {c.companyName ?? "Geral"} · vence {fmtDate(c.dueDate)}
              </span>
            </span>
            {c.status === "PAID" ? <Badge tone="positive">Paga {c.paidAt ? fmtDate(c.paidAt) : ""}</Badge> : c.status === "CANCELED" ? <Badge tone="outline">Cancelada</Badge> : <Badge tone="warning">Pendente</Badge>}
            <span className="w-28 text-right font-medium tabular-nums">{formatBRL(c.amountCents)}</span>
            <span className="flex gap-1">
              {perms.edit && c.status === "PENDING" ? (
                <Button size="sm" variant="ghost" onClick={() => run(() => setCommissionStatus(c.id, "PAID"))}>
                  Marcar paga
                </Button>
              ) : null}
              {perms.edit && c.status === "PAID" ? (
                <Button size="sm" variant="ghost" onClick={() => run(() => setCommissionStatus(c.id, "PENDING"))}>
                  Desfazer
                </Button>
              ) : null}
              {perms.delete ? (
                <Button size="sm" variant="ghost" className="text-negative" onClick={async () => { if (await confirm({ title: "Excluir comissão?", confirmLabel: "Excluir", danger: true })) run(() => deleteCommission(c.id)); }}>
                  Excluir
                </Button>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
