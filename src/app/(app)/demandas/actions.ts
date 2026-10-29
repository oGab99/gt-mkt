"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { runAction, UserError } from "@/lib/actions";
import { assertAgencyUser, assertCompanyAccess, requireActionPermission } from "@/lib/auth/context";
import { enumOf, id, optionalText, text } from "@/lib/validation/common";
import { PRIORITIES, TASK_STATUSES } from "@/lib/domain/labels";
import { loadFolderForCtx, loadTaskForCtx, nextPosition } from "@/lib/domain/tasks";
import { parseLocalDateTime } from "@/lib/tz";
import { ATTACHMENT_TYPES, deleteStored, LIMITS, saveUpload } from "@/lib/storage";

// ---------- Pastas ----------

export async function createFolder(companyId: string, name: string) {
  return runAction(async () => {
    const ctx = await requireActionPermission("tasks", "manage");
    await assertCompanyAccess(ctx, id.parse(companyId));
    const n = text(80, "Informe o nome da pasta.").parse(name);
    const last = await prisma.folder.findFirst({ where: { companyId, deletedAt: null }, orderBy: { position: "desc" }, select: { position: true } });
    const folder = await prisma.folder.create({ data: { agencyId: ctx.agency.id, companyId, name: n, position: (last?.position ?? 0) + 1024 } });
    return { id: folder.id };
  }, "Pasta criada.");
}

export async function renameFolder(folderId: string, name: string) {
  return runAction(async () => {
    const ctx = await requireActionPermission("tasks", "manage");
    await loadFolderForCtx(ctx, id.parse(folderId));
    await prisma.folder.update({ where: { id: folderId }, data: { name: text(80, "Informe o nome da pasta.").parse(name) } });
    return null;
  }, "Pasta renomeada.");
}

export async function deleteFolder(folderId: string) {
  return runAction(async () => {
    const ctx = await requireActionPermission("tasks", "manage");
    await loadFolderForCtx(ctx, id.parse(folderId));
    const now = new Date();
    await prisma.$transaction([
      prisma.task.updateMany({ where: { folderId, deletedAt: null }, data: { deletedAt: now } }),
      prisma.folder.update({ where: { id: folderId }, data: { deletedAt: now } }),
    ]);
    return null;
  }, "Pasta excluída.");
}

// ---------- Demandas ----------

const dateTime = z
  .object({ date: z.string().nullish(), time: z.string().nullish() })
  .nullish()
  .transform((v, ctx) => {
    if (!v?.date) return null;
    // Sem horário: o prazo vale até o fim do dia (23:59 em São Paulo).
    const d = parseLocalDateTime(v.date, v.time || "23:59");
    if (!d) {
      ctx.addIssue({ code: "custom", message: "Data inválida." });
      return z.NEVER;
    }
    return d;
  });

const taskFields = {
  title: text(200, "Informe o título da demanda."),
  description: optionalText(10000),
  notes: optionalText(10000),
  status: enumOf(TASK_STATUSES),
  priority: enumOf(PRIORITIES),
  assigneeId: z.string().nullish().transform((v) => v || null),
  startDate: dateTime,
  dueDate: dateTime,
};

const taskSchema = z.object({
  ...taskFields,
  folderId: id,
  status: enumOf(TASK_STATUSES).default("TODO"),
  priority: enumOf(PRIORITIES).default("NORMAL"),
});

export type TaskInput = z.input<typeof taskSchema>;

export async function createTask(input: TaskInput) {
  return runAction(async () => {
    const ctx = await requireActionPermission("tasks", "create");
    const data = taskSchema.parse(input);
    const folder = await loadFolderForCtx(ctx, data.folderId);
    const assigneeId = await assertAgencyUser(ctx, data.assigneeId);
    if (data.startDate && data.dueDate && data.dueDate < data.startDate) throw new UserError("O prazo deve ser depois do início.", { dueDate: "O prazo deve ser depois do início." });
    const task = await prisma.task.create({
      data: {
        ...data,
        assigneeId,
        agencyId: ctx.agency.id,
        companyId: folder.companyId,
        createdById: ctx.user.id,
        position: await nextPosition(folder.id, data.status),
        completedAt: data.status === "DONE" ? new Date() : null,
      },
    });
    return { id: task.id, folderId: folder.id };
  }, "Demanda criada.");
}

const patchSchema = z.object(taskFields).partial().extend({ folderId: id.optional() });

export async function updateTask(taskId: string, input: z.input<typeof patchSchema>) {
  return runAction(async () => {
    const ctx = await requireActionPermission("tasks", "edit");
    const task = await loadTaskForCtx(ctx, id.parse(taskId));
    const data = patchSchema.parse(input);
    const patch: Record<string, unknown> = { ...data };
    if ("assigneeId" in data) patch.assigneeId = await assertAgencyUser(ctx, data.assigneeId);
    if (data.folderId && data.folderId !== task.folderId) {
      const folder = await loadFolderForCtx(ctx, data.folderId);
      if (folder.companyId !== task.companyId) throw new UserError("A pasta precisa ser da mesma empresa.");
      patch.position = await nextPosition(folder.id, data.status ?? task.status);
    }
    if (data.status && data.status !== task.status) {
      patch.completedAt = data.status === "DONE" ? new Date() : null;
      if (!patch.position) patch.position = await nextPosition(task.folderId, data.status);
    }
    await prisma.task.update({ where: { id: task.id }, data: patch });
    return null;
  });
}

/** Arrastar no quadro: muda status e posição (entre os vizinhos). */
export async function moveTask(taskId: string, status: string, beforeId: string | null, afterId: string | null) {
  return runAction(async () => {
    const ctx = await requireActionPermission("tasks", "edit");
    const task = await loadTaskForCtx(ctx, id.parse(taskId));
    const s = enumOf(TASK_STATUSES).parse(status);
    const neighbors = await prisma.task.findMany({
      where: { id: { in: [beforeId, afterId].filter((x): x is string => Boolean(x)) }, folderId: task.folderId, deletedAt: null },
      select: { id: true, position: true },
    });
    const before = neighbors.find((n) => n.id === beforeId)?.position;
    const after = neighbors.find((n) => n.id === afterId)?.position;
    let position: number;
    if (before !== undefined && after !== undefined) position = (before + after) / 2;
    else if (before !== undefined) position = before + 1024;
    else if (after !== undefined) position = after - 1024;
    else position = 1024;
    await prisma.task.update({
      where: { id: task.id },
      data: { status: s, position, ...(s !== task.status ? { completedAt: s === "DONE" ? new Date() : null } : {}) },
    });
    return null;
  });
}

export async function setTaskDone(taskId: string, done: boolean) {
  return runAction(async () => {
    const ctx = await requireActionPermission("tasks", "edit");
    const task = await loadTaskForCtx(ctx, id.parse(taskId));
    const status = done ? "DONE" : "TODO";
    await prisma.task.update({
      where: { id: task.id },
      data: { status, completedAt: done ? new Date() : null, position: await nextPosition(task.folderId, status) },
    });
    return null;
  }, done ? "Demanda concluída." : "Demanda reaberta.");
}

export async function deleteTask(taskId: string) {
  return runAction(async () => {
    const ctx = await requireActionPermission("tasks", "delete");
    const task = await loadTaskForCtx(ctx, id.parse(taskId));
    await prisma.task.update({ where: { id: task.id }, data: { deletedAt: new Date() } });
    return null;
  }, "Demanda excluída.");
}

// ---------- Subtarefas e checklist ----------

export async function addSubtask(taskId: string, title: string) {
  return runAction(async () => {
    const ctx = await requireActionPermission("tasks", "edit");
    const task = await loadTaskForCtx(ctx, id.parse(taskId));
    const last = await prisma.subtask.findFirst({ where: { taskId: task.id }, orderBy: { position: "desc" }, select: { position: true } });
    await prisma.subtask.create({ data: { taskId: task.id, title: text(200, "Informe a subtarefa.").parse(title), position: (last?.position ?? 0) + 1024 } });
    return null;
  });
}

export async function updateSubtask(subtaskId: string, patch: { done?: boolean; title?: string; assigneeId?: string | null }) {
  return runAction(async () => {
    const ctx = await requireActionPermission("tasks", "edit");
    const sub = await prisma.subtask.findUnique({ where: { id: id.parse(subtaskId) }, select: { taskId: true } });
    if (!sub) throw new UserError("Subtarefa não encontrada.");
    await loadTaskForCtx(ctx, sub.taskId);
    const data: { done?: boolean; title?: string; assigneeId?: string | null } = {};
    if (typeof patch.done === "boolean") data.done = patch.done;
    if (patch.title !== undefined) data.title = text(200, "Informe a subtarefa.").parse(patch.title);
    if (patch.assigneeId !== undefined) data.assigneeId = await assertAgencyUser(ctx, patch.assigneeId);
    await prisma.subtask.update({ where: { id: subtaskId }, data });
    return null;
  });
}

export async function deleteSubtask(subtaskId: string) {
  return runAction(async () => {
    const ctx = await requireActionPermission("tasks", "edit");
    const sub = await prisma.subtask.findUnique({ where: { id: id.parse(subtaskId) }, select: { taskId: true } });
    if (!sub) throw new UserError("Subtarefa não encontrada.");
    await loadTaskForCtx(ctx, sub.taskId);
    await prisma.subtask.delete({ where: { id: subtaskId } });
    return null;
  });
}

export async function addChecklistItem(taskId: string, label: string) {
  return runAction(async () => {
    const ctx = await requireActionPermission("tasks", "edit");
    const task = await loadTaskForCtx(ctx, id.parse(taskId));
    const last = await prisma.checklistItem.findFirst({ where: { taskId: task.id }, orderBy: { position: "desc" }, select: { position: true } });
    await prisma.checklistItem.create({ data: { taskId: task.id, label: text(200, "Informe o item.").parse(label), position: (last?.position ?? 0) + 1024 } });
    return null;
  });
}

export async function toggleChecklistItem(itemId: string, done: boolean) {
  return runAction(async () => {
    const ctx = await requireActionPermission("tasks", "edit");
    const item = await prisma.checklistItem.findUnique({ where: { id: id.parse(itemId) }, select: { taskId: true } });
    if (!item) throw new UserError("Item não encontrado.");
    await loadTaskForCtx(ctx, item.taskId);
    await prisma.checklistItem.update({ where: { id: itemId }, data: { done: Boolean(done) } });
    return null;
  });
}

export async function deleteChecklistItem(itemId: string) {
  return runAction(async () => {
    const ctx = await requireActionPermission("tasks", "edit");
    const item = await prisma.checklistItem.findUnique({ where: { id: id.parse(itemId) }, select: { taskId: true } });
    if (!item) throw new UserError("Item não encontrado.");
    await loadTaskForCtx(ctx, item.taskId);
    await prisma.checklistItem.delete({ where: { id: itemId } });
    return null;
  });
}

// ---------- Comentários e anexos ----------

export async function addComment(taskId: string, body: string) {
  return runAction(async () => {
    const ctx = await requireActionPermission("tasks", "view");
    const task = await loadTaskForCtx(ctx, id.parse(taskId));
    await prisma.taskComment.create({ data: { taskId: task.id, authorId: ctx.user.id, body: text(5000, "Escreva um comentário.").parse(body) } });
    return null;
  });
}

export async function deleteComment(commentId: string) {
  return runAction(async () => {
    const ctx = await requireActionPermission("tasks", "view");
    const c = await prisma.taskComment.findUnique({ where: { id: id.parse(commentId) }, select: { taskId: true, authorId: true } });
    if (!c) throw new UserError("Comentário não encontrado.");
    await loadTaskForCtx(ctx, c.taskId);
    // Apenas o autor ou quem gerencia demandas pode remover.
    if (c.authorId !== ctx.user.id) await requireActionPermission("tasks", "manage");
    await prisma.taskComment.delete({ where: { id: commentId } });
    return null;
  }, "Comentário removido.");
}

export async function uploadTaskAttachment(taskId: string, form: FormData) {
  return runAction(async () => {
    const ctx = await requireActionPermission("tasks", "edit");
    const task = await loadTaskForCtx(ctx, id.parse(taskId));
    await saveUpload(form.get("file"), { agencyId: ctx.agency.id, uploadedById: ctx.user.id, allowed: ATTACHMENT_TYPES, maxBytes: LIMITS.attachment, taskId: task.id });
    return null;
  }, "Anexo enviado.");
}

export async function deleteTaskAttachment(fileId: string) {
  return runAction(async () => {
    const ctx = await requireActionPermission("tasks", "edit");
    const f = await prisma.storedFile.findFirst({ where: { id: id.parse(fileId), agencyId: ctx.agency.id }, select: { taskId: true } });
    if (!f?.taskId) throw new UserError("Anexo não encontrado.");
    await loadTaskForCtx(ctx, f.taskId);
    await deleteStored(fileId);
    return null;
  }, "Anexo removido.");
}
