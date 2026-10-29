import "server-only";
import { cache } from "react";
import { forbidden, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import type { ActionId, ModuleId, PermissionKey } from "@/lib/permissions/catalog";

export class AccessError extends Error {
  constructor(message = "Você não tem permissão para realizar esta ação.") {
    super(message);
    this.name = "AccessError";
  }
}

export type AppContext = {
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
    firstName: string | null;
    lastName: string | null;
    nickname: string | null;
  };
  sessionToken: string;
  agency: { id: string; name: string; timezone: string };
  member: { id: string; allCompanies: boolean };
  role: { id: string; name: string; isOwner: boolean };
  permissions: Set<PermissionKey>;
  /** null = acesso a todas as empresas da agência */
  companyIds: string[] | null;
};

/**
 * Contexto da requisição: sessão + vínculo com a agência + papel + empresas
 * permitidas. Lido uma vez por requisição (React cache).
 */
export const getAppContext = cache(async (): Promise<AppContext | null> => {
  const session = await getSession();
  if (!session) return null;

  const member = await prisma.agencyMember.findFirst({
    where: { userId: session.user.id, active: true },
    orderBy: { createdAt: "asc" },
    include: {
      agency: { select: { id: true, name: true, timezone: true } },
      role: { include: { permissions: true } },
      companies: { select: { companyId: true } },
    },
  });
  if (!member) return null;

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, image: true, firstName: true, lastName: true, nickname: true },
  });

  const fullAccess = member.role.isOwner || member.allCompanies;
  return {
    user,
    sessionToken: session.session.token,
    agency: member.agency,
    member: { id: member.id, allCompanies: member.allCompanies },
    role: { id: member.role.id, name: member.role.name, isOwner: member.role.isOwner },
    permissions: new Set(member.role.permissions.map((p) => `${p.module}:${p.action}` as PermissionKey)),
    companyIds: fullAccess ? null : member.companies.map((c) => c.companyId),
  };
});

export function can(ctx: AppContext, module: ModuleId, action: ActionId = "view") {
  return ctx.role.isOwner || ctx.permissions.has(`${module}:${action}` as PermissionKey);
}

/** Para páginas: exige sessão, primeiro acesso concluído e vínculo com a agência. */
export async function requireAppContext() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.mustChangePassword) redirect("/primeiro-acesso");
  const ctx = await getAppContext();
  if (!ctx) forbidden();
  return ctx;
}

/** Para páginas: exige permissão no módulo (verificada no servidor). */
export async function requirePagePermission(module: ModuleId, action: ActionId = "view") {
  const ctx = await requireAppContext();
  if (!can(ctx, module, action)) forbidden();
  return ctx;
}

/** Para Server Actions: lança AccessError em vez de redirecionar. */
export async function requireActionPermission(module: ModuleId, action: ActionId) {
  const session = await getSession();
  if (!session || session.user.mustChangePassword) throw new AccessError("Sua sessão expirou. Entre novamente.");
  const ctx = await getAppContext();
  if (!ctx) throw new AccessError();
  if (!can(ctx, module, action)) throw new AccessError();
  return ctx;
}

/** Filtro Prisma para empresas visíveis ao usuário. */
export function companyFilter(ctx: AppContext) {
  return ctx.companyIds === null ? {} : { id: { in: ctx.companyIds } };
}

/** Filtro Prisma para registros ligados a empresa (companyId). */
export function companyScope(ctx: AppContext) {
  return ctx.companyIds === null ? {} : { companyId: { in: ctx.companyIds } };
}

/**
 * Garante que a empresa existe, pertence à agência do usuário e está entre as
 * empresas que ele pode acessar. Nunca confie em IDs vindos do navegador.
 */
export async function assertCompanyAccess(ctx: AppContext, companyId: string) {
  if (ctx.companyIds !== null && !ctx.companyIds.includes(companyId)) throw new AccessError();
  const company = await prisma.company.findFirst({
    where: { id: companyId, agencyId: ctx.agency.id, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!company) throw new AccessError("Empresa não encontrada.");
  return company;
}

export function canAccessCompany(ctx: AppContext, companyId: string | null | undefined) {
  if (!companyId) return true;
  return ctx.companyIds === null || ctx.companyIds.includes(companyId);
}

/** Usuário pertence (ativo) à agência? Usado ao atribuir responsáveis. */
export async function assertAgencyUser(ctx: AppContext, userId: string | null | undefined) {
  if (!userId) return null;
  const m = await prisma.agencyMember.findFirst({
    where: { agencyId: ctx.agency.id, userId, active: true },
    select: { userId: true },
  });
  if (!m) throw new AccessError("Responsável inválido.");
  return m.userId;
}
