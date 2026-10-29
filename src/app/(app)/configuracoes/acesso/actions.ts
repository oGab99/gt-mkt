"use server";

import { prisma } from "@/lib/db";
import { runAction, UserError } from "@/lib/actions";
import { requireActionContext } from "@/lib/auth/context";
import { id } from "@/lib/validation/common";

/** Encerra uma sessão do próprio usuário (nunca a atual; para ela, use Sair). */
export async function revokeSession(sessionId: string) {
  return runAction(async () => {
    const ctx = await requireActionContext();
    const target = await prisma.session.findFirst({ where: { id: id.parse(sessionId), userId: ctx.user.id }, select: { token: true } });
    if (!target) throw new UserError("Sessão não encontrada.");
    if (target.token === ctx.sessionToken) throw new UserError("Para encerrar esta sessão, use Sair.");
    await prisma.session.delete({ where: { id: sessionId } });
    return null;
  }, "Sessão encerrada.");
}

export async function revokeOtherSessions() {
  return runAction(async () => {
    const ctx = await requireActionContext();
    const { count } = await prisma.session.deleteMany({ where: { userId: ctx.user.id, NOT: { token: ctx.sessionToken } } });
    return { count };
  });
}
