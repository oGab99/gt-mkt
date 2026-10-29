import "server-only";
import { prisma } from "@/lib/db";
import { AccessError, type AppContext } from "@/lib/auth/context";
import { UserError } from "@/lib/actions";
import { isValidPermission, type PermissionKey } from "@/lib/permissions/catalog";

/** Membros da agência com papel, empresas e último acesso (sessões ativas). */
export async function teamMembers(ctx: AppContext) {
  const rows = await prisma.agencyMember.findMany({
    where: { agencyId: ctx.agency.id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          nickname: true,
          email: true,
          username: true,
          image: true,
          mustChangePassword: true,
          sessions: { select: { updatedAt: true }, orderBy: { updatedAt: "desc" }, take: 1 },
        },
      },
      role: { select: { id: true, name: true, isOwner: true } },
      companies: { select: { companyId: true } },
    },
    orderBy: [{ active: "desc" }, { user: { name: "asc" } }],
  });
  return rows.map((m) => ({
    id: m.id,
    userId: m.user.id,
    name: m.user.name,
    nickname: m.user.nickname,
    email: m.user.email,
    username: m.user.username,
    image: m.user.image,
    pendingFirstAccess: m.user.mustChangePassword,
    lastSeenAt: m.user.sessions[0]?.updatedAt ?? null,
    active: m.active,
    allCompanies: m.role.isOwner || m.allCompanies,
    companyIds: m.companies.map((c) => c.companyId),
    role: m.role,
    isSelf: m.user.id === ctx.user.id,
  }));
}
export type TeamMember = Awaited<ReturnType<typeof teamMembers>>[number];

/** Papéis da agência com permissões e número de membros. */
export async function agencyRoles(agencyId: string) {
  const roles = await prisma.role.findMany({
    where: { agencyId },
    include: { permissions: true, _count: { select: { members: true } } },
    orderBy: [{ isOwner: "desc" }, { isSystem: "desc" }, { name: "asc" }],
  });
  return roles.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    isOwner: r.isOwner,
    isSystem: r.isSystem,
    members: r._count.members,
    permissions: r.permissions.filter((p) => isValidPermission(p.module, p.action)).map((p) => `${p.module}:${p.action}` as PermissionKey),
  }));
}
export type RoleRow = Awaited<ReturnType<typeof agencyRoles>>[number];

/**
 * Impede escalada de privilégio: quem não é Dono só pode conceder permissões
 * que ele mesmo tem. O papel Dono da Agência só pode ser atribuído por um Dono.
 */
export function assertCanGrant(ctx: AppContext, role: { isOwner: boolean; permissions: { module: string; action: string }[] }) {
  if (ctx.role.isOwner) return;
  if (role.isOwner) throw new AccessError("Apenas o Dono da Agência pode atribuir este papel.");
  const missing = role.permissions.some((p) => !ctx.permissions.has(`${p.module}:${p.action}` as PermissionKey));
  if (missing) throw new AccessError("Este papel tem permissões que você não possui.");
}

export async function loadRoleForCtx(ctx: AppContext, roleId: string) {
  const role = await prisma.role.findFirst({ where: { id: roleId, agencyId: ctx.agency.id }, include: { permissions: true } });
  if (!role) throw new UserError("Papel não encontrado.");
  return role;
}

/** Carrega um membro da agência e aplica as regras de quem pode alterá-lo. */
export async function loadMemberForCtx(ctx: AppContext, memberId: string, opts: { allowSelf?: boolean } = {}) {
  const member = await prisma.agencyMember.findFirst({
    where: { id: memberId, agencyId: ctx.agency.id },
    include: { role: true, user: { select: { id: true, email: true, username: true, name: true } }, companies: { select: { companyId: true } } },
  });
  if (!member) throw new UserError("Membro não encontrado.");
  if (!opts.allowSelf && member.userId === ctx.user.id) throw new AccessError("Você não pode alterar o próprio papel ou acesso.");
  if (member.role.isOwner && !ctx.role.isOwner) throw new AccessError("Apenas o Dono da Agência pode alterar outro Dono.");
  return member;
}

/** Garante que sempre reste ao menos um Dono ativo. */
export async function assertNotLastOwner(agencyId: string, memberId: string) {
  const others = await prisma.agencyMember.count({
    where: { agencyId, active: true, role: { isOwner: true }, id: { not: memberId } },
  });
  if (others === 0) throw new UserError("A agência precisa de pelo menos um Dono ativo.");
}

/**
 * Valida as empresas escolhidas. Quem tem acesso restrito só concede empresas
 * que ele enxerga e não pode conceder "todas as empresas".
 */
export async function resolveCompanyAccess(ctx: AppContext, allCompanies: boolean, companyIds: string[], previous: string[] = []) {
  if (allCompanies) {
    if (ctx.companyIds !== null) throw new AccessError("Você não pode conceder acesso a todas as empresas.");
    return { allCompanies: true, companyIds: [] as string[] };
  }
  const unique = [...new Set(companyIds)];
  if (ctx.companyIds !== null && unique.some((c) => !ctx.companyIds!.includes(c))) throw new AccessError();
  const found = await prisma.company.findMany({ where: { id: { in: unique }, agencyId: ctx.agency.id, deletedAt: null }, select: { id: true } });
  if (found.length !== unique.length) throw new UserError("Empresa inválida.");
  // Empresas que o editor não enxerga continuam como estavam.
  const hidden = ctx.companyIds === null ? [] : previous.filter((c) => !ctx.companyIds!.includes(c));
  return { allCompanies: false, companyIds: [...new Set([...unique, ...hidden])] };
}
