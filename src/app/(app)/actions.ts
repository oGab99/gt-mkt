"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db";
import { requireActionContext } from "@/lib/auth/context";

export async function signOutAction() {
  try {
    await auth.api.signOut({ headers: await headers() });
  } catch (error) {
    // Mesmo que a sessão já não exista, o cookie é limpo e o usuário sai.
    console.error("[logout] Falha ao encerrar sessão", error);
  }
  redirect("/login?status=sessao-encerrada");
}

/** Marca como lidas as notificações registradas do usuário (ex.: respostas de clientes). */
export async function markNotificationsRead() {
  const ctx = await requireActionContext();
  await prisma.notification.updateMany({ where: { userId: ctx.user.id, agencyId: ctx.agency.id, readAt: null }, data: { readAt: new Date() } });
}
