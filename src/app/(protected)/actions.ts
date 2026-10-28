"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";

export async function signOutAction() {
  try {
    await auth.api.signOut({ headers: await headers() });
  } catch (error) {
    // Mesmo que a sessão já não exista, o cookie é limpo e o usuário sai.
    console.error("[logout] Falha ao encerrar sessão", error);
  }
  redirect("/login?status=sessao-encerrada");
}
