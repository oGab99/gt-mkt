"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { runAction, UserError } from "@/lib/actions";
import { AccessError, requireActionPermission, type AppContext } from "@/lib/auth/context";
import { loadRoleForCtx } from "@/lib/domain/team";
import { isValidPermission, type PermissionKey } from "@/lib/permissions/catalog";
import { id, optionalId, optionalText, text } from "@/lib/validation/common";

const permissionList = z
  .array(z.string().max(40))
  .max(100)
  .transform((keys) => [...new Set(keys)])
  .refine((keys) => keys.every((k) => isValidPermission(...(k.split(":") as [string, string]))), "Permissão inválida.");

/** Quem não é Dono só concede permissões que possui e não edita o próprio papel. */
function assertCanEdit(ctx: AppContext, roleId: string, keys: string[]) {
  if (ctx.role.isOwner) return;
  if (roleId === ctx.role.id) throw new AccessError("Você não pode alterar as permissões do seu próprio papel.");
  if (keys.some((k) => !ctx.permissions.has(k as PermissionKey))) throw new AccessError("Você só pode conceder permissões que possui.");
}

const toRows = (keys: string[]) =>
  keys.map((k) => {
    const [module, action] = k.split(":");
    return { module, action };
  });

const roleSchema = z.object({
  name: text(60, "Informe o nome do papel."),
  description: optionalText(240),
  copyFromId: optionalId,
});

export async function createRole(input: z.input<typeof roleSchema>) {
  return runAction(async () => {
    const ctx = await requireActionPermission("roles", "manage");
    const data = roleSchema.parse(input);
    await assertUniqueName(ctx.agency.id, data.name);
    let keys: string[] = [];
    if (data.copyFromId) {
      const source = await loadRoleForCtx(ctx, data.copyFromId);
      if (source.isOwner) throw new UserError("O papel Dono da Agência não pode ser copiado.");
      keys = source.permissions.map((p) => `${p.module}:${p.action}`).filter((k) => isValidPermission(...(k.split(":") as [string, string])));
    }
    if (!ctx.role.isOwner) keys = keys.filter((k) => ctx.permissions.has(k as PermissionKey));
    const role = await prisma.role.create({
      data: { agencyId: ctx.agency.id, name: data.name, description: data.description, permissions: { create: toRows(keys) } },
    });
    return { id: role.id };
  }, "Papel criado.");
}

export async function updateRoleInfo(roleId: string, input: z.input<typeof roleSchema>) {
  return runAction(async () => {
    const ctx = await requireActionPermission("roles", "manage");
    const role = await loadRoleForCtx(ctx, id.parse(roleId));
    if (role.isOwner) throw new UserError("O papel Dono da Agência não pode ser alterado.");
    assertCanEdit(ctx, role.id, []);
    const data = roleSchema.parse(input);
    await assertUniqueName(ctx.agency.id, data.name, role.id);
    await prisma.role.update({ where: { id: role.id }, data: { name: data.name, description: data.description } });
    return null;
  }, "Papel atualizado.");
}

/** Substitui a matriz de permissões do papel (validada contra o catálogo). */
export async function setRolePermissions(roleId: string, keys: string[]) {
  return runAction(async () => {
    const ctx = await requireActionPermission("roles", "manage");
    const role = await loadRoleForCtx(ctx, id.parse(roleId));
    if (role.isOwner) throw new UserError("O Dono da Agência tem acesso integral e não pode perder permissões.");
    const list = permissionList.parse(keys);
    // Permissões que o editor não possui e que o papel já tinha são preservadas.
    const kept = ctx.role.isOwner ? [] : role.permissions.map((p) => `${p.module}:${p.action}`).filter((k) => !ctx.permissions.has(k as PermissionKey));
    assertCanEdit(ctx, role.id, list);
    const final = [...new Set([...list, ...kept])];
    await prisma.$transaction([
      prisma.rolePermission.deleteMany({ where: { roleId: role.id } }),
      prisma.rolePermission.createMany({ data: toRows(final).map((r) => ({ ...r, roleId: role.id })) }),
    ]);
    return null;
  }, "Permissões salvas.");
}

export async function deleteRole(roleId: string) {
  return runAction(async () => {
    const ctx = await requireActionPermission("roles", "manage");
    const role = await loadRoleForCtx(ctx, id.parse(roleId));
    if (role.isOwner || role.isSystem) throw new UserError("Papéis padrão do sistema não podem ser excluídos.");
    assertCanEdit(ctx, role.id, []);
    const members = await prisma.agencyMember.count({ where: { roleId: role.id } });
    if (members) throw new UserError(`Este papel está em uso por ${members} ${members === 1 ? "membro" : "membros"}. Troque o papel deles antes de excluir.`);
    await prisma.role.delete({ where: { id: role.id } });
    return null;
  }, "Papel excluído.");
}

async function assertUniqueName(agencyId: string, name: string, exceptId?: string) {
  const dup = await prisma.role.findFirst({
    where: { agencyId, name: { equals: name, mode: "insensitive" }, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true },
  });
  if (dup) throw new UserError("Já existe um papel com esse nome.", { name: "Já existe um papel com esse nome." });
}
