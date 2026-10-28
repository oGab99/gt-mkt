"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { PrimaryButton } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { Checkbox, PasswordField, TextField } from "@/components/ui/form-fields";
import { ArrowRightIcon, LockIcon, UserIcon } from "@/components/ui/icons";
import { loginAction, type LoginResult } from "./actions";

type Errors = Extract<LoginResult, { ok: false }>;

export function LoginForm({ notice }: { notice?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Errors>({ ok: false });
  const identifierRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    const input = {
      identifier: String(data.get("identifier") ?? ""),
      password: String(data.get("password") ?? ""),
      remember: data.get("remember") === "on",
    };

    const fieldErrors: Errors["fieldErrors"] = {};
    if (!input.identifier.trim()) fieldErrors.identifier = "Informe seu usuário ou e-mail.";
    if (!input.password) fieldErrors.password = "Informe sua senha.";
    if (fieldErrors.identifier || fieldErrors.password) {
      setErrors({ ok: false, fieldErrors });
      (fieldErrors.identifier ? identifierRef : passwordRef).current?.focus();
      return;
    }

    setErrors({ ok: false });
    startTransition(async () => {
      let result: LoginResult;
      try {
        result = await loginAction(input);
      } catch {
        setErrors({ ok: false, error: "Sem conexão com o servidor. Verifique sua internet e tente novamente." });
        return;
      }
      if (result.ok) {
        router.replace(result.redirectTo);
        router.refresh();
        return;
      }
      setErrors(result);
      if (passwordRef.current) passwordRef.current.value = "";
      (result.fieldErrors?.identifier ? identifierRef : passwordRef).current?.focus();
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-9 flex flex-col gap-4" aria-describedby="login-status">
      <div id="login-status" aria-live="polite" className="empty:hidden">
        {errors.error ? <FormAlert>{errors.error}</FormAlert> : notice ? <FormAlert tone="success">{notice}</FormAlert> : null}
      </div>

      <TextField
        ref={identifierRef}
        name="identifier"
        label="Usuário ou e-mail"
        placeholder="Usuário ou e-mail"
        hideLabel
        icon={<UserIcon />}
        autoComplete="username"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        inputMode="email"
        maxLength={254}
        required
        error={errors.fieldErrors?.identifier}
        disabled={pending}
      />
      <PasswordField
        ref={passwordRef}
        name="password"
        label="Senha"
        placeholder="Senha"
        hideLabel
        icon={<LockIcon />}
        autoComplete="current-password"
        maxLength={128}
        required
        error={errors.fieldErrors?.password}
        disabled={pending}
      />

      <div className="-my-1 flex flex-wrap items-center justify-between gap-x-4">
        <Checkbox name="remember" label="Lembrar de mim" defaultChecked disabled={pending} />
        <Link
          href="/esqueci-senha"
          className="inline-flex min-h-11 items-center text-[13px] text-ink underline underline-offset-4 decoration-ink/40 hover:decoration-ink"
        >
          Esqueceu sua senha?
        </Link>
      </div>

      <PrimaryButton loading={pending} loadingLabel="Entrando…" icon={<ArrowRightIcon width={18} height={18} />}>
        Entrar
      </PrimaryButton>
    </form>
  );
}
