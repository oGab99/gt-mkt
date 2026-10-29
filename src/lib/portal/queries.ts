import "server-only";
import { prisma } from "@/lib/db";
import type { AppContext } from "@/lib/auth/context";
import { canAccessCompany } from "@/lib/auth/context";
import { goalsForMonth } from "@/lib/domain/posts-metrics";
import { fileUrl } from "@/lib/storage";
import { monthStart, plusMonths } from "@/lib/tz";
import type { PortalViewer } from "@/lib/portal/session";
import { loadRelease, portalPostOrThrow } from "@/lib/portal/review";
import { COMPONENT_KINDS, portalStage, PORTAL_VISIBLE, visibleProgress, type ComponentKindKey, type ComponentStatusKey } from "@/lib/portal/rules";

/**
 * Consultas do portal. Os dados enviados ao navegador do cliente são montados
 * campo a campo (nunca o registro inteiro): sem notas internas, briefing,
 * comentários internos, financeiro ou dados de outras empresas.
 */

export const portalFileUrl = (fileId: string | null | undefined) => (fileId ? `/portal/arquivos/${fileId}` : null);

function referenceAt(plannedAt: Date | null, targets: { scheduledAt: Date | null; publishedAt: Date | null }[]) {
  const pub = targets.filter((t) => t.publishedAt).map((t) => t.publishedAt!.getTime());
  const sch = targets.filter((t) => t.scheduledAt).map((t) => t.scheduledAt!.getTime());
  const v = pub.length ? Math.min(...pub) : sch.length ? Math.min(...sch) : plannedAt?.getTime();
  return v === undefined ? null : new Date(v);
}

const personName = (u: { name: string; nickname: string | null } | null) => (u ? u.nickname || u.name : null);

export type PortalPostCard = {
  id: string;
  title: string;
  contentType: string;
  at: string | null;
  published: boolean;
  platforms: string[];
  awaitingApproval: boolean;
  progress: { steps: { key: string; label: string }[]; currentIndex: number; done: boolean };
  components: { kind: ComponentKindKey; status: ComponentStatusKey; required: boolean }[];
  assignee: string | null;
};

export async function portalHome(viewer: PortalViewer, month: Date) {
  const from = monthStart(month);
  const to = plusMonths(from, 1);
  const nowMs = Date.now();

  const [posts, goals, tasks] = await Promise.all([
    prisma.post.findMany({
      where: { agencyId: viewer.agencyId, companyId: viewer.company.id, deletedAt: null, clientVisibility: { in: PORTAL_VISIBLE } },
      select: {
        id: true,
        title: true,
        contentType: true,
        productionStage: true,
        approvalStatus: true,
        clientVisibility: true,
        plannedAt: true,
        reviewDueAt: true,
        assignee: viewer.settings.showAssignee ? { select: { name: true, nickname: true } } : false,
        targets: { select: { platform: true, status: true, scheduledAt: true, publishedAt: true } },
        components: { select: { kind: true, status: true, required: true } },
      },
      orderBy: [{ plannedAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
    }),
    goalsForMonth([viewer.company.id], from),
    prisma.task.findMany({
      where: { agencyId: viewer.agencyId, companyId: viewer.company.id, clientVisible: true, deletedAt: null, folder: { deletedAt: null } },
      select: { id: true, title: true, status: true, dueDate: true },
      orderBy: [{ status: "asc" }, { dueDate: { sort: "asc", nulls: "last" } }],
      take: 30,
    }),
  ]);

  const cards = posts.map((p) => {
    const ref = referenceAt(p.plannedAt, p.targets);
    const published = p.targets.some((t) => t.status === "PUBLISHED");
    const current = portalStage(p);
    const card: PortalPostCard = {
      id: p.id,
      title: p.title,
      contentType: p.contentType,
      at: ref?.toISOString() ?? null,
      published,
      platforms: [...new Set(p.targets.map((t) => t.platform))],
      awaitingApproval: p.clientVisibility === "APPROVAL" && p.components.some((c) => c.status === "PENDING"),
      progress: visibleProgress(current, viewer.settings.visibleStages),
      components: p.components.sort((a, b) => COMPONENT_KINDS.indexOf(a.kind) - COMPONENT_KINDS.indexOf(b.kind)),
      assignee: "assignee" in p && p.assignee ? personName(p.assignee as { name: string; nickname: string | null }) : null,
    };
    return { card, ref, stage: current.stage, approvalStatus: p.approvalStatus };
  });

  const inPeriod = cards.filter(({ ref, card }) => (ref ? ref >= from && ref < to : !card.published));
  const count = (f: (c: (typeof cards)[number]) => boolean) => inPeriod.filter(f).length;
  const delivered = count((c) => c.card.published);
  const goal = goals.get(viewer.company.id) ?? null;

  return {
    period: { from: from.toISOString(), to: to.toISOString() },
    goal,
    delivered,
    stats: {
      planned: inPeriod.length,
      production: count((c) => !c.card.published && ["PLANNING", "RECORDING", "EDITING", "REVIEW"].includes(c.stage)),
      awaiting: count((c) => c.card.awaitingApproval),
      approved: count((c) => !c.card.published && c.approvalStatus === "APPROVED"),
      published: delivered,
    },
    // Aprovações pendentes aparecem mesmo fora do período, porque dependem do cliente.
    awaiting: cards.filter((c) => c.card.awaitingApproval).map((c) => c.card),
    upcoming: cards
      .filter((c) => !c.card.published && c.ref && c.ref.getTime() >= nowMs)
      .sort((a, b) => a.ref!.getTime() - b.ref!.getTime())
      .slice(0, 6)
      .map((c) => c.card),
    posts: inPeriod.map((c) => c.card),
    tasks: tasks.map((t) => ({ id: t.id, title: t.title, status: t.status, dueDate: t.dueDate?.toISOString() ?? null })),
  };
}
export type PortalHome = Awaited<ReturnType<typeof portalHome>>;

export async function portalPostDetail(viewer: PortalViewer, postId: string) {
  const base = await portalPostOrThrow(viewer, postId);
  const p = await prisma.post.findUniqueOrThrow({
    where: { id: base.id },
    select: {
      id: true,
      title: true,
      caption: true,
      contentType: true,
      productionStage: true,
      approvalStatus: true,
      clientVisibility: true,
      plannedAt: true,
      reviewDueAt: true,
      company: { select: { name: true } },
      assignee: viewer.settings.showAssignee ? { select: { name: true, nickname: true } } : false,
      targets: { select: { platform: true, status: true, scheduledAt: true, publishedAt: true } },
      components: {
        select: {
          id: true,
          kind: true,
          required: true,
          status: true,
          currentVersionId: true,
          versions: {
            orderBy: { number: "desc" },
            select: {
              id: true,
              number: true,
              caption: true,
              note: true,
              createdAt: true,
              file: { select: { id: true, mimeType: true, filename: true } },
              decision: { select: { decision: true, comment: true, timestampMs: true, actorName: true, createdAt: true } },
            },
          },
        },
      },
      comments: {
        where: { internal: false },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          componentId: true,
          versionId: true,
          body: true,
          timestampMs: true,
          createdAt: true,
          contact: { select: { name: true } },
          user: { select: { name: true, nickname: true } },
          version: { select: { number: true } },
        },
      },
    },
  });

  const components = p.components
    .sort((a, b) => COMPONENT_KINDS.indexOf(a.kind) - COMPONENT_KINDS.indexOf(b.kind))
    .map((c) => ({
      id: c.id,
      kind: c.kind,
      required: c.required,
      status: c.status,
      currentVersionId: c.status === "AWAITING_UPLOAD" ? null : c.currentVersionId,
      versions: c.versions.map((v) => ({
        id: v.id,
        number: v.number,
        caption: v.caption,
        note: v.note,
        createdAt: v.createdAt.toISOString(),
        file: v.file ? { url: portalFileUrl(v.file.id)!, mimeType: v.file.mimeType } : null,
        decision: v.decision ? { ...v.decision, createdAt: v.decision.createdAt.toISOString() } : null,
      })),
    }));

  const release = await loadRelease(p.id);
  return {
    id: p.id,
    title: p.title,
    companyName: p.company.name,
    contentType: p.contentType,
    plannedAt: p.plannedAt?.toISOString() ?? null,
    reviewDueAt: p.reviewDueAt?.toISOString() ?? null,
    platforms: [...new Set(p.targets.map((t) => t.platform))],
    published: p.targets.some((t) => t.status === "PUBLISHED"),
    assignee: "assignee" in p && p.assignee ? personName(p.assignee as { name: string; nickname: string | null }) : null,
    approvalOpen: p.clientVisibility === "APPROVAL",
    progress: visibleProgress(portalStage(p), viewer.settings.visibleStages),
    components,
    comments: p.comments.map((c) => ({
      id: c.id,
      componentId: c.componentId,
      versionId: c.versionId,
      versionNumber: c.version?.number ?? null,
      body: c.body,
      timestampMs: c.timestampMs,
      createdAt: c.createdAt.toISOString(),
      author: c.contact ? c.contact.name : `${personName(c.user) ?? "Equipe"} · GT Studio`,
      fromAgency: !c.contact,
    })),
    release: { authorized: release.authorized, applies: release.applies },
  };
}
export type PortalPostDetail = Awaited<ReturnType<typeof portalPostDetail>>;

// ─────────────────────────────────────────────────────────────
// Visão da equipe (módulo Postagens)
// ─────────────────────────────────────────────────────────────

export async function staffReviewData(ctx: AppContext, postId: string) {
  const p = await prisma.post.findFirst({
    where: { id: postId, agencyId: ctx.agency.id, deletedAt: null },
    select: {
      id: true,
      companyId: true,
      contentType: true,
      clientVisibility: true,
      reviewDueAt: true,
      taskId: true,
      caption: true,
      targets: { select: { status: true } },
      components: {
        select: {
          id: true,
          kind: true,
          required: true,
          status: true,
          currentVersionId: true,
          versions: {
            orderBy: { number: "desc" },
            select: {
              id: true,
              number: true,
              caption: true,
              note: true,
              createdAt: true,
              createdBy: { select: { name: true, nickname: true } },
              file: { select: { id: true, mimeType: true, filename: true, size: true } },
              decision: { select: { decision: true, comment: true, timestampMs: true, actorName: true, actorEmail: true, createdAt: true, resolvedAt: true } },
            },
          },
        },
      },
      comments: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          componentId: true,
          body: true,
          timestampMs: true,
          internal: true,
          createdAt: true,
          contact: { select: { name: true } },
          user: { select: { name: true, nickname: true } },
          version: { select: { number: true } },
        },
      },
    },
  });
  if (!p || !canAccessCompany(ctx, p.companyId)) return null;

  const [release, tasks, approvers] = await Promise.all([
    loadRelease(p.id),
    prisma.task.findMany({
      where: { agencyId: ctx.agency.id, companyId: p.companyId, deletedAt: null, folder: { deletedAt: null } },
      select: { id: true, title: true, status: true },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      take: 200,
    }),
    prisma.clientContact.count({ where: { companyId: p.companyId, revokedAt: null, canApprove: true } }),
  ]);

  return {
    postId: p.id,
    contentType: p.contentType,
    visibility: p.clientVisibility,
    reviewDueAt: p.reviewDueAt?.toISOString() ?? null,
    taskId: p.taskId,
    caption: p.caption ?? "",
    scheduled: p.targets.some((t) => ["SCHEDULED_INTERNAL", "SCHEDULED_PLATFORM", "PUBLISHING"].includes(t.status)),
    components: p.components
      .sort((a, b) => COMPONENT_KINDS.indexOf(a.kind) - COMPONENT_KINDS.indexOf(b.kind))
      .map((c) => ({
        id: c.id,
        kind: c.kind,
        required: c.required,
        status: c.status,
        currentVersionId: c.currentVersionId,
        versions: c.versions.map((v) => ({
          id: v.id,
          number: v.number,
          caption: v.caption,
          note: v.note,
          createdAt: v.createdAt.toISOString(),
          createdBy: personName(v.createdBy),
          file: v.file ? { url: fileUrl(v.file.id)!, mimeType: v.file.mimeType, filename: v.file.filename, size: v.file.size } : null,
          decision: v.decision ? { ...v.decision, createdAt: v.decision.createdAt.toISOString(), resolvedAt: v.decision.resolvedAt?.toISOString() ?? null } : null,
        })),
      })),
    comments: p.comments.map((c) => ({
      id: c.id,
      componentId: c.componentId,
      versionNumber: c.version?.number ?? null,
      body: c.body,
      timestampMs: c.timestampMs,
      internal: c.internal,
      createdAt: c.createdAt.toISOString(),
      author: c.contact ? c.contact.name : (personName(c.user) ?? "Usuário removido"),
      fromClient: Boolean(c.contact),
    })),
    release,
    tasks,
    approvers,
  };
}
export type StaffReviewData = NonNullable<Awaited<ReturnType<typeof staffReviewData>>>;

/** Pedidos de alteração do cliente ligados a uma demanda (via postagens relacionadas). */
export async function taskClientRequests(ctx: AppContext, taskId: string) {
  const rows = await prisma.approvalDecision.findMany({
    where: { decision: "CHANGES_REQUESTED", post: { taskId, agencyId: ctx.agency.id, deletedAt: null } },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      id: true,
      comment: true,
      timestampMs: true,
      actorName: true,
      createdAt: true,
      resolvedAt: true,
      post: { select: { id: true, title: true } },
      component: { select: { kind: true } },
      version: { select: { number: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    comment: r.comment,
    timestampMs: r.timestampMs,
    actorName: r.actorName,
    createdAt: r.createdAt.toISOString(),
    resolvedAt: r.resolvedAt?.toISOString() ?? null,
    postId: r.post.id,
    postTitle: r.post.title,
    kind: r.component.kind,
    versionNumber: r.version.number,
  }));
}
