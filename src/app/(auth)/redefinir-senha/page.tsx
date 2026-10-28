import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard, AuthCardHeader, AuthShell } from "@/components/auth/auth-shell";
import { FormAlert } from "@/components/ui/form-alert";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = { title: "Redefinir senha", referrer: "no-referrer" };

export default async function ResetPasswordPage({ searchParams }: PageProps<"/redefinir-senha">) {
  const { token } = await searchParams;
  const validToken = typeof token === "string" && /^[A-Za-z0-9_-]{16,128}$/.test(token) ? token : null;

  return (
    <AuthShell>
      <AuthCard labelledBy="reset-title">
        <AuthCardHeader id="reset-title" title="Nova senha" description="Crie uma nova senha para sua conta." />
        {validToken ? (
          <ResetPasswordForm token={validToken} />
        ) : (
          <div className="mt-8 flex flex-col gap-4">
            <FormAlert>Este link é inválido ou expirou. Solicite um novo link de recuperação.</FormAlert>
            <Link href="/esqueci-senha" className="mx-auto inline-flex min-h-11 items-center text-[13.5px] underline underline-offset-4">
              Solicitar novo link
            </Link>
          </div>
        )}
      </AuthCard>
    </AuthShell>
  );
}
