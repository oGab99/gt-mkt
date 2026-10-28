"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { PasswordRules } from "@/components/auth/password-rules";
import { PrimaryButton } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { PasswordField } from "@/components/ui/form-fields";
import { LockIcon } from "@/components/ui/icons";
import { resetPasswordAction, type ResetPasswordResult } from "./actions";

type Errors = Extract<ResetPasswordResult, { ok: false }>;

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Errors>({ ok: false });
  const [newPassword, setNewPassword] = useState("");

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const confirmPassword = String(new FormData(event.currentTarget).get("confirmPassword") ?? "");
    setErrors({ ok: false });
    startTransition(async () => {
      try {
        const result = await resetPasswordAction({ token, newPassword, confirmPassword });
        if (result.ok) router.replace("/login?status=senha-redefinida");
        else setErrors(result);
      } catch {
        setErrors({ ok: false, error: "Sem conexão com o servidor. Verifique sua internet e tente novamente." });
      }
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-8 flex flex-col gap-4">
      <div aria-live="polite" className="empty:hidden">
        {errors.error ? <FormAlert>{errors.error}</FormAlert> : null}
      </div>
      <PasswordField
        name="newPassword"
        label="Nova senha"
        icon={<LockIcon />}
        autoComplete="new-password"
        maxLength={128}
        required
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        error={errors.fieldErrors?.newPassword}
        hint={<PasswordRules password={newPassword} />}
        disabled={pending}
      />
      <PasswordField
        name="confirmPassword"
        label="Confirmar nova senha"
        icon={<LockIcon />}
        autoComplete="new-password"
        maxLength={128}
        required
        error={errors.fieldErrors?.confirmPassword}
        disabled={pending}
      />
      <PrimaryButton className="mt-1" loading={pending} loadingLabel="Salvando…">
        Redefinir senha
      </PrimaryButton>
    </form>
  );
}
