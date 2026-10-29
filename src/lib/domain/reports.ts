import "server-only";
import { prisma } from "@/lib/db";
import type { AppContext } from "@/lib/auth/context";
import { deliveryDates, goalsForMonth } from "@/lib/domain/posts-metrics";
import { fmt, monthKey, now, plusMonths } from "@/lib/tz";

/**
 * Relatórios calculados apenas a partir dos dados internos do sistema
 * (postagens, metas, demandas e financeiro). Métricas de redes sociais
 * dependem de integrações e não são estimadas.
 */

type Scope = { agencyId: string; companyIds: string[] | null };

export function reportScope(ctx: AppContext, companyId: string | null): Scope {
  return { agencyId: ctx.agency.id, companyIds: companyId ? [companyId] : ctx.companyIds };
}

/** Entregas por mês (cada conteúdo conta uma vez) e soma das metas vigentes. */
export async function monthlyProduction(scope: Scope, lastMonth: Date, months = 6) {
  const first = plusMonths(lastMonth, -(months - 1));
  const dates = await deliveryDates(scope, first, plusMonths(lastMonth, 1));
  const counts = new Map<string, number>();
  for (const d of dates) counts.set(monthKey(d), (counts.get(monthKey(d)) ?? 0) + 1);

  const companies = await prisma.company.findMany({
    where: { agencyId: scope.agencyId, deletedAt: null, status: "ACTIVE", ...(scope.companyIds === null ? {} : { id: { in: scope.companyIds } }) },
    select: { id: true },
  });
  const ids = companies.map((c) => c.id);

  const points = [];
  for (let i = 0; i < months; i++) {
    const m = plusMonths(first, i);
    const goals = await goalsForMonth(ids, m);
    const target = [...goals.values()].reduce((s, v) => s + v, 0);
    points.push({ key: monthKey(m), label: fmt(m, "MMM"), fullLabel: fmt(m, "MMMM 'de' yyyy"), delivered: counts.get(monthKey(m)) ?? 0, target: target || null });
  }
  return points;
}
export type ProductionPoint = Awaited<ReturnType<typeof monthlyProduction>>[number];

/** Indicadores de demandas no mês + atrasadas no momento. */
export async function taskReport(scope: Scope, from: Date, to: Date) {
  const base = { agencyId: scope.agencyId, deletedAt: null, ...(scope.companyIds === null ? {} : { companyId: { in: scope.companyIds } }) };
  const current = now();

  const [completed, created, overdue, overdueList, byAssignee] = await Promise.all([
    prisma.task.findMany({ where: { ...base, status: "DONE", completedAt: { gte: from, lt: to } }, select: { completedAt: true, dueDate: true } }),
    prisma.task.count({ where: { ...base, createdAt: { gte: from, lt: to } } }),
    prisma.task.count({ where: { ...base, status: { not: "DONE" }, dueDate: { lt: current } } }),
    prisma.task.findMany({
      where: { ...base, status: { not: "DONE" }, dueDate: { lt: current } },
      select: { id: true, title: true, dueDate: true, company: { select: { name: true } }, assignee: { select: { name: true, nickname: true } } },
      orderBy: { dueDate: "asc" },
      take: 8,
    }),
    prisma.task.groupBy({
      by: ["assigneeId"],
      where: { ...base, status: "DONE", completedAt: { gte: from, lt: to } },
      _count: { _all: true },
    }),
  ]);

  const withDue = completed.filter((t) => t.dueDate);
  const onTime = withDue.filter((t) => t.completedAt! <= t.dueDate!).length;

  const userIds = byAssignee.map((r) => r.assigneeId).filter(Boolean) as string[];
  const users = userIds.length ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, nickname: true } }) : [];
  const names = new Map(users.map((u) => [u.id, u.nickname || u.name]));

  return {
    completed: completed.length,
    created,
    overdue,
    overdueList,
    withDue: withDue.length,
    onTime,
    onTimePercent: withDue.length ? Math.round((onTime / withDue.length) * 100) : null,
    byAssignee: byAssignee
      .map((r) => ({ name: r.assigneeId ? (names.get(r.assigneeId) ?? "—") : "Sem responsável", count: r._count._all }))
      .sort((a, b) => b.count - a.count),
  };
}
