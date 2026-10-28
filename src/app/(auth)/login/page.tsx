import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard, AuthCardHeader, AuthShell } from "@/components/auth/auth-shell";
import { getSession, homeFor } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

const NOTICES: Record<string, string> = {
  "senha-redefinida": "Senha redefinida. Entre com a nova senha.",
  "sessao-encerrada": "Você saiu da sua conta.",
  "sessao-expirada": "Sua sessão expirou. Entre novamente.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const session = await getSession();
  if (session) redirect(homeFor(session.user));

  const { status } = await searchParams;
  const notice = typeof status === "string" ? NOTICES[status] : undefined;

  return (
    <AuthShell>
      <AuthCard labelledBy="login-title">
        <AuthCardHeader id="login-title" title="Bem-vindo" description="Faça login para acessar sua conta." />
        <LoginForm notice={notice} />
      </AuthCard>
    </AuthShell>
  );
}
