import "server-only";
import { prisma } from "@/lib/db";
import type { AppContext } from "@/lib/auth/context";
import { companyScope } from "@/lib/auth/context";
import { deliveryDates } from "@/lib/domain/posts-metrics";
import { fmt, monthStart, now, plusDays, plusMonths, plusYears, weekStart, yearStart } from "@/lib/tz";

export type ChartRange = "semana" | "mes" | "ano";
export type ChartPoint = { label: string; current: number; previous: number; currentLabel: string; previousLabel: string };

export function parseChartRange(v: unknown): ChartRange {
  return v === "semana" || v === "ano" ? v : "mes";
}

/**
 * Série de conteúdos entregues (primeira publicação) no período, comparada
 * com o período anterior equivalente. Mês: dia a dia; semana: dias; ano: meses.
 */
export async function deliveriesSeries(ctx: AppContext, range: ChartRange, month: Date, companyId: string | null) {
  const scope = { agencyId: ctx.agency.id, companyIds: companyId ? [companyId] : ctx.companyIds };

  let curFrom: Date, curTo: Date, prevFrom: Date, prevTo: Date;
  if (range === "semana") {
    curFrom = weekStart(now());
    curTo = plusDays(curFrom, 7);
    prevFrom = plusDays(curFrom, -7);
    prevTo = curFrom;
  } else if (range === "ano") {
    curFrom = yearStart(month);
    curTo = plusYears(curFrom, 1);
    prevFrom = plusYears(curFrom, -1);
    prevTo = curFrom;
  } else {
    curFrom = monthStart(month);
    curTo = plusMonths(curFrom, 1);
    prevFrom = plusMonths(curFrom, -1);
    prevTo = curFrom;
  }

  const [cur, prev] = await Promise.all([deliveryDates(scope, curFrom, curTo), deliveryDates(scope, prevFrom, prevTo)]);

  const bucket = (d: Date, from: Date) =>
    range === "ano" ? Number(fmt(d, "M")) - 1 : Math.floor((d.getTime() - from.getTime()) / 86_400_000 + 1e-9);

  const size =
    range === "semana" ? 7 : range === "ano" ? 12 : Math.round((curTo.getTime() - curFrom.getTime()) / 86_400_000);
  const prevSize =
    range === "semana" ? 7 : range === "ano" ? 12 : Math.round((prevTo.getTime() - prevFrom.getTime()) / 86_400_000);

  const points: ChartPoint[] = Array.from({ length: size }, (_, i) => {
    const cd = range === "ano" ? plusMonths(curFrom, i) : plusDays(curFrom, i);
    const pd = range === "ano" ? plusMonths(prevFrom, i) : plusDays(prevFrom, i);
    return {
      label: range === "ano" ? fmt(cd, "MMM") : range === "semana" ? fmt(cd, "EEE dd") : fmt(cd, "dd"),
      currentLabel: range === "ano" ? fmt(cd, "MMMM yyyy") : fmt(cd, "EEE, dd/MM"),
      previousLabel: i < prevSize ? (range === "ano" ? fmt(pd, "MMMM yyyy") : fmt(pd, "EEE, dd/MM")) : "",
      current: 0,
      previous: 0,
    };
  });
  for (const d of cur) {
    const i = bucket(d, curFrom);
    if (points[i]) points[i].current++;
  }
  for (const d of prev) {
    const i = bucket(d, prevFrom);
    if (points[i] && i < prevSize) points[i].previous++;
  }

  const totalCurrent = cur.length;
  const totalPrevious = prev.length;
  return {
    points,
    totalCurrent,
    totalPrevious,
    changePercent: totalPrevious ? Math.round(((totalCurrent - totalPrevious) / totalPrevious) * 100) : null,
    // Na semana/mês atual, os dias futuros não devem parecer "zero entregas".
    lastIndexWithData:
      curTo.getTime() > Date.now() ? bucket(new Date(), curFrom) : size - 1,
  };
}

/** Próximos conteúdos agendados (internamente ou na plataforma). */
export async function upcomingScheduled(ctx: AppContext, companyId: string | null) {
  const targets = await prisma.postTarget.findMany({
    where: {
      status: { in: ["SCHEDULED_INTERNAL", "SCHEDULED_PLATFORM"] },
      scheduledAt: { gte: new Date() },
      post: { agencyId: ctx.agency.id, deletedAt: null, company: { deletedAt: null }, ...companyScope(ctx), ...(companyId ? { companyId } : {}) },
    },
    select: { scheduledAt: true, platform: true, status: true, post: { select: { id: true, title: true, company: { select: { name: true } } } } },
    orderBy: { scheduledAt: "asc" },
  });
  // Um conteúdo em várias redes aparece uma vez (no primeiro horário).
  const byPost = new Map<string, { id: string; title: string; company: string; at: Date; platforms: string[]; confirmed: boolean }>();
  for (const t of targets) {
    const e = byPost.get(t.post.id);
    if (e) {
      e.platforms.push(t.platform);
      e.confirmed &&= t.status === "SCHEDULED_PLATFORM";
    } else
      byPost.set(t.post.id, {
        id: t.post.id,
        title: t.post.title,
        company: t.post.company.name,
        at: t.scheduledAt!,
        platforms: [t.platform],
        confirmed: t.status === "SCHEDULED_PLATFORM",
      });
  }
  return [...byPost.values()];
}

export async function pendingApprovalCount(ctx: AppContext, companyId: string | null) {
  return prisma.post.count({
    where: { agencyId: ctx.agency.id, deletedAt: null, approvalStatus: "PENDING", company: { deletedAt: null }, ...companyScope(ctx), ...(companyId ? { companyId } : {}) },
  });
}

/** Conteúdos em que o cliente pediu alterações (aguardando nova versão da equipe). */
export async function changesRequestedCount(ctx: AppContext, companyId: string | null) {
  return prisma.post.count({
    where: { agencyId: ctx.agency.id, deletedAt: null, approvalStatus: "CHANGES_REQUESTED", company: { deletedAt: null }, ...companyScope(ctx), ...(companyId ? { companyId } : {}) },
  });
}
