import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

/**
 * Regras centrais de produção e metas. Toda tela que mostra "postagens
 * realizadas" ou "meta" usa estas funções, para não haver cálculos divergentes.
 *
 * - Um conteúdo publicado em várias redes conta UMA vez.
 * - A data de entrega é a primeira publicação concluída (menor publishedAt).
 * - A meta de um mês é a última meta cadastrada com mês <= ao mês consultado.
 */

type Scope = { agencyId: string; companyIds: string[] | null };

function companySql(companyIds: string[] | null) {
  if (companyIds === null) return Prisma.empty;
  if (companyIds.length === 0) return Prisma.sql`AND FALSE`;
  return Prisma.sql`AND p."companyId" IN (${Prisma.join(companyIds)})`;
}

/** Conteúdos entregues (primeira publicação) por empresa no intervalo [from, to). */
export async function deliveredByCompany(scope: Scope, from: Date, to: Date) {
  const rows = await prisma.$queryRaw<{ companyId: string; count: bigint }[]>`
    SELECT p."companyId", COUNT(*)::bigint AS count
    FROM "post" p
    JOIN (
      SELECT "postId", MIN("publishedAt") AS first
      FROM "post_target"
      WHERE "status" = 'PUBLISHED' AND "publishedAt" IS NOT NULL
      GROUP BY "postId"
    ) t ON t."postId" = p."id"
    WHERE p."agencyId" = ${scope.agencyId}
      AND p."deletedAt" IS NULL
      AND t.first >= ${from} AND t.first < ${to}
      ${companySql(scope.companyIds)}
    GROUP BY p."companyId"
  `;
  return new Map(rows.map((r) => [r.companyId, Number(r.count)]));
}

/** Datas de primeira publicação no intervalo (para gráficos). */
export async function deliveryDates(scope: Scope, from: Date, to: Date) {
  const rows = await prisma.$queryRaw<{ first: Date }[]>`
    SELECT t.first
    FROM "post" p
    JOIN (
      SELECT "postId", MIN("publishedAt") AS first
      FROM "post_target"
      WHERE "status" = 'PUBLISHED' AND "publishedAt" IS NOT NULL
      GROUP BY "postId"
    ) t ON t."postId" = p."id"
    WHERE p."agencyId" = ${scope.agencyId}
      AND p."deletedAt" IS NULL
      AND t.first >= ${from} AND t.first < ${to}
      ${companySql(scope.companyIds)}
  `;
  return rows.map((r) => r.first);
}

/** Publicações por plataforma (cada rede conta separadamente) no intervalo. */
export async function publicationsByPlatform(scope: Scope, from: Date, to: Date) {
  const rows = await prisma.postTarget.groupBy({
    by: ["platform"],
    where: {
      status: "PUBLISHED",
      publishedAt: { gte: from, lt: to },
      post: {
        agencyId: scope.agencyId,
        deletedAt: null,
        ...(scope.companyIds === null ? {} : { companyId: { in: scope.companyIds } }),
      },
    },
    _count: { _all: true },
  });
  return Object.fromEntries(rows.map((r) => [r.platform, r._count._all])) as Record<string, number>;
}

/** Meta vigente de cada empresa no mês (monthStart = início do mês). */
export async function goalsForMonth(companyIds: string[], monthStart: Date) {
  if (companyIds.length === 0) return new Map<string, number>();
  const goals = await prisma.companyGoal.findMany({
    where: { companyId: { in: companyIds }, month: { lte: monthStart } },
    orderBy: { month: "desc" },
    select: { companyId: true, postsTarget: true },
  });
  const map = new Map<string, number>();
  for (const g of goals) if (!map.has(g.companyId)) map.set(g.companyId, g.postsTarget);
  return map;
}

export type CompanyProgress = {
  companyId: string;
  name: string;
  delivered: number;
  target: number | null;
  percent: number | null;
};

/** Progresso de metas das empresas ativas visíveis, no mês informado. */
export async function companyProgress(scope: Scope, monthStart: Date, monthEndExclusive: Date, onlyCompanyId?: string | null) {
  const companies = await prisma.company.findMany({
    where: {
      agencyId: scope.agencyId,
      deletedAt: null,
      status: "ACTIVE",
      ...(scope.companyIds === null ? {} : { id: { in: scope.companyIds } }),
      ...(onlyCompanyId ? { id: onlyCompanyId } : {}),
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const ids = companies.map((c) => c.id);
  const [delivered, goals] = await Promise.all([
    deliveredByCompany({ agencyId: scope.agencyId, companyIds: ids }, monthStart, monthEndExclusive),
    goalsForMonth(ids, monthStart),
  ]);
  const progress: CompanyProgress[] = companies.map((c) => {
    const d = delivered.get(c.id) ?? 0;
    const t = goals.get(c.id) ?? null;
    return { companyId: c.id, name: c.name, delivered: d, target: t, percent: t ? Math.round((d / t) * 100) : null };
  });

  const withGoal = progress.filter((p) => p.target);
  const totalTarget = withGoal.reduce((s, p) => s + (p.target ?? 0), 0);
  const totalDelivered = progress.reduce((s, p) => s + p.delivered, 0);
  // Cumprimento consolidado: o excedente de uma empresa não compensa a falta de outra.
  const cappedDelivered = withGoal.reduce((s, p) => s + Math.min(p.delivered, p.target ?? 0), 0);

  return {
    companies: progress,
    totalDelivered,
    totalTarget,
    deliveredPercent: totalTarget ? Math.round((totalDelivered / totalTarget) * 100) : null,
    attainmentPercent: totalTarget ? Math.round((cappedDelivered / totalTarget) * 100) : null,
    companiesOnTarget: withGoal.filter((p) => p.delivered >= (p.target ?? 0)).length,
    companiesWithGoal: withGoal.length,
  };
}

export type PipelineBucket = "creating" | "editing" | "approval" | "approved" | "scheduled" | "published";

export const PIPELINE_LABELS: Record<PipelineBucket, string> = {
  creating: "Em criação",
  editing: "Em edição",
  approval: "Em aprovação",
  approved: "Aprovadas",
  scheduled: "Agendadas",
  published: "Publicadas",
};

/** Classifica um conteúdo em UMA etapa do fluxo (a mais avançada). */
export function pipelineBucket(post: {
  productionStage: string;
  approvalStatus: string;
  targets: { status: string }[];
}): PipelineBucket {
  if (post.targets.some((t) => t.status === "PUBLISHED")) return "published";
  if (post.targets.some((t) => ["SCHEDULED_INTERNAL", "SCHEDULED_PLATFORM", "PUBLISHING"].includes(t.status)))
    return "scheduled";
  if (post.approvalStatus === "APPROVED") return "approved";
  if (post.approvalStatus === "PENDING") return "approval";
  if (["IDEA", "CREATING"].includes(post.productionStage)) return "creating";
  return "editing";
}

/** Contagem do fluxo de produção. Publicadas = entregues no intervalo. */
export async function pipelineCounts(scope: Scope, from: Date, to: Date, companyId?: string | null) {
  const posts = await prisma.post.findMany({
    where: {
      agencyId: scope.agencyId,
      deletedAt: null,
      ...(scope.companyIds === null ? {} : { companyId: { in: scope.companyIds } }),
      ...(companyId ? { companyId } : {}),
    },
    select: {
      productionStage: true,
      approvalStatus: true,
      targets: { select: { status: true, publishedAt: true } },
    },
  });
  const counts: Record<PipelineBucket, number> = {
    creating: 0,
    editing: 0,
    approval: 0,
    approved: 0,
    scheduled: 0,
    published: 0,
  };
  for (const p of posts) {
    const bucket = pipelineBucket(p);
    if (bucket === "published") {
      const first = p.targets
        .filter((t) => t.status === "PUBLISHED" && t.publishedAt)
        .map((t) => t.publishedAt!.getTime())
        .sort((a, b) => a - b)[0];
      if (first !== undefined && first >= from.getTime() && first < to.getTime()) counts.published++;
    } else counts[bucket]++;
  }
  return counts;
}
