import "server-only";
import { prisma } from "@/lib/db";
import type { AppContext } from "@/lib/auth/context";

/** Membros ativos da agência (para atribuir responsáveis). */
export async function agencyMembers(ctx: AppContext) {
  const rows = await prisma.agencyMember.findMany({
    where: { agencyId: ctx.agency.id, active: true },
    select: { user: { select: { id: true, name: true, nickname: true, image: true } } },
    orderBy: { user: { name: "asc" } },
  });
  return rows.map((r) => ({ id: r.user.id, name: r.user.nickname || r.user.name, image: r.user.image }));
}
export type MemberOption = Awaited<ReturnType<typeof agencyMembers>>[number];
