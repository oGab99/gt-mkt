import "server-only";
import { prisma } from "@/lib/db";
import { canAccessCompany, companyScope, type AppContext } from "@/lib/auth/context";
import { pipelineBucket } from "@/lib/domain/posts-metrics";
import { fileUrl } from "@/lib/storage";

import type { PostRow, PostTargetRow, PostFilters } from "@/lib/domain/posts-query-types";
export type { PostRow, PostTargetRow, PostFilters };

function mapTarget(t: {
  platform: PostTargetRow["platform"];
  status: PostTargetRow["status"];
  scheduledAt: Date | null;
  publishedAt: Date | null;
  externalUrl: string | null;
  manual: boolean;
  attempts: number;
  lastError: string | null;
}): PostTargetRow {
  return { ...t, scheduledAt: t.scheduledAt?.toISOString() ?? null, publishedAt: t.publishedAt?.toISOString() ?? null };
}

function referenceAt(plannedAt: Date | null, targets: { scheduledAt: Date | null; publishedAt: Date | null }[]) {
  const pub = targets.filter((t) => t.publishedAt).map((t) => t.publishedAt!.getTime());
  const sch = targets.filter((t) => t.scheduledAt).map((t) => t.scheduledAt!.getTime());
  const v = pub.length ? Math.min(...pub) : sch.length ? Math.min(...sch) : plannedAt?.getTime();
  return v === undefined ? null : new Date(v).toISOString();
}

const ORDER = ["IDEA", "CREATING", "EDITING", "REVIEW", "READY"];

export async function listPosts(ctx: AppContext, f: PostFilters = {}): Promise<PostRow[]> {
  const rows = await prisma.post.findMany({
    where: {
      agencyId: ctx.agency.id,
      deletedAt: null,
      company: { deletedAt: null },
      ...companyScope(ctx),
      ...(f.companyId ? { companyId: f.companyId } : {}),
      ...(f.approval ? { approvalStatus: f.approval as PostRow["approvalStatus"] } : {}),
      ...(f.platform ? { targets: { some: { platform: f.platform as PostTargetRow["platform"] } } } : {}),
      ...(f.assigneeId === "none" ? { assigneeId: null } : f.assigneeId ? { assigneeId: f.assigneeId } : {}),
      ...(f.q ? { OR: [{ title: { contains: f.q, mode: "insensitive" as const } }, { caption: { contains: f.q, mode: "insensitive" as const } }] } : {}),
    },
    include: {
      company: { select: { name: true } },
      assignee: { select: { id: true, name: true, nickname: true, image: true } },
      targets: true,
      _count: { select: { media: true } },
    },
    orderBy: [{ plannedAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    take: 1000,
  });
  const mapped = rows.map((p) => ({
    id: p.id,
    title: p.title,
    companyId: p.companyId,
    companyName: p.company.name,
    contentType: p.contentType,
    productionStage: p.productionStage,
    approvalStatus: p.approvalStatus,
    bucket: pipelineBucket(p),
    plannedAt: p.plannedAt?.toISOString() ?? null,
    referenceAt: referenceAt(p.plannedAt, p.targets),
    assignee: p.assignee ? { id: p.assignee.id, name: p.assignee.nickname || p.assignee.name, image: p.assignee.image } : null,
    targets: p.targets.sort((a, b) => a.platform.localeCompare(b.platform)).map(mapTarget),
    media: p._count.media,
  }));
  return f.bucket ? mapped.filter((p) => p.bucket === f.bucket) : mapped;
}

export async function postDetail(ctx: AppContext, postId: string) {
  if (!/^[a-z0-9]{10,40}$/i.test(postId)) return null;
  const p = await prisma.post.findFirst({
    where: { id: postId, agencyId: ctx.agency.id, deletedAt: null, company: { deletedAt: null } },
    include: {
      company: { select: { id: true, name: true, platforms: true } },
      createdBy: { select: { name: true, nickname: true } },
      targets: true,
      approvals: { orderBy: { createdAt: "desc" }, include: { actor: { select: { name: true, nickname: true } } } },
      media: { orderBy: { createdAt: "desc" }, select: { id: true, filename: true, mimeType: true, size: true } },
    },
  });
  if (!p || !canAccessCompany(ctx, p.companyId)) return null;
  return {
    id: p.id,
    title: p.title,
    description: p.description ?? "",
    caption: p.caption ?? "",
    internalNotes: p.internalNotes ?? "",
    contentType: p.contentType,
    productionStage: p.productionStage,
    approvalStatus: p.approvalStatus,
    assigneeId: p.assigneeId,
    plannedAt: p.plannedAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
    createdBy: p.createdBy ? p.createdBy.nickname || p.createdBy.name : null,
    company: p.company,
    targets: p.targets.sort((a, b) => a.platform.localeCompare(b.platform)).map(mapTarget),
    approvals: p.approvals.map((a) => ({ id: a.id, status: a.status, comment: a.comment, createdAt: a.createdAt.toISOString(), actor: a.actor ? a.actor.nickname || a.actor.name : null })),
    media: p.media.map((m) => ({ ...m, url: fileUrl(m.id)! })),
  };
}
export type PostDetail = NonNullable<Awaited<ReturnType<typeof postDetail>>>;

/** Status das integrações por rede (Instagram e Facebook usam a mesma conta Meta). */
export async function integrationStatus(ctx: AppContext) {
  const rows = await prisma.integration.findMany({ where: { agencyId: ctx.agency.id }, select: { platform: true, status: true } });
  const map: Record<string, string> = { INSTAGRAM: "NOT_CONFIGURED", FACEBOOK: "NOT_CONFIGURED", TIKTOK: "NOT_CONFIGURED", YOUTUBE: "NOT_CONFIGURED" };
  for (const r of rows) map[r.platform] = r.status;
  return map;
}

export { ORDER as STAGE_ORDER };
