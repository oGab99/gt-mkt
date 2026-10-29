import "server-only";
import { prisma } from "@/lib/db";
import { AccessError, canAccessCompany, type AppContext } from "@/lib/auth/context";
import { UserError } from "@/lib/actions";

/** Carrega a demanda garantindo agência e acesso à empresa. */
export async function loadTaskForCtx(ctx: AppContext, taskId: string) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, agencyId: ctx.agency.id, deletedAt: null, folder: { deletedAt: null }, company: { deletedAt: null } },
    select: { id: true, companyId: true, folderId: true, status: true, position: true },
  });
  if (!task) throw new UserError("Demanda não encontrada.");
  if (!canAccessCompany(ctx, task.companyId)) throw new AccessError();
  return task;
}

export async function loadFolderForCtx(ctx: AppContext, folderId: string) {
  const folder = await prisma.folder.findFirst({
    where: { id: folderId, agencyId: ctx.agency.id, deletedAt: null, company: { deletedAt: null } },
    select: { id: true, companyId: true, name: true },
  });
  if (!folder) throw new UserError("Pasta não encontrada.");
  if (!canAccessCompany(ctx, folder.companyId)) throw new AccessError();
  return folder;
}

/** Posição ao final de uma coluna (status) da pasta. */
export async function nextPosition(folderId: string, status: string) {
  const last = await prisma.task.findFirst({
    where: { folderId, status: status as never, deletedAt: null },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  return (last?.position ?? 0) + 1024;
}
