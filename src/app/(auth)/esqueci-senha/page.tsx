import type { Metadata } from "next";
import { AuthCard, AuthCardHeader, AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = { title: "Recuperar senha" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell>
      <AuthCard labelledBy="forgot-title">
        <AuthCardHeader
          id="forgot-title"
          title="Recuperar senha"
          description="Informe o e-mail da sua conta para receber um link de redefinição."
        />
        <ForgotPasswordForm />
      </AuthCard>
    </AuthShell>
  );
}
