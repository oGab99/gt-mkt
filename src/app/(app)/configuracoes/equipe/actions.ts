"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { runAction, UserError } from "@/lib/actions";
import { requireActionPermission } from "@/lib/auth/context";
import { hashPassword } from "@/lib/auth/password";
import { generateTemporaryPassword } from "@/lib/auth/temp-password";
import { assertCanGrant, assertNotLastOwner, loadMemberForCtx, loadRoleForCtx, resolveCompanyAccess } from "@/lib/domain/team";
import { id, text } from "@/lib/validation/common";

const accessSchema = z.object({
  roleId: id,
  allCompanies: z.boolean(),
  companyIds: z.array(id).max(500),
});

const newMemberSchema = accessSchema.extend({
  name: text(120, "Informe o nome."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("E-mail inválido.").max(254)),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._-]{3,32}$/, "Use 3 a 32 caracteres: letras minúsculas, números, ponto, hífen ou sublinhado."),
});

export type NewMemberInput = z.input<typeof newMemberSchema>;
export type MemberAccessInput = z.input<typeof accessSchema>;

/**
 * Cadastra um membro com senha temporária. A senha é devolvida uma única vez
 * para quem cadastrou; no banco fica apenas o hash Argon2id, e o primeiro
 * acesso exige a troca.
 */
export async function createMember(input: NewMemberInput) {
  return runAction(async () => {
    const ctx = await requireActionPermission("team", "create");
    const data = newMemberSchema.parse(input);
    const role = await loadRoleForCtx(ctx, data.roleId);
    assertCanGrant(ctx, role);
    const access = role.isOwner ? { allCompanies: true, companyIds: [] } : await resolveCompanyAccess(ctx, data.allCompanies, data.companyIds);

    const [byEmail, byUsername] = await Promise.all([
      prisma.user.findFirst({ where: { OR: [{ email: data.email }, { username: data.email }] }, select: { id: true } }),
      prisma.user.findFirst({ where: { OR: [{ username: data.username }, { email: data.username }] }, select: { id: true } }),
    ]);
    const fieldErrors: Record<string, string> = {};
    if (byEmail) fieldErrors.email = "Este e-mail já está em uso.";
    if (byUsername) fieldErrors.username = "Este usuário já está em uso.";
    if (Object.keys(fieldErrors).length) throw new UserError("Revise os campos destacados.", fieldErrors);

    const temporaryPassword = generateTemporaryPassword({ email: data.email, username: data.username });
    const passwordHash = await hashPassword(temporaryPassword);
    const userId = randomUUID();
    const [firstName, ...rest] = data.name.split(/\s+/);

    await prisma.$transaction(async (tx) => {
      await tx.user.create({
        data: {
          id: userId,
          name: data.name,
          firstName,
          lastName: rest.join(" ") || null,
          email: data.email,
          username: data.username,
          role: "user",
          mustChangePassword: true,
          accounts: { create: { id: randomUUID(), accountId: userId, providerId: "credential", password: passwordHash } },
        },
      });
      await tx.agencyMember.create({
        data: {
          agencyId: ctx.agency.id,
          userId,
          roleId: role.id,
          allCompanies: access.allCompanies,
          companies: { create: access.companyIds.map((companyId) => ({ companyId })) },
        },
      });
    });
    return { temporaryPassword, username: data.username, email: data.email };
  }, "Membro adicionado.");
}

/** Papel e empresas de outro membro. Ninguém altera o próprio papel. */
export async function updateMemberAccess(memberId: string, input: MemberAccessInput) {
  return runAction(async () => {
    const ctx = await requireActionPermission("team", "edit");
    const member = await loadMemberForCtx(ctx, id.parse(memberId));
    const data = accessSchema.parse(input);
    const role = await loadRoleForCtx(ctx, data.roleId);
    assertCanGrant(ctx, role);
    if (member.role.isOwner && !role.isOwner && member.active) await assertNotLastOwner(ctx.agency.id, member.id);

    const access = role.isOwner
      ? { allCompanies: true, companyIds: [] }
      : await resolveCompanyAccess(ctx, data.allCompanies, data.companyIds, member.companies.map((c) => c.companyId));

    await prisma.$transaction([
      prisma.agencyMember.update({ where: { id: member.id }, data: { roleId: role.id, allCompanies: access.allCompanies } }),
      prisma.memberCompanyAccess.deleteMany({ where: { memberId: member.id } }),
      prisma.memberCompanyAccess.createMany({ data: access.companyIds.map((companyId) => ({ memberId: member.id, companyId })) }),
    ]);
    return null;
  }, "Acesso atualizado.");
}

/** Ativa ou desativa um membro. Ao desativar, as sessões dele são encerradas. */
export async function setMemberActive(memberId: string, active: boolean) {
  return runAction(async () => {
    const ctx = await requireActionPermission("team", "manage");
    const member = await loadMemberForCtx(ctx, id.parse(memberId));
    if (!active && member.role.isOwner) await assertNotLastOwner(ctx.agency.id, member.id);
    await prisma.$transaction([
      prisma.agencyMember.update({ where: { id: member.id }, data: { active } }),
      ...(active ? [] : [prisma.session.deleteMany({ where: { userId: member.userId } })]),
    ]);
    return null;
  }, active ? "Membro reativado." : "Membro desativado e sessões encerradas.");
}

/** Gera nova senha temporária, exige troca no próximo acesso e encerra as sessões. */
export async function resetMemberPassword(memberId: string) {
  return runAction(async () => {
    const ctx = await requireActionPermission("team", "manage");
    const member = await loadMemberForCtx(ctx, id.parse(memberId));
    const temporaryPassword = generateTemporaryPassword({ email: member.user.email, username: member.user.username ?? undefined });
    const passwordHash = await hashPassword(temporaryPassword);
    await prisma.$transaction(async (tx) => {
      const account = await tx.account.findFirst({ where: { userId: member.userId, providerId: "credential" }, select: { id: true } });
      if (account) await tx.account.update({ where: { id: account.id }, data: { password: passwordHash } });
      else await tx.account.create({ data: { id: randomUUID(), accountId: member.userId, providerId: "credential", userId: member.userId, password: passwordHash } });
      await tx.user.update({ where: { id: member.userId }, data: { mustChangePassword: true } });
      await tx.session.deleteMany({ where: { userId: member.userId } });
    });
    return { temporaryPassword, username: member.user.username, email: member.user.email };
  }, "Senha temporária gerada.");
}
