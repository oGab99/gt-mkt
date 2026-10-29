"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { runAction, UserError } from "@/lib/actions";
import { assertAgencyUser, assertCompanyAccess, requireActionPermission } from "@/lib/auth/context";
import { enumOf, id, optionalText, optionalUrl, text } from "@/lib/validation/common";
import { PLATFORMS, STAGES } from "@/lib/domain/labels";
import { loadPostForCtx } from "@/lib/domain/posts";
import { parseLocalDateTime } from "@/lib/tz";
import { ATTACHMENT_TYPES, deleteStored, LIMITS, saveUpload } from "@/lib/storage";

const CONTENT_TYPES = ["VIDEO", "IMAGE", "CAROUSEL", "OTHER"] as const;

const localDateTime = z
  .object({ date: z.string().nullish(), time: z.string().nullish() })
  .nullish()
  .transform((v, ctx) => {
    if (!v?.date) return null;
    const d = parseLocalDateTime(v.date, v.time || "09:00");
    if (!d) {
      ctx.addIssue({ code: "custom", message: "Data ou horário inválido." });
      return z.NEVER;
    }
    return d;
  });

const postFields = {
  companyId: id,
  title: text(200, "Informe o título do conteúdo."),
  description: optionalText(10000),
  caption: optionalText(5000),
  internalNotes: optionalText(10000),
  contentType: enumOf(CONTENT_TYPES),
  productionStage: enumOf(STAGES),
  assigneeId: z.string().nullish().transform((v) => v || null),
  plannedAt: localDateTime,
  platforms: z.array(enumOf(PLATFORMS)).max(4).transform((v) => [...new Set(v)]),
};

const createSchema = z.object({
  ...postFields,
  contentType: enumOf(CONTENT_TYPES).default("VIDEO"),
  productionStage: enumOf(STAGES).default("IDEA"),
  platforms: postFields.platforms.default([]),
});
export type PostInput = z.input<typeof createSchema>;

export async function createPost(input: PostInput) {
  return runAction(async () => {
    const ctx = await requireActionPermission("posts", "create");
    const data = createSchema.parse(input);
    await assertCompanyAccess(ctx, data.companyId);
    const assigneeId = await assertAgencyUser(ctx, data.assigneeId);
    const { platforms, ...rest } = data;
    const post = await prisma.post.create({
      data: {
        ...rest,
        assigneeId,
        agencyId: ctx.agency.id,
        createdById: ctx.user.id,
        targets: { create: platforms.map((platform) => ({ platform })) },
      },
    });
    return { id: post.id };
  }, "Postagem criada.");
}

const patchSchema = z.object(postFields).omit({ platforms: true }).partial();

export async function updatePost(postId: string, input: z.input<typeof patchSchema>) {
  return runAction(async () => {
    const ctx = await requireActionPermission("posts", "edit");
    const post = await loadPostForCtx(ctx, id.parse(postId));
    const data = patchSchema.parse(input);
    const patch: Record<string, unknown> = { ...data };
    if (data.companyId && data.companyId !== post.companyId) await assertCompanyAccess(ctx, data.companyId);
    if ("assigneeId" in data) patch.assigneeId = await assertAgencyUser(ctx, data.assigneeId);
    await prisma.post.update({ where: { id: post.id }, data: patch });
    return null;
  });
}

export async function duplicatePost(postId: string) {
  return runAction(async () => {
    const ctx = await requireActionPermission("posts", "create");
    const p = await loadPostForCtx(ctx, id.parse(postId));
    const src = await prisma.post.findUniqueOrThrow({ where: { id: p.id }, include: { targets: { select: { platform: true } } } });
    // A cópia volta para o início do fluxo: sem aprovação, agendamento ou publicação.
    const copy = await prisma.post.create({
      data: {
        agencyId: src.agencyId,
        companyId: src.companyId,
        title: `${src.title} (cópia)`.slice(0, 200),
        description: src.description,
        caption: src.caption,
        internalNotes: src.internalNotes,
        contentType: src.contentType,
        assigneeId: src.assigneeId,
        createdById: ctx.user.id,
        targets: { create: src.targets.map((t) => ({ platform: t.platform })) },
      },
    });
    return { id: copy.id };
  }, "Postagem duplicada.");
}

export async function deletePost(postId: string) {
  return runAction(async () => {
    const ctx = await requireActionPermission("posts", "delete");
    const p = await loadPostForCtx(ctx, id.parse(postId));
    await prisma.post.update({ where: { id: p.id }, data: { deletedAt: new Date() } });
    return null;
  }, "Postagem excluída.");
}

// ---------- Aprovação ----------

export async function submitForApproval(postId: string) {
  return runAction(async () => {
    const ctx = await requireActionPermission("posts", "edit");
    const p = await loadPostForCtx(ctx, id.parse(postId));
    if (p.approvalStatus === "PENDING") throw new UserError("Esta postagem já aguarda aprovação.");
    await prisma.$transaction([
      prisma.post.update({ where: { id: p.id }, data: { approvalStatus: "PENDING" } }),
      prisma.postApproval.create({ data: { postId: p.id, status: "PENDING", actorId: ctx.user.id } }),
    ]);
    return null;
  }, "Enviada para aprovação.");
}

export async function reviewPost(postId: string, decision: "APPROVED" | "CHANGES_REQUESTED", comment?: string) {
  return runAction(async () => {
    const ctx = await requireActionPermission("posts", "approve");
    const p = await loadPostForCtx(ctx, id.parse(postId));
    const d = enumOf(["APPROVED", "CHANGES_REQUESTED"] as const).parse(decision);
    const c = optionalText(2000).parse(comment);
    if (d === "CHANGES_REQUESTED" && !c) throw new UserError("Descreva as alterações solicitadas.", { comment: "Descreva as alterações solicitadas." });
    await prisma.$transaction([
      prisma.post.update({ where: { id: p.id }, data: { approvalStatus: d } }),
      prisma.postApproval.create({ data: { postId: p.id, status: d, comment: c, actorId: ctx.user.id } }),
    ]);
    return null;
  }, decision === "APPROVED" ? "Postagem aprovada." : "Alterações solicitadas.");
}

// ---------- Distribuição por plataforma ----------

async function loadTarget(postId: string, platform: string) {
  const ctx = await requireActionPermission("posts", "edit");
  const p = await loadPostForCtx(ctx, id.parse(postId));
  const pl = enumOf(PLATFORMS).parse(platform);
  return { ctx, post: p, platform: pl };
}

export async function addPlatform(postId: string, platform: string) {
  return runAction(async () => {
    const { post, platform: pl } = await loadTarget(postId, platform);
    await prisma.postTarget.upsert({ where: { postId_platform: { postId: post.id, platform: pl } }, create: { postId: post.id, platform: pl }, update: {} });
    return null;
  });
}

export async function removePlatform(postId: string, platform: string) {
  return runAction(async () => {
    const { post, platform: pl } = await loadTarget(postId, platform);
    const t = await prisma.postTarget.findUnique({ where: { postId_platform: { postId: post.id, platform: pl } } });
    if (t?.status === "PUBLISHED") throw new UserError("Não é possível remover uma rede com publicação registrada. Desfaça o registro antes.");
    if (t?.status === "SCHEDULED_PLATFORM" || t?.status === "PUBLISHING") throw new UserError("Cancele o agendamento na plataforma antes de remover.");
    await prisma.postTarget.deleteMany({ where: { postId: post.id, platform: pl } });
    return null;
  });
}

/** Agendamento interno: só registra a data no GT Studio, sem enviar à rede. */
export async function scheduleInternal(postId: string, platform: string, when: { date: string; time: string }) {
  return runAction(async () => {
    const { post, platform: pl } = await loadTarget(postId, platform);
    const at = localDateTime.parse(when);
    if (!at) throw new UserError("Informe data e horário.");
    const t = await prisma.postTarget.findUnique({ where: { postId_platform: { postId: post.id, platform: pl } } });
    if (!t) throw new UserError("Adicione a rede à postagem primeiro.");
    if (["PUBLISHED", "SCHEDULED_PLATFORM", "PUBLISHING"].includes(t.status)) throw new UserError("Esta rede já foi agendada na plataforma ou publicada.");
    await prisma.postTarget.update({ where: { id: t.id }, data: { status: "SCHEDULED_INTERNAL", scheduledAt: at, lastError: null } });
    return null;
  }, "Agendamento interno salvo.");
}

export async function clearSchedule(postId: string, platform: string) {
  return runAction(async () => {
    const { post, platform: pl } = await loadTarget(postId, platform);
    const t = await prisma.postTarget.findUnique({ where: { postId_platform: { postId: post.id, platform: pl } } });
    if (!t || !["SCHEDULED_INTERNAL", "FAILED"].includes(t.status)) throw new UserError("Não há agendamento interno para remover.");
    await prisma.postTarget.update({ where: { id: t.id }, data: { status: "NOT_SCHEDULED", scheduledAt: null, lastError: null } });
    return null;
  }, "Agendamento removido.");
}

/**
 * Registro manual de publicação feita fora do sistema (diretamente no app da
 * rede). Fica marcado como manual; não é uma publicação pela API.
 */
export async function recordManualPublication(postId: string, platform: string, input: { date: string; time: string; url?: string | null }) {
  return runAction(async () => {
    const { post, platform: pl } = await loadTarget(postId, platform);
    const at = localDateTime.parse({ date: input.date, time: input.time });
    if (!at) throw new UserError("Informe data e horário da publicação.");
    if (at.getTime() > Date.now() + 5 * 60 * 1000) throw new UserError("A data da publicação não pode estar no futuro. Para datas futuras, use o agendamento.");
    const url = optionalUrl.parse(input.url);
    await prisma.postTarget.upsert({
      where: { postId_platform: { postId: post.id, platform: pl } },
      create: { postId: post.id, platform: pl, status: "PUBLISHED", publishedAt: at, externalUrl: url, manual: true },
      update: { status: "PUBLISHED", publishedAt: at, externalUrl: url, manual: true, lastError: null },
    });
    return null;
  }, "Publicação registrada.");
}

export async function undoManualPublication(postId: string, platform: string) {
  return runAction(async () => {
    const { post, platform: pl } = await loadTarget(postId, platform);
    const t = await prisma.postTarget.findUnique({ where: { postId_platform: { postId: post.id, platform: pl } } });
    if (!t || t.status !== "PUBLISHED" || !t.manual) throw new UserError("Só é possível desfazer registros manuais.");
    await prisma.postTarget.update({ where: { id: t.id }, data: { status: "NOT_SCHEDULED", publishedAt: null, externalUrl: null, manual: false, scheduledAt: null } });
    return null;
  }, "Registro desfeito.");
}

// ---------- Arquivos ----------

export async function uploadPostMedia(postId: string, form: FormData) {
  return runAction(async () => {
    const ctx = await requireActionPermission("posts", "edit");
    const p = await loadPostForCtx(ctx, id.parse(postId));
    await saveUpload(form.get("file"), { agencyId: ctx.agency.id, uploadedById: ctx.user.id, allowed: ATTACHMENT_TYPES, maxBytes: LIMITS.attachment, postId: p.id });
    return null;
  }, "Arquivo enviado.");
}

export async function deletePostMedia(fileId: string) {
  return runAction(async () => {
    const ctx = await requireActionPermission("posts", "edit");
    const f = await prisma.storedFile.findFirst({ where: { id: id.parse(fileId), agencyId: ctx.agency.id }, select: { postId: true } });
    if (!f?.postId) throw new UserError("Arquivo não encontrado.");
    await loadPostForCtx(ctx, f.postId);
    await deleteStored(fileId);
    return null;
  }, "Arquivo removido.");
}
