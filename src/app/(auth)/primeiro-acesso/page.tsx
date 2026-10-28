import type { Metadata } from "next";
import { AuthCard, AuthCardHeader, AuthShell } from "@/components/auth/auth-shell";
import { requireSession } from "@/lib/auth/session";
import { ChangePasswordForm } from "./change-password-form";

export const metadata: Metadata = { title: "Alterar senha" };

/**
 * Primeiro acesso (senha temporária) e alteração de senha posterior.
 * No primeiro acesso só são pedidas a nova senha e a confirmação; depois disso,
 * a senha atual também é exigida.
 */
export default async function ChangePasswordPage() {
  const session = await requireSession();
  const firstAccess = Boolean(session.user.mustChangePassword);

  return (
    <AuthShell>
      <AuthCard labelledBy="password-title">
        <AuthCardHeader
          id="password-title"
          title={firstAccess ? "Primeiro acesso" : "Alterar senha"}
          description={
            firstAccess
              ? "Por segurança, crie uma nova senha para substituir a senha temporária."
              : "Escolha uma nova senha para sua conta."
          }
        />
        <ChangePasswordForm requireCurrent={!firstAccess} />
      </AuthCard>
    </AuthShell>
  );
}
