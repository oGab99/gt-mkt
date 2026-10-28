"use server";

import { isAPIError } from "better-auth/api";
import { headers } from "next/headers";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db";
import { homeFor } from "@/lib/auth/session";
import { getClientIp } from "@/lib/security/request";
import {
  RATE_LIMITS,
  checkRateLimit,
  formatRetryAfter,
  hitRateLimit,
  resetRateLimit,
} from "@/lib/security/rate-limit";
import { firstErrors, loginSchema, type FieldErrors } from "@/lib/validation/auth";

export type LoginResult =
  | { ok: true; redirectTo: string }
  | { ok: false; error?: string; fieldErrors?: FieldErrors<"identifier" | "password"> };

const INVALID_CREDENTIALS = "Usuário, e-mail ou senha incorretos.";
// E-mail que nunca existe, usado para manter o mesmo custo (hash) quando o
// usuário informado não é encontrado.
const UNKNOWN_EMAIL = "nao-encontrado@invalid.invalid";

export async function loginAction(input: {
  identifier: unknown;
  password: unknown;
  remember: unknown;
}): Promise<LoginResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, fieldErrors: firstErrors(parsed.error) };
  }
  const { identifier, password, remember } = parsed.data;
  const ip = await getClientIp();

  try {
    for (const [rule, subject] of [
      [RATE_LIMITS.loginPerIdentifier, identifier],
      ...(ip ? [[RATE_LIMITS.loginPerIp, ip] as const] : []),
    ] as const) {
      const status = await checkRateLimit(rule, subject);
      if (status.blocked) {
        return {
          ok: false,
          error: `Muitas tentativas de acesso. Aguarde ${formatRetryAfter(status.retryAfterSeconds)} e tente novamente.`,
        };
      }
    }

    const email = identifier.includes("@")
      ? identifier
      : ((await prisma.user.findUnique({ where: { username: identifier }, select: { email: true } }))?.email ??
        UNKNOWN_EMAIL);

    let userId: string;
    try {
      const result = await auth.api.signInEmail({
        body: { email, password, rememberMe: remember },
        headers: await headers(),
      });
      userId = result.user.id;
    } catch (error) {
      if (isAPIError(error)) {
        await hitRateLimit(RATE_LIMITS.loginPerIdentifier, identifier);
        if (ip) await hitRateLimit(RATE_LIMITS.loginPerIp, ip);
        return { ok: false, error: INVALID_CREDENTIALS };
      }
      throw error;
    }

    await resetRateLimit(RATE_LIMITS.loginPerIdentifier, identifier);
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { mustChangePassword: true },
    });
    return { ok: true, redirectTo: homeFor(user) };
  } catch (error) {
    console.error("[login] Erro inesperado", error);
    return { ok: false, error: "Não foi possível entrar agora. Tente novamente em instantes." };
  }
}
