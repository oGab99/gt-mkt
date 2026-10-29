import type { Metadata } from "next";
import Link from "next/link";
import { PageContainer, PageHeader } from "@/components/app/shell/page-header";
import { Card, CardHeader } from "@/components/app/ui/card";
import { ProgressBar } from "@/components/app/ui/misc";
import { CashflowChart, EXPENSE_COLOR, INCOME_COLOR } from "@/components/app/finance/cashflow-chart";
import { CommissionsList, EntriesFilters, EntriesTable, NewEntryButtons, RecurrencesList } from "@/components/app/finance/finance-client";
import { FinanceSettings } from "@/components/app/finance/finance-forms";
import { can, companyFilter, requirePagePermission } from "@/lib/auth/context";
import { prisma } from "@/lib/db";
import { cashFlowByMonth, financeSummary, materializeRecurrences } from "@/lib/domain/finance";
import { resolveCompanyParam } from "@/lib/domain/shell";
import { formatBRL } from "@/lib/money";
import { capFirst, dayStart, fmt, fmtDate, fmtMonth, now, parseMonthKey, plusDays, plusMonths } from "@/lib/tz";

export const metadata: Metadata = { title: "Financeiro" };

const TABS = [
  { key: "visao", label: "Visão geral" },
  { key: "lancamentos", label: "Lançamentos" },
  { key: "recorrencias", label: "Recorrências" },
  { key: "comissoes", label: "Comissões" },
  { key: "ajustes", label: "Saldo e metas" },
] as const;

const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : null);

export default async function FinancePage({ searchParams }: PageProps<"/financeiro">) {
  const ctx = await requirePagePermission("finance");
  const sp = await searchParams;
  const tabs = TABS.filter((t) => t.key !== "ajustes" || can(ctx, "finance", "manage"));
  const tab = tabs.find((t) => t.key === sp.aba)?.key ?? (sp.status === "vencidos" ? "lancamentos" : "visao");
  const month = parseMonthKey(str(sp.mes));
  const company = await resolveCompanyParam(ctx, sp.empresa);
  const companyIds = company ? [company.id] : ctx.companyIds;
  const scope = { agencyId: ctx.agency.id, ...(companyIds === null ? {} : { companyId: { in: companyIds } }) };
  const perms = { create: can(ctx, "finance", "create"), edit: can(ctx, "finance", "edit"), delete: can(ctx, "finance", "delete") };
  const allowNone = ctx.companyIds === null;

  await materializeRecurrences(ctx.agency.id);
  const companies = await prisma.company.findMany({ where: { agencyId: ctx.agency.id, deletedAt: null, ...companyFilter(ctx) }, select: { id: true, name: true }, orderBy: { name: "asc" } });

  const tabHref = (key: string) => {
    const p = new URLSearchParams();
    if (key !== "visao") p.set("aba", key);
    if (str(sp.mes)) p.set("mes", str(sp.mes)!);
    if (company) p.set("empresa", company.id);
    const s = p.toString();
    return s ? `/financeiro?${s}` : "/financeiro";
  };

  return (
    <PageContainer>
      <PageHeader
        eyebrow={`${capFirst(fmtMonth(month))} · ${company ? company.name : "Todas as empresas"}`}
        title="Financeiro"
        description="Regime de caixa: receitas e despesas contam quando são efetivamente recebidas ou pagas. Valores previstos ficam separados."
        actions={<NewEntryButtons companies={companies} allowNone={allowNone} perms={perms} />}
      />
      <nav className="scroll-thin mb-6 flex gap-1 overflow-x-auto border-b border-line" aria-label="Seções do financeiro">
        {tabs.map((t) => (
          <Link key={t.key} href={tabHref(t.key)} aria-current={tab === t.key ? "page" : undefined} className={`-mb-px border-b-2 px-3 pb-2.5 text-[13.5px] font-medium whitespace-nowrap ${tab === t.key ? "border-fg text-fg" : "border-transparent text-muted-strong hover:text-fg"}`}>
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "visao" ? <Overview agencyId={ctx.agency.id} companyIds={companyIds} month={month} scope={scope} /> : null}

      {tab === "lancamentos" ? (
        <Entries sp={sp} scope={scope} month={month} companies={companies} allowNone={allowNone} perms={perms} />
      ) : null}

      {tab === "recorrencias" ? (
        <RecurrencesList
          companies={companies}
          allowNone={allowNone}
          perms={perms}
          items={(
            await prisma.financeRecurrence.findMany({ where: scope, include: { company: { select: { name: true } } }, orderBy: [{ active: "desc" }, { description: "asc" }] })
          ).map((r) => ({
            id: r.id,
            type: r.type,
            description: r.description,
            amountCents: r.amountCents,
            category: r.category,
            companyId: r.companyId,
            companyName: r.company?.name ?? null,
            frequency: r.frequency,
            dayOfMonth: r.dayOfMonth,
            startDate: r.startDate.toISOString(),
            endDate: r.endDate?.toISOString() ?? null,
            active: r.active,
          }))}
        />
      ) : null}

      {tab === "comissoes" ? (
        <CommissionsList
          perms={perms}
          items={(await prisma.commission.findMany({ where: scope, include: { company: { select: { name: true } } }, orderBy: [{ status: "asc" }, { dueDate: "asc" }] })).map((c) => ({
            id: c.id,
            beneficiary: c.beneficiary,
            description: c.description,
            amountCents: c.amountCents,
            dueDate: c.dueDate.toISOString(),
            status: c.status,
            paidAt: c.paidAt?.toISOString() ?? null,
            companyName: c.company?.name ?? null,
          }))}
        />
      ) : null}

      {tab === "ajustes" ? <Settings agencyId={ctx.agency.id} /> : null}
    </PageContainer>
  );
}

type Scope = Record<string, unknown>;

async function Overview({ agencyId, companyIds, month, scope }: { agencyId: string; companyIds: string[] | null; month: Date; scope: Scope }) {
  const year = Number(fmt(month, "yyyy"));
  const today = dayStart(now());
  const [s, flow, upcoming] = await Promise.all([
    financeSummary(agencyId, companyIds, month),
    cashFlowByMonth(agencyId, companyIds, year),
    prisma.financeEntry.findMany({
      where: { ...scope, status: "PENDING", dueDate: { lt: plusDays(today, 15) } },
      include: { company: { select: { name: true } } },
      orderBy: { dueDate: "asc" },
      take: 10,
    }),
  ]);
  const cards = [
    { label: "Receita recebida", value: s.revenue, hint: `Prevista no mês: ${formatBRL(s.expectedRevenue)}` },
    { label: "Despesas pagas", value: s.expenses, hint: `Previstas no mês: ${formatBRL(s.expectedExpenses)}` },
    { label: "Lucro do mês", value: s.profit, signed: true, hint: "Receita recebida − despesas pagas" },
    { label: "Saldo em caixa", value: s.cashBalance, signed: true, hint: "Agência inteira, desde o saldo inicial" },
    { label: "A receber", value: s.receivable, hint: "Entradas pendentes" },
    { label: "A pagar", value: s.payable, hint: "Saídas pendentes" },
    { label: "Comissões pendentes", value: s.commissionsPending, hint: "Ainda não pagas" },
  ];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label} className="p-4 sm:p-5">
            <p className="text-[12.5px] font-medium text-muted-strong">{c.label}</p>
            <p className={`mt-2 text-[22px] leading-none font-semibold tracking-[-0.02em] tabular-nums sm:text-[24px] ${c.signed && c.value < 0 ? "text-negative" : ""}`}>{formatBRL(c.value)}</p>
            <p className="mt-2 text-[12px] text-muted-strong">{c.hint}</p>
          </Card>
        ))}
        <Card className="p-4 sm:p-5">
          <p className="text-[12.5px] font-medium text-muted-strong">Meta de receita</p>
          {s.goalCents ? (
            <>
              <p className="mt-2 text-[22px] leading-none font-semibold tabular-nums sm:text-[24px]">{s.goalPercent}%</p>
              <ProgressBar value={s.revenue} max={s.goalCents} className="mt-3" />
              <p className="mt-2 text-[12px] text-muted-strong">de {formatBRL(s.goalCents)}</p>
            </>
          ) : (
            <p className="mt-2 text-[13px] text-muted-strong">Sem meta para o mês.</p>
          )}
        </Card>
      </div>
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3 xl:items-start">
        <Card className="xl:col-span-2">
          <CardHeader
            title={`Fluxo de caixa ${year}`}
            description="Entradas recebidas e saídas pagas (inclui comissões), por mês"
            action={
              <span className="flex gap-3 text-[12px] text-muted-strong">
                <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: INCOME_COLOR }} /> Entradas</span>
                <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: EXPENSE_COLOR }} /> Saídas</span>
              </span>
            }
          />
          <div className="px-3 pt-4 pb-3">
            <CashflowChart data={flow} />
          </div>
          <details className="border-t border-line px-5 py-3 text-[12.5px]">
            <summary className="cursor-pointer text-muted-strong hover:text-fg">Ver dados em tabela</summary>
            <table className="mt-2 w-full tabular-nums">
              <thead className="text-left text-muted-strong">
                <tr>
                  <th className="py-1 font-medium">Mês</th>
                  <th className="py-1 text-right font-medium">Entradas</th>
                  <th className="py-1 text-right font-medium">Saídas</th>
                  <th className="py-1 text-right font-medium">Resultado</th>
                </tr>
              </thead>
              <tbody>
                {flow.map((m) => (
                  <tr key={m.key} className="border-t border-line">
                    <td className="py-1 capitalize">{m.label}</td>
                    <td className="py-1 text-right">{formatBRL(m.income)}</td>
                    <td className="py-1 text-right">{formatBRL(m.expense)}</td>
                    <td className={`py-1 text-right ${m.income - m.expense < 0 ? "text-negative" : ""}`}>{formatBRL(m.income - m.expense)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </Card>
        <Card>
          <CardHeader title="Vencimentos" description="Pendentes vencidos e dos próximos 15 dias" action={<Link href="/financeiro?aba=lancamentos&status=PENDING" className="text-[12.5px] font-medium hover:underline">Ver todos</Link>} />
          {upcoming.length ? (
            <ul className="mt-3 divide-y divide-line px-5 pb-2">
              {upcoming.map((e) => {
                const late = e.dueDate! < today;
                return (
                  <li key={e.id} className="flex items-center gap-3 py-2.5 text-[13px]">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{e.description}</span>
                      <span className={`block text-[12px] ${late ? "text-negative" : "text-muted-strong"}`}>
                        {late ? "Venceu" : "Vence"} {fmtDate(e.dueDate!)} · {e.company?.name ?? "Geral"}
                      </span>
                    </span>
                    <span className={`font-medium tabular-nums ${e.type === "EXPENSE" ? "text-negative" : ""}`}>
                      {e.type === "INCOME" ? "+" : "−"} {formatBRL(e.amountCents)}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-5 pt-3 pb-5 text-[13px] text-muted-strong">Nada vencendo nos próximos 15 dias.</p>
          )}
        </Card>
      </div>
    </div>
  );
}

async function Entries({ sp, scope, month, companies, allowNone, perms }: { sp: Record<string, string | string[] | undefined>; scope: Scope; month: Date; companies: { id: string; name: string }[]; allowNone: boolean; perms: { create: boolean; edit: boolean; delete: boolean } }) {
  const status = str(sp.status);
  const tipo = str(sp.tipo);
  const categoria = str(sp.categoria)?.slice(0, 80);
  const q = str(sp.q)?.slice(0, 80);
  const overdue = status === "vencidos";
  const entries = await prisma.financeEntry.findMany({
    where: {
      ...scope,
      ...(overdue ? { status: "PENDING" as const, dueDate: { lt: dayStart(now()) } } : { date: { gte: month, lt: plusMonths(month, 1) } }),
      ...(status && !overdue && ["PENDING", "PAID", "CANCELED"].includes(status) ? { status: status as "PENDING" } : {}),
      ...(tipo === "INCOME" || tipo === "EXPENSE" ? { type: tipo } : {}),
      ...(categoria ? { category: categoria } : {}),
      ...(q ? { description: { contains: q, mode: "insensitive" as const } } : {}),
    },
    include: { company: { select: { name: true } } },
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { date: "asc" }],
    take: 500,
  });
  return (
    <>
      <EntriesFilters />
      <p className="mb-3 text-[12.5px] text-muted-strong">{overdue ? "Lançamentos pendentes com vencimento anterior a hoje, de qualquer mês." : `Lançamentos com competência em ${fmtMonth(month)}. Use o seletor de período no topo para mudar o mês.`}</p>
      <EntriesTable
        companies={companies}
        allowNone={allowNone}
        perms={perms}
        entries={entries.map((e) => ({
          id: e.id,
          type: e.type,
          description: e.description,
          amountCents: e.amountCents,
          category: e.category,
          companyId: e.companyId,
          companyName: e.company?.name ?? null,
          date: e.date.toISOString(),
          dueDate: e.dueDate?.toISOString() ?? null,
          status: e.status,
          paidAt: e.paidAt?.toISOString() ?? null,
          recurring: Boolean(e.recurrenceId),
        }))}
      />
    </>
  );
}

async function Settings({ agencyId }: { agencyId: string }) {
  const [agency, goals] = await Promise.all([
    prisma.agency.findUniqueOrThrow({ where: { id: agencyId }, select: { openingBalanceCents: true, openingBalanceDate: true } }),
    prisma.financialGoal.findMany({ where: { agencyId }, orderBy: { month: "desc" }, take: 12 }),
  ]);
  return (
    <FinanceSettings
      opening={agency.openingBalanceCents}
      openingDate={agency.openingBalanceDate?.toISOString() ?? null}
      goals={goals.map((g) => ({ month: g.month.toISOString(), label: fmtMonth(g.month), cents: g.revenueTargetCents }))}
    />
  );
}
