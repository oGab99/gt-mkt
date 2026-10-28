"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth/auth";
import { isMailConfigured } from "@/lib/mail/mailer";
import { getClientIp } from "@/lib/security/request";
import { RATE_LIMITS, checkRateLimit, formatRetryAfter, hitRateLimit } from "@/lib/security/rate-limit";
import { emailSchema } from "@/lib/validation/auth";

export type ForgotPasswordResult =
  | { status: "sent" }
  | { status: "unavailable" }
  | { status: "error"; error?: string; fieldError?: string };

export async function requestPasswordResetAction(input: { email: unknown }): Promise<ForgotPasswordResult> {
  const parsed = emailSchema.safeParse(input.email);
  if (!parsed.success) return { status: "error", fieldError: "Informe um e-mail válido." };
  const email = parsed.data;

  // Sem serviço de e-mail não há como entregar o link: avisamos em vez de
  // fingir que o envio foi feito. (A resposta é a mesma para qualquer e-mail.)
  if (!isMailConfigured()) return { status: "unavailable" };

  try {
    const ip = await getClientIp();
    for (const [rule, subject] of [
      [RATE_LIMITS.passwordResetRequest, email],
      ...(ip ? [[RATE_LIMITS.passwordResetRequestPerIp, ip] as const] : []),
    ] as const) {
      const limit = await checkRateLimit(rule, subject);
      if (limit.blocked) {
        return { status: "error", error: `Muitas solicitações. Aguarde ${formatRetryAfter(limit.retryAfterSeconds)}.` };
      }
    }
    await hitRateLimit(RATE_LIMITS.passwordResetRequest, email);
    if (ip) await hitRateLimit(RATE_LIMITS.passwordResetRequestPerIp, ip);

    await auth.api.requestPasswordReset({ body: { email }, headers: await headers() });
    return { status: "sent" };
  } catch (error) {
    console.error("[recuperacao] Erro ao solicitar redefinição", error);
    return { status: "error", error: "Não foi possível processar o pedido agora. Tente novamente." };
  }
}
