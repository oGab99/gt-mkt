"use client";

import Link from "next/link";
import { useState, useTransition, type FormEvent } from "react";
import { PrimaryButton } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { TextField } from "@/components/ui/form-fields";
import { MailIcon } from "@/components/ui/icons";
import { requestPasswordResetAction, type ForgotPasswordResult } from "./actions";

export function ForgotPasswordForm() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ForgotPasswordResult | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const email = String(new FormData(event.currentTarget).get("email") ?? "");
    if (!email.trim()) {
      setResult({ status: "error", fieldError: "Informe seu e-mail." });
      return;
    }
    setResult(null);
    startTransition(async () => {
      try {
        setResult(await requestPasswordResetAction({ email }));
      } catch {
        setResult({ status: "error", error: "Sem conexão com o servidor. Verifique sua internet e tente novamente." });
      }
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-8 flex flex-col gap-4">
      <div aria-live="polite" className="empty:hidden">
        {result?.status === "sent" ? (
          <FormAlert tone="success">
            Se existir uma conta com este e-mail, você receberá um link para criar uma nova senha. O link expira em 30
            minutos e só pode ser usado uma vez.
          </FormAlert>
        ) : result?.status === "unavailable" ? (
          <FormAlert>
            A recuperação por e-mail ainda não está disponível porque o serviço de envio não foi configurado. Fale com o
            administrador do sistema.
          </FormAlert>
        ) : result?.status === "error" && result.error ? (
          <FormAlert>{result.error}</FormAlert>
        ) : null}
      </div>
      <TextField
        name="email"
        type="email"
        label="E-mail"
        placeholder="seu@email.com"
        icon={<MailIcon />}
        autoComplete="email"
        inputMode="email"
        autoCapitalize="none"
        maxLength={254}
        required
        error={result?.status === "error" ? result.fieldError : undefined}
        disabled={pending}
      />
      <PrimaryButton loading={pending} loadingLabel="Enviando…">
        Enviar link de recuperação
      </PrimaryButton>
      <Link
        href="/login"
        className="mx-auto inline-flex min-h-11 items-center text-[13.5px] text-ink underline decoration-ink/40 underline-offset-4 hover:decoration-ink"
      >
        Voltar para o login
      </Link>
    </form>
  );
}
