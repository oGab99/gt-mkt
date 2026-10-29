"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Camera, Trash2 } from "lucide-react";
import { Button } from "@/components/app/ui/button";
import { Input } from "@/components/app/ui/fields";
import { Avatar } from "@/components/app/ui/misc";
import { useAction } from "@/components/app/ui/use-action";
import { useConfirm } from "@/components/app/ui/confirm";
import { PasswordRules } from "@/components/auth/password-rules";
import { removeAvatar, updateProfile, uploadAvatar, type ProfileInput } from "@/app/(app)/configuracoes/perfil/actions";
import { changePasswordAction } from "@/app/(auth)/primeiro-acesso/actions";

export function AvatarUploader({ name, image }: { name: string; image: string | null }) {
  const input = useRef<HTMLInputElement>(null);
  const { run, pending } = useAction();
  const confirm = useConfirm();
  return (
    <div className="flex flex-wrap items-center gap-4">
      <Avatar name={name} src={image} size={72} />
      <div>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="sr-only"
          aria-label="Enviar foto"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const fd = new FormData();
            fd.set("file", f);
            run(() => uploadAvatar(fd));
            e.target.value = "";
          }}
        />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" loading={pending} icon={<Camera className="size-4" />} onClick={() => input.current?.click()}>
            {image ? "Trocar foto" : "Enviar foto"}
          </Button>
          {image ? (
            <Button
              size="sm"
              variant="ghost"
              icon={<Trash2 className="size-4" />}
              onClick={async () => {
                if (await confirm({ title: "Remover foto?", confirmLabel: "Remover", danger: true })) run(() => removeAvatar());
              }}
            >
              Remover
            </Button>
          ) : null}
        </div>
        <p className="mt-1.5 text-[12px] text-muted-strong">PNG, JPG, WEBP ou GIF de até 5 MB.</p>
      </div>
    </div>
  );
}

export function ProfileForm({ initial }: { initial: Required<{ [K in keyof ProfileInput]: string }> }) {
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { run, pending } = useAction();
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => updateProfile(form), { onSuccess: () => setErrors({}), onError: (r) => setErrors(r.fieldErrors ?? {}) });
      }}
    >
      <Input label="Nome" value={form.firstName} onChange={set("firstName")} error={errors.firstName} maxLength={60} autoComplete="given-name" required />
      <Input label="Sobrenome" value={form.lastName} onChange={set("lastName")} error={errors.lastName} maxLength={80} autoComplete="family-name" />
      <Input label="Apelido" value={form.nickname} onChange={set("nickname")} error={errors.nickname} maxLength={40} hint="Como você aparece no menu e nas atribuições." />
      <Input
        label="E-mail de recuperação"
        type="email"
        value={form.recoveryEmail}
        onChange={set("recoveryEmail")}
        error={errors.recoveryEmail}
        maxLength={254}
        autoComplete="email"
        hint="Contato alternativo. O acesso continua pelo e-mail principal."
      />
      <div className="sm:col-span-2">
        <Button type="submit" variant="primary" loading={pending}>
          Salvar perfil
        </Button>
      </div>
    </form>
  );
}

export function PasswordForm() {
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const set = (k: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) => setValues((v) => ({ ...v, [k]: e.target.value }));

  return (
    <form
      className="grid max-w-xl gap-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          try {
            const result = await changePasswordAction(values);
            if (result.ok) {
              setValues({ currentPassword: "", newPassword: "", confirmPassword: "" });
              setErrors({});
              toast.success("Senha alterada. As outras sessões foram encerradas.");
            } else {
              setErrors(result.fieldErrors ?? {});
              if (result.error) toast.error(result.error);
            }
          } catch {
            toast.error("Falha de conexão. Verifique sua internet e tente novamente.");
          }
        });
      }}
    >
      <Input label="Senha atual" type="password" autoComplete="current-password" maxLength={128} value={values.currentPassword} onChange={set("currentPassword")} error={errors.currentPassword} required />
      <Input
        label="Nova senha"
        type="password"
        autoComplete="new-password"
        maxLength={128}
        value={values.newPassword}
        onChange={set("newPassword")}
        error={errors.newPassword}
        required
      />
      <div className="-mt-2 text-[12px]">
        <PasswordRules password={values.newPassword} />
      </div>
      <Input label="Confirmar nova senha" type="password" autoComplete="new-password" maxLength={128} value={values.confirmPassword} onChange={set("confirmPassword")} error={errors.confirmPassword} required />
      <div>
        <Button type="submit" variant="primary" loading={pending}>
          Alterar senha
        </Button>
      </div>
    </form>
  );
}
