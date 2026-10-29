import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { auth } from "@/lib/auth/auth";

/**
 * Camada de acesso à sessão (DAL). Toda página e Server Action protegida
 * passa por aqui; o proxy só faz um redirecionamento otimista.
 */
export const getSession = cache(async () => {
  try {
    return await auth.api.getSession({ headers: await headers() });
  } catch (error) {
    unstable_rethrow(error);
    console.error("[auth] Falha ao ler sessão", error);
    return null;
  }
});

export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/** Destino após login, conforme o estado da conta. */
export function homeFor(user: { mustChangePassword?: boolean | null }) {
  return user.mustChangePassword ? "/primeiro-acesso" : "/dashboard";
}
