import "server-only";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

export async function getCredentialAccount(userId: string) {
  return prisma.account.findFirst({ where: { userId, providerId: "credential" } });
}

/**
 * Atualiza o hash da senha, conclui o primeiro acesso e encerra as demais
 * sessões do usuário (a sessão atual, se informada, é mantida).
 */
export async function updateUserPassword(params: {
  userId: string;
  accountId: string;
  newPassword: string;
  keepSessionToken?: string;
}) {
  const passwordHash = await hashPassword(params.newPassword);
  await prisma.$transaction([
    prisma.account.update({ where: { id: params.accountId }, data: { password: passwordHash } }),
    prisma.user.update({ where: { id: params.userId }, data: { mustChangePassword: false } }),
    prisma.session.deleteMany({
      where: { userId: params.userId, ...(params.keepSessionToken ? { NOT: { token: params.keepSessionToken } } : {}) },
    }),
  ]);
}

export { verifyPassword };
