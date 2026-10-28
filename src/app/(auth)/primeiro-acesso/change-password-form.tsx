"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { PasswordRules } from "@/components/auth/password-rules";
import { PrimaryButton } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { PasswordField } from "@/components/ui/form-fields";
import { ArrowRightIcon, LockIcon } from "@/components/ui/icons";
import { changePasswordAction, type ChangePasswordResult } from "./actions";

type Errors = Extract<ChangePasswordResult, { ok: false }>;

export function ChangePasswordForm({ requireCurrent }: { requireCurrent: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Errors>({ ok: false });
  const [newPassword, setNewPassword] = useState("");

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    const input = {
      currentPassword: String(data.get("currentPassword") ?? ""),
      newPassword: String(data.get("newPassword") ?? ""),
      confirmPassword: String(data.get("confirmPassword") ?? ""),
    };
    setErrors({ ok: false });
    startTransition(async () => {
      try {
        const result = await changePasswordAction(input);
        if (result.ok) {
          router.replace(result.redirectTo);
          router.refresh();
        } else {
          setErrors(result);
        }
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
      {requireCurrent ? (
        <PasswordField
          name="currentPassword"
          label="Senha atual"
          icon={<LockIcon />}
          autoComplete="current-password"
          maxLength={128}
          required
          error={errors.fieldErrors?.currentPassword}
          disabled={pending}
        />
      ) : null}
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
      <PrimaryButton
        className="mt-1"
        loading={pending}
        loadingLabel="Salvando…"
        icon={<ArrowRightIcon width={18} height={18} />}
      >
        Salvar nova senha
      </PrimaryButton>
    </form>
  );
}
