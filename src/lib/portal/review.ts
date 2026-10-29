import "server-only";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { AccessError, type AppContext } from "@/lib/auth/context";
import { UserError } from "@/lib/actions";
import { loadPostForCtx } from "@/lib/domain/posts";
import { enumOf, id, optionalText, text } from "@/lib/validation/common";
import { IMAGE_TYPES, LIMITS, saveUpload, VIDEO_TYPES } from "@/lib/storage";
import { emailNewVersion, emailReviewAvailable, notifyTeamAboutPost } from "@/lib/notifications";
import type { PortalViewer } from "@/lib/portal/session";
import {
  aggregateApproval,
  COMPONENT_KINDS,
  COMPONENT_LABELS,
  defaultComponentsFor,
  evaluateRelease,
  formatTimestamp,
  PORTAL_VISIBLE,
  versionLabel,
  VISIBILITIES,
  type ComponentKindKey,
  type ComponentStatusKey,
  type VisibilityKey,
} from "@/lib/portal/rules";

type Tx = Prisma.TransactionClient;

const MAX_TIMESTAMP_MS = 6 * 3600 * 1000;
const timestamp = z.coerce.number().int().min(0).max(MAX_TIMESTAMP_MS).nullish().transform((v) => (v === undefined ? null : v));

function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

// ─────────────────────────────────────────────────────────────
// Consolidação e liberação
// ─────────────────────────────────────────────────────────────

/**
 * Mantém approvalStatus da postagem coerente com os componentes, para que
 * Dashboard, Postagens, Calendário e notificações usem os dados reais.
 */
export async function syncPostApprovalStatus(tx: Tx, postId: string) {
  const components = await tx.postComponent.findMany({ where: { postId }, select: { required: true, status: true } });
  const status = aggregateApproval(components as { required: boolean; status: ComponentStatusKey }[]);
  if (status) await tx.post.update({ where: { id: postId }, data: { approvalStatus: status } });
  return status;
}

export async function loadRelease(postId: string, db: Tx | typeof prisma = prisma) {
  const post = await db.post.findUnique({
    where: { id: postId },
    select: {
      caption: true,
      clientVisibility: true,
      components: {
        select: { kind: true, required: true, status: true, currentVersion: { select: { id: true, caption: true, decision: { select: { decision: true } } } } },
      },
    },
  });
  if (!post) throw new UserError("Postagem não encontrada.");
  return evaluateRelease({
    visibility: post.clientVisibility,
    caption: post.caption,
    components: post.components.map((c) => ({
      kind: c.kind,
      required: c.required,
      status: c.status,
      currentVersion: c.currentVersion ? { id: c.currentVersion.id, caption: c.currentVersion.caption, decision: c.currentVersion.decision?.decision ?? null } : null,
    })),
  });
}

/**
 * Validação obrigatória antes de agendar ou publicar (inclusive futuras
 * publicações automáticas pela API): exige as aprovações da versão atual.
 */
export async function assertPublicationAuthorized(postId: string, db: Tx | typeof prisma = prisma) {
  const release = await loadRelease(postId, db);
  if (!release.authorized) {
    throw new UserError(`Publicação ainda não autorizada pelo cliente. ${release.blocking.map((b) => b.reason).join(" ")}`.trim());
  }
  return release;
}

// ─────────────────────────────────────────────────────────────
// Lado da agência
// ─────────────────────────────────────────────────────────────

async function postInScope(ctx: AppContext, postId: string) {
  const p = await loadPostForCtx(ctx, id.parse(postId));
  return prisma.post.findUniqueOrThrow({ where: { id: p.id }, select: { id: true, title: true, companyId: true, contentType: true, clientVisibility: true, caption: true } });
}

/** Cria os componentes aprováveis padrão do formato (sem duplicar). */
export async function setupComponents(ctx: AppContext, postId: string) {
  const post = await postInScope(ctx, postId);
  const kinds = defaultComponentsFor(post.contentType);
  await prisma.postComponent.createMany({ data: kinds.map((kind) => ({ postId: post.id, kind })), skipDuplicates: true });
  return kinds;
}

export async function addComponent(ctx: AppContext, postId: string, kind: string) {
  const post = await postInScope(ctx, postId);
  const k = enumOf(COMPONENT_KINDS).parse(kind);
  await prisma.postComponent.createMany({ data: [{ postId: post.id, kind: k }], skipDuplicates: true });
}

async function componentInScope(ctx: AppContext, componentId: string) {
  const c = await prisma.postComponent.findUnique({ where: { id: id.parse(componentId) }, select: { id: true, postId: true, kind: true, _count: { select: { versions: true } } } });
  if (!c) throw new UserError("Componente não encontrado.");
  await postInScope(ctx, c.postId);
  return c;
}

/** Componentes não obrigatórios não bloqueiam a publicação. */
export async function setComponentRequired(ctx: AppContext, componentId: string, required: boolean) {
  const c = await componentInScope(ctx, componentId);
  await prisma.$transaction(async (tx) => {
    await tx.postComponent.update({ where: { id: c.id }, data: { required: Boolean(required) } });
    await syncPostApprovalStatus(tx, c.postId);
  });
}

export async function removeComponent(ctx: AppContext, componentId: string) {
  const c = await componentInScope(ctx, componentId);
  if (c._count.versions > 0) throw new UserError("Este item já tem versões enviadas. Marque-o como não obrigatório em vez de remover.");
  await prisma.$transaction(async (tx) => {
    await tx.postComponent.delete({ where: { id: c.id } });
    await syncPostApprovalStatus(tx, c.postId);
  });
}

const visibilitySchema = z.object({
  visibility: enumOf(VISIBILITIES),
  reviewDueAt: z.date().nullish(),
});

/** Visibilidade no portal. Ao liberar para aprovação, avisa os aprovadores. */
export async function setPostVisibility(ctx: AppContext, postId: string, input: z.input<typeof visibilitySchema>) {
  const post = await postInScope(ctx, postId);
  const data = visibilitySchema.parse(input);
  await prisma.post.update({
    where: { id: post.id },
    data: { clientVisibility: data.visibility, ...(data.reviewDueAt !== undefined ? { reviewDueAt: data.reviewDueAt } : {}) },
  });
  const pending = await prisma.postComponent.count({ where: { postId: post.id, status: "PENDING" } });
  if (data.visibility === "APPROVAL" && post.clientVisibility !== "APPROVAL" && pending > 0) await emailReviewAvailable(post);
}

/** Demanda relacionada: recebe os pedidos de alteração do cliente. */
export async function linkPostTask(ctx: AppContext, postId: string, taskId: string | null) {
  const post = await postInScope(ctx, postId);
  if (taskId) {
    const task = await prisma.task.findFirst({ where: { id: id.parse(taskId), agencyId: ctx.agency.id, companyId: post.companyId, deletedAt: null }, select: { id: true } });
    if (!task) throw new UserError("Demanda não encontrada nesta empresa.");
  }
  await prisma.post.update({ where: { id: post.id }, data: { taskId: taskId || null } });
}

const versionSchema = z.object({
  kind: enumOf(COMPONENT_KINDS),
  caption: optionalText(5000),
  note: optionalText(1000),
});

/**
 * Nova versão de um componente. Reinicia SOMENTE a aprovação desse
 * componente; os demais mantêm o status. Pedidos de alteração abertos do
 * componente ficam marcados como atendidos.
 */
export async function submitComponentVersion(ctx: AppContext, postId: string, input: { kind: string; caption?: string | null; note?: string | null; file?: unknown }) {
  const post = await postInScope(ctx, postId);
  const data = versionSchema.parse(input);
  if (data.kind === "CAPTION" && !data.caption) throw new UserError("Escreva a legenda.", { caption: "Escreva a legenda." });

  let fileId: string | null = null;
  if (data.kind !== "CAPTION") {
    const stored = await saveUpload(input.file, {
      agencyId: ctx.agency.id,
      uploadedById: ctx.user.id,
      allowed: data.kind === "VIDEO" ? VIDEO_TYPES : IMAGE_TYPES,
      maxBytes: data.kind === "VIDEO" ? LIMITS.reviewVideo : LIMITS.cover,
      postId: post.id,
    });
    fileId = stored.id;
  }

  // Idempotente mesmo com envios simultâneos (upsert concorrente violaria a chave única).
  await prisma.postComponent.createMany({ data: [{ postId: post.id, kind: data.kind }], skipDuplicates: true });
  const result = await prisma.$transaction(async (tx) => {
    const component = await tx.postComponent.findUniqueOrThrow({ where: { postId_kind: { postId: post.id, kind: data.kind } }, select: { id: true } });
    // Bloqueia o componente durante a numeração (envios simultâneos).
    await tx.$queryRaw`SELECT id FROM "post_component" WHERE id = ${component.id} FOR UPDATE`;
    const last = await tx.componentVersion.findFirst({ where: { componentId: component.id }, orderBy: { number: "desc" }, select: { number: true } });
    const number = (last?.number ?? 0) + 1;
    const version = await tx.componentVersion.create({
      data: { componentId: component.id, number, fileId, caption: data.kind === "CAPTION" ? data.caption : null, note: data.note, createdById: ctx.user.id },
    });
    await tx.postComponent.update({ where: { id: component.id }, data: { currentVersionId: version.id, status: "PENDING" } });
    await tx.approvalDecision.updateMany({ where: { componentId: component.id, decision: "CHANGES_REQUESTED", resolvedAt: null }, data: { resolvedAt: new Date() } });
    if (data.kind === "CAPTION") await tx.post.update({ where: { id: post.id }, data: { caption: data.caption } });
    await syncPostApprovalStatus(tx, post.id);
    return { versionId: version.id, number };
  });

  if (post.clientVisibility === "APPROVAL") {
    if (result.number === 1) await emailReviewAvailable(post);
    else await emailNewVersion(post, COMPONENT_LABELS[data.kind], versionLabel(result.number));
  }
  return result;
}

/**
 * A legenda foi editada direto na postagem: se o texto deixou de ser o da
 * versão enviada, a aprovação daquela versão não vale mais para o conteúdo
 * atual. O item volta para "Aguardando envio" até uma nova versão.
 */
export async function onCaptionEdited(postId: string, caption: string | null) {
  await prisma.$transaction(async (tx) => {
    const c = await tx.postComponent.findUnique({ where: { postId_kind: { postId, kind: "CAPTION" } }, select: { id: true, status: true, currentVersion: { select: { caption: true } } } });
    if (!c?.currentVersion || c.status === "AWAITING_UPLOAD") return;
    if ((c.currentVersion.caption ?? "").trim() === (caption ?? "").trim()) return;
    await tx.postComponent.update({ where: { id: c.id }, data: { status: "AWAITING_UPLOAD" } });
    await syncPostApprovalStatus(tx, postId);
  });
}

const staffCommentSchema = z.object({
  body: text(2000, "Escreva o comentário."),
  componentId: id.nullish(),
  versionId: id.nullish(),
  internal: z.boolean().default(false),
});

export async function staffComment(ctx: AppContext, postId: string, input: z.input<typeof staffCommentSchema>) {
  const post = await postInScope(ctx, postId);
  const data = staffCommentSchema.parse(input);
  const target = await resolveCommentTarget(post.id, data.componentId ?? null, data.versionId ?? null);
  await prisma.reviewComment.create({ data: { postId: post.id, componentId: target.componentId, versionId: target.versionId, body: data.body, internal: data.internal, userId: ctx.user.id } });
}

async function resolveCommentTarget(postId: string, componentId: string | null, versionId: string | null) {
  if (!componentId) return { componentId: null, versionId: null, kind: null as ComponentKindKey | null };
  const c = await prisma.postComponent.findFirst({ where: { id: componentId, postId }, select: { id: true, kind: true, currentVersionId: true } });
  if (!c) throw new UserError("Item não encontrado nesta postagem.");
  const vId = versionId ?? c.currentVersionId;
  if (vId) {
    const v = await prisma.componentVersion.findFirst({ where: { id: vId, componentId: c.id }, select: { id: true } });
    if (!v) throw new UserError("Versão não encontrada.");
  }
  return { componentId: c.id, versionId: vId, kind: c.kind };
}

// ─────────────────────────────────────────────────────────────
// Lado do cliente (portal)
// ─────────────────────────────────────────────────────────────

/** Postagem visível no portal para a empresa do visitante (isolamento). */
export async function portalPostOrThrow(viewer: PortalViewer, postId: string) {
  const parsed = id.safeParse(postId);
  if (!parsed.success) throw new UserError("Conteúdo não encontrado.");
  const post = await prisma.post.findFirst({
    where: {
      id: parsed.data,
      agencyId: viewer.agencyId,
      companyId: viewer.company.id,
      deletedAt: null,
      clientVisibility: { in: PORTAL_VISIBLE },
      company: { deletedAt: null },
    },
    select: { id: true, title: true, companyId: true, clientVisibility: true, taskId: true },
  });
  if (!post) throw new UserError("Conteúdo não encontrado.");
  return post;
}

const decisionSchema = z.object({
  componentId: id,
  versionId: id,
  decision: enumOf(["APPROVED", "CHANGES_REQUESTED"] as const),
  comment: optionalText(2000),
  timestampMs: timestamp,
});

/**
 * Aprovação individual de um componente, vinculada à versão exata.
 * Protegida contra cliques repetidos e decisões simultâneas: a troca de
 * status só acontece se a versão ainda for a atual e estiver pendente, e o
 * banco aceita uma única decisão por versão.
 */
export async function decideComponent(viewer: PortalViewer, postId: string, input: z.input<typeof decisionSchema>) {
  if (viewer.mode !== "client" || !viewer.contact) throw new AccessError("Pré-visualização: aprovações reais estão desativadas.");
  if (!viewer.canDecide) throw new AccessError("Seu acesso permite acompanhar, mas não aprovar. Fale com a agência.");
  const post = await portalPostOrThrow(viewer, postId);
  if (post.clientVisibility !== "APPROVAL") throw new UserError("Este conteúdo ainda não está disponível para aprovação.");
  const data = decisionSchema.parse(input);
  if (data.decision === "CHANGES_REQUESTED" && !data.comment) throw new UserError("Conte para a gente o que precisa mudar.", { comment: "Descreva os ajustes." });

  const component = await prisma.postComponent.findFirst({ where: { id: data.componentId, postId: post.id }, select: { id: true, kind: true } });
  if (!component) throw new UserError("Item não encontrado.");
  if (data.timestampMs !== null && component.kind !== "VIDEO") data.timestampMs = null;
  const contact = viewer.contact;

  let number = 0;
  try {
    await prisma.$transaction(async (tx) => {
      const version = await tx.componentVersion.findFirst({ where: { id: data.versionId, componentId: component.id }, select: { number: true } });
      if (!version) throw new UserError("Versão não encontrada.");
      number = version.number;
      const updated = await tx.postComponent.updateMany({
        where: { id: component.id, currentVersionId: data.versionId, status: "PENDING" },
        data: { status: data.decision },
      });
      if (updated.count !== 1) throw new UserError("Esta versão já foi avaliada ou foi substituída por uma nova. Atualize a página.");
      await tx.approvalDecision.create({
        data: {
          postId: post.id,
          componentId: component.id,
          versionId: data.versionId,
          decision: data.decision,
          comment: data.comment,
          timestampMs: data.timestampMs,
          contactId: contact.id,
          actorName: contact.name,
          actorEmail: contact.email,
        },
      });
      await syncPostApprovalStatus(tx, post.id);
      if (data.decision === "CHANGES_REQUESTED" && post.taskId) {
        // Reabre a demanda relacionada (sem criar outra) para a equipe acompanhar.
        await tx.task.updateMany({ where: { id: post.taskId, status: "DONE", deletedAt: null }, data: { status: "IN_PROGRESS", completedAt: null } });
      }
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new UserError("Esta versão já foi avaliada. Atualize a página.");
    throw error;
  }

  const label = `${COMPONENT_LABELS[component.kind]} (${versionLabel(number).toLowerCase()})`;
  const when = data.timestampMs !== null ? `${formatTimestamp(data.timestampMs)} — ` : "";
  await notifyTeamAboutPost(post.id, {
    type: data.decision === "APPROVED" ? "review.approved" : "review.changes_requested",
    title: data.decision === "APPROVED" ? `${contact.name} aprovou: ${label}` : `${contact.name} pediu alterações: ${label}`,
    detail: data.decision === "APPROVED" ? post.title : `${post.title} · ${when}${data.comment ?? ""}`.slice(0, 300),
    href: `/postagens?post=${post.id}`,
  });
  if (data.decision === "APPROVED") {
    const release = await loadRelease(post.id);
    if (release.authorized)
      await notifyTeamAboutPost(post.id, { type: "review.approved", title: `Liberado para agendamento: ${post.title}`, detail: "Todos os itens obrigatórios foram aprovados pelo cliente.", href: `/postagens?post=${post.id}` });
  }
}

const clientCommentSchema = z.object({
  body: text(2000, "Escreva o comentário."),
  componentId: id.nullish(),
  versionId: id.nullish(),
  timestampMs: timestamp,
});

/** Comentário do cliente (compartilhado com a equipe), opcionalmente num instante do vídeo. */
export async function clientComment(viewer: PortalViewer, postId: string, input: z.input<typeof clientCommentSchema>) {
  if (viewer.mode !== "client" || !viewer.contact || !viewer.canComment) throw new AccessError("Pré-visualização: comentários estão desativados.");
  const post = await portalPostOrThrow(viewer, postId);
  const data = clientCommentSchema.parse(input);
  const target = await resolveCommentTarget(post.id, data.componentId ?? null, data.versionId ?? null);
  const ts = target.kind === "VIDEO" ? data.timestampMs : null;
  const comment = await prisma.reviewComment.create({
    data: { postId: post.id, componentId: target.componentId, versionId: target.versionId, body: data.body, timestampMs: ts, contactId: viewer.contact.id },
  });
  await notifyTeamAboutPost(post.id, {
    type: "review.comment",
    title: `Comentário de ${viewer.contact.name}`,
    detail: `${post.title} · ${ts !== null ? `${formatTimestamp(ts)} — ` : ""}${data.body}`.slice(0, 300),
    href: `/postagens?post=${post.id}`,
  });
  return comment.id;
}

export type { VisibilityKey };
