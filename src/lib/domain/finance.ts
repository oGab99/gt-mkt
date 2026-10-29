import "server-only";
import { prisma } from "@/lib/db";
import { fmt, monthEnd, monthKey, monthStart, now, plusMonths, TIMEZONE } from "@/lib/tz";
import { TZDate } from "@date-fns/tz";

/**
 * Regras financeiras (regime de caixa):
 * - Receita do mês: entradas RECEBIDAS (status PAID) com data de pagamento no mês.
 * - Despesas do mês: saídas PAGAS no mês + comissões PAGAS no mês.
 * - Lucro do mês: receita do mês − despesas do mês.
 * - Saldo em caixa: saldo inicial + todas as entradas recebidas − todas as
 *   saídas pagas − comissões pagas (a partir da data do saldo inicial).
 * - Previstos (a receber / a pagar) nunca entram no saldo nem no lucro.
 */

const MAX_GENERATED_MONTHS = 36;

/** Gera os lançamentos das recorrências até o fim do próximo mês, sem duplicar. */
export async function materializeRecurrences(agencyId: string) {
  const until = monthEnd(plusMonths(now(), 1));
  const recurrences = await prisma.financeRecurrence.findMany({ where: { agencyId, active: true } });
  for (const r of recurrences) {
    const step = r.frequency === "YEARLY" ? 12 : 1;
    const rows: {
      agencyId: string;
      companyId: string | null;
      description: string;
      type: typeof r.type;
      amountCents: number;
      category: string;
      date: Date;
      dueDate: Date;
      recurrenceId: string;
      recurrencePeriod: string;
    }[] = [];
    let cursor = monthStart(r.startDate);
    for (let i = 0; i < MAX_GENERATED_MONTHS * 2 && cursor.getTime() <= until.getTime(); i++) {
      const y = cursor.getFullYear();
      const m = cursor.getMonth();
      const lastDay = new TZDate(y, m + 1, 0, TIMEZONE).getDate();
      const due = new TZDate(y, m, Math.min(r.dayOfMonth, lastDay), 12, 0, TIMEZONE);
      if (r.endDate && due.getTime() > r.endDate.getTime()) break;
      if (due.getTime() >= r.startDate.getTime() - 24 * 3600 * 1000) {
        rows.push({
          agencyId,
          companyId: r.companyId,
          description: r.description,
          type: r.type,
          amountCents: r.amountCents,
          category: r.category,
          date: new Date(due.getTime()),
          dueDate: new Date(due.getTime()),
          recurrenceId: r.id,
          recurrencePeriod: monthKey(due),
        });
      }
      cursor = plusMonths(cursor, step);
    }
    if (rows.length) await prisma.financeEntry.createMany({ data: rows, skipDuplicates: true });
  }
}

function scopeWhere(agencyId: string, companyIds: string[] | null) {
  return {
    agencyId,
    ...(companyIds === null ? {} : { OR: [{ companyId: null }, { companyId: { in: companyIds } }] }),
  };
}

export async function financeSummary(agencyId: string, companyIds: string[] | null, month: Date) {
  const from = monthStart(month);
  const to = plusMonths(from, 1);
  const base = scopeWhere(agencyId, companyIds);
  const agency = await prisma.agency.findUniqueOrThrow({
    where: { id: agencyId },
    select: { openingBalanceCents: true, openingBalanceDate: true },
  });
  const since = agency.openingBalanceDate ? { gte: agency.openingBalanceDate } : { not: null };

  const sum = async (where: object) =>
    (await prisma.financeEntry.aggregate({ where, _sum: { amountCents: true } }))._sum.amountCents ?? 0;
  const sumCommissions = async (where: object) =>
    (await prisma.commission.aggregate({ where, _sum: { amountCents: true } }))._sum.amountCents ?? 0;

  const [
    revenue,
    expenses,
    commissionsPaidMonth,
    expectedRevenue,
    expectedExpenses,
    allIncome,
    allExpense,
    allCommissionsPaid,
    receivable,
    payable,
    commissionsPending,
    goal,
  ] = await Promise.all([
    sum({ ...base, type: "INCOME", status: "PAID", paidAt: { gte: from, lt: to } }),
    sum({ ...base, type: "EXPENSE", status: "PAID", paidAt: { gte: from, lt: to } }),
    sumCommissions({ ...base, status: "PAID", paidAt: { gte: from, lt: to } }),
    sum({ ...base, type: "INCOME", status: { not: "CANCELED" }, date: { gte: from, lt: to } }),
    sum({ ...base, type: "EXPENSE", status: { not: "CANCELED" }, date: { gte: from, lt: to } }),
    sum({ agencyId, type: "INCOME", status: "PAID", paidAt: since }),
    sum({ agencyId, type: "EXPENSE", status: "PAID", paidAt: since }),
    sumCommissions({ agencyId, status: "PAID", paidAt: since }),
    sum({ ...base, type: "INCOME", status: "PENDING" }),
    sum({ ...base, type: "EXPENSE", status: "PENDING" }),
    sumCommissions({ ...base, status: "PENDING" }),
    prisma.financialGoal.findUnique({ where: { agencyId_month: { agencyId, month: from } } }),
  ]);

  const totalExpenses = expenses + commissionsPaidMonth;
  return {
    month: from,
    revenue,
    expenses: totalExpenses,
    profit: revenue - totalExpenses,
    expectedRevenue,
    expectedExpenses,
    // O saldo é sempre da agência inteira.
    cashBalance: agency.openingBalanceCents + allIncome - allExpense - allCommissionsPaid,
    receivable,
    payable,
    commissionsPending,
    goalCents: goal?.revenueTargetCents ?? null,
    goalPercent: goal?.revenueTargetCents ? Math.round((revenue / goal.revenueTargetCents) * 100) : null,
  };
}

/** Entradas e saídas efetivadas por mês do ano (fluxo de caixa). */
export async function cashFlowByMonth(agencyId: string, companyIds: string[] | null, year: number) {
  const from = new TZDate(year, 0, 1, TIMEZONE);
  const to = new TZDate(year + 1, 0, 1, TIMEZONE);
  const base = scopeWhere(agencyId, companyIds);
  const [entries, commissions] = await Promise.all([
    prisma.financeEntry.findMany({
      where: { ...base, status: "PAID", paidAt: { gte: from, lt: to } },
      select: { type: true, amountCents: true, paidAt: true },
    }),
    prisma.commission.findMany({
      where: { ...base, status: "PAID", paidAt: { gte: from, lt: to } },
      select: { amountCents: true, paidAt: true },
    }),
  ]);
  const months = Array.from({ length: 12 }, (_, i) => ({
    key: `${year}-${String(i + 1).padStart(2, "0")}`,
    label: fmt(new TZDate(year, i, 1, TIMEZONE), "MMM"),
    income: 0,
    expense: 0,
  }));
  for (const e of entries) {
    const i = Number(fmt(e.paidAt!, "M")) - 1;
    if (e.type === "INCOME") months[i].income += e.amountCents;
    else months[i].expense += e.amountCents;
  }
  for (const c of commissions) months[Number(fmt(c.paidAt!, "M")) - 1].expense += c.amountCents;
  return months;
}
