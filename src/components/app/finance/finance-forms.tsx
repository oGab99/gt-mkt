"use client";

import { useState } from "react";
import { Modal } from "@/components/app/ui/dialog";
import { Button } from "@/components/app/ui/button";
import { Input, Select } from "@/components/app/ui/fields";
import { useAction } from "@/components/app/ui/use-action";
import { FINANCE_CATEGORIES } from "@/lib/domain/labels";
import { centsToInput } from "@/lib/money";
import { monthKey, now, toDateInput } from "@/lib/tz";
import {
  createCommission,
  createEntry,
  createRecurrence,
  setOpeningBalance,
  setRevenueGoal,
  updateEntry,
  updateRecurrence,
} from "@/app/(app)/financeiro/actions";

type Company = { id: string; name: string };

export type EntryValues = {
  id?: string;
  type: "INCOME" | "EXPENSE";
  description: string;
  amountCents: number;
  category: string;
  companyId: string | null;
  date: string;
  dueDate: string | null;
  status: "PENDING" | "PAID" | "CANCELED";
  paidAt: string | null;
};

function CompanySelect({ value, onChange, companies, error, allowNone }: { value: string; onChange: (v: string) => void; companies: Company[]; error?: string; allowNone: boolean }) {
  return (
    <Select label="Empresa" value={value} onChange={(e) => onChange(e.target.value)} error={error}>
      {allowNone ? <option value="">Geral da agência</option> : null}
      {companies.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </Select>
  );
}

function Categories({ type, value, onChange, error }: { type: "INCOME" | "EXPENSE"; value: string; onChange: (v: string) => void; error?: string }) {
  const list = FINANCE_CATEGORIES[type] as readonly string[];
  return (
    <Select label="Categoria" value={value} onChange={(e) => onChange(e.target.value)} error={error}>
      {!list.includes(value) && value ? <option value={value}>{value}</option> : null}
      {list.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </Select>
  );
}

export function EntryModal({ initial, onClose, companies, allowNone }: { initial?: EntryValues; onClose: () => void; companies: Company[]; allowNone: boolean }) {
  const today = toDateInput(now());
  const [v, setV] = useState({
    type: initial?.type ?? ("EXPENSE" as "INCOME" | "EXPENSE"),
    description: initial?.description ?? "",
    amount: initial ? centsToInput(initial.amountCents) : "",
    category: initial?.category ?? FINANCE_CATEGORIES.EXPENSE[0],
    companyId: initial?.companyId ?? (allowNone ? "" : companies[0]?.id ?? ""),
    date: initial ? toDateInput(initial.date) : today,
    dueDate: initial?.dueDate ? toDateInput(initial.dueDate) : today,
    status: (initial?.status === "PAID" ? "PAID" : "PENDING") as "PENDING" | "PAID",
    paidAt: initial?.paidAt ? toDateInput(initial.paidAt) : today,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { run, pending } = useAction();
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((s) => ({ ...s, [k]: val }));

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={initial?.id ? "Editar lançamento" : "Novo lançamento"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="entry-form" loading={pending}>
            Salvar
          </Button>
        </>
      }
    >
      <form
        id="entry-form"
        noValidate
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          const payload = { ...v, paidAt: v.status === "PAID" ? v.paidAt : null };
          run(() => (initial?.id ? updateEntry(initial.id, payload) : createEntry(payload)), { onSuccess: onClose, onError: (r) => setErrors(r.fieldErrors ?? {}) });
        }}
      >
        <div className="flex rounded-lg border border-line bg-canvas p-1 sm:col-span-2" role="radiogroup" aria-label="Tipo">
          {(["INCOME", "EXPENSE"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={v.type === t}
              onClick={() => setV((s) => ({ ...s, type: t, category: FINANCE_CATEGORIES[t][0] }))}
              className={`flex-1 rounded-md py-1.5 text-[13px] font-medium ${v.type === t ? "bg-surface shadow-sm" : "text-muted-strong"}`}
            >
              {t === "INCOME" ? "Entrada (receita)" : "Saída (despesa)"}
            </button>
          ))}
        </div>
        <Input label="Descrição" required value={v.description} onChange={(e) => set("description", e.target.value)} error={errors.description} wrapperClassName="sm:col-span-2" autoFocus maxLength={200} />
        <Input label="Valor (R$)" required inputMode="decimal" placeholder="0,00" value={v.amount} onChange={(e) => set("amount", e.target.value)} error={errors.amount} />
        <Categories type={v.type} value={v.category} onChange={(c) => set("category", c)} error={errors.category} />
        <CompanySelect value={v.companyId} onChange={(c) => set("companyId", c)} companies={companies} error={errors.companyId} allowNone={allowNone} />
        <Input label="Competência" type="date" required value={v.date} onChange={(e) => set("date", e.target.value)} error={errors.date} hint="Mês a que o lançamento se refere" />
        <Input label="Vencimento" type="date" value={v.dueDate} onChange={(e) => set("dueDate", e.target.value)} error={errors.dueDate} />
        <Select label="Situação" value={v.status} onChange={(e) => set("status", e.target.value as "PENDING" | "PAID")}>
          <option value="PENDING">{v.type === "INCOME" ? "A receber" : "A pagar"}</option>
          <option value="PAID">{v.type === "INCOME" ? "Recebido" : "Pago"}</option>
        </Select>
        {v.status === "PAID" ? <Input label={v.type === "INCOME" ? "Recebido em" : "Pago em"} type="date" value={v.paidAt} onChange={(e) => set("paidAt", e.target.value)} error={errors.paidAt} /> : null}
      </form>
    </Modal>
  );
}

export type RecurrenceValues = {
  id: string;
  type: "INCOME" | "EXPENSE";
  description: string;
  amountCents: number;
  category: string;
  companyId: string | null;
  frequency: "MONTHLY" | "YEARLY";
  dayOfMonth: number;
  startDate: string;
  endDate: string | null;
};

export function RecurrenceModal({ initial, onClose, companies, allowNone }: { initial?: RecurrenceValues; onClose: () => void; companies: Company[]; allowNone: boolean }) {
  const [v, setV] = useState({
    type: initial?.type ?? ("INCOME" as "INCOME" | "EXPENSE"),
    description: initial?.description ?? "",
    amount: initial ? centsToInput(initial.amountCents) : "",
    category: initial?.category ?? FINANCE_CATEGORIES.INCOME[0],
    companyId: initial?.companyId ?? (allowNone ? "" : companies[0]?.id ?? ""),
    frequency: initial?.frequency ?? ("MONTHLY" as "MONTHLY" | "YEARLY"),
    dayOfMonth: String(initial?.dayOfMonth ?? 10),
    startDate: initial ? toDateInput(initial.startDate) : toDateInput(now()),
    endDate: initial?.endDate ? toDateInput(initial.endDate) : "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { run, pending } = useAction();
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((s) => ({ ...s, [k]: val }));
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={initial ? "Editar recorrência" : "Nova recorrência"}
      description="Gera os lançamentos automaticamente, sem duplicar, até o fim do próximo mês."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="rec-form" loading={pending}>
            Salvar
          </Button>
        </>
      }
    >
      <form
        id="rec-form"
        noValidate
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => (initial ? updateRecurrence(initial.id, v) : createRecurrence(v)), { onSuccess: onClose, onError: (r) => setErrors(r.fieldErrors ?? {}) });
        }}
      >
        <Select label="Tipo" value={v.type} onChange={(e) => setV((s) => ({ ...s, type: e.target.value as "INCOME" | "EXPENSE", category: FINANCE_CATEGORIES[e.target.value as "INCOME" | "EXPENSE"][0] }))}>
          <option value="INCOME">Entrada (receita)</option>
          <option value="EXPENSE">Saída (despesa)</option>
        </Select>
        <Categories type={v.type} value={v.category} onChange={(c) => set("category", c)} error={errors.category} />
        <Input label="Descrição" required value={v.description} onChange={(e) => set("description", e.target.value)} error={errors.description} wrapperClassName="sm:col-span-2" maxLength={200} placeholder="Ex.: Mensalidade Café Aurora" />
        <Input label="Valor (R$)" required inputMode="decimal" value={v.amount} onChange={(e) => set("amount", e.target.value)} error={errors.amount} />
        <CompanySelect value={v.companyId} onChange={(c) => set("companyId", c)} companies={companies} error={errors.companyId} allowNone={allowNone} />
        <Select label="Frequência" value={v.frequency} onChange={(e) => set("frequency", e.target.value as "MONTHLY" | "YEARLY")}>
          <option value="MONTHLY">Mensal</option>
          <option value="YEARLY">Anual</option>
        </Select>
        <Input label="Dia do vencimento" type="number" min={1} max={31} value={v.dayOfMonth} onChange={(e) => set("dayOfMonth", e.target.value)} error={errors.dayOfMonth} hint="Em meses mais curtos, usa o último dia" />
        <Input label="Início" type="date" required value={v.startDate} onChange={(e) => set("startDate", e.target.value)} error={errors.startDate} />
        <Input label="Fim (opcional)" type="date" value={v.endDate} onChange={(e) => set("endDate", e.target.value)} error={errors.endDate} />
        {initial ? <p className="text-[12px] text-muted-strong sm:col-span-2">Mudanças valem para as próximas parcelas pendentes. Parcelas pagas não mudam.</p> : null}
      </form>
    </Modal>
  );
}

export function CommissionModal({ onClose, companies, allowNone }: { onClose: () => void; companies: Company[]; allowNone: boolean }) {
  const [v, setV] = useState({ beneficiary: "", description: "", amount: "", companyId: allowNone ? "" : companies[0]?.id ?? "", dueDate: toDateInput(now()) });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { run, pending } = useAction();
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((s) => ({ ...s, [k]: val }));
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title="Nova comissão"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="com-form" loading={pending}>
            Salvar
          </Button>
        </>
      }
    >
      <form id="com-form" noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); run(() => createCommission(v), { onSuccess: onClose, onError: (r) => setErrors(r.fieldErrors ?? {}) }); }}>
        <Input label="Quem recebe" required value={v.beneficiary} onChange={(e) => set("beneficiary", e.target.value)} error={errors.beneficiary} maxLength={120} autoFocus />
        <Input label="Valor (R$)" required inputMode="decimal" value={v.amount} onChange={(e) => set("amount", e.target.value)} error={errors.amount} />
        <Input label="Descrição" required value={v.description} onChange={(e) => set("description", e.target.value)} error={errors.description} wrapperClassName="sm:col-span-2" maxLength={200} placeholder="Ex.: Indicação do cliente Café Aurora" />
        <CompanySelect value={v.companyId} onChange={(c) => set("companyId", c)} companies={companies} error={errors.companyId} allowNone={allowNone} />
        <Input label="Vencimento" type="date" required value={v.dueDate} onChange={(e) => set("dueDate", e.target.value)} error={errors.dueDate} />
      </form>
    </Modal>
  );
}

export function FinanceSettings({ opening, openingDate, goals }: { opening: number; openingDate: string | null; goals: { month: string; label: string; cents: number }[] }) {
  const { run, pending } = useAction();
  const [balance, setBalance] = useState({ amount: centsToInput(opening), date: openingDate ? toDateInput(openingDate) : toDateInput(now()) });
  const [goal, setGoal] = useState({ month: monthKey(now()), amount: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:items-start">
      <form
        className="rounded-xl border border-line bg-surface p-5"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => setOpeningBalance(balance), { onError: (r) => setErrors(r.fieldErrors ?? {}) });
        }}
      >
        <h3 className="text-[14.5px] font-semibold">Saldo inicial</h3>
        <p className="mt-0.5 mb-4 text-[12.5px] text-muted-strong">Saldo em caixa = saldo inicial + entradas recebidas − saídas e comissões pagas a partir desta data.</p>
        <div className="flex flex-wrap items-end gap-3">
          <Input label="Valor (R$)" inputMode="decimal" value={balance.amount} onChange={(e) => setBalance((s) => ({ ...s, amount: e.target.value }))} error={errors.amount} wrapperClassName="w-[160px]" />
          <Input label="Data" type="date" value={balance.date} onChange={(e) => setBalance((s) => ({ ...s, date: e.target.value }))} wrapperClassName="w-[170px]" />
          <Button type="submit" variant="primary" loading={pending}>
            Salvar
          </Button>
        </div>
      </form>
      <div className="rounded-xl border border-line bg-surface p-5">
        <h3 className="text-[14.5px] font-semibold">Meta de receita mensal</h3>
        <p className="mt-0.5 mb-4 text-[12.5px] text-muted-strong">Comparada com a receita recebida no mês.</p>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => setRevenueGoal(goal), { onSuccess: () => setGoal((s) => ({ ...s, amount: "" })) });
          }}
        >
          <Input label="Mês" type="month" value={goal.month} onChange={(e) => setGoal((s) => ({ ...s, month: e.target.value }))} wrapperClassName="w-[170px]" />
          <Input label="Meta (R$)" inputMode="decimal" value={goal.amount} onChange={(e) => setGoal((s) => ({ ...s, amount: e.target.value }))} wrapperClassName="w-[160px]" />
          <Button type="submit" variant="primary" loading={pending}>
            Salvar meta
          </Button>
        </form>
        {goals.length ? (
          <ul className="mt-4 divide-y divide-line border-t border-line text-[13px]">
            {goals.map((g) => (
              <li key={g.month} className="flex justify-between py-2">
                <span className="first-letter:uppercase">{g.label}</span>
                <span className="font-medium tabular-nums">{(g.cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
