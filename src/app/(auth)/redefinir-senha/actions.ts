"use server";

import { isAPIError } from "better-auth/api";
import { auth } from "@/lib/auth/auth";
import { passwordPolicyErrors } from "@/lib/auth/password-policy";
import { getClientIp } from "@/lib/security/request";
import { RATE_LIMITS, checkRateLimit, formatRetryAfter, hitRateLimit } from "@/lib/security/rate-limit";
import type { FieldErrors } from "@/lib/validation/auth";

type Field = "newPassword" | "confirmPassword";
export type ResetPasswordResult = { ok: true } | { ok: false; error?: string; fieldErrors?: FieldErrors<Field> };

const INVALID_LINK = "Este link é inválido ou expirou. Solicite um novo link de recuperação.";

export async function resetPasswordAction(input: {
  token: unknown;
  newPassword: unknown;
  confirmPassword: unknown;
}): Promise<ResetPasswordResult> {
  const token = typeof input.token === "string" ? input.token : "";
  const newPassword = typeof input.newPassword === "string" ? input.newPassword : "";
  const confirmPassword = typeof input.confirmPassword === "string" ? input.confirmPassword : "";
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(token)) return { ok: false, error: INVALID_LINK };

  const fieldErrors: FieldErrors<Field> = {};
  const policy = passwordPolicyErrors(newPassword);
  if (!newPassword) fieldErrors.newPassword = "Informe a nova senha.";
  else if (policy.length) fieldErrors.newPassword = `A senha ainda precisa de: ${policy.join(", ").toLowerCase()}.`;
  if (confirmPassword !== newPassword) fieldErrors.confirmPassword = "As senhas não coincidem.";
  if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors };

  try {
    const subject = (await getClientIp()) ?? "global";
    const limit = await checkRateLimit(RATE_LIMITS.passwordResetSubmit, subject);
    if (limit.blocked) {
      return { ok: false, error: `Muitas tentativas. Aguarde ${formatRetryAfter(limit.retryAfterSeconds)}.` };
    }
    try {
      await auth.api.resetPassword({ body: { token, newPassword } });
    } catch (error) {
      if (isAPIError(error)) {
        await hitRateLimit(RATE_LIMITS.passwordResetSubmit, subject);
        return { ok: false, error: INVALID_LINK };
      }
      throw error;
    }
    return { ok: true };
  } catch (error) {
    console.error("[recuperacao] Erro ao redefinir senha", error);
    return { ok: false, error: "Não foi possível redefinir a senha agora. Tente novamente." };
  }
}
