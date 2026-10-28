"use server";

import { getSession } from "@/lib/auth/session";
import { getCredentialAccount, updateUserPassword, verifyPassword } from "@/lib/auth/change-password";
import { passwordPolicyErrors } from "@/lib/auth/password-policy";
import { PASSWORD_MAX_LENGTH } from "@/lib/auth/password";
import { RATE_LIMITS, checkRateLimit, formatRetryAfter, hitRateLimit } from "@/lib/security/rate-limit";
import type { FieldErrors } from "@/lib/validation/auth";

type Field = "currentPassword" | "newPassword" | "confirmPassword";
export type ChangePasswordResult =
  | { ok: true; redirectTo: string }
  | { ok: false; error?: string; fieldErrors?: FieldErrors<Field> };

export async function changePasswordAction(input: {
  currentPassword?: unknown;
  newPassword: unknown;
  confirmPassword: unknown;
}): Promise<ChangePasswordResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Sua sessão expirou. Entre novamente." };

  const { user } = session;
  const firstAccess = Boolean(user.mustChangePassword);
  const currentPassword = typeof input.currentPassword === "string" ? input.currentPassword : "";
  const newPassword = typeof input.newPassword === "string" ? input.newPassword : "";
  const confirmPassword = typeof input.confirmPassword === "string" ? input.confirmPassword : "";

  const fieldErrors: FieldErrors<Field> = {};
  if (!firstAccess && !currentPassword) fieldErrors.currentPassword = "Informe sua senha atual.";
  const policy = passwordPolicyErrors(newPassword, { email: user.email, username: user.username });
  if (!newPassword) fieldErrors.newPassword = "Informe a nova senha.";
  else if (policy.length) fieldErrors.newPassword = `A senha ainda precisa de: ${policy.join(", ").toLowerCase()}.`;
  if (!confirmPassword) fieldErrors.confirmPassword = "Confirme a nova senha.";
  else if (confirmPassword !== newPassword) fieldErrors.confirmPassword = "As senhas não coincidem.";
  if (currentPassword.length > PASSWORD_MAX_LENGTH) fieldErrors.currentPassword = "Senha muito longa.";
  if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors };

  try {
    const limit = await checkRateLimit(RATE_LIMITS.passwordChange, user.id);
    if (limit.blocked) {
      return { ok: false, error: `Muitas tentativas. Aguarde ${formatRetryAfter(limit.retryAfterSeconds)}.` };
    }

    const account = await getCredentialAccount(user.id);
    if (!account?.password) return { ok: false, error: "Não foi possível alterar a senha desta conta." };

    if (!firstAccess && !(await verifyPassword(account.password, currentPassword))) {
      await hitRateLimit(RATE_LIMITS.passwordChange, user.id);
      return { ok: false, fieldErrors: { currentPassword: "Senha atual incorreta." } };
    }

    if (await verifyPassword(account.password, newPassword)) {
      return {
        ok: false,
        fieldErrors: {
          newPassword: firstAccess
            ? "A nova senha não pode ser igual à senha temporária."
            : "A nova senha precisa ser diferente da atual.",
        },
      };
    }

    await updateUserPassword({
      userId: user.id,
      accountId: account.id,
      newPassword,
      keepSessionToken: session.session.token,
    });
    return { ok: true, redirectTo: "/em-construcao" };
  } catch (error) {
    console.error("[senha] Erro ao alterar senha", error);
    return { ok: false, error: "Não foi possível alterar a senha agora. Tente novamente." };
  }
}
